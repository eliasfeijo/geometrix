import { describe, expect, test } from "vitest";
import { generateMap } from "../src/map.ts";
import { createWorld, SIM_VERSION } from "../src/world.ts";
import { loadDefaultParams } from "./helpers.ts";

const params = loadDefaultParams();

describe("createWorld", () => {
  const world = createWorld(42, params);

  test("is deterministic for a seed", () => {
    expect(createWorld(42, params)).toEqual(world);
  });

  test("starts at tick 0 with the current sim version and the given params", () => {
    expect(world.tick).toBe(0);
    expect(world.simVersion).toBe(SIM_VERSION);
    expect(world.params).toBe(params);
    expect(world.seed).toBe(42);
  });

  test("uses the generated map and continues its rng", () => {
    const generated = generateMap(42, params);
    expect(world.map).toEqual(generated.layout.map);
    expect(world.rng).toEqual(generated.rng);
    expect(world.mapSeed).toBe(generated.mapSeed);
  });

  test("has two teams on the map cores with the initial stock", () => {
    const { cores } = generateMap(42, params).layout;
    expect(world.teams).toEqual([
      {
        id: 0,
        core: cores[0],
        stock: { materia: 0, cristal: 0 },
        upgrades: { capacity: false },
      },
      {
        id: 1,
        core: cores[1],
        stock: { materia: 0, cristal: 0 },
        upgrades: { capacity: false },
      },
    ]);
  });

  test("spawns the initial population on each core: 2 of each DNA", () => {
    for (const team of world.teams) {
      const creeps = world.creeps.filter((c) => c.team === team.id);
      expect(creeps.map((c) => c.dna)).toEqual([
        "square",
        "square",
        "triangle",
        "triangle",
        "circle",
        "circle",
      ]);
      for (const c of creeps) expect({ x: c.x, y: c.y }).toEqual(team.core);
    }
  });

  test("fills deposits from the params", () => {
    expect(world.deposits).toHaveLength(2 * (3 + 3) + 2);
    for (const d of world.deposits) {
      expect(d.amount).toBe(d.kind === "materia" ? 500 : 300);
    }
  });

  test("ids are unique, increasing per array, and below nextId", () => {
    const ids = [...world.deposits, ...world.creeps].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const list of [world.deposits, world.creeps]) {
      const listIds = list.map((e) => e.id);
      expect(listIds).toEqual([...listIds].sort((a, b) => a - b));
    }
    expect(world.nextId).toBe(Math.max(...ids) + 1);
  });
});
