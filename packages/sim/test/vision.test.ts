import { describe, expect, test } from "vitest";
import { createWorld } from "../src/world.ts";
import {
  manhattan,
  mirrorCell,
  Terrain,
  type Cell,
  type GameMap,
} from "../src/map.ts";
import { computeSight, sightCells } from "../src/vision.ts";
import { loadTestParams, parseMap } from "./helpers.ts";

/** The map with `o` on every cell in sight that is not a rock, `@` the viewer. */
function picture(map: GameMap, from: Cell, cells: readonly number[]): string {
  const symbols = [".", "~", "=", "#"];
  const seen = new Set(cells);
  const rows: string[] = [];
  for (let y = 0; y < map.height; y++) {
    let row = "";
    for (let x = 0; x < map.width; x++) {
      const i = y * map.width + x;
      if (x === from.x && y === from.y) row += "@";
      else if (map.terrain[i] === Terrain.rock) row += seen.has(i) ? "#" : "%";
      else row += seen.has(i) ? "o" : symbols[map.terrain[i]!]!;
    }
    rows.push(row);
  }
  return `\n${rows.join("\n")}\n`;
}

describe("line of sight", () => {
  test("a rock hides what is behind it and is seen itself", () => {
    const map = parseMap(["...#....."]);
    const from = { x: 0, y: 0 };
    expect(picture(map, from, computeSight(map, from, 8, false))).toBe(
      "\n@oo#.....\n",
    );
  });

  test("river and crossings do not block", () => {
    const map = parseMap([".....", "~~=~~", ".....", "~~~~~", "....."]);
    const from = { x: 2, y: 0 };
    const cells = computeSight(map, from, 4, false);
    expect(cells).toContain(4 * 5 + 2);
    expect(cells).toHaveLength(
      map.terrain.filter(
        (_, i) => manhattan(from, { x: i % 5, y: Math.floor(i / 5) }) <= 4,
      ).length,
    );
  });

  test("the radius is Manhattan and the map edge cuts it", () => {
    const map = parseMap([".......", ".......", ".......", "......."]);
    const from = { x: 1, y: 1 };
    expect(picture(map, from, computeSight(map, from, 2, false)))
      .toMatchInlineSnapshot(`
        "
        ooo....
        o@oo...
        ooo....
        .o.....
        "
      `);
  });

  test("a wall of rocks casts a shadow", () => {
    const map = parseMap([
      "...........",
      "...........",
      "....###....",
      "...........",
      "...........",
      "...........",
    ]);
    const from = { x: 5, y: 5 };
    expect(picture(map, from, computeSight(map, from, 6, false)))
      .toMatchInlineSnapshot(`
        "
        ...........
        ...o...o...
        ..oo###oo..
        .ooooooooo.
        ooooooooooo
        ooooo@ooooo
        "
      `);
  });

  test("radius 0 sees only the viewer's own cell", () => {
    const map = parseMap(["...", "..."]);
    expect(computeSight(map, { x: 1, y: 1 }, 0, false)).toEqual([4]);
  });

  test("sightCells caches computeSight per cell, radius and side", () => {
    const map = createWorld(42, loadTestParams()).map;
    const from = { x: 20, y: 10 };
    const first = sightCells(map, from, 6, false);
    expect(first).toEqual(computeSight(map, from, 6, false));
    expect(sightCells(map, from, 6, false)).toBe(first);
    expect(sightCells(map, from, 6, true)).toEqual(
      computeSight(map, from, 6, true),
    );
    expect(sightCells(map, from, 4, false)).toEqual(
      computeSight(map, from, 4, false),
    );
  });

  test("on the generated map, team 1 sees the mirror of what team 0 sees", () => {
    const map = createWorld(42, loadTestParams()).map;
    const size = map.width * map.height;
    const mirrored = (cells: readonly number[]) =>
      cells.map((i) => size - 1 - i).sort((a, b) => a - b);
    // The same map without rocks: what each viewer would see unblocked.
    const open: GameMap = {
      ...map,
      terrain: map.terrain.map((t) =>
        t === Terrain.rock ? Terrain.jungle : t,
      ),
    };
    let shadowed = 0;
    for (let i = 0; i < size; i++) {
      const cell = { x: i % map.width, y: Math.floor(i / map.width) };
      const mirror = mirrorCell(cell, map);
      for (const radius of [3, 4, 6, 8]) {
        const top = computeSight(map, cell, radius, false);
        expect(mirrored(computeSight(map, mirror, radius, true))).toEqual(top);
        if (top.length < computeSight(open, cell, radius, false).length) {
          shadowed++;
        }
      }
    }
    // Rocks do hide cells on this map: the test is not vacuous.
    expect(shadowed).toBeGreaterThan(100);
  });
});
