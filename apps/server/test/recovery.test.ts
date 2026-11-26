import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { replayLog } from "@geometrix/battle";
import { replayResults, serializeHost } from "@geometrix/junction";
import type { Command } from "@geometrix/sim";
import { describe, expect, test } from "vitest";
import { battleHash, stateHash } from "../src/hash.ts";
import { Store } from "../src/persistence.ts";
import {
  RecoveryError,
  WorldHost,
  type HostContext,
} from "../src/world-host.ts";
import {
  firstTeamBattle,
  testApp,
  testBattleParams,
  testParams,
} from "./helpers.ts";

/** The first battle between the teams of seed 42 (see helpers). */
const first = firstTeamBattle();

const config = {
  snapshotEveryTicks: 300,
  metricsEveryTicks: 60,
  chronicleWelcome: 100,
};
const TICKS = 1_000;

const dbFile = () => join(mkdtempSync(join(tmpdir(), "geo-db-")), "geo.db");

function newWorld(store: Store): WorldHost {
  return WorldHost.create(
    { store, config },
    {
      seed: 42,
      params: testParams(),
      battleParams: testBattleParams(),
      multiplier: 36,
      botTeams: [1],
      createdAt: "2026-11-14T00:00:00.000Z",
    },
  );
}

/** A human on team 0 who dominates and moves a creep now and then. */
function humanCommands(host: WorldHost): Command[] {
  const { tick } = host.state;
  if (tick === 0) return [{ type: "join", team: 0, bot: false }];
  const creep = host.state.creeps.find((c) => c.team === 0)!;
  if (tick === 10) return [{ type: "dominate", creepId: creep.id }];
  if (tick % 97 === 0) {
    return [
      {
        type: "order",
        creepId: creep.id,
        order: { type: "moveTo", x: creep.x, y: (creep.y + 5) % 30 },
      },
    ];
  }
  if (tick === 700)
    return [
      { type: "applyPreset", creepId: creep.id, preset: "cristalCollector" },
    ];
  return [];
}

/** Runs `host` up to `until`, with the human's commands. */
function run(host: WorldHost, human: number, until: number) {
  while (host.state.tick < until) {
    for (const command of humanCommands(host)) {
      expect(host.submit(human, command)).toBeNull();
    }
    host.tick();
  }
}

function addHuman(store: Store, host: WorldHost) {
  return store.addPlayer({
    worldId: host.id,
    team: 0,
    name: "Ana",
    tokenHash: "a",
    bot: false,
  });
}

describe("recovery after a restart", () => {
  test("a world stopped mid-run without a snapshot reaches the same hash", () => {
    const steady = new Store(":memory:");
    const reference = newWorld(steady);
    run(reference, addHuman(steady, reference), TICKS);

    const file = dbFile();
    let store = new Store(file);
    const crashed = newWorld(store);
    const human = addHuman(store, crashed);
    run(crashed, human, 650);
    store.close(); // the process dies: no snapshot at 650, the last is at 600

    store = new Store(file);
    const context: HostContext = { store, config };
    const recovered = WorldHost.recover(
      context,
      store.world(crashed.id)!,
      testBattleParams(),
    );
    expect(store.latestSnapshot(crashed.id)?.tick).toBe(600);
    expect(recovered.state.tick).toBe(650);
    expect(stateHash(recovered.state)).not.toBe(stateHash(reference.state));
    run(recovered, human, TICKS);
    expect(stateHash(recovered.state)).toBe(stateHash(reference.state));
    expect(store.commandsFrom(crashed.id, 0)).toEqual(
      steady.commandsFrom(reference.id, 0),
    );
  });

  test("the chronicle after a restart is the one before it (spec N-2)", () => {
    // The crash comes 90 ticks after one of team 1's first events (births,
    // on tick 2160 before R F3), found by search, so the event falls after
    // the last snapshot.
    const probe = new Store(":memory:");
    const probed = newWorld(probe);
    run(probed, addHuman(probe, probed), 6_000);
    const event = probe
      .recentChronicle(probed.id, 1, 10_000)
      .map((e) => e.tick)
      .find((tick) => tick % config.snapshotEveryTicks < 200);
    if (event === undefined) throw new Error("no team 1 event to crash after");
    const until = event + 90;
    const snapshotTick =
      Math.floor(until / config.snapshotEveryTicks) * config.snapshotEveryTicks;

    const steady = new Store(":memory:");
    const reference = newWorld(steady);
    run(reference, addHuman(steady, reference), until);

    const file = dbFile();
    let store = new Store(file);
    const crashed = newWorld(store);
    run(crashed, addHuman(store, crashed), until);
    // Events after the last snapshot are stored, and get redone.
    expect(store.latestSnapshot(crashed.id)?.tick).toBe(snapshotTick);
    const tail = store
      .recentChronicle(crashed.id, 1, 1_000)
      .filter((e) => e.tick >= snapshotTick);
    expect(tail.length).toBeGreaterThan(0);
    const rows = store.chronicleCount(crashed.id);
    store.close();

    store = new Store(file);
    const recovered = WorldHost.recover(
      { store, config },
      store.world(crashed.id)!,
      testBattleParams(),
    );
    expect(store.chronicleCount(crashed.id)).toBe(rows);
    expect(rows).toBe(steady.chronicleCount(reference.id));
    for (const team of [0, 1]) {
      expect(recovered.chronicle(team)).toEqual(reference.chronicle(team));
      expect(store.recentChronicle(crashed.id, team, 1_000)).toEqual(
        steady.recentChronicle(reference.id, team, 1_000),
      );
    }
    expect(recovered.chronicle(1).length).toBeGreaterThan(0);
  }, 30_000);

  test("a player whose join was still queued joins again", () => {
    const file = dbFile();
    let store = new Store(file);
    const host = newWorld(store);
    host.tick();
    const late = addHuman(store, host);
    host.submit(late, { type: "join", team: 0, bot: false });
    store.close();

    store = new Store(file);
    const recovered = WorldHost.recover(
      { store, config },
      store.world(host.id)!,
      testBattleParams(),
    );
    recovered.tick();
    expect(recovered.state.players.map((p) => p.id)).toContain(late);
  });

  test("refuses a world from another sim version", () => {
    const store = new Store(":memory:");
    const host = newWorld(store);
    const row = { ...store.world(host.id)!, simVersion: 0 };
    expect(() =>
      WorldHost.recover({ store, config }, row, testBattleParams()),
    ).toThrow(RecoveryError);
  });

  test("the app hosts stored worlds again on start, clock and all", async () => {
    const file = dbFile();
    const store = new Store(file);
    const host = newWorld(store);
    host.tick();
    host.tick();
    store.close();

    const second = await testApp({}, new Store(file));
    try {
      const again = second.app.worlds.get(host.id)!;
      expect(again.state.tick).toBe(2);
      expect(second.app.recoveryFailures).toEqual([]);
      second.timers.advance(1_000);
      expect(again.state.tick).toBe(2 + 36);
    } finally {
      await second.app.close();
    }
  });
});

