import {
  eventsFor,
  SIM_VERSION,
  SYSTEM_PLAYER_ID,
  type SimEvent,
} from "@geometrix/sim";
import { describe, expect, test } from "vitest";
import { stateHash } from "../src/hash.ts";
import { Store } from "../src/persistence.ts";
import { rebuild } from "../src/soak.ts";
import { WorldHost, type HostContext } from "../src/world-host.ts";
import { testBattleParams, testParams } from "./helpers.ts";

const params = testParams();

function setup(
  botTeams: number[] = [],
  config: HostContext["config"] = {
    snapshotEveryTicks: 300,
    metricsEveryTicks: 60,
    chronicleWelcome: 100,
  },
) {
  const context: HostContext = { store: new Store(":memory:"), config };
  const host = WorldHost.create(context, {
    seed: 42,
    params,
    battleParams: testBattleParams(),
    multiplier: 1,
    botTeams,
    createdAt: "2026-11-14T00:00:00.000Z",
  });
  return { host, store: context.store };
}

/** A human player stored and joined on `team`. */
function human(host: WorldHost, store: Store, team: number, token: string) {
  const id = store.addPlayer({
    worldId: host.id,
    team,
    name: token,
    tokenHash: token,
    bot: false,
  });
  expect(host.submit(id, { type: "join", team, bot: false })).toBeNull();
  return id;
}

describe("WorldHost", () => {
  test("stores the new world with a snapshot of tick 0", () => {
    const { host, store } = setup();
    expect(store.world(host.id)).toMatchObject({ seed: 42, tick: 0 });
    expect(store.latestSnapshot(host.id)?.tick).toBe(0);
  });

  test("an accepted command is logged with the tick it applied on and a seq", () => {
    const { host, store } = setup();
    const ana = human(host, store, 0, "a");
    host.tick();
    const creep = host.state.creeps.find((c) => c.team === 0)!;
    expect(
      host.submit(ana, { type: "dominate", creepId: creep.id }),
    ).toBeNull();
    expect(host.submit(ana, { type: "release" })).toBe("notDominating");
    host.tick();
    expect(store.commandsFrom(host.id, 0)).toEqual([
      {
        tick: 0,
        seq: 0,
        playerId: ana,
        command: { type: "join", team: 0, bot: false },
      },
      {
        tick: 1,
        seq: 0,
        playerId: ana,
        command: { type: "dominate", creepId: creep.id },
      },
    ]);
    expect(creep.dominatedBy).toBe(ana);
    expect(store.world(host.id)!.tick).toBe(2);
  });

  test("bots join on tick 0, then decide on tick 1 and every minute", () => {
    const { host, store } = setup([0, 1]);
    host.tick();
    expect(host.state.players.map((p) => [p.team, p.bot])).toEqual([
      [0, true],
      [1, true],
    ]);
    for (let i = 1; i < 200; i++) host.tick();
    const bots = new Set(host.state.players.map((p) => p.id));
    const ticks = store
      .commandsFrom(host.id, 1)
      .filter((c) => bots.has(c.playerId))
      .map((c) => c.tick);
    expect(ticks).toContain(1);
    expect(ticks.every((t) => t % 60 === 1)).toBe(true);
  });

  test("a team takes 3 humans, counting joins queued for the same tick", () => {
    const { host, store } = setup([0]);
    for (const token of ["a", "b", "c"]) human(host, store, 0, token);
    const fourth = store.addPlayer({
      worldId: host.id,
      team: 0,
      name: "d",
      tokenHash: "d",
      bot: false,
    });
    expect(host.submit(fourth, { type: "join", team: 0, bot: false })).toBe(
      "teamFull",
    );
    host.tick();
    expect(host.submit(fourth, { type: "join", team: 0, bot: false })).toBe(
      "teamFull",
    );
    expect(
      host.submit(fourth, { type: "join", team: 1, bot: false }),
    ).toBeNull();
  });

  test("snapshots and samples metrics at their intervals", () => {
    const { host, store } = setup([], {
      snapshotEveryTicks: 10,
      metricsEveryTicks: 4,
      chronicleWelcome: 100,
    });
    for (let i = 0; i < 12; i++) host.tick();
    expect(store.latestSnapshot(host.id)?.tick).toBe(10);
    const ticks = [...new Set(store.metrics(host.id).map((m) => m.tick))];
    expect(ticks).toEqual([4, 8, 12]);
  });

  test("ends at the world duration (spec M-4)", () => {
    const short = { ...params, world: { ...params.world, durationSeconds: 5 } };
    const context: HostContext = {
      store: new Store(":memory:"),
      config: {
        snapshotEveryTicks: 300,
        metricsEveryTicks: 60,
        chronicleWelcome: 100,
      },
    };
    const host = WorldHost.create(context, {
      seed: 1,
      params: short,
      battleParams: testBattleParams(),
      multiplier: 1,
      botTeams: [],
      createdAt: "2026-11-14T00:00:00.000Z",
    });
    for (let i = 0; i < 8; i++) host.tick();
    expect(host.state.tick).toBe(5);
    expect(host.status).toBe("ended");
    expect(context.store.world(host.id)!.status).toBe("ended");
    expect(context.store.latestSnapshot(host.id)?.tick).toBe(5);
    expect(host.submit(1, { type: "release" })).toBe("worldEnded");
  });

  test("notifies listeners after each tick", () => {
    const { host } = setup();
    const seen: number[] = [];
    host.onTick(() => seen.push(host.state.tick));
    host.tick();
    host.tick();
    expect(seen).toEqual([1, 2]);
  });

  test("hands listeners the tick's events and keeps each team's latest", () => {
    const { host } = setup([0, 1], {
      snapshotEveryTicks: 300,
      metricsEveryTicks: 60,
      chronicleWelcome: 3,
    });
    const all: SimEvent[] = [];
    host.onTick((events) => all.push(...events));
    while (all.filter((e) => e.teams.includes(1)).length < 5) host.tick();
    for (const team of [0, 1]) {
      expect(host.chronicle(team)).toEqual(eventsFor(all, team).slice(-3));
    }
    expect(host.chronicle(1)).toHaveLength(3);
    // A copy: changing it does not change what the host keeps.
    host.chronicle(1).pop();
    expect(host.chronicle(1)).toHaveLength(3);
  });
});

