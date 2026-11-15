import { describe, expect, test } from "vitest";
import type { Rule } from "../src/autopilot.ts";
import { join } from "../src/domination.ts";
import { collectorRules, roadBuilderRules } from "../src/presets.ts";
import {
  applyPreset,
  applyPresetRefusal,
  setRules,
  setRulesRefusal,
} from "../src/rules.ts";
import { step } from "../src/step.ts";
import type { WorldState } from "../src/world.ts";
import { textWorld } from "./helpers.ts";

/** Players 1 and 2 on team 0, player 3 on team 1; core A at x=0. */
function world(): WorldState {
  const w = textWorld(["A.m......B"]);
  join(w, 1, 0, false);
  join(w, 2, 0, false);
  join(w, 3, 1, false);
  return w;
}

const ownCreep = (w: WorldState) => w.creeps.find((c) => c.team === 0)!;
const always = { type: "always" } as const;

describe("setRules", () => {
  test("any player of the team sets the rules, without dominating", () => {
    const w = world();
    const creep = ownCreep(w);
    const rules: Rule[] = [
      {
        when: { type: "stockBelow", resource: "cristal", amount: 50 },
        then: { type: "gather", resource: "cristal" },
      },
      {
        when: { type: "resourceInRange", resource: "materia", radius: 4 },
        then: { type: "moveTo", x: 3, y: 0 },
      },
      { when: always, then: { type: "buildRoad", x: 5, y: 0 } },
      {
        when: { type: "resourceUnknown", resource: "cristal" },
        then: { type: "explore" },
      },
    ];
    expect(setRulesRefusal(w, 2, creep.id, rules)).toBeNull();
    setRules(w, creep.id, rules);
    expect(creep.rules).toEqual(rules);
    expect(creep.rules[0]).not.toBe(rules[0]);
  });

  test("an empty list is valid: the creep keeps its order", () => {
    const w = world();
    expect(setRulesRefusal(w, 1, ownCreep(w).id, [])).toBeNull();
  });

  test("copies the encounter vocabulary, the DNA filter only when given", () => {
    const w = world();
    const creep = ownCreep(w);
    const rules = [
      {
        when: { type: "enemyInSight", radius: 6, minCargo: 2, extra: 1 },
        then: {
          type: "approach",
          intent: "extort",
          radius: 6,
          dna: ["square"],
          minCargo: 2,
        },
      },
      { when: { type: "hpBelow", permille: 400 }, then: { type: "flee" } },
      { when: { type: "demandAtMost", permille: 0 }, then: { type: "pay" } },
      { when: always, then: { type: "fight" } },
      { when: always, then: { type: "pickup" } },
    ] as unknown as Rule[];
    expect(setRulesRefusal(w, 1, creep.id, rules)).toBeNull();
    setRules(w, creep.id, rules);
    expect(creep.rules).toEqual([
      {
        when: { type: "enemyInSight", radius: 6, minCargo: 2 },
        then: {
          type: "approach",
          intent: "extort",
          radius: 6,
          dna: ["square"],
          minCargo: 2,
        },
      },
      { when: { type: "hpBelow", permille: 400 }, then: { type: "flee" } },
      { when: { type: "demandAtMost", permille: 0 }, then: { type: "pay" } },
      { when: always, then: { type: "fight" } },
      { when: always, then: { type: "pickup" } },
    ]);
    const filter = creep.rules[0]!.then;
    if (filter.type !== "approach") throw new Error("unreachable");
    expect(filter.dna).not.toBe((rules[0]!.then as typeof filter).dna);
  });

  test("copies only vocabulary fields", () => {
    const w = world();
    const creep = ownCreep(w);
    const extra = {
      when: { type: "cargoFull", note: "x" },
      then: { type: "deliver", depositId: 3 },
      label: "mine",
    } as unknown as Rule;
    setRules(w, creep.id, [extra]);
    expect(creep.rules).toEqual([
      { when: { type: "cargoFull" }, then: { type: "deliver" } },
    ]);
  });

  test("refuses another team's creep", () => {
    const w = world();
    expect(setRulesRefusal(w, 3, ownCreep(w).id, [])).toBe("unknownCreep");
  });

  test("refuses more than autopilot.maxRules rules", () => {
    const w = world();
    const rules: Rule[] = new Array(11).fill({
      when: always,
      then: { type: "stop" },
    });
    expect(setRulesRefusal(w, 1, ownCreep(w).id, rules)).toBe("tooManyRules");
    expect(setRulesRefusal(w, 1, ownCreep(w).id, rules.slice(1))).toBeNull();
  });

  test.each([
    [
      "an unknown condition",
      { when: { type: "sometimes" }, then: { type: "stop" } },
    ],
    ["an unknown action", { when: always, then: { type: "fly" } }],
    [
      "an unknown resource",
      { when: always, then: { type: "gather", resource: "ouro" } },
    ],
    [
      "a negative radius",
      {
        when: { type: "resourceInRange", resource: "materia", radius: -1 },
        then: { type: "stop" },
      },
    ],
    [
      "a fractional amount",
      {
        when: { type: "stockBelow", resource: "materia", amount: 1.5 },
        then: { type: "stop" },
      },
    ],
    [
      "a target outside the map",
      { when: always, then: { type: "moveTo", x: 0, y: 1 } },
    ],
    [
      "a road target outside the map",
      { when: always, then: { type: "buildRoad", x: -1, y: 0 } },
    ],
    [
      "an unknown resource in resourceUnknown",
      {
        when: { type: "resourceUnknown", resource: "ouro" },
        then: { type: "explore" },
      },
    ],
    [
      "an unknown DNA in enemyInSight",
      {
        when: { type: "enemyInSight", radius: 5, dna: ["star"], minCargo: 0 },
        then: { type: "stop" },
      },
    ],
    [
      "a repeated DNA in approach",
      {
        when: always,
        then: {
          type: "approach",
          intent: "attack",
          radius: 5,
          dna: ["circle", "circle"],
          minCargo: 0,
        },
      },
    ],
    [
      "an unknown intent",
      {
        when: always,
        then: { type: "approach", intent: "hug", radius: 5, minCargo: 0 },
      },
    ],
    [
      "a per mille above 1000",
      { when: { type: "hpBelow", permille: 1001 }, then: { type: "flee" } },
    ],
    [
      "a missing minCargo",
      { when: { type: "enemyInSight", radius: 5 }, then: { type: "stop" } },
    ],
  ])("refuses %s", (_, rule) => {
    const w = world();
    expect(setRulesRefusal(w, 1, ownCreep(w).id, [rule as Rule])).toBe(
      "invalidRule",
    );
  });
});

