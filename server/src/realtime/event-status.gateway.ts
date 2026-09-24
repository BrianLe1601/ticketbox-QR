import type { Server as HttpServer } from "node:http";

import WebSocket, { WebSocketServer } from "ws";

import type { EventLifecycleSyncResult } from "../modules/events/event-lifecycle.repository.js";
import {
  publishEventStatusChanges,
  subscribeToEventStatusChanges,
} from "../modules/events/event-status.publisher.js";

const EVENT_SOCKET_PATH = "/ws/events";
const HEARTBEAT_INTERVAL_MS = 30_000;

interface TrackedWebSocket extends WebSocket {
  isAlive: boolean;
}

export interface EventRealtimeGateway {
  broadcastLifecycleUpdate: (result: EventLifecycleSyncResult) => void;
  close: () => Promise<void>;
}

export function createEventRealtimeGateway(server: HttpServer): EventRealtimeGateway {
  const webSocketServer = new WebSocketServer({
    server,
    path: EVENT_SOCKET_PATH,
    perMessageDeflate: false,
  });

  webSocketServer.on("connection", (socket: TrackedWebSocket) => {
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });
    socket.on("error", (error) => {
      console.error("[event-realtime] WebSocket client error:", error);
    });
  });

  const heartbeat = setInterval(() => {
    for (const client of webSocketServer.clients) {
      const socket = client as TrackedWebSocket;
      if (!socket.isAlive) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      socket.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);
  heartbeat.unref();

  const unsubscribe = subscribeToEventStatusChanges((changes) => {
    const message = JSON.stringify({
      type: "event.lifecycle.updated",
      occurredAt: new Date().toISOString(),
      changes,
    });
    for (const client of webSocketServer.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    }
  });

  return {
    broadcastLifecycleUpdate: (result) => {
      publishEventStatusChanges(result.changes);
    },
    close: async () => {
      clearInterval(heartbeat);
      unsubscribe();
      for (const client of webSocketServer.clients) client.terminate();
      await new Promise<void>((resolve) => {
        webSocketServer.close(() => resolve());
      });
    },
  };
}