describe("the world through the junction host (junction F4, P2, P5)", () => {
  test("a battle's results are logged as the system player's, after the players' commands, and the log replays alone", () => {
    const { host, store } = setup([0, 1]);
    // Seed 42 of the test params: the first battle ends near tick 8,560.
    let ended = -1;
    while (ended < 0 && host.state.tick < 12_000) {
      host.tick();
      const tick = host.state.tick - 1;
      if (
        store
          .commandsFrom(host.id, tick)
          .some((c) => c.command.type === "battleEnd")
      ) {
        ended = tick;
      }
    }
    expect(ended).toBeGreaterThan(0);
    const log = store.commandsFrom(host.id, 0);
    const results = log.filter(
      (c) => c.command.type === "battleExit" || c.command.type === "battleEnd",
    );
    expect(results.every((c) => c.playerId === SYSTEM_PLAYER_ID)).toBe(true);
    for (const result of results) {
      const players = log.filter(
        (c) => c.tick === result.tick && c.playerId !== SYSTEM_PLAYER_ID,
      );
      expect(players.every((c) => c.seq < result.seq)).toBe(true);
    }
    const state = rebuild({
      simVersion: SIM_VERSION,
      seed: 42,
      params,
      ticks: host.state.tick,
      finalHash: stateHash(host.state),
      commands: log,
    });
    expect(stateHash(state)).toBe(stateHash(host.state));
  }, 30_000);
});
