import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Command } from "@geometrix/sim";
import { describe, expect, test } from "vitest";
import { stateHash } from "../src/hash.ts";
import { Store } from "../src/persistence.ts";
import {
  RecoveryError,
  WorldHost,
  type HostContext,
} from "../src/world-host.ts";
import { testApp, testParams } from "./helpers.ts";

const config = { snapshotEveryTicks: 300, metricsEveryTicks: 60 };
const TICKS = 1_000;

const dbFile = () => join(mkdtempSync(join(tmpdir(), "geo-db-")), "geo.db");

function newWorld(store: Store): WorldHost {
  return WorldHost.create(
    { store, config },
    {
      seed: 42,
      params: testParams(),
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
    const recovered = WorldHost.recover(context, store.world(crashed.id)!);
    expect(store.latestSnapshot(crashed.id)?.tick).toBe(600);
    expect(recovered.state.tick).toBe(650);
    expect(stateHash(recovered.state)).not.toBe(stateHash(reference.state));
    run(recovered, human, TICKS);
    expect(stateHash(recovered.state)).toBe(stateHash(reference.state));
    expect(store.commandsFrom(crashed.id, 0)).toEqual(
      steady.commandsFrom(reference.id, 0),
    );
  });

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
    );
    recovered.tick();
    expect(recovered.state.players.map((p) => p.id)).toContain(late);
  });

  test("refuses a world from another sim version", () => {
    const store = new Store(":memory:");
    const host = newWorld(store);
    const row = { ...store.world(host.id)!, simVersion: 0 };
    expect(() => WorldHost.recover({ store, config }, row)).toThrow(
      RecoveryError,
    );
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
