import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";

export type UpgradeHandler = (request: IncomingMessage, socket: Duplex, head: Buffer) => void;

/**
 * One "upgrade" listener per HTTP server, dispatching by pathname. A ws WebSocketServer created
 * with `{ server, path }` answers 400 to every upgrade whose path is not its own, so two gateways
 * on the same server would break each other; gateways therefore use `noServer` and register here.
 */
const routers = new WeakMap<HttpServer, Map<string, UpgradeHandler>>();

export function registerWebSocketRoute(server: HttpServer, path: string, handler: UpgradeHandler): () => void {
  let routes = routers.get(server);
  if (!routes) {
    const table = new Map<string, UpgradeHandler>();
    routes = table;
    routers.set(server, table);
    server.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      let pathname = "";
      try {
        pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      } catch {
        pathname = "";
      }
      const route = table.get(pathname);
      if (!route) {
        socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }
      route(request, socket, head);
    });
  }
  if (routes.has(path)) throw new Error(`WebSocket route already registered: ${path}`);
  routes.set(path, handler);
  return () => { routes?.delete(path); };
}
