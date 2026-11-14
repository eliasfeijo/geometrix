// WebSocket (plan section 7). A client connects to /ws?token=..., gets the
// welcome with the static map and the last view sent to its team, then sends
// commands and gets an ack (with the tick the command will apply on) or a
// reject. After ticks, each team's stream sends the delta of its view to the
// team's sockets, at most once per broadcastIntervalMs (M1.5 plan section 5).

import type { Server } from "node:http";
import {
  parseClientMessage,
  PROTOCOL_VERSION,
  toStaticMap,
  type ServerMessage,
  type WelcomeMessage,
} from "@geometrix/protocol";
import { WebSocket, WebSocketServer } from "ws";
import { hashToken } from "./http.ts";
import type { Timers } from "./loop.ts";
import type { PlayerRow, Store } from "./persistence.ts";
import { TeamStream } from "./stream.ts";
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
  viewHashEveryTicks: number;
  deltaBufferMs: number;
  /** Told about connections and inputs (domination release, F6). */
  presence?: Presence;
  /** Server log, for incidents such as a resync (default console.log). */
  log?: (line: string) => void;
};

export function attachWebSocket(server: Server, context: WsContext) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const broadcasters = new Map<number, Broadcaster>();

  const broadcasterOf = (host: WorldHost) => {
    let b = broadcasters.get(host.id);
    if (b === undefined) {
      b = new Broadcaster(host, context);
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
    const stream = broadcaster.stream(player.team);
    const missed = resumeFrom(stream, req.url);
    if (missed === null) {
      send(socket, welcome(host, player, stream));
    } else {
      for (const json of missed) socket.send(json);
    }
    broadcaster.add(socket, player.team);
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
      if (message.type === "resync") {
        // Spec S-6: the full view again, and the incident in the log.
        (context.log ?? console.log)(
          `resync world=${host.id} team=${player.team} player=${player.id} tick=${host.state.tick} seq=${message.seq} reason=${message.reason}`,
        );
        send(socket, welcome(host, player, stream));
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

function welcome(
  host: WorldHost,
  player: PlayerRow,
  stream: TeamStream,
): WelcomeMessage {
  const { seq, view, status } = stream.lastView();
  return {
    type: "welcome",
    protocol: PROTOCOL_VERSION,
    worldId: host.id,
    playerId: player.id,
    team: player.team,
    status,
    multiplier: host.multiplier,
    params: host.state.params,
    map: toStaticMap(host.state),
    cores: host.state.teams.map((t) => t.core),
    stream: stream.id,
    seq,
    view,
  };
}

/**
 * The deltas a reconnecting client missed, from `&stream=…&seq=…` in the URL
 * (plan R5), or null when it gets a welcome: a first connection, or a seq the
 * stream can no longer resume from.
 */
function resumeFrom(
  stream: TeamStream,
  url: string | undefined,
): string[] | null {
  const params = new URL(url ?? "", "http://localhost").searchParams;
  const id = params.get("stream");
  const raw = params.get("seq");
  if (id === null || raw === null || !/^\d+$/.test(raw)) return null;
  return stream.since(id, Number(raw));
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
 * Sends each team's view delta after the world's ticks, at most once per
 * interval: a tick right after a send waits for the interval, and the send
 * carries the latest state then. Every team's stream advances, with sockets
 * or not (plan R7).
 */
class Broadcaster {
  /** Each open socket and its team. */
  private readonly sockets = new Map<WebSocket, number>();
  private readonly streams: TeamStream[];
  private readonly host: WorldHost;
  private readonly timers: Timers;
  private readonly intervalMs: number;
  private lastSent = -Infinity;
  private pending: unknown = null;

  constructor(host: WorldHost, context: WsContext) {
    this.host = host;
    this.timers = context.timers;
    this.intervalMs = context.broadcastIntervalMs;
    const options = {
      hashEveryTicks: context.viewHashEveryTicks,
      bufferMs: context.deltaBufferMs,
    };
    this.streams = host.state.teams.map(
      (team) => new TeamStream(host.state, team.id, host.status, options),
    );
    host.onTick(() => this.ticked());
  }

  stream(team: number): TeamStream {
    return this.streams[team]!;
  }

  add(socket: WebSocket, team: number): void {
    this.sockets.set(socket, team);
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
    const now = this.timers.now();
    this.lastSent = now;
    const { state, status } = this.host;
    const messages = this.streams.map((s) => s.advance(state, status, now));
    for (const [socket, team] of this.sockets) {
      if (socket.readyState === WebSocket.OPEN) socket.send(messages[team]!);
    }
  }
}
