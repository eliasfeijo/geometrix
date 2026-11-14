import { Terrain } from "@geometrix/sim";
import { describe, expect, it } from "vitest";
import {
  roadJoinsDown,
  roadRuns,
  ROCK_EDGE,
  rockEdges,
  terrainRuns,
} from "../src/map/terrain.ts";
import { testWorld } from "./helpers.ts";

const { jungle: J, river: W, crossing: C, rock: R } = Terrain;

describe("terrain runs", () => {
  it("merges equal cells along each row and skips jungle", () => {
    const map = { width: 4, height: 2, terrain: [J, R, R, J, W, W, C, W] };
    expect(terrainRuns(map)).toEqual([
      { terrain: R, x: 1, y: 0, length: 2 },
      { terrain: W, x: 0, y: 1, length: 2 },
      { terrain: C, x: 2, y: 1, length: 1 },
      { terrain: W, x: 3, y: 1, length: 1 },
    ]);
  });

  it("covers every non-jungle cell of a real map exactly once", () => {
    const { map } = testWorld();
    const covered = new Array<number>(map.terrain.length).fill(0);
    for (const run of terrainRuns(map)) {
      for (let i = 0; i < run.length; i++) {
        const index = run.y * map.width + run.x + i;
        expect(map.terrain[index]).toBe(run.terrain);
        covered[index]!++;
      }
    }
    map.terrain.forEach((t, i) => expect(covered[i]).toBe(t === J ? 0 : 1));
  });

  it("merges road cells into row runs, in any order", () => {
    expect(roadRuns([5, 2, 3, 9, 10, 11], 5)).toEqual([
      { x: 2, y: 0, length: 2 },
      { x: 0, y: 1, length: 1 },
      { x: 4, y: 1, length: 1 },
      { x: 0, y: 2, length: 2 },
    ]);
  });
});

describe("rock relief", () => {
  // 3x3 map, rocks at (1,1) and (2,1): one block touching the right border.
  const map = { width: 3, height: 3, terrain: [J, J, J, J, R, R, J, J, J] };

  it("lights the sides facing up and left, shades those facing down and right", () => {
    const { lit, shade } = rockEdges(map);
    const half = ROCK_EDGE / 2;
    expect(lit).toBe(`M1 ${1 + half}h1M${1 + half} 1v1M2 ${1 + half}h1`);
    expect(shade).toBe(`M1 ${2 - half}h1M2 ${2 - half}h1`);
  });

  it("draws nothing where rocks touch each other or the map's edge", () => {
    const full = { width: 2, height: 1, terrain: [R, R] };
    expect(rockEdges(full)).toEqual({ lit: "", shade: "" });
  });
});

describe("road joins", () => {
  it("joins a road cell to the one right below it", () => {
    // width 4: a vertical road (1,0)-(1,1)-(1,2) and a lone cell (3,0).
    expect(roadJoinsDown([9, 1, 5, 3], 4)).toEqual([
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]);
  });
});
