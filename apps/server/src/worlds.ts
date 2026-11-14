// The worlds this process hosts, each with its tick loop (plan section 7).

import { randomInt } from "node:crypto";
import type { CreateWorldRequest } from "@geometrix/protocol";
import type { Params } from "@geometrix/sim";
import type { ServerConfig } from "./config.ts";
import { TickLoop, type Timers } from "./loop.ts";
import type { Store } from "./persistence.ts";
import type { PresenceTracker } from "./presence.ts";
import { WorldHost } from "./world-host.ts";

export class Worlds {
  private readonly store: Store;
  private readonly config: ServerConfig;
  private readonly timers: Timers;
  private readonly params: Params;
  private readonly presence: PresenceTracker;
  private readonly hosted = new Map<
    number,
    { host: WorldHost; loop: TickLoop }
  >();

  /** `params` are the ones new worlds start with. */
  constructor(
    store: Store,
    config: ServerConfig,
    timers: Timers,
    params: Params,
    presence: PresenceTracker,
  ) {
    this.store = store;
    this.config = config;
    this.timers = timers;
    this.params = params;
    this.presence = presence;
  }

  get(id: number): WorldHost | undefined {
    return this.hosted.get(id)?.host;
  }

  /** Creates a world and starts its clock. */
  create(request: CreateWorldRequest, createdAt: string): WorldHost {
    const host = WorldHost.create(
      { store: this.store, config: this.config },
      {
        seed: request.seed ?? randomInt(2 ** 32),
        params: this.params,
        multiplier: request.multiplier ?? 1,
        botTeams: request.botTeams ?? [],
        createdAt,
      },
    );
    this.host(host);
    return host;
  }

  /** Starts hosting `host`; its loop runs while the world is running. */
  host(host: WorldHost): void {
    const loop = new TickLoop(
      host,
      this.timers,
      this.config.maxCatchUpTicks,
      () => this.presence.check(host),
    );
    this.hosted.set(host.id, { host, loop });
    loop.start();
  }

  /** Stops every loop and snapshots the running worlds (clean shutdown). */
  stopAll(): void {
    for (const { host, loop } of this.hosted.values()) {
      loop.stop();
      if (host.status === "running") host.snapshot();
    }
  }
}
