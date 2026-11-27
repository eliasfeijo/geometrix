// Automatic release of a domination (spec D-4; F6 details decided by the owner
// on 2026-11-14). A player who dominates a creep releases it when they stay
// disconnected past the reconnect grace, or send no input for the domination
// timeout, both in real time. The release is a command the server emits for
// the player, logged like any other (plan section 4), so the sim keeps no
// clock for it.

import type { WorldState } from "@geometrix/sim";
import type { ServerConfig } from "./config.ts";
import type { Timers } from "./loop.ts";
import type { PlayerRow } from "./persistence.ts";
import type { WorldHost } from "./world-host.ts";
import type { Presence } from "./ws.ts";

type Seen = {
  sockets: number;
  disconnectedAt: number | null;
  lastInput: number;
};

export class PresenceTracker implements Presence {
  private readonly timers: Pick<Timers, "now">;
  private readonly config: Pick<
    ServerConfig,
    "dominationTimeoutMs" | "reconnectGraceMs"
  >;
  private readonly players = new Map<number, Seen>();

  constructor(
    timers: Pick<Timers, "now">,
    config: Pick<ServerConfig, "dominationTimeoutMs" | "reconnectGraceMs">,
  ) {
    this.timers = timers;
    this.config = config;
  }

  private seen(id: number): Seen {
    let seen = this.players.get(id);
    if (seen === undefined) {
      // Unknown so far (e.g. after a restart): the clocks start now.
      seen = {
        sockets: 0,
        disconnectedAt: this.timers.now(),
        lastInput: this.timers.now(),
      };
      this.players.set(id, seen);
    }
    return seen;
  }

  /** Whether the player has a socket open now. */
  isConnected(playerId: number): boolean {
    return (this.players.get(playerId)?.sockets ?? 0) > 0;
  }

  connected(player: PlayerRow): void {
    const seen = this.seen(player.id);
    seen.sockets += 1;
    seen.disconnectedAt = null;
  }

  disconnected(player: PlayerRow): void {
    const seen = this.seen(player.id);
    seen.sockets = Math.max(0, seen.sockets - 1);
    if (seen.sockets === 0) seen.disconnectedAt = this.timers.now();
  }

  input(player: PlayerRow): void {
    this.seen(player.id).lastInput = this.timers.now();
  }

  /** Queues a release for each dominating player of `host` past a limit. */
  check(host: WorldHost): void {
    if (host.status !== "running") return;
    const now = this.timers.now();
    for (const player of host.state.players) {
      if (player.bot || !dominates(host.state, player.id)) continue;
      if (host.queued(player.id, "release")) continue;
      const seen = this.seen(player.id);
      const gone =
        seen.disconnectedAt !== null &&
        now - seen.disconnectedAt >= this.config.reconnectGraceMs;
      const idle = now - seen.lastInput >= this.config.dominationTimeoutMs;
      if (gone || idle) host.submit(player.id, { type: "release" });
    }
  }
}

function dominates(state: WorldState, playerId: number): boolean {
  return state.creeps.some((c) => c.dominatedBy === playerId);
}
