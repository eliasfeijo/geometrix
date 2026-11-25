import { describe, expect, test } from "vitest";
import { isReaction } from "../src/autopilot.ts";
import {
  collectorRules,
  helpRule,
  presetRules,
  roadBuilderRules,
  withHelp,
} from "../src/presets.ts";
import { startProduction } from "../src/production.ts";
import { step } from "../src/step.ts";
import { createWorld } from "../src/world.ts";
import { creepOf, loadTestParams, run, textWorld } from "./helpers.ts";

const params = loadTestParams();

describe("preset rules", () => {
  test("collectors deliver when full, gather, explore while they know no deposit, then bring the leftover home", () => {
    expect(presetRules("cristalCollector", "square").slice(1)).toEqual([
      { when: { type: "cargoFull" }, then: { type: "deliver" } },
      {
        when: { type: "always" },
        then: { type: "gather", resource: "cristal" },
      },
      {
        when: { type: "resourceUnknown", resource: "cristal" },
        then: { type: "explore" },
      },
      { when: { type: "always" }, then: { type: "deliver" } },
    ]);
    expect(presetRules("materiaCollector", "square")).toEqual(
      withHelp(collectorRules("materia"), "square"),
    );
  });

  test("the scout explores, then goes back to the core", () => {
    expect(presetRules("scout", "circle").slice(1)).toEqual([
      { when: { type: "always" }, then: { type: "explore" } },
      { when: { type: "always" }, then: { type: "deliver" } },
    ]);
  });

  test("the road builder builds toward the target it resolves, before gathering materia", () => {
    expect(presetRules("roadBuilder", "triangle").slice(1)).toEqual([
      { when: { type: "cargoFull" }, then: { type: "deliver" } },
      { when: { type: "always" }, then: { type: "buildRoad" } },
      {
        when: { type: "always" },
        then: { type: "gather", resource: "materia" },
      },
      { when: { type: "always" }, then: { type: "deliver" } },
    ]);
  });

  test("every preset starts with the DNA's help rule (R spec D10, D11)", () => {
    expect(helpRule("square")).toEqual({
      when: { type: "allyInBattle", radius: 6 },
      then: { type: "joinBattle", minHpPermille: 400 },
    });
    expect(helpRule("triangle")).toEqual({
      when: { type: "allyInBattle", radius: 6 },
      then: { type: "joinBattle", minHpPermille: 500 },
    });
    expect(helpRule("circle")).toEqual({
      when: { type: "allyInBattle", radius: 8 },
      then: { type: "joinBattle", minHpPermille: 500 },
    });
    for (const preset of [
      "materiaCollector",
      "cristalCollector",
      "roadBuilder",
      "scout",
      "raider",
    ] as const) {
      const rules = presetRules(preset, "circle");
      const at = rules.findIndex((r) => r.then.type === "joinBattle");
      expect(rules[at]).toEqual(helpRule("circle"));
      // After the reactions only: the raider's flee and fight.
      expect(rules.slice(0, at).every((r) => isReaction(r.then))).toBe(true);
      expect(rules.filter((r) => r.then.type === "joinBattle")).toHaveLength(1);
    }
  });

  test("the help rule goes after the reaction rules, before everything else (H-3)", () => {
    const rules = withHelp(
      [
        { when: { type: "always" }, then: { type: "pay" } },
        { when: { type: "always" }, then: { type: "flee" } },
        ...collectorRules("materia"),
      ],
      "triangle",
    );
    expect(rules.map((r) => r.then.type)).toEqual([
      "pay",
      "flee",
      "joinBattle",
      "deliver",
      "gather",
      "explore",
      "deliver",
    ]);
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
      expect(creep.rules).toEqual(presetRules("materiaCollector", creep.dna));
    }
  });

  test("a produced creep", () => {
    const world = textWorld(["A.....B"]);
    world.teams[0]!.stock = { materia: 40, cristal: 10 };
    startProduction(world, 0, "circle", false);
    run(world, 600);
    expect(world.creeps.at(-1)!.rules).toEqual(
      withHelp(collectorRules("materia"), "circle"),
    );
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
    // The only deposit, 5 cells away, is its target (R spec D12).
    const world = textWorld(["A....m...B"]);
    const creep = creepOf(world, 0, "circle");
    creep.rules = roadBuilderRules();
    run(world, 3000);
    expect(world.map.road.slice(0, 7)).toEqual([0, 1, 1, 1, 1, 1, 0]);
    expect(world.teams[0]!.stock.materia).toBeGreaterThan(0);
  });

  test("a road builder re-resolves its target: once the nearest deposit has a road, the next (RB-1)", () => {
    const world = textWorld(["A..m...m......B"]);
    const creep = creepOf(world, 0, "circle");
    creep.rules = roadBuilderRules();
    world.teams[0]!.stock.materia = 10_000;
    step(world, []);
    expect(creep.order).toMatchObject({ type: "buildRoad", x: 3, y: 0 });
    run(world, 6000);
    expect(world.map.road.slice(0, 9)).toEqual([0, 1, 1, 1, 1, 1, 1, 1, 0]);
  });
});
