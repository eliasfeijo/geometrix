// The worlds this process hosts, each with its tick loop (plan section 7).

import { randomInt } from "node:crypto";
import type { BattleParams } from "@geometrix/battle";
import type { CreateWorldRequest } from "@geometrix/protocol";
import type { Params } from "@geometrix/sim";
import type { ServerConfig } from "./config.ts";
import { BattleClock } from "./battle-clock.ts";
import { Holds } from "./holds.ts";
import { TickLoop, type Timers } from "./loop.ts";
import type { Store } from "./persistence.ts";
import type { PresenceTracker } from "./presence.ts";
import { RecoveryError, WorldHost } from "./world-host.ts";

export class Worlds {
  private readonly store: Store;
  private readonly config: ServerConfig;
  private readonly timers: Timers;
  private readonly params: Params;
  private readonly battleParams: BattleParams;
  private readonly presence: PresenceTracker;
  private readonly hosted = new Map<
    number,
    { host: WorldHost; loop: TickLoop; clock: BattleClock; holds: Holds }
  >();

  /** `params` and `battleParams` are the ones new worlds start with. */
  constructor(
    store: Store,
    config: ServerConfig,
    timers: Timers,
    params: Params,
    battleParams: BattleParams,
    presence: PresenceTracker,
  ) {
    this.store = store;
    this.config = config;
    this.timers = timers;
    this.params = params;
    this.battleParams = battleParams;
    this.presence = presence;
  }

  get(id: number): WorldHost | undefined {
    return this.hosted.get(id)?.host;
  }

  /** A hosted world's battle holds (R plan P11). */
  holds(id: number): Holds | undefined {
    return this.hosted.get(id)?.holds;
  }

  /** Creates a world and starts its clock. */
  create(request: CreateWorldRequest, createdAt: string): WorldHost {
    const host = WorldHost.create(
      { store: this.store, config: this.config },
      {
        seed: request.seed ?? randomInt(2 ** 32),
        params: this.params,
        battleParams: this.battleParams,
        multiplier: request.multiplier ?? 1,
        botTeams: request.botTeams ?? [],
        botDifficulty: request.botDifficulty,
        createdAt,
      },
    );
    this.host(host);
    return host;
  }

  /**
   * Hosts every stored world again (ADR-0004): running ones resume their
   * clock, ended ones stay viewable. A world that cannot be recovered (other
   * sim version, broken snapshot) is skipped; returns why, per world.
   */
  recoverAll(): { worldId: number; error: string }[] {
    const failures: { worldId: number; error: string }[] = [];
    for (const row of this.store.worlds()) {
      try {
        this.host(
          WorldHost.recover(
            { store: this.store, config: this.config },
            row,
            this.battleParams,
          ),
        );
      } catch (error) {
        if (!(error instanceof RecoveryError)) throw error;
        failures.push({ worldId: row.id, error: error.message });
      }
    }
    return failures;
  }

  /**
   * Starts hosting `host`; its loop and its battle clock run while the world
   * is running.
   */
  host(host: WorldHost): void {
    const loop = new TickLoop(
      host,
      this.timers,
      this.config.maxCatchUpTicks,
      () => this.presence.check(host),
    );
    const { ticksPerSecond } = host.junction.battleParams.tick;
    const clock = new BattleClock(
      host,
      this.timers,
      1000 / ticksPerSecond,
      this.config.maxCatchUpBattleTicks,
    );
    const holds = new Holds(host, this.timers, (playerId) =>
      this.presence.isConnected(playerId),
    );
    this.hosted.set(host.id, { host, loop, clock, holds });
    loop.start();
    clock.start();
  }

  /** Stops every loop and snapshots the running worlds (clean shutdown). */
  stopAll(): void {
    for (const { host, loop, clock, holds } of this.hosted.values()) {
      loop.stop();
      clock.stop();
      holds.stop();
      if (host.status === "running") host.snapshot();
    }
  }
}
