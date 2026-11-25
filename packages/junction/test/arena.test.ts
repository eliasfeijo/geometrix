import { parseArena } from "@geometrix/battle";
import { windowAround } from "@geometrix/sim";
import { describe, expect, test } from "vitest";
import {
  arenaOf,
  arenaShape,
  JunctionArenaError,
  worldCellOf,
} from "../src/arena.ts";
import { paramsWith, textWorld } from "./helpers.ts";

// 12 × 7: rock at (3, 1) and (4, 1); a river row at y = 5 with a crossing.
const MAP = [
  "A...........",
  "...##.......",
  "............",
  "............",
  "............",
  "~~~~~=~~~~~~",
  "...........B",
];

describe("the arena from the window (junction D5, O-4, P7)", () => {
  const world = textWorld(MAP);
  const window = windowAround(world, { x: 2, y: 1 });

  test("the window shifts to stay inside the map; 9 × 5 cells of 5 × 5 blocks plus the ring", () => {
    expect(window).toEqual({ x: 0, y: 0, width: 9, height: 5 });
    expect(arenaShape(world, window)).toEqual({ width: 47, height: 27 });
    const rows = arenaOf(world, window);
    expect(rows).toHaveLength(27);
    expect(rows.every((r) => r.length === 47)).toBe(true);
  });

  test("rock stays rock, block by block; the river is floor", () => {
    const rows = arenaOf(world, window);
    // World (3, 1) and (4, 1) are arena x 16..25, y 6..10; zone 3 (rows
    // 5..7, columns 21..25) takes the floor out of the second one.
    for (let y = 6; y <= 10; y++) {
      expect(rows[y]!.slice(16, 26)).toBe(y <= 7 ? "#####33333" : "##########");
      expect(rows[y]![15]).toBe(".");
      expect(rows[y]![26]).toBe(".");
    }
    expect(rows.join("").split("#")).toHaveLength(10 * 5 - 2 * 5 + 1);
  });

  test("the four spawn zones are always floor, halfway to the center, and parse", () => {
    const rows = arenaOf(world, window);
    const cells = (glyph: string) =>
      rows.flatMap((row, y) =>
        [...row].flatMap((g, x) => (g === glyph ? [[x, y]] : [])),
      );
    // Side 0: 3 wide, 5 tall around x = 11, y = 13; side 2: 5 wide, 3 tall.
    expect(cells("1")).toHaveLength(15);
    expect(cells("1")[0]).toEqual([10, 11]);
    expect(cells("2")[0]).toEqual([34, 11]);
    expect(cells("3")[0]).toEqual([21, 5]);
    expect(cells("4")[0]).toEqual([21, 19]);
    // Zone 3 sits on the world rock at (4, 1): floor there.
    const arena = parseArena(rows);
    expect(arena.entries.map((e) => e.facing)).toEqual([
      "right",
      "left",
      "down",
      "up",
    ]);
  });

  test("the zones' distance to the border is a param (C1-3)", () => {
    const first = (inset: number, glyph: string) => {
      const params = paramsWith((p) => {
        p.battle.zone.insetPermille = inset;
      });
      const moved = textWorld(MAP, params);
      const rows = arenaOf(moved, windowAround(moved, { x: 2, y: 1 }));
      const y = rows.findIndex((r) => r.includes(glyph));
      return [rows[y]!.indexOf(glyph), y];
    };
    // 750‰ of the way: x = floor(23 × 0.75) = 17, y = floor(13 × 0.75) = 9.
    expect(first(750, "1")).toEqual([16, 11]);
    expect(first(750, "2")).toEqual([28, 11]);
    expect(first(750, "3")).toEqual([21, 8]);
    expect(first(750, "4")).toEqual([21, 16]);
    expect(first(500, "1")).toEqual([10, 11]);
    // Too close to the edge, or the zones on top of each other: refused.
    expect(() => first(50, "1")).toThrow(JunctionArenaError);
    expect(() => first(950, "1")).toThrow(/overlap/);
  });

  test("arena cells map back by floor division; the ring to the outer cells", () => {
    const at = (x: number, y: number) => y * 47 + x;
    expect(worldCellOf(world, window, at(1, 1))).toEqual({ x: 0, y: 0 });
    expect(worldCellOf(world, window, at(0, 0))).toEqual({ x: 0, y: 0 });
    expect(worldCellOf(world, window, at(46, 26))).toEqual({ x: 8, y: 4 });
    expect(worldCellOf(world, window, at(11, 13))).toEqual({ x: 2, y: 2 });
  });

  test("a rock or river cell comes back on the nearest walkable one", () => {
    const at = (x: number, y: number) => y * 47 + x;
    // World (3, 1) is rock: up first, (3, 0).
    expect(worldCellOf(world, window, at(17, 7))).toEqual({ x: 3, y: 0 });
    const low = windowAround(world, { x: 5, y: 5 });
    expect(low).toEqual({ x: 1, y: 2, width: 9, height: 5 });
    // World (2, 5) is river: up, (2, 4).
    expect(worldCellOf(world, low, at(6, 16))).toEqual({ x: 2, y: 4 });
    // The crossing (5, 5) is walkable.
    expect(worldCellOf(world, low, at(21, 16))).toEqual({ x: 5, y: 5 });
  });
});
