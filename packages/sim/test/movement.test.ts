import { describe, expect, test } from "vitest";
import { Terrain, type GameMap } from "../src/map.ts";
import { CELL_COST, cellModifier, movePointsPerTick } from "../src/movement.ts";
import type { Dna } from "../src/params.ts";
import type { Creep } from "../src/world.ts";
import { loadTestParams } from "./helpers.ts";

const params = loadTestParams();

// One row: jungle, crossing, jungle+road, crossing+road, river, rock.
const map: GameMap = {
  width: 6,
  height: 1,
  terrain: [
    Terrain.jungle,
    Terrain.crossing,
    Terrain.jungle,
    Terrain.crossing,
    Terrain.river,
    Terrain.rock,
  ],
  road: [0, 0, 1, 1, 0, 0],
};
const JUNGLE = 0;
const CROSSING = 1;
const ROAD = 2;
const ROAD_ON_CROSSING = 3;
const RIVER = 4;
const ROCK = 5;

const creep = (dna: Dna, materia = 0, cristal = 0): Creep => ({
  id: 1,
  team: 0,
  dna,
  name: "Abo",
  hp: 1000,
  x: 0,
  y: 0,
  cargo: { materia, cristal },
  order: { type: "stop" },
  movePoints: 0,
  path: null,
  rules: [],
  dominatedBy: null,
  activity: "idle",
  trip: null,
});

describe("cellModifier", () => {
  test.each([
    [JUNGLE, 1000],
    [CROSSING, 500],
    [ROAD, 2000],
    [ROAD_ON_CROSSING, 2000],
    [RIVER, 0],
    [ROCK, 0],
  ])("cell %i -> %i per mille", (index, permille) => {
    expect(cellModifier(map, index, params)).toBe(permille);
  });
});

describe("movePointsPerTick", () => {
  test("2 cells per minute is 2000 points per tick (plan section 3)", () => {
    expect(movePointsPerTick(creep("square"), map, JUNGLE, params)).toBe(2000);
  });

  test.each([
    ["square", 2],
    ["triangle", 3],
    ["circle", 5],
  ] as const)(
    "%s on jungle enters a cell every 60/%i seconds",
    (dna, cellsPerMinute) => {
      const points = movePointsPerTick(creep(dna), map, JUNGLE, params);
      expect((CELL_COST / points) * cellsPerMinute).toBe(60);
    },
  );

  test.each([
    ["road", ROAD, 4000],
    ["crossing", CROSSING, 1000],
    ["river", RIVER, 0],
  ] as const)("square entering %s", (_, index, points) => {
    expect(movePointsPerTick(creep("square"), map, index, params)).toBe(points);
  });

  test("carrying anything applies the 800 per mille load modifier", () => {
    expect(movePointsPerTick(creep("square", 1), map, JUNGLE, params)).toBe(
      1600,
    );
    expect(movePointsPerTick(creep("square", 0, 30), map, ROAD, params)).toBe(
      3200,
    );
  });

  test("rounds down to whole points", () => {
    const slowLoad = {
      ...params,
      movementPermille: { ...params.movementPermille, loaded: 333 },
    };
    // 5000 * 1000 * 333 / 10^6 = 1665
    expect(movePointsPerTick(creep("circle", 1), map, JUNGLE, slowLoad)).toBe(
      1665,
    );
    // 2000 * 500 * 333 / 10^6 = 333
    expect(movePointsPerTick(creep("square", 1), map, CROSSING, slowLoad)).toBe(
      333,
    );
  });

  test("follows world.tickSeconds", () => {
    const twoSecondTicks = {
      ...params,
      world: { ...params.world, tickSeconds: 2 },
    };
    expect(
      movePointsPerTick(creep("square"), map, JUNGLE, twoSecondTicks),
    ).toBe(4000);
  });
});
