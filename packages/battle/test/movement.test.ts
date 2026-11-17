import { describe, expect, test } from "vitest";
import {
  brakePermille,
  moveGain,
  moveParticipants,
  turnToIntent,
} from "../src/movement.ts";
import { CELL_COST } from "../src/params.ts";
import { nextInt } from "../src/rng.ts";
import type { BattleState } from "../src/state.ts";
import { battleOn, FIELD, member, put, xyOf } from "./helpers.ts";

/** Turn and move, the F1 part of the tick, `ticks` times. */
function walk(state: BattleState, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    turnToIntent(state);
    moveParticipants(state);
  }
}

function go(
  state: BattleState,
  id: number,
  move: "up" | "down" | "left" | "right" | null,
) {
  state.participants.find((p) => p.id === id)!.intent.move = move;
}

describe("speed and the carry brake (spec M-1, D8)", () => {
  test.each([
    ["square", 3],
    ["triangle", 4],
    ["circle", 5],
  ] as const)("a %s walks %s cells per second", (dna, cellsPerSecond) => {
    const state = battleOn(FIELD, [[dna], ["square"]]);
    put(state, 1, 0, 0);
    put(state, 2, 8, 6);
    go(state, 1, "right");
    for (let tick = 1; tick <= 40; tick++) {
      walk(state, 1);
      // Points carry over between cells, so the pace is exact.
      const cells = Math.floor(
        (tick * cellsPerSecond * CELL_COST) / 20 / CELL_COST,
      );
      expect(xyOf(state, 1)).toEqual([Math.min(cells, 8), 0]);
    }
  });

  test.each([
    [0, 1000],
    [15, 750],
    [30, 500],
  ])("a square carrying %s moves at %s‰", (load, permille) => {
    const state = battleOn(FIELD, [
      [member("square", { carry: { materia: load, cristal: 0 } })],
      ["circle"],
    ]);
    const square = state.participants[0]!;
    expect(brakePermille(state, square)).toBe(permille);
    expect(moveGain(state, square)).toBe((900 * permille) / 1000);
  });

  test("a full bag halves the speed: 3 cells in 2 s instead of 6", () => {
    const state = battleOn(FIELD, [
      [member("square", { carry: { materia: 10, cristal: 20 } })],
      ["circle"],
    ]);
    put(state, 1, 0, 0);
    put(state, 2, 8, 6);
    go(state, 1, "right");
    walk(state, 40);
    expect(xyOf(state, 1)).toEqual([3, 0]);
  });

  test("points reset when the intent to walk stops", () => {
    const state = battleOn(FIELD, [["square"], ["circle"]]);
    put(state, 1, 3, 3);
    go(state, 1, "up");
    walk(state, 5);
    expect(state.participants[0]!.movePoints).toBe(4500);
    go(state, 1, null);
    walk(state, 1);
    expect(state.participants[0]!.movePoints).toBe(0);
    expect(xyOf(state, 1)).toEqual([3, 3]);
  });

  test("walking turns the creep the way it walks", () => {
    const state = battleOn(FIELD, [["square"], ["circle"]]);
    put(state, 1, 3, 3, "right");
    go(state, 1, "down");
    walk(state, 1);
    expect(state.participants[0]!.facing).toBe("down");
  });
});

describe("blocked cells (spec M-2)", () => {
  const rocky = [
    ".........",
    ".........",
    ".1..#..2.",
    ".1.....2.",
    ".1.....2.",
    ".........",
    ".........",
  ];

  test("rock: it only turns, and holds a full cell of points", () => {
    const state = battleOn(rocky, [["circle"], ["square"]]);
    put(state, 1, 3, 2, "up");
    put(state, 2, 8, 6);
    go(state, 1, "right");
    walk(state, 20);
    expect(xyOf(state, 1)).toEqual([3, 2]);
    expect(state.participants[0]!.facing).toBe("right");
    expect(state.participants[0]!.movePoints).toBe(CELL_COST);
  });

  test("the grid's edge blocks like rock", () => {
    const state = battleOn(FIELD, [["circle"], ["square"]]);
    put(state, 1, 0, 3);
    go(state, 1, "left");
    walk(state, 10);
    expect(xyOf(state, 1)).toEqual([0, 3]);
  });

  test("a body blocks: nobody walks through anybody", () => {
    const state = battleOn(FIELD, [["circle"], ["square"]]);
    put(state, 1, 3, 3);
    put(state, 2, 4, 3);
    go(state, 1, "right");
    walk(state, 20);
    expect(xyOf(state, 1)).toEqual([3, 3]);
    expect(xyOf(state, 2)).toEqual([4, 3]);
  });

  test("a cell left in a tick is free only on the next one", () => {
    const state = battleOn(FIELD, [["circle", "circle"], ["square"]]);
    put(state, 1, 3, 3);
    put(state, 2, 4, 3);
    put(state, 3, 8, 6);
    // Both ready to step right this tick.
    state.participants[0]!.movePoints = CELL_COST - 1;
    state.participants[1]!.movePoints = CELL_COST - 1;
    go(state, 1, "right");
    go(state, 2, "right");
    walk(state, 1);
    expect([xyOf(state, 1), xyOf(state, 2)]).toEqual([
      [3, 3],
      [5, 3],
    ]);
    // The follower held a full cell of points and steps right away.
    walk(state, 1);
    expect(xyOf(state, 1)).toEqual([4, 3]);
  });
});

describe("two creeps into one cell (spec M-3)", () => {
  /** Two circles one cell away from (4, 3), both ready to step into it. */
  function standoff(seed: number) {
    const state = battleOn(FIELD, [["circle"], ["circle"]], seed);
    put(state, 1, 3, 3);
    put(state, 2, 5, 3);
    go(state, 1, "right");
    go(state, 2, "left");
    for (const p of state.participants) p.movePoints = CELL_COST - 1;
    return state;
  }

  test("the rng picks who enters, with one call; the other stays with its points", () => {
    for (let seed = 0; seed < 20; seed++) {
      const state = standoff(seed);
      const rng = structuredClone(state.rng);
      const pick = nextInt(rng, 2);
      walk(state, 1);
      expect(state.rng).toEqual(rng);
      const winner = state.participants[pick]!;
      const loser = state.participants[1 - pick]!;
      expect(xyOf(state, winner.id)).toEqual([4, 3]);
      expect(loser.cell).toBe(loser.id === 1 ? 3 * 9 + 3 : 3 * 9 + 5);
      expect(loser.movePoints).toBe(CELL_COST);
    }
  });

  test("either side can win: the id never decides", () => {
    const winners = new Set<number>();
    for (let seed = 0; seed < 40; seed++) {
      const state = standoff(seed);
      walk(state, 1);
      winners.add(state.participants.find((p) => p.cell === 3 * 9 + 4)!.id);
    }
    expect([...winners].sort()).toEqual([1, 2]);
  });

  test("no dispute, no rng call", () => {
    const state = battleOn(FIELD, [["circle"], ["circle"]]);
    put(state, 1, 3, 3);
    put(state, 2, 5, 5);
    go(state, 1, "right");
    go(state, 2, "left");
    const rng = structuredClone(state.rng);
    walk(state, 20);
    expect(state.rng).toEqual(rng);
  });
});
