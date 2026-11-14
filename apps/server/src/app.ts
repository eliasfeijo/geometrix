// Wires the server together: the hosted worlds, HTTP and WebSocket.

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Params } from "@geometrix/sim";
import type { ServerConfig } from "./config.ts";
import { createHttpHandler } from "./http.ts";
import type { Timers } from "./loop.ts";
import type { Store } from "./persistence.ts";
import { PresenceTracker } from "./presence.ts";
import { Worlds } from "./worlds.ts";
import { attachWebSocket } from "./ws.ts";

export type AppOptions = {
  store: Store;
  config: ServerConfig;
  timers: Timers;
  /** Params for new worlds. */
  params: Params;
  /** ISO timestamp, for new worlds. */
  clock: () => string;
};

export type App = {
  worlds: Worlds;
  server: Server;
  /** The port it listens on (config.port, or the one picked for 0). */
  port: number;
  /** Stops the loops, snapshots the running worlds, closes the sockets. */
  close(): Promise<void>;
};

export async function startApp(options: AppOptions): Promise<App> {
  const { store, config, timers, params, clock } = options;
  const presence = new PresenceTracker(timers, config);
  const worlds = new Worlds(store, config, timers, params, presence);
  const server = createServer(
    createHttpHandler({ store, worlds, staticDir: config.staticDir, clock }),
  );
  const ws = attachWebSocket(server, {
    store,
    worlds,
    timers,
    broadcastIntervalMs: config.broadcastIntervalMs,
    presence,
  });
  await new Promise<void>((done) => server.listen(config.port, done));
  return {
    worlds,
    server,
    port: (server.address() as AddressInfo).port,
    close: async () => {
      worlds.stopAll();
      ws.close();
      server.closeAllConnections();
      await new Promise<void>((done) => server.close(() => done()));
    },
  };
}
