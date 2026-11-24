import { describe, expect, test } from "vitest";
import {
  BattleParamsError,
  CELL_COST,
  msToTicks,
  parseBattleParams,
  pointsPerTick,
  type BattleParams,
} from "../src/params.ts";
import {
  loadTestParams,
  readDefaultParamsJson,
  readTestParamsJson,
} from "./helpers.ts";

function issuesOf(input: unknown): readonly string[] {
  try {
    parseBattleParams(input);
  } catch (error) {
    if (error instanceof BattleParamsError) return error.issues;
    throw error;
  }
  return [];
}

/** Deep copy of the test params with one leaf replaced. */
function withLeaf(path: string, value: unknown): unknown {
  const copy = readTestParamsJson() as Record<string, unknown>;
  const keys = path.split(".");
  let node = copy;
  for (const key of keys.slice(0, -1)) {
    node = node[key] as Record<string, unknown>;
  }
  node[keys.at(-1)!] = value;
  return copy;
}

describe("parseBattleParams", () => {
  test("accepts params/battle.json", () => {
    const params: BattleParams = parseBattleParams(readDefaultParamsJson());
    expect(params.tick.ticksPerSecond).toBe(20);
  });

  test("accepts test/params.json, with the spec section 6 numbers", () => {
    const { dna } = loadTestParams();
    expect(dna.square).toEqual({
      damage: 30,
      range: 1,
      cooldownMs: 1000,
      cellsPerSecond: 3,
      projectileCellsPerSecond: 0,
    });
    expect([dna.triangle.range, dna.circle.range]).toEqual([4, 6]);
  });

  test.each([
    ["dna.square.range", 0, "dna.square.range: must be >= 1"],
    // Max HP and capacity are the world's (junction spec D9).
    ["dna.square.hp", 300, "dna.square.hp: unknown"],
    ["dna.square.capacity", 30, "dna.square.capacity: unknown"],
    ["dna.circle.damage", 2.5, "dna.circle.damage: expected an integer"],
    ["carry.fullBrakePermille", -1, "carry.fullBrakePermille: must be >= 0"],
    ["exit.dwellMs", "2000", "exit.dwellMs: expected an integer"],
    ["inactivity", undefined, "inactivity: missing"],
    ["limits", [], "limits: expected an object"],
  ])("rejects %s = %s", (path, value, issue) => {
    expect(issuesOf(withLeaf(path, value))).toEqual([issue]);
  });

  test("rejects unknown keys", () => {
    expect(issuesOf(withLeaf("dna.square.armor", 1))).toEqual([
      "dna.square.armor: unknown",
    ]);
  });

  test("a melee DNA has projectile speed 0", () => {
    expect(
      issuesOf(withLeaf("dna.triangle.projectileCellsPerSecond", 0)),
    ).toEqual([]);
  });

  test("durations must be whole ticks", () => {
    // 40 ticks per second: 25 ms per tick, and every duration still fits.
    expect(issuesOf(withLeaf("tick.ticksPerSecond", 40))).toEqual([]);
    expect(issuesOf(withLeaf("exit.dwellMs", 2010))).toEqual([
      "exit.dwellMs: must be a multiple of one tick (50 ms)",
    ]);
    expect(issuesOf(withLeaf("dna.circle.cooldownMs", 825))).toEqual([
      "dna.circle.cooldownMs: must be a multiple of one tick (50 ms)",
    ]);
    expect(issuesOf(withLeaf("start.countdownMs", 2990))).toEqual([
      "start.countdownMs: must be a multiple of one tick (50 ms)",
    ]);
    // No countdown is allowed (spec D21: the fight starts at once).
    expect(issuesOf(withLeaf("start.countdownMs", 0))).toEqual([]);
  });

  test("the tick rate must divide 1000 ms", () => {
    expect(issuesOf(withLeaf("tick.ticksPerSecond", 30))).toEqual([
      "tick.ticksPerSecond: must divide 1000 (durations are in ms)",
    ]);
  });

  test("every tick rate that divides 1000 also divides CELL_COST", () => {
    // So the CELL_COST guard in checkConsistency only fires if CELL_COST
    // changes: movement points per tick stay whole.
    for (let tps = 1; tps <= 1000; tps++) {
      if (1000 % tps === 0) expect(CELL_COST % tps).toBe(0);
    }
  });

  test("the AI jitter is smaller than its period, at every reaction", () => {
    expect(issuesOf(withLeaf("ai.normal.decisionJitterMs", 250))).toEqual([
      "ai.normal.decisionJitterMs: must be smaller than ai.normal.decisionMs",
    ]);
    expect(issuesOf(withLeaf("ai.hard.decisionMs", 50))).toEqual([
      "ai.hard.decisionJitterMs: must be smaller than ai.hard.decisionMs",
    ]);
    expect(issuesOf(withLeaf("ai.easy.decisionMs", 610))).toEqual([
      "ai.easy.decisionMs: must be a multiple of one tick (50 ms)",
    ]);
  });

  test("a full bag slows but never stops", () => {
    expect(issuesOf(withLeaf("carry.fullBrakePermille", 1000))).toEqual([
      "carry.fullBrakePermille: must be < 1000",
    ]);
  });

  test.each([1, 5])("maxSides %s is outside 2..4", (sides) => {
    expect(issuesOf(withLeaf("limits.maxSides", sides))).toEqual([
      "limits.maxSides: must be between 2 and 4",
    ]);
  });
});

describe("unit conversions", () => {
  const params = loadTestParams();

  test("ms to ticks at 20 ticks per second", () => {
    expect(msToTicks(params, params.dna.circle.cooldownMs)).toBe(16);
    expect(msToTicks(params, params.exit.dwellMs)).toBe(40);
    expect(msToTicks(params, params.inactivity.timeoutMs)).toBe(300);
  });

  test("points per tick are whole for every DNA and projectile", () => {
    for (const dna of Object.values(params.dna)) {
      expect(Number.isInteger(pointsPerTick(params, dna.cellsPerSecond))).toBe(
        true,
      );
      expect(
        Number.isInteger(pointsPerTick(params, dna.projectileCellsPerSecond)),
      ).toBe(true);
    }
    expect(pointsPerTick(params, 3)).toBe(900);
  });
});
