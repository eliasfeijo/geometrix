import { describe, expect, test } from "vitest";
import {
  ArenaError,
  cellX,
  cellY,
  clearLine,
  isExit,
  isRock,
  neighbor,
  parseArena,
  type Arena,
  rockStepsFrom,
  stepsFrom,
} from "../src/arena.ts";
import { ARENA_NAMES, readArenaRows } from "./helpers.ts";

const small = parseArena([
  ".......",
  ".......",
  ".1..#2.",
  ".1...2.",
  "...#...",
  ".......",
]);
const at = (arena: Arena, x: number, y: number) => y * arena.width + x;

describe("parseArena", () => {
  test("reads size, rock and the entry stretches with their facing", () => {
    expect(small.width).toBe(7);
    expect(small.height).toBe(6);
    expect(isRock(small, at(small, 4, 2))).toBe(true);
    expect(isRock(small, at(small, 3, 4))).toBe(true);
    expect(small.rock.filter((r) => r === 1)).toHaveLength(2);
    expect(small.entries).toEqual([
      { cells: [at(small, 1, 2), at(small, 1, 3)], facing: "right" },
      { cells: [at(small, 5, 2), at(small, 5, 3)], facing: "left" },
    ]);
  });

  test("top and bottom stretches face down and up", () => {
    const arena = parseArena([".....", "..1..", ".....", "..2..", "....."]);
    expect(arena.entries.map((e) => e.facing)).toEqual(["down", "up"]);
  });

  test.each<[string, string[], string]>([
    ["too small", ["....", "....", "...."], "at least 5 × 5"],
    ["ragged", [".....", "..1..", "....", "..2..", "....."], "row 2 has 4"],
    ["unknown glyph", [".....", "..1..", "..x..", "..2..", "....."], '"x"'],
    [
      "entry on the ring",
      ["..1..", ".....", ".....", "..2..", "....."],
      "on the exit ring",
    ],
    [
      "entry in a corner of the lap",
      [".....", ".1...", ".....", "..2..", "....."],
      "off its corners",
    ],
    [
      "stretch on two edges",
      [".......", ".1.....", ".1.....", ".1.....", "..1..2.", "......."],
      "one edge",
    ],
    ["one side only", [".....", "..1..", ".....", ".....", "....."], "1 and 2"],
    [
      "entry 4 without 3",
      [".......", "..1....", ".4....."].concat([
        "..2....",
        ".......",
        ".......",
      ]),
      "missing before",
    ],
  ])("rejects %s", (_, rows, reason) => {
    expect(() => parseArena(rows)).toThrow(ArenaError);
    expect(() => parseArena(rows)).toThrow(reason);
  });
});

describe("cells", () => {
  test("the ring's floor is the exit, its rock is not", () => {
    const arena = parseArena(["..#..", "..1..", ".....", "..2..", "....."]);
    expect(isExit(arena, at(arena, 0, 0))).toBe(true);
    expect(isExit(arena, at(arena, 2, 0))).toBe(false);
    expect(isExit(arena, at(arena, 4, 2))).toBe(true);
    expect(isExit(arena, at(arena, 2, 2))).toBe(false);
  });

  test("neighbors stop at the grid's edge", () => {
    const corner = at(small, 0, 0);
    expect(neighbor(small, corner, "up")).toBe(-1);
    expect(neighbor(small, corner, "left")).toBe(-1);
    expect(neighbor(small, corner, "right")).toBe(at(small, 1, 0));
    expect(neighbor(small, corner, "down")).toBe(at(small, 0, 1));
    const last = at(small, 6, 5);
    expect(neighbor(small, last, "right")).toBe(-1);
    expect(neighbor(small, last, "down")).toBe(-1);
    expect([cellX(small, last), cellY(small, last)]).toEqual([6, 5]);
  });

  test("the clear line runs up to the range and stops before rock or edge", () => {
    const from = at(small, 1, 2);
    expect(clearLine(small, from, "right", 6)).toEqual([
      at(small, 2, 2),
      at(small, 3, 2),
    ]);
    expect(clearLine(small, from, "right", 1)).toEqual([at(small, 2, 2)]);
    expect(clearLine(small, from, "up", 6)).toEqual([
      at(small, 1, 1),
      at(small, 1, 0),
    ]);
    expect(clearLine(small, from, "down", 2)).toEqual([
      at(small, 1, 3),
      at(small, 1, 4),
    ]);
  });
});

describe("the arenas in params/arenas", () => {
  test.each(ARENA_NAMES)("%s is 23 × 15 with four 7-cell stretches", (name) => {
    const arena = parseArena(readArenaRows(name));
    expect([arena.width, arena.height]).toEqual([23, 15]);
    expect(arena.entries.map((e) => e.cells.length)).toEqual([7, 7, 7, 7]);
  });

  test.each(ARENA_NAMES)(
    "%s is symmetric by a 180° rotation, swapping stretches 1↔2 and 3↔4",
    (name) => {
      const rows = readArenaRows(name);
      const swap: Record<string, string> = {
        "1": "2",
        "2": "1",
        "3": "4",
        "4": "3",
      };
      const rotated = rows
        .map((row) =>
          [...row]
            .reverse()
            .map((glyph) => swap[glyph] ?? glyph)
            .join(""),
        )
        .reverse();
      expect(rotated).toEqual(rows);
    },
  );
});

describe("steps around rock (plan section 9)", () => {
  const arena = parseArena([
    ".........",
    ".........",
    ".1..#..2.",
    ".1..#..2.",
    ".1..#..2.",
    ".........",
    ".........",
  ]);
  const at = (x: number, y: number) => y * arena.width + x;

  test("go around rock and blocked cells; -1 where unreached", () => {
    const steps = stepsFrom(arena, [at(3, 3)]);
    expect(steps[at(5, 3)]).toBe(6);
    expect(steps[at(4, 3)]).toBe(-1);
    const blocked = stepsFrom(arena, [at(3, 3)], new Set([at(3, 2), at(3, 4)]));
    expect(blocked[at(3, 1)]).toBe(4);
    expect(blocked[at(3, 2)]).toBe(-1);
  });

  test("the rock-only steps are memoized per arena, equal to the search", () => {
    const first = rockStepsFrom(arena, at(2, 2));
    expect([...first]).toEqual([...stepsFrom(arena, [at(2, 2)])]);
    expect(rockStepsFrom(arena, at(2, 2))).toBe(first);
    // A restored battle has another arena object: it fills its own cache.
    const copy = structuredClone(arena);
    expect(rockStepsFrom(copy, at(2, 2))).not.toBe(first);
  });
});
