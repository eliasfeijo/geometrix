// WebSocket (plan section 7). A client connects to /ws?token=..., gets the
// welcome with the static map, then sends commands and gets an ack (with the
// tick the command will apply on) or a reject. After ticks, the whole dynamic
// state goes to the world's sockets, at most once per broadcastIntervalMs.

import type { Server } from "node:http";
import {
  parseClientMessage,
  toDynamicState,
  toStaticMap,
  type ServerMessage,
  type WelcomeMessage,
} from "@geometrix/protocol";
import { WebSocket, WebSocketServer } from "ws";
import { hashToken } from "./http.ts";
import type { Timers } from "./loop.ts";
import type { PlayerRow, Store } from "./persistence.ts";
import type { WorldHost } from "./world-host.ts";
import type { Worlds } from "./worlds.ts";

/** Close codes in the private range (4000-4999). */
export const CLOSE = { unauthorized: 4401, worldNotHosted: 4404 } as const;

export type Presence = {
  connected(player: PlayerRow): void;
  disconnected(player: PlayerRow): void;
  input(player: PlayerRow): void;
};

export type WsContext = {
  store: Store;
  worlds: Worlds;
  timers: Timers;
  broadcastIntervalMs: number;
  /** Told about connections and inputs (domination release, F6). */
  presence?: Presence;
};

export function attachWebSocket(server: Server, context: WsContext) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const broadcasters = new Map<number, Broadcaster>();

  const broadcasterOf = (host: WorldHost) => {
    let b = broadcasters.get(host.id);
    if (b === undefined) {
      b = new Broadcaster(host, context.timers, context.broadcastIntervalMs);
      broadcasters.set(host.id, b);
    }
    return b;
  };

  wss.on("connection", (socket, req) => {
    const token = new URL(req.url ?? "", "http://localhost").searchParams.get(
      "token",
    );
    const player =
      token === null
        ? undefined
        : context.store.playerByTokenHash(hashToken(token));
    if (player === undefined) {
      socket.close(CLOSE.unauthorized, "unauthorized");
      return;
    }
    const host = context.worlds.get(player.worldId);
    if (host === undefined) {
      socket.close(CLOSE.worldNotHosted, "world not hosted");
      return;
    }
    const broadcaster = broadcasterOf(host);
    send(socket, welcome(host, player));
    broadcaster.add(socket);
    context.presence?.connected(player);

    socket.on("message", (data) => {
      context.presence?.input(player);
      const raw = data.toString();
      const message = parseClientMessage(raw);
      if (message === null) {
        send(socket, {
          type: "reject",
          ref: refOf(raw),
          reason: "invalidMessage",
        });
        return;
      }
      const tick = host.state.tick;
      const reason = host.submit(player.id, message.command);
      send(
        socket,
        reason === null
          ? { type: "ack", ref: message.ref, tick }
          : { type: "reject", ref: message.ref, reason },
      );
    });
    socket.on("close", () => {
      broadcaster.remove(socket);
      context.presence?.disconnected(player);
    });
  });

  return {
    close: () => {
      for (const b of broadcasters.values()) b.stop();
      for (const client of wss.clients) client.terminate();
      wss.close();
    },
  };
}

function welcome(host: WorldHost, player: PlayerRow): WelcomeMessage {
  return {
    type: "welcome",
    worldId: host.id,
    playerId: player.id,
    team: player.team,
    status: host.status,
    multiplier: host.multiplier,
    params: host.state.params,
    map: toStaticMap(host.state),
    cores: host.state.teams.map((t) => t.core),
    state: toDynamicState(host.state),
  };
}

/** The ref of a message that failed validation, or -1 when there is none. */
function refOf(raw: string): number {
  try {
    const ref = (JSON.parse(raw) as { ref?: unknown }).ref;
    return typeof ref === "number" && Number.isSafeInteger(ref) ? ref : -1;
  } catch {
    return -1;
  }
}

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === WebSocket.OPEN)
    socket.send(JSON.stringify(message));
}

/**
 * Sends a world's state after its ticks, at most once per interval: a tick
 * right after a send waits for the interval, and the send carries the latest
 * state then.
 */
class Broadcaster {
  private readonly sockets = new Set<WebSocket>();
  private readonly host: WorldHost;
  private readonly timers: Timers;
  private readonly intervalMs: number;
  private lastSent = -Infinity;
  private pending: unknown = null;

  constructor(host: WorldHost, timers: Timers, intervalMs: number) {
    this.host = host;
    this.timers = timers;
    this.intervalMs = intervalMs;
    host.onTick(() => this.ticked());
  }

  add(socket: WebSocket): void {
    this.sockets.add(socket);
  }

  remove(socket: WebSocket): void {
    this.sockets.delete(socket);
  }

  stop(): void {
    if (this.pending !== null) this.timers.clearTimeout(this.pending);
    this.pending = null;
  }

  private ticked(): void {
    if (this.pending !== null) return;
    const wait = this.lastSent + this.intervalMs - this.timers.now();
    if (wait <= 0) {
      this.flush();
    } else {
      this.pending = this.timers.setTimeout(() => {
        this.pending = null;
        this.flush();
      }, wait);
    }
  }

  private flush(): void {
    this.lastSent = this.timers.now();
    if (this.sockets.size === 0) return;
    const message = JSON.stringify({
      type: "state",
      state: toDynamicState(this.host.state),
      status: this.host.status,
    } satisfies ServerMessage);
    for (const socket of this.sockets) {
      if (socket.readyState === WebSocket.OPEN) socket.send(message);
    }
  }
}
