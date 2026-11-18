import { describe, expect, test } from "vitest";
import {
  brakePermille,
  moveGain,
  moveParticipants,
  turnToIntent,
} from "../src/movement.ts";
import { CELL_COST } from "../src/params.ts";
import { createRng, nextInt } from "../src/rng.ts";
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
      // The first step is ready (D22), and points carry over between cells,
      // so the pace after it is exact.
      const cells = Math.floor((tick * cellsPerSecond) / 20) + 1;
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

  test("a full bag halves the speed: 3 cells after the first in 2 s instead of 6", () => {
    const state = battleOn(FIELD, [
      [member("square", { carry: { materia: 10, cristal: 20 } })],
      ["circle"],
    ]);
    put(state, 1, 0, 0);
    put(state, 2, 8, 6);
    go(state, 1, "right");
    walk(state, 40);
    expect(xyOf(state, 1)).toEqual([4, 0]);
  });

  test("standing, points build back up to one cell and no further (D22)", () => {
    const state = battleOn(FIELD, [["square"], ["circle"]]);
    const square = put(state, 1, 3, 6);
    go(state, 1, "up");
    walk(state, 1);
    // The ready step was spent at once; the tick's gain is left over.
    expect(xyOf(state, 1)).toEqual([3, 5]);
    expect(square.movePoints).toBe(900);
    go(state, 1, null);
    walk(state, 2);
    expect(square.movePoints).toBe(2700);
    walk(state, 10);
    expect(square.movePoints).toBe(CELL_COST);
    expect(xyOf(state, 1)).toEqual([3, 5]);
  });

  test("the carry brake slows the build-up too", () => {
    const state = battleOn(FIELD, [
      [member("square", { carry: { materia: 30, cristal: 0 } })],
      ["circle"],
    ]);
    const square = state.participants[0]!;
    square.movePoints = 0;
    walk(state, 4);
    expect(square.movePoints).toBe(4 * 450);
  });

  test("walking turns the creep the way it walks", () => {
    const state = battleOn(FIELD, [["square"], ["circle"]]);
    put(state, 1, 3, 3, "right");
    go(state, 1, "down");
    walk(state, 1);
    expect(state.participants[0]!.facing).toBe("down");
  });
});

describe("the first step (spec D22, M-1)", () => {
  /** A square at (0, 3) of FIELD, walking right; the circle far away. */
  function square(): BattleState {
    const state = battleOn(FIELD, [["square"], ["circle"]]);
    put(state, 1, 0, 3);
    put(state, 2, 8, 0);
    return state;
  }

  /** Steps one tick per entry of `pattern` (true: holding the key). */
  function play(state: BattleState, pattern: readonly boolean[]): number[] {
    const xs: number[] = [];
    for (const holding of pattern) {
      go(state, 1, holding ? "right" : null);
      walk(state, 1);
      xs.push(xyOf(state, 1)[0]);
    }
    return xs;
  }

  test("a creep that stood still steps on the first tick of the order", () => {
    const state = square();
    expect(play(state, [true])).toEqual([1]);
  });

  test("a 1-tick tap walks one cell, once it stood the time of a cell", () => {
    const state = square();
    // A square steps every 6.67 ticks: 7 ticks standing make it ready again.
    const tap = [true, false, false, false, false, false, false];
    const xs = play(state, [...tap, ...tap, ...tap]);
    expect(xs.at(-1)).toBe(3);
    expect(xs.filter((x, i) => x !== (xs[i - 1] ?? 0))).toEqual([1, 2, 3]);
  });

  test("tapping faster than the pace walks no faster than holding", () => {
    const rng = createRng(7);
    const holding = play(square(), Array<boolean>(60).fill(true));
    for (let round = 0; round < 200; round++) {
      const pattern = Array.from({ length: 60 }, () => nextInt(rng, 3) > 0);
      const xs = play(square(), pattern);
      xs.forEach((x, i) => expect(x).toBeLessThanOrEqual(holding[i]!));
    }
  });

  test("after a tap and a rest, holding walks at the DNA's pace", () => {
    const state = square();
    play(state, [true, false, false, false, false, false, false]);
    const xs = play(state, Array<boolean>(40).fill(true));
    // Ready again: one cell at once, then 3 cells per second.
    xs.forEach((x, i) => {
      expect(x).toBe(Math.min(8, 1 + Math.floor(((i + 1) * 3) / 20) + 1));
    });
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
