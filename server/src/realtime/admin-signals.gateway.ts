import type { IncomingMessage, Server as HttpServer } from "node:http";

import jwt from "jsonwebtoken";
import WebSocket, { WebSocketServer } from "ws";

import type { AdminSignalFingerprint, AdminSignalTopic } from "../modules/dashboard/admin-dashboard.repository.js";
import { subscribeToEventStatusChanges } from "../modules/events/event-status.publisher.js";
import type { TokenPayload } from "../utils/jwt.js";
import { registerWebSocketRoute } from "./upgrade-router.js";

/**
 * Authenticated Admin realtime channel (/ws/admin).
 *
 * - Recipients: every connected, active Admin. Authentication alone is not enough; the
 *   account is re-read from the database and must be an active admin.
 * - Authorization: the access token arrives in the first message (never in the URL, so it
 *   cannot reach access logs), within AUTH_TIMEOUT_MS. The socket closes when the token
 *   expires; the client refreshes the session and reconnects.
 * - Event source: while at least one Admin is connected, a read-only fingerprint of the task
 *   and Dashboard figures is compared every POLL_MS; Event lifecycle pushes are forwarded too.
 * - Delivery: only `{ type, occurredAt, topics }`. Clients refetch REST data, exactly like
 *   /ws/events; the payload carries no business data. In-process, single instance only.
 */
export const ADMIN_SOCKET_PATH = "/ws/admin";

export const CLOSE = { badMessage: 4400, unauthenticated: 4401, forbidden: 4403 } as const;

export interface AdminSignalsDeps {
  verifyToken: (token: string) => TokenPayload;
  findActiveAdmin: (userId: number) => Promise<boolean>;
  fingerprint: () => Promise<AdminSignalFingerprint>;
  /** Exact browser origins allowed to open the socket (CLIENT_URL). Missing Origin is allowed:
   *  non-browser clients still need a valid Admin token. */
  allowedOrigins: string[];
  pollMs?: number;
  authTimeoutMs?: number;
  heartbeatMs?: number;
  log?: (message: string) => void;
}

interface AdminSocket extends WebSocket {
  isAlive: boolean;
  userId: number | null;
  authTimer?: NodeJS.Timeout;
  expiryTimer?: NodeJS.Timeout;
}

export interface AdminSignalsGateway {
  /** Push a change now (used by tests and in-process producers). */
  notify: (topics: Array<AdminSignalTopic | "eventLifecycle">) => void;
  /** Compare the fingerprint once (the poller calls this). */
  check: () => Promise<void>;
  close: () => Promise<void>;
}

export function changedTopics(previous: AdminSignalFingerprint | null, next: AdminSignalFingerprint): AdminSignalTopic[] {
  if (!previous) return [];
  return (Object.keys(next) as AdminSignalTopic[]).filter((topic) => previous[topic] !== next[topic]);
}