describe("recovery in the middle of a battle (junction N-3, P6)", () => {
  /** Seed 42 of the test params with two bots: firstTeamBattle opens the first battle. */
  function botWorld(store: Store): WorldHost {
    return WorldHost.create(
      { store, config },
      {
        seed: 42,
        params: testParams(),
        battleParams: testBattleParams(),
        multiplier: 1,
        botTeams: [0, 1],
        createdAt: "2026-11-14T00:00:00.000Z",
      },
    );
  }

  const runTo = (host: WorldHost, tick: number) => {
    while (host.state.tick < tick) host.tick();
  };

  test("the battle is rebuilt from its tables as it was, and the world ends the same", () => {
    const steady = new Store(":memory:");
    const reference = botWorld(steady);
    runTo(reference, first.openedTick + 11);
    expect(reference.junction.instances.length).toBeGreaterThan(0);
    const hostThen = serializeHost(reference.junction);
    runTo(reference, first.openedTick + 461);

    const file = dbFile();
    let store = new Store(file);
    const crashed = botWorld(store);
    runTo(crashed, first.openedTick + 11);
    store.close(); // no snapshot there: recovery replays from the last one

    store = new Store(file);
    const recovered = WorldHost.recover(
      { store, config },
      store.world(crashed.id)!,
      testBattleParams(),
    );
    expect(recovered.state.tick).toBe(first.openedTick + 11);
    expect(serializeHost(recovered.junction)).toBe(hostThen);
    runTo(recovered, first.openedTick + 461);
    expect(stateHash(recovered.state)).toBe(stateHash(reference.state));
    expect(serializeHost(recovered.junction)).toBe(
      serializeHost(reference.junction),
    );
    expect(store.commandsFrom(crashed.id, 0)).toEqual(
      steady.commandsFrom(reference.id, 0),
    );
    expect(store.battles(crashed.id)).toEqual(steady.battles(reference.id));
  }, 60_000);

  test("an ended battle's stored log replays to its final hash and to the results the world log applied", () => {
    const store = new Store(":memory:");
    const host = botWorld(store);
    runTo(host, first.openedTick + 461);
    const battles = store.battles(host.id);
    expect(battles.length).toBeGreaterThan(0);
    const log = store.commandsFrom(host.id, 0);
    for (const battle of battles.filter((b) => b.endedTick !== null)) {
      const battleLog = {
        battleVersion: battle.battleVersion,
        setup: battle.setup,
        params: battle.params,
        ticks: battle.reachedTick,
        commands: store.battleTicks(host.id, battle.battleId),
        finalHash: null,
      };
      expect(battleHash(replayLog(battleLog))).toBe(battle.finalHash);
      const applied = log
        .map((c) => c.command)
        .filter(
          (c) =>
            (c.type === "battleExit" || c.type === "battleEnd") &&
            c.battleId === battle.battleId,
        );
      expect(battle.record.sent).toEqual(applied);
      expect(battle.record.pending).toEqual([]);
      expect(
        replayResults(host.state, {
          ...battle.record,
          log: battleLog,
          late: [],
          results: battle.record.sent,
        }),
      ).toEqual(applied);
      // It ended on the world tick whose step applied its end.
      const end = log.find(
        (c) =>
          c.command.type === "battleEnd" &&
          c.command.battleId === battle.battleId,
      )!;
      expect(battle.endedTick).toBe(end.tick);
    }
  }, 60_000);

  test("refuses a world whose open battle is not stored", () => {
    const store = new Store(":memory:");
    const host = botWorld(store);
    runTo(host, first.openedTick + 6);
    expect(host.state.battles.length).toBeGreaterThan(0);
    store.transaction(() => {
      // An older file: the battle tables did not exist.
      (store as unknown as { db: { exec(sql: string): void } }).db.exec(
        "DELETE FROM battles",
      );
    });
    expect(() =>
      WorldHost.recover(
        { store, config },
        store.world(host.id)!,
        testBattleParams(),
      ),
    ).toThrow(RecoveryError);
  }, 60_000);
});
