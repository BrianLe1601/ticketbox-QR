import { createServer, type Server } from "node:http";

import WebSocket from "ws";
import { afterEach, expect, it } from "vitest";

import {
  createEventRealtimeGateway,
  type EventRealtimeGateway,
} from "../src/realtime/event-status.gateway.js";

let server: Server | undefined;
let gateway: EventRealtimeGateway | undefined;
let client: WebSocket | undefined;

afterEach(async () => {
  client?.terminate();
  await gateway?.close();
  await new Promise<void>((resolve) => {
    if (!server?.listening) return resolve();
    server.close(() => resolve());
  });
  client = undefined;
  gateway = undefined;
  server = undefined;
});

it("broadcasts committed Event lifecycle changes over /ws/events", async () => {
  server = createServer();
  gateway = createEventRealtimeGateway(server);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server has no TCP port");

  client = new WebSocket(`ws://127.0.0.1:${address.port}/ws/events`);
  await new Promise<void>((resolve, reject) => {
    client!.once("open", resolve);
    client!.once("error", reject);
  });

  const received = new Promise<unknown>((resolve, reject) => {
    client!.once("message", (data) => {
      try {
        resolve(JSON.parse(data.toString()));
      } catch (error) {
        reject(error);
      }
    });
  });
  gateway.broadcastLifecycleUpdate({
    started: 1,
    completed: 0,
    changes: [{ eventId: 88, status: "ongoing" }],
  });

  await expect(received).resolves.toMatchObject({
    type: "event.lifecycle.updated",
    changes: [{ eventId: 88, status: "ongoing" }],
  });
});
