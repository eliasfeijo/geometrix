import { describe, expect, test } from "vitest";
import { isPassable, Terrain, type Cell, type GameMap } from "../src/map.ts";
import { findPath, pathTo, stepCost } from "../src/pathfinding.ts";
import { createWorld } from "../src/world.ts";
import { loadDefaultParams, parseMap } from "./helpers.ts";

const params = loadDefaultParams();

/** The path drawn as `*` over the map rows. The start cell is not part of it. */
function draw(map: GameMap, rows: string[], path: number[] | null): string[] {
  const out = rows.map((row) => row.split(""));
  for (const i of path ?? [])
    out[Math.floor(i / map.width)]![i % map.width] = "*";
  return out.map((row) => row.join(""));
}

function route(rows: string[], from: Cell, to: Cell): string[] {
  const map = parseMap(rows);
  return draw(map, rows, findPath(map, from, to, params));
}

describe("stepCost", () => {
  test("is the inverse of the speed modifier", () => {
    const map = parseMap([".r=~#"]);
    expect([0, 1, 2, 3, 4].map((i) => stepCost(map, i, params))).toEqual([
      1000, 500, 2000, -1, -1,
    ]);
  });
});

describe("findPath", () => {
  test("goes straight on open ground", () => {
    expect(route(["....."], { x: 0, y: 0 }, { x: 4, y: 0 })).toEqual([".****"]);
  });

  test("returns [] when already at the target", () => {
    expect(
      findPath(parseMap(["..."]), { x: 1, y: 0 }, { x: 1, y: 0 }, params),
    ).toEqual([]);
  });

  test("breaks ties between equal-cost paths the same way every time", () => {
    const rows = ["...", "...", "..."];
    const first = route(rows, { x: 0, y: 0 }, { x: 2, y: 2 });
    // Lower cell index wins: along the row first, then down.
    expect(first).toMatchInlineSnapshot(`
      [
        ".**",
        "..*",
        "..*",
      ]
    `);
    expect(route(rows, { x: 0, y: 0 }, { x: 2, y: 2 })).toEqual(first);
  });

  test("goes around rock", () => {
    expect(
      route([".#...", ".#.#.", "...#."], { x: 0, y: 0 }, { x: 4, y: 0 }),
    ).toEqual([".#***", "*#*#.", "***#."]);
  });

  test("crosses the river only at a crossing", () => {
    expect(
      route(["....", "~~=~", "~~=~", "...."], { x: 0, y: 0 }, { x: 0, y: 3 }),
    ).toEqual([".**.", "~~*~", "~~*~", "***."]);
  });

  test("converges on a road when it is cheaper, even if longer", () => {
    // Straight: 20 jungle cells = 20000. Via the road: 13500.
    const rows = ["r".repeat(21), ".".repeat(21), ".".repeat(21)];
    expect(route(rows, { x: 0, y: 2 }, { x: 20, y: 2 })).toEqual([
      "*".repeat(21),
      "*" + ".".repeat(19) + "*",
      "." + ".".repeat(19) + "*",
    ]);
  });

  test("keeps to the jungle when the road detour costs more", () => {
    // Straight: 6000. Via the road: 6500.
    const rows = ["rrrrrrr", ".......", "......."];
    expect(route(rows, { x: 0, y: 2 }, { x: 6, y: 2 })).toEqual([
      "rrrrrrr",
      ".......",
      ".******",
    ]);
  });

  test.each([
    ["an impassable target", [".#"], { x: 1, y: 0 }],
    ["a walled-off target", [".#.", "##."], { x: 2, y: 0 }],
  ])("returns null for %s", (_, rows, to) => {
    expect(findPath(parseMap(rows), { x: 0, y: 0 }, to, params)).toBeNull();
  });

  test.each([1, 2, 3, 42, 649])(
    "seed %i: a core-to-core path is a chain of passable neighbors",
    (seed) => {
      const world = createWorld(seed, params);
      const [a, b] = world.teams.map((t) => t.core) as [Cell, Cell];
      const path = findPath(world.map, a, b, params)!;
      expect(path.at(-1)).toBe(b.y * world.map.width + b.x);
      let prev = a.y * world.map.width + a.x;
      for (const i of path) {
        expect(isPassable(world.map.terrain[i]!)).toBe(true);
        const dx = Math.abs((i % world.map.width) - (prev % world.map.width));
        const dy = Math.abs(
          Math.floor(i / world.map.width) - Math.floor(prev / world.map.width),
        );
        expect(dx + dy).toBe(1);
        prev = i;
      }
    },
  );
});

describe("pathTo (cache)", () => {
  function setup() {
    const world = createWorld(42, params);
    world.map = parseMap([".......", ".......", "......."]);
    const creep = world.creeps[0]!;
    creep.x = 0;
    creep.y = 2;
    return { world, creep };
  }

  test("reuses the cached path while target and roads are unchanged", () => {
    const { world, creep } = setup();
    const first = pathTo(world, creep, { x: 6, y: 2 });
    // Changing the map without a road revision must not trigger a recompute.
    world.map.terrain[3 + 2 * 7] = Terrain.rock;
    expect(pathTo(world, creep, { x: 6, y: 2 })).toBe(first);
  });

  test("recomputes when the target changes", () => {
    const { world, creep } = setup();
    const first = pathTo(world, creep, { x: 6, y: 2 });
    const second = pathTo(world, creep, { x: 6, y: 0 });
    expect(second).not.toBe(first);
    expect(second?.at(-1)).toBe(6);
  });

  test("recomputes when a road was completed", () => {
    const { world, creep } = setup();
    const before = pathTo(world, creep, { x: 6, y: 2 });
    // A road along row 1: 4500 instead of 6000 for the straight jungle path.
    for (let x = 0; x < 7; x++) world.map.road[7 + x] = 1;
    world.roadRevision += 1;
    const after = pathTo(world, creep, { x: 6, y: 2 });
    expect(after).not.toEqual(before);
    expect(creep.path?.roadRevision).toBe(1);
  });

  test("clears the cache when the target is unreachable", () => {
    const { world, creep } = setup();
    pathTo(world, creep, { x: 6, y: 2 });
    world.map.terrain[6] = Terrain.rock;
    expect(pathTo(world, creep, { x: 6, y: 0 })).toBeNull();
    expect(creep.path).toBeNull();
  });
});
