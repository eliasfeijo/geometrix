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

  test("a zone inside the arena faces away from the edge nearest to it", () => {
    const arena = parseArena([
      "...........",
      "...........",
      "......3....",
      "..11.......",
      "..11....22.",
      "...........",
      "..4........",
      "...........",
    ]);
    expect(arena.entries.map((e) => e.facing)).toEqual([
      "right",
      "left",
      "down",
      "up",
    ]);
    expect(arena.entries[0]!.cells).toEqual([
      at(arena, 2, 3),
      at(arena, 3, 3),
      at(arena, 2, 4),
      at(arena, 3, 4),
    ]);
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
      "a zone as near to two edges",
      [".....", ".1...", ".....", "..2..", "....."],
      "as near to two edges",
    ],
    [
      "a zone in the middle of a square arena",
      [
        ".......",
        ".2.....",
        ".......",
        "...1...",
        ".......",
        ".......",
        ".......",
      ],
      "zone 1 is as near",
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
  test.each(ARENA_NAMES)(
    "%s is 45 × 29 with four 15-cell zones a quarter of the way in",
    (name) => {
      const arena = parseArena(readArenaRows(name));
      expect([arena.width, arena.height]).toEqual([45, 29]);
      expect(arena.entries.map((e) => e.cells.length)).toEqual([
        15, 15, 15, 15,
      ]);
      expect(arena.entries.map((e) => e.facing)).toEqual([
        "right",
        "left",
        "down",
        "up",
      ]);
      // Zones 1 and 2 sit a quarter of the inner width from the left and
      // right edges (spec D3, section 6): no zone touches the exit ring's
      // neighbourhood, so nobody spawns one step from escaping.
      const xs = (side: number) =>
        arena.entries[side]!.cells.map((c) => cellX(arena, c));
      expect(Math.min(...xs(0))).toBe(10);
      expect(Math.max(...xs(1))).toBe(34);
      for (const entry of arena.entries) {
        for (const cell of entry.cells) {
          const x = cellX(arena, cell);
          const y = cellY(arena, cell);
          expect(Math.min(x, y, 44 - x, 28 - y)).toBeGreaterThanOrEqual(6);
        }
      }
    },
  );

  test("aberta-3x is 65 × 41, for the report only", () => {
    const arena = parseArena(readArenaRows("aberta-3x"));
    expect([arena.width, arena.height]).toEqual([65, 41]);
    expect(arena.rock.every((r) => r === 0)).toBe(true);
    expect(arena.entries.map((e) => e.cells.length)).toEqual([15, 15, 15, 15]);
  });

  test.each([...ARENA_NAMES, "aberta-3x"])(
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