export function createAdminSignalsGateway(server: HttpServer, deps: AdminSignalsDeps): AdminSignalsGateway {
  const pollMs = deps.pollMs ?? 5_000;
  const authTimeoutMs = deps.authTimeoutMs ?? 5_000;
  const log = deps.log ?? ((message: string) => console.warn(`[admin-realtime] ${message}`));
  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false, maxPayload: 4096 });
  let lastFingerprint: AdminSignalFingerprint | null = null;
  let pollTimer: NodeJS.Timeout | null = null;
  let checking = false;

  const authenticated = () => [...wss.clients].filter((client) => (client as AdminSocket).userId !== null && client.readyState === WebSocket.OPEN);

  function broadcast(topics: string[]) {
    if (topics.length === 0) return;
    const message = JSON.stringify({ type: "admin.signals.changed", occurredAt: new Date().toISOString(), topics });
    for (const client of authenticated()) client.send(message);
  }

  async function check() {
    if (checking) return;
    checking = true;
    try {
      const next = await deps.fingerprint();
      broadcast(changedTopics(lastFingerprint, next));
      lastFingerprint = next;
    } catch {
      log("fingerprint query failed; will retry");
    } finally {
      checking = false;
    }
  }

  function syncPolling() {
    const active = authenticated().length > 0;
    if (active && !pollTimer) {
      void check();
      pollTimer = setInterval(() => { void check(); }, pollMs);
      pollTimer.unref();
    } else if (!active && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
      lastFingerprint = null;
    }
  }

  function closeSocket(socket: AdminSocket, code: number, reason: string) {
    clearTimeout(socket.authTimer);
    clearTimeout(socket.expiryTimer);
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close(code, reason);
  }

  async function authenticate(socket: AdminSocket, token: unknown) {
    if (typeof token !== "string" || token.length === 0 || token.length > 4096) {
      closeSocket(socket, CLOSE.unauthenticated, "Token required");
      return;
    }
    let payload: TokenPayload;
    try {
      payload = deps.verifyToken(token);
    } catch {
      closeSocket(socket, CLOSE.unauthenticated, "Invalid or expired token");
      return;
    }
    if (payload.role !== "admin") {
      closeSocket(socket, CLOSE.forbidden, "Admin only");
      return;
    }
    let active = false;
    try { active = await deps.findActiveAdmin(payload.userId); } catch { active = false; }
    if (!active) {
      closeSocket(socket, CLOSE.forbidden, "Admin only");
      return;
    }
    clearTimeout(socket.authTimer);
    clearTimeout(socket.expiryTimer);
    socket.userId = payload.userId;
    const decoded = jwt.decode(token) as { exp?: number } | null;
    const expiresAt = decoded?.exp ? decoded.exp * 1000 : null;
    if (expiresAt) {
      socket.expiryTimer = setTimeout(() => closeSocket(socket, CLOSE.unauthenticated, "Token expired"), Math.max(0, expiresAt - Date.now()));
      socket.expiryTimer.unref();
    }
    socket.send(JSON.stringify({ type: "admin.ready", expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null }));
    syncPolling();
  }

  wss.on("connection", (raw: WebSocket) => {
    const socket = raw as AdminSocket;
    socket.isAlive = true;
    socket.userId = null;
    socket.authTimer = setTimeout(() => closeSocket(socket, CLOSE.unauthenticated, "Authentication timeout"), authTimeoutMs);
    socket.authTimer.unref();
    socket.on("pong", () => { socket.isAlive = true; });
    socket.on("message", (data) => {
      let message: { type?: unknown; token?: unknown };
      try { message = JSON.parse(String(data)); } catch { closeSocket(socket, CLOSE.badMessage, "Bad message"); return; }
      if (message?.type === "auth") { void authenticate(socket, message.token); return; }
      if (socket.userId === null) closeSocket(socket, CLOSE.unauthenticated, "Authenticate first");
      // Authenticated clients have nothing else to send; other messages are ignored.
    });
    socket.on("close", () => {
      clearTimeout(socket.authTimer);
      clearTimeout(socket.expiryTimer);
      socket.userId = null;
      syncPolling();
    });
    socket.on("error", () => { log("client socket error"); });
  });

  const unregister = registerWebSocketRoute(server, ADMIN_SOCKET_PATH, (request: IncomingMessage, socket, head) => {
    const origin = request.headers.origin;
    if (origin && !deps.allowedOrigins.includes(origin)) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (client) => wss.emit("connection", client, request));
  });

  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      const socket = client as AdminSocket;
      if (!socket.isAlive) { socket.terminate(); continue; }
      socket.isAlive = false;
      socket.ping();
    }
  }, deps.heartbeatMs ?? 30_000);
  heartbeat.unref();

  // Event lifecycle changes (published -> ongoing -> completed) reach Admins immediately.
  const unsubscribeLifecycle = subscribeToEventStatusChanges(() => broadcast(["eventLifecycle"]));

  return {
    notify: (topics) => broadcast(topics),
    check,
    close: async () => {
      clearInterval(heartbeat);
      if (pollTimer) clearInterval(pollTimer);
      unsubscribeLifecycle();
      unregister();
      for (const client of wss.clients) client.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    },
  };
}
