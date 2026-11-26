import { readFileSync } from "node:fs";
import { parseBattleParams, type BattleParams } from "@geometrix/battle";
import { parseParams, type Params } from "@geometrix/sim";
import { startApp } from "../src/app.ts";
import { DEFAULT_CONFIG, type ServerConfig } from "../src/config.ts";
import { Store } from "../src/persistence.ts";
import { WorldHost } from "../src/world-host.ts";

/** The sim tests' fixed params, so balancing does not change these tests. */
export function testParams(): Params {
  return parseParams(
    JSON.parse(
      readFileSync(
        new URL("../../../packages/sim/test/params.json", import.meta.url),
        "utf8",
      ),
    ),
  );
}

/** The battle tests' fixed params, for the same reason. */
export function testBattleParams(): BattleParams {
  return parseBattleParams(
    JSON.parse(
      readFileSync(
        new URL("../../../packages/battle/test/params.json", import.meta.url),
        "utf8",
      ),
    ),
  );
}

/** The first battle between the two teams of the tests' bot world. */
export type TeamBattle = {
  /** The tick it opens in: the world stands at this tick just before. */
  openedTick: number;
  battle: number;
  /**
   * Its lowest-id creep of team 0, and of team 1, among the instance's
   * members at the opening: the opening's creeps, without the ones that
   * joined on its tick (since R F3 the defense opens with several).
   */
  team0: number;
  team1: number;
};

let firstBattle: TeamBattle | null = null;

/**
 * Where the seed-42 bot world of the server tests (both teams bots, the
 * tests' params) opens its first battle between the two teams, found by
 * stepping a world in memory once per test file (~2 s). Tests start from it
 * instead of a fixed tick and fixed ids, so a rule change that moves the
 * battle moves them along instead of breaking them.
 */
export function firstTeamBattle(): TeamBattle {
  if (firstBattle !== null) return firstBattle;
  const host = WorldHost.create(
    {
      store: new Store(":memory:"),
      config: {
        snapshotEveryTicks: 300,
        metricsEveryTicks: 60,
        chronicleWelcome: 100,
      },
    },
    {
      seed: 42,
      params: testParams(),
      battleParams: testBattleParams(),
      multiplier: 1,
      botTeams: [0, 1],
      createdAt: "2026-11-14T00:00:00.000Z",
    },
  );
  const limit = host.state.params.world.durationSeconds;
  while (host.state.tick < limit) {
    host.tick();
    for (const battle of host.state.battles) {
      if (battle.openedTick !== host.state.tick - 1) continue;
      const instance = host.junction.instances.find(
        (i) => i.battleId === battle.id,
      );
      const of = (team: number) =>
        instance?.members
          .map((m) => m.creep)
          .filter(
            (id) => host.state.creeps.find((c) => c.id === id)?.team === team,
          )
          .sort((a, b) => a - b)[0];
      const team0 = of(0);
      const team1 = of(1);
      if (team0 === undefined || team1 === undefined) continue;
      firstBattle = {
        openedTick: battle.openedTick,
        battle: battle.id,
        team0,
        team1,
      };
      return firstBattle;
    }
  }
  throw new Error("firstTeamBattle: the bot world opened no team battle");
}

/** A clock and setTimeout the test moves by hand. */
export class FakeTimers {
  private time = 0;
  private nextId = 1;
  private queue: { id: number; at: number; fn: () => void }[] = [];

  now = (): number => this.time;

  setTimeout = (fn: () => void, ms: number): unknown => {
    const id = this.nextId++;
    this.queue.push({ id, at: this.time + ms, fn });
    return id;
  };

  clearTimeout = (handle: unknown): void => {
    this.queue = this.queue.filter((t) => t.id !== handle);
  };

  /** Moves the clock by `ms`, firing each due timer at its own time. */
  advance(ms: number): void {
    const end = this.time + ms;
    for (;;) {
      this.queue.sort((a, b) => a.at - b.at || a.id - b.id);
      const next = this.queue[0];
      if (next === undefined || next.at > end) break;
      this.queue.shift();
      this.time = Math.max(this.time, next.at);
      next.fn();
    }
    this.time = end;
  }

  /** Moves the clock without firing anything (a blocked event loop). */
  stall(ms: number): void {
    this.time += ms;
  }
}

/** The app on a free port, with a memory store and a clock that never moves. */
export async function testApp(
  config: Partial<ServerConfig> = {},
  store = new Store(":memory:"),
  params = testParams(),
) {
  const timers = new FakeTimers();
  const logs: string[] = [];
  const app = await startApp({
    store,
    config: { ...DEFAULT_CONFIG, port: 0, dbFile: ":memory:", ...config },
    timers,
    params,
    battleParams: testBattleParams(),
    clock: () => "2026-11-14T00:00:00.000Z",
    log: (line) => logs.push(line),
  });
  const base = `http://127.0.0.1:${app.port}`;
  const post = async (path: string, body: unknown) => {
    const res = await fetch(base + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json()) as never };
  };
  const get = async (path: string) => {
    const res = await fetch(base + path);
    return { status: res.status, res };
  };
  return { app, store, timers, base, post, get, logs };
}