describe("applyPreset", () => {
  test("replaces the rules with the preset's", () => {
    const w = world();
    const creep = ownCreep(w);
    expect(
      applyPresetRefusal(w, 2, creep.id, "cristalCollector", null),
    ).toBeNull();
    applyPreset(w, creep.id, "cristalCollector", null);
    expect(creep.rules).toEqual(collectorRules("cristal"));
  });

  test("the road builder takes its target; other presets ignore it", () => {
    const w = world();
    const creep = ownCreep(w);
    applyPreset(w, creep.id, "roadBuilder", { x: 4, y: 0 });
    expect(creep.rules).toEqual(roadBuilderRules({ x: 4, y: 0 }));
    applyPreset(w, creep.id, "materiaCollector", { x: 4, y: 0 });
    expect(creep.rules).toEqual(collectorRules("materia"));
  });

  test.each([
    ["no target", null],
    ["a target outside the map", { x: 10, y: 0 }],
  ])("refuses a road builder with %s", (_, target) => {
    const w = world();
    expect(
      applyPresetRefusal(w, 1, ownCreep(w).id, "roadBuilder", target),
    ).toBe("invalidTarget");
  });

  test("refuses an unknown preset and another team's creep", () => {
    const w = world();
    const creep = ownCreep(w);
    expect(applyPresetRefusal(w, 1, creep.id, "miner" as never, null)).toBe(
      "invalidPreset",
    );
    expect(applyPresetRefusal(w, 3, creep.id, "materiaCollector", null)).toBe(
      "unknownCreep",
    );
  });

  test("a new preset takes effect on the next tick", () => {
    const w = world();
    const creep = ownCreep(w);
    applyPreset(w, creep.id, "materiaCollector", null);
    step(w, []);
    expect(creep.order).toEqual({
      type: "gather",
      depositId: w.deposits[0]!.id,
    });
  });
});
