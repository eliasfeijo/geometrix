import type { BattleView } from "@geometrix/battle";
import { describe, expect, test } from "vitest";
import { glideProgress, positions } from "../src/battle/interpolate.ts";

describe("the interpolation (plan P8)", () => {
  const view = (cells: number[], shots: number[] = []): BattleView => ({
    tick: 0,
    countdownTicks: 0,
    idleTicks: 0,
    participants: cells.map((cell, i) => ({
      id: i + 1,
      side: 0,
      name: "x",
      dna: "square",
      cell,
      facing: "up",
      hp: 1,
      maxHp: 1,
      carry: { materia: 0, cristal: 0 },
      capacity: 1,
      controller: "gambits",
      reaction: "normal",
      cooldownTicks: 0,
      exitTicks: 0,
    })),
    projectiles: shots.map((cell, i) => ({
      id: 100 + i,
      owner: 1,
      side: 0,
      cell,
      dir: "right",
      cellsLeft: 3,
    })),
    piles: [],
    ended: null,
  });

  test("glides over one tick, or jumps with it off", () => {
    expect(glideProgress(1000, 1025, 50, true)).toBe(0.5);
    expect(glideProgress(1000, 1100, 50, true)).toBe(1);
    expect(glideProgress(1000, 1000, 50, false)).toBe(1);
  });

  test("a creep that moved a cell is drawn between the two", () => {
    // Width 10: cell 11 is (1, 1), cell 12 is (2, 1).
    const drawn = positions(10, view([11], [30]), view([12], [31]), 0.25);
    expect(drawn.participants.get(1)).toEqual({ x: 1.25, y: 1 });
    expect(drawn.projectiles.get(100)).toEqual({ x: 0.25, y: 3 });
  });

  test("what just appeared, or jumped far, is drawn at its cell", () => {
    const drawn = positions(10, view([11]), view([55, 20]), 0.5);
    expect(drawn.participants.get(1)).toEqual({ x: 5, y: 5 });
    expect(drawn.participants.get(2)).toEqual({ x: 0, y: 2 });
    expect(positions(10, null, view([12]), 0).participants.get(1)).toEqual({
      x: 2,
      y: 1,
    });
  });
});
