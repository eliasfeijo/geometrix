import { describe, expect, test } from "vitest";
import {
  collectorRules,
  presetRules,
  roadBuilderRules,
} from "../src/presets.ts";
import { startProduction } from "../src/production.ts";
import { createWorld } from "../src/world.ts";
import { creepOf, loadDefaultParams, run, textWorld } from "./helpers.ts";

const params = loadDefaultParams();

describe("preset rules", () => {
  test("collectors deliver when full, gather, then bring the leftover home", () => {
    expect(presetRules("cristalCollector", null)).toEqual([
      { when: { type: "cargoFull" }, then: { type: "deliver" } },
      {
        when: { type: "always" },
        then: { type: "gather", resource: "cristal" },
      },
      { when: { type: "always" }, then: { type: "deliver" } },
    ]);
    expect(presetRules("materiaCollector", null)).toEqual(
      collectorRules("materia"),
    );
  });

  test("the road builder builds toward its target before gathering materia", () => {
    expect(presetRules("roadBuilder", { x: 4, y: 9 })).toEqual([
      { when: { type: "cargoFull" }, then: { type: "deliver" } },
      { when: { type: "always" }, then: { type: "buildRoad", x: 4, y: 9 } },
      {
        when: { type: "always" },
        then: { type: "gather", resource: "materia" },
      },
      { when: { type: "always" }, then: { type: "deliver" } },
    ]);
  });

  test("the road builder needs a target", () => {
    expect(() => presetRules("roadBuilder", null)).toThrow();
  });

  test("every call builds fresh rule objects", () => {
    const a = collectorRules("materia");
    const b = collectorRules("materia");
    expect(a).toEqual(b);
    expect(a[0]).not.toBe(b[0]);
    expect(a[0]!.when).not.toBe(b[0]!.when);
  });
});

describe("creeps are born materia collectors", () => {
  test("the initial population", () => {
    const world = createWorld(42, params);
    for (const creep of world.creeps) {
      expect(creep.rules).toEqual(collectorRules("materia"));
    }
  });

  test("a produced creep", () => {
    const world = textWorld(["A.....B"]);
    world.teams[0]!.stock = { materia: 40, cristal: 10 };
    startProduction(world, 0, "circle", false);
    run(world, 600);
    expect(world.creeps.at(-1)!.rules).toEqual(collectorRules("materia"));
  });

  test("on a generated map both teams fill their materia stock", () => {
    const world = createWorld(42, params);
    run(world, 3600);
    for (const team of world.teams) {
      expect(team.stock.materia).toBeGreaterThan(300);
      expect(team.stock.cristal).toBe(0);
    }
  });
});

describe("presets at work", () => {
  test("a cristal collector empties the deposit, then idles at the core", () => {
    const world = textWorld(["A.c......B"]);
    const creep = creepOf(world, 0, "circle");
    creep.rules = collectorRules("cristal");
    world.deposits[0]!.amount = 25;
    run(world, 1000);
    expect(world.teams[0]!.stock.cristal).toBe(25);
    expect(creep).toMatchObject({
      x: 0,
      y: 0,
      cargo: { materia: 0, cristal: 0 },
    });
  });

  test("a road builder pays for its road by gathering materia", () => {
    const world = textWorld(["Am.......B"]);
    const creep = creepOf(world, 0, "circle");
    creep.rules = roadBuilderRules({ x: 5, y: 0 });
    run(world, 3000);
    expect(world.map.road.slice(0, 7)).toEqual([0, 1, 1, 1, 1, 1, 0]);
    expect(world.teams[0]!.stock.materia).toBeGreaterThan(0);
  });
});
