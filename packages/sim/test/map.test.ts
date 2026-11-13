import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  crossingColumns,
  generateMap,
  isPassable,
  Terrain,
  type Cell,
  type GameMap,
  type MapLayout,
} from "../src/map.ts";
import { parseParams, type Params } from "../src/params.ts";

const params = parseParams(
  JSON.parse(
    readFileSync(
      new URL("../../../params/default.json", import.meta.url),
      "utf8",
    ),
  ),
);
const SEEDS = Array.from({ length: 500 }, (_, i) => i);
const layouts = new Map<number, MapLayout>(
  SEEDS.map((seed) => [seed, generateMap(seed, params).layout]),
);

const manhattan = (a: Cell, b: Cell) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const at = (map: GameMap, c: Cell) => map.terrain[c.y * map.width + c.x]!;
const sideRows = (params.map.height - params.map.riverRows) / 2;

/** Independent flood fill: cells reachable from `start` through passable terrain. */
function reachable(map: GameMap, start: Cell): Set<string> {
  const seen = new Set([`${start.x},${start.y}`]);
  const queue = [start];
  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    for (const n of [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
    ]) {
      const key = `${n.x},${n.y}`;
      const inside =
        n.x >= 0 && n.x < map.width && n.y >= 0 && n.y < map.height;
      if (inside && !seen.has(key) && isPassable(at(map, n))) {
        seen.add(key);
        queue.push(n);
      }
    }
  }
  return seen;
}

describe("generateMap", () => {
  test("is deterministic for a seed", () => {
    expect(generateMap(42, params)).toEqual(generateMap(42, params));
    expect(generateMap(42, params).layout).not.toEqual(
      generateMap(43, params).layout,
    );
  });

  test("lays out the river and the 3 crossings from the params", () => {
    expect(crossingColumns(params)).toEqual([15, 31, 47]);
    const { map } = layouts.get(0)!;
    for (const y of [sideRows, sideRows + 1]) {
      const row = Array.from({ length: map.width }, (_, x) =>
        at(map, { x, y }),
      );
      const crossingXs = row.flatMap((t, x) =>
        t === Terrain.crossing ? [x] : [],
      );
      expect(crossingXs).toEqual([15, 16, 31, 32, 47, 48]);
      expect(row.filter((t) => t === Terrain.river)).toHaveLength(64 - 6);
    }
  });

  test.each(SEEDS)("seed %i: point-symmetric", (seed) => {
    const { map, cores, deposits } = layouts.get(seed)!;
    const mirror = (c: Cell) => ({
      x: map.width - 1 - c.x,
      y: map.height - 1 - c.y,
    });
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        expect(at(map, { x, y })).toBe(at(map, mirror({ x, y })));
      }
    }
    expect(cores[1]).toEqual(mirror(cores[0]));
    const key = (d: { kind: string } & Cell) => `${d.kind}@${d.x},${d.y}`;
    expect(
      deposits.map((d) => key({ kind: d.kind, ...mirror(d) })).sort(),
    ).toEqual(deposits.map(key).sort());
  });

  test.each(SEEDS)("seed %i: cores and deposits are connected", (seed) => {
    const { map, cores, deposits } = layouts.get(seed)!;
    const region = reachable(map, cores[0]);
    for (const c of [cores[1], ...deposits]) {
      expect(region.has(`${c.x},${c.y}`)).toBe(true);
    }
  });

  test.each(SEEDS)("seed %i: placement rules", (seed) => {
    const { map, cores, deposits } = layouts.get(seed)!;
    const [core] = cores;
    const { core: zone, rocks } = params.map;
    expect(core.y).toBeGreaterThanOrEqual(zone.minRow);
    expect(core.y).toBeLessThanOrEqual(zone.maxRow);
    expect(core.x).toBeGreaterThanOrEqual(zone.minCol);
    expect(core.x).toBeLessThanOrEqual(zone.maxCol);

    const cells = [...cores, ...deposits].map((c) => `${c.x},${c.y}`);
    expect(new Set(cells).size).toBe(cells.length);
    for (const c of [...cores, ...deposits]) {
      expect(at(map, c)).toBe(Terrain.jungle);
    }

    const top = deposits.filter((d) => d.y < sideRows);
    const materia = top.filter((d) => d.kind === "materia");
    const cristal = top.filter((d) => d.kind === "cristal");
    expect(materia).toHaveLength(params.deposits.materia.perSide);
    expect(cristal).toHaveLength(
      params.deposits.cristal.perSide + params.deposits.cristal.contested / 2,
    );
    for (const d of materia) {
      expect(manhattan(d, core)).toBeGreaterThanOrEqual(3);
      expect(manhattan(d, core)).toBeLessThanOrEqual(8);
    }
    // Contested sites are the last ones on each side (see MapLayout).
    const contested = cristal.slice(params.deposits.cristal.perSide);
    for (const d of cristal.slice(0, params.deposits.cristal.perSide)) {
      expect(manhattan(d, core)).toBeGreaterThanOrEqual(12);
    }
    for (const d of contested) {
      expect(sideRows - d.y).toBeLessThanOrEqual(3);
      const nearCrossing = crossingColumns(params).some((left) =>
        [left, left + 1].some((x) => manhattan(d, { x, y: sideRows }) <= 4),
      );
      expect(nearCrossing).toBe(true);
    }

    for (let y = 0; y < sideRows; y++) {
      for (let x = 0; x < map.width; x++) {
        if (at(map, { x, y }) === Terrain.rock) {
          expect(manhattan({ x, y }, core)).toBeGreaterThan(
            rocks.coreClearance,
          );
        }
      }
    }
  });

  test("has rocks on typical seeds", () => {
    const rockCounts = SEEDS.map(
      (seed) =>
        layouts.get(seed)!.map.terrain.filter((t) => t === Terrain.rock).length,
    );
    const min =
      params.map.rocks.clustersPerSide * params.map.rocks.minCells * 2;
    expect(rockCounts.filter((n) => n >= min).length).toBeGreaterThan(450);
  });

  test("an invalid map is regenerated from seed + 1", () => {
    // Seed 649 is one of the rare default-param seeds whose first map is
    // invalid (found by scanning seeds 0..1999).
    const retried = generateMap(649, params);
    expect(retried.mapSeed).toBe(650);
    expect(retried.layout).toEqual(generateMap(650, params).layout);
  });

  test("gives up with a clear error when no seed works", () => {
    // Full-width rock walls leave no valid placement or path.
    const walled: Params = {
      ...params,
      map: {
        ...params.map,
        rocks: {
          clustersPerSide: 60,
          minCells: 64,
          maxCells: 64,
          coreClearance: 2,
        },
      },
    };
    expect(() => generateMap(1, walled)).toThrow(
      /no valid map within 100 seeds/,
    );
  });
});
