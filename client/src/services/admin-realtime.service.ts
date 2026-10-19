import { API_BASE_URL } from "@/services/api";
import { getStoredToken, refreshSessionRequest } from "@/services/auth.service";

/**
 * Client of the authenticated Admin channel (/ws/admin). One socket for the whole Admin area.
 * The token goes in the first message, never in the URL. Messages only say which topics
 * changed; consumers refetch REST data. Polling stays as the fallback when the socket is down.
 */
export type AdminRealtimeStatus = "connecting" | "live" | "offline";
export interface AdminSignalsMessage { type: "admin.signals.changed"; occurredAt: string; topics: string[] }

type ChangeListener = (message: AdminSignalsMessage) => void;
type StatusListener = (status: AdminRealtimeStatus) => void;

const CLOSE_UNAUTHENTICATED = 4401;
const CLOSE_FORBIDDEN = 4403;

const changeListeners = new Set<ChangeListener>();
const statusListeners = new Set<StatusListener>();
let socket: WebSocket | null = null;
let status: AdminRealtimeStatus = "offline";
let reconnectTimer: number | null = null;
let attempt = 0;
let stopped = true;

function socketUrl(): string {
  const configured = import.meta.env.VITE_ADMIN_WS_URL as string | undefined;
  if (configured) return configured;
  const url = new URL(API_BASE_URL, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws/admin";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function setStatus(next: AdminRealtimeStatus) {
  if (status === next) return;
  status = next;
  statusListeners.forEach((listener) => listener(next));
}

function scheduleReconnect(delay?: number) {
  if (stopped || reconnectTimer !== null) return;
  const wait = delay ?? Math.min(30_000, 1_000 * 2 ** attempt) + Math.floor(Math.random() * 500);
  attempt += 1;
  reconnectTimer = window.setTimeout(() => { reconnectTimer = null; connect(); }, wait);
}

function connect() {
  if (stopped || socket || !navigator.onLine) return;
  const token = getStoredToken();
  if (!token) { setStatus("offline"); scheduleReconnect(); return; }
  setStatus("connecting");
  const active = new WebSocket(socketUrl());
  socket = active;
  active.addEventListener("open", () => { active.send(JSON.stringify({ type: "auth", token })); });
  active.addEventListener("message", (event) => {
    let message: { type?: string; topics?: unknown };
    try { message = JSON.parse(String(event.data)); } catch { return; }
    if (message.type === "admin.ready") { attempt = 0; setStatus("live"); return; }
    if (message.type === "admin.signals.changed" && Array.isArray(message.topics)) {
      changeListeners.forEach((listener) => listener(message as AdminSignalsMessage));
    }
  });
  active.addEventListener("close", (event) => {
    if (socket === active) socket = null;
    setStatus("offline");
    if (stopped) return;
    if (event.code === CLOSE_FORBIDDEN) return; // not an Admin anymore: stay on polling only
    if (event.code === CLOSE_UNAUTHENTICATED) {
      // Expired access token: renew the session once, then reconnect right away.
      refreshSessionRequest().then(() => scheduleReconnect(0), () => scheduleReconnect());
      return;
    }
    scheduleReconnect();
  });
}

function onOnline() { if (!stopped) { attempt = 0; connect(); } }

export function startAdminRealtime() {
  if (!stopped) return;
  stopped = false;
  attempt = 0;
  window.addEventListener("online", onOnline);
  connect();
}

export function stopAdminRealtime() {
  stopped = true;
  window.removeEventListener("online", onOnline);
  if (reconnectTimer !== null) { window.clearTimeout(reconnectTimer); reconnectTimer = null; }
  const active = socket;
  socket = null;
  active?.close(1000, "Admin area closed");
  setStatus("offline");
}

export function onAdminSignalsChanged(listener: ChangeListener): () => void {
  changeListeners.add(listener);
  return () => { changeListeners.delete(listener); };
}

export function onAdminRealtimeStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  listener(status);
  return () => { statusListeners.delete(listener); };
}
