import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createWorld,
  sampleMetrics,
  SIM_VERSION,
  type SimEvent,
} from "@geometrix/sim";
import Database from "better-sqlite3";
import { describe, expect, test } from "vitest";
import { Store } from "../src/persistence.ts";
import { testBattleParams, testParams } from "./helpers.ts";

const params = testParams();
const battleParams = testBattleParams();

function storeWithWorld() {
  const store = new Store(":memory:");
  const id = store.createWorld({
    seed: 42,
    params,
    battleParams,
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
      battleParams,
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
      difficulty: null,
    });
    expect(store.playerByTokenHash("nope")).toBeUndefined();
    expect(store.players(id).map((p) => [p.id, p.bot])).toEqual([
      [bot, true],
      [human, false],
    ]);
  });

  test("a players table without difficulty gets the column (R plan section 7)", () => {
    const file = join(mkdtempSync(join(tmpdir(), "geo-db-")), "geo.db");
    const old = new Database(file);
    old.exec(`CREATE TABLE players (
      id INTEGER PRIMARY KEY, world_id INTEGER NOT NULL, team_id INTEGER NOT NULL,
      name TEXT NOT NULL, token_hash TEXT UNIQUE, bot INTEGER NOT NULL DEFAULT 0
    )`);
    old.exec(
      "INSERT INTO players (world_id, team_id, name, bot) VALUES (1, 1, 'bot', 1)",
    );
    old.close();
    const store = new Store(file);
    const id = store.createWorld({
      seed: 1,
      params,
      battleParams,
      simVersion: SIM_VERSION,
      multiplier: 6,
      createdAt: "2026-11-14T00:00:00.000Z",
    });
    store.addPlayer({
      worldId: id,
      team: 0,
      name: "bot",
      tokenHash: null,
      bot: true,
      difficulty: "easy",
    });
    expect(store.players(id).map((p) => p.difficulty)).toEqual([null, "easy"]);
    store.close();
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

  test("keeps the chronicle per team, newest last, and deletes from a tick", () => {
    const { store, id } = storeWithWorld();
    const born = (tick: number, index: number, teams: number[]): SimEvent => ({
      type: "born",
      creep: { id: 10 + tick, team: 0, dna: "square", name: "Ada" },
      x: 0,
      y: 0,
      tick,
      index,
      teams,
    });
    store.commitTick({
      worldId: id,
      commands: [],
      tick: 4,
      events: [born(3, 0, [0]), born(3, 1, [0, 1])],
    });
    store.commitTick({
      worldId: id,
      commands: [],
      tick: 5,
      events: [born(4, 0, [1])],
    });
    const plain = (tick: number, index: number) => {
      const event: Partial<SimEvent> = born(tick, index, []);
      delete event.teams;
      return event;
    };
    expect(store.chronicleCount(id)).toBe(4);
    expect(store.recentChronicle(id, 0, 10)).toEqual([
      plain(3, 0),
      plain(3, 1),
    ]);
    expect(store.recentChronicle(id, 1, 10)).toEqual([
      plain(3, 1),
      plain(4, 0),
    ]);
    expect(store.recentChronicle(id, 1, 1)).toEqual([plain(4, 0)]);
    store.deleteChronicleFrom(id, 4);
    expect(store.recentChronicle(id, 1, 10)).toEqual([plain(3, 1)]);
    // A failed tick writes no chronicle either.
    expect(() =>
      store.commitTick({
        worldId: id,
        commands: [],
        tick: 6,
        events: [born(5, 0, [0]), born(5, 0, [0])],
      }),
    ).toThrow();
    expect(store.chronicleCount(id)).toBe(3);
  });
});
