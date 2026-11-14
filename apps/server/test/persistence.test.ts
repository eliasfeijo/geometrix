import { createWorld, sampleMetrics, SIM_VERSION } from "@geometrix/sim";
import { describe, expect, test } from "vitest";
import { Store } from "../src/persistence.ts";
import { testParams } from "./helpers.ts";

const params = testParams();

function storeWithWorld() {
  const store = new Store(":memory:");
  const id = store.createWorld({
    seed: 42,
    params,
    simVersion: SIM_VERSION,
    multiplier: 36,
    createdAt: "2026-11-14T00:00:00.000Z",
  });
  return { store, id };
}

describe("Store", () => {
  test("creates and lists worlds", () => {
    const { store, id } = storeWithWorld();
    expect(store.world(id)).toEqual({
      id,
      seed: 42,
      params,
      simVersion: SIM_VERSION,
      multiplier: 36,
      status: "running",
      tick: 0,
      createdAt: "2026-11-14T00:00:00.000Z",
    });
    store.setStatus(id, "ended");
    expect(store.worlds().map((w) => w.status)).toEqual(["ended"]);
    expect(store.world(id + 1)).toBeUndefined();
  });

  test("finds players by token hash; bots have none", () => {
    const { store, id } = storeWithWorld();
    const bot = store.addPlayer({
      worldId: id,
      team: 1,
      name: "bot",
      tokenHash: null,
      bot: true,
    });
    const human = store.addPlayer({
      worldId: id,
      team: 0,
      name: "Ana",
      tokenHash: "abc",
      bot: false,
    });
    expect(store.playerByTokenHash("abc")).toEqual({
      id: human,
      worldId: id,
      team: 0,
      name: "Ana",
      bot: false,
    });
    expect(store.playerByTokenHash("nope")).toBeUndefined();
    expect(store.players(id).map((p) => [p.id, p.bot])).toEqual([
      [bot, true],
      [human, false],
    ]);
  });

  test("commits a tick: commands, tick, snapshot and metrics together", () => {
    const { store, id } = storeWithWorld();
    const state = createWorld(42, params);
    store.commitTick({
      worldId: id,
      commands: [
        { tick: 5, seq: 0, playerId: 1, command: { type: "stopRepeat" } },
        { tick: 5, seq: 1, playerId: 2, command: { type: "release" } },
      ],
      tick: 6,
      snapshot: { tick: 6, stateJson: "{}", stateHash: "h6" },
      metrics: sampleMetrics(state),
    });
    store.commitTick({
      worldId: id,
      commands: [
        { tick: 6, seq: 0, playerId: 1, command: { type: "stopRepeat" } },
      ],
      tick: 7,
    });
    expect(store.world(id)!.tick).toBe(7);
    expect(store.latestSnapshot(id)).toEqual({
      tick: 6,
      stateJson: "{}",
      stateHash: "h6",
    });
    expect(store.commandsFrom(id, 6)).toEqual([
      { tick: 6, seq: 0, playerId: 1, command: { type: "stopRepeat" } },
    ]);
    expect(store.commandsFrom(id, 0)).toHaveLength(3);
    const rows = store.metrics(id);
    expect(rows.map((r) => r.team)).toEqual([null, 0, 1]);
    expect(rows[1]!.sample).toMatchObject({ team: 0 });
  });

  test("a failed tick leaves nothing behind", () => {
    const { store, id } = storeWithWorld();
    const command = {
      tick: 0,
      seq: 0,
      playerId: 1,
      command: { type: "release" },
    } as const;
    expect(() =>
      store.commitTick({ worldId: id, commands: [command, command], tick: 1 }),
    ).toThrow();
    expect(store.commandsFrom(id, 0)).toEqual([]);
    expect(store.world(id)!.tick).toBe(0);
  });
});
