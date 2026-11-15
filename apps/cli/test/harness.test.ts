import { readFileSync } from "node:fs";
import {
  BALANCED,
  botCommands,
  botsFor,
  createWorld,
  parseParams,
  serialize,
  step,
  strategistActs,
  type WorldState,
} from "@geometrix/sim";
import { describe, expect, test } from "vitest";
import {
  logCursor,
  runBots,
  stepWithBots,
  type LoggedCommand,
} from "../src/harness.ts";

const params = parseParams(
  JSON.parse(
    readFileSync(
      // The sim tests' fixed params, so balancing does not change the bots.
      new URL("../../../packages/sim/test/params.json", import.meta.url),
      "utf8",
    ),
  ),
);

const bots = botsFor(["balanced", "balanced"]);

/** The seed-42 world after the bots joined at tick 0. */
function joined(): WorldState {
  const world = createWorld(42, params);
  stepWithBots(world, bots, []);
  return world;
}

const teamCreeps = (world: WorldState, team: number) =>
  world.creeps.filter((c) => c.team === team);

describe("bots", () => {
  test("join their teams at tick 0, then act on tick 1 and every minute", () => {
    expect(botCommands(createWorld(42, params), bots)).toEqual([
      { playerId: 1, command: { type: "join", team: 0, bot: true } },
      { playerId: 2, command: { type: "join", team: 1, bot: true } },
    ]);
    expect(BALANCED.everyTicks).toBe(60);
    expect([0, 1, 2, 60, 61, 121].map(strategistActs)).toEqual([
      false,
      true,
      false,
      false,
      true,
      true,
    ]);
  });

  test("only accepted commands go into the log, with tick and seq", () => {
    const world = joined();
    world.teams[0]!.stock = { materia: 40, cristal: 10 };
    const log: LoggedCommand[] = [];
    stepWithBots(world, bots, log);
    // Team 1 cannot pay for a creep, so it never sends produce.
    expect(log.filter((l) => l.command.type === "produce")).toEqual([
      {
        tick: 1,
        seq: 0,
        playerId: 1,
        command: { type: "produce", dna: "square", repeat: false },
      },
    ]);
    expect(log.map((l) => l.seq)).toEqual(log.map((_, i) => i));
  });
});

describe("a bot × bot world", () => {
  const ticks = 6 * 3600;
  const { state, log } = runBots(42, params, ticks, bots);

  test("grows, buys the upgrade and builds roads on both sides", () => {
    for (const team of state.teams) {
      expect(teamCreeps(state, team.id).length).toBeGreaterThan(6);
      expect(team.upgrades.capacity).toBe(true);
      expect(state.stats.teams[team.id]!.roadSegments).toBeGreaterThan(0);
      expect(state.stats.teams[team.id]!.delivered.cristal).toBeGreaterThan(0);
    }
  });

  test("replaying the log without bots reaches the same state", () => {
    const replay = createWorld(42, params);
    const commandsAt = logCursor(log);
    for (let i = 0; i < ticks; i++) step(replay, commandsAt(replay.tick));
    expect(serialize(replay)).toBe(serialize(state));
  }, 30_000);
});
