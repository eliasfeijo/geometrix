import { join, setRulesRefusal, type Rule } from "@geometrix/sim";
import { describe, expect, it } from "vitest";
import {
  ACTION_LABELS,
  ACTION_TYPES,
  actionOf,
  CONDITION_LABELS,
  CONDITION_TYPES,
  conditionOf,
  move,
  newRule,
  parseCount,
  removeAt,
  replaceAt,
  sameRules,
} from "../src/rules-draft.ts";
import { testWorld } from "./helpers.ts";

const rule = (n: number): Rule => ({
  when: { type: "stockBelow", resource: "materia", amount: n },
  then: { type: "deliver" },
});

describe("rules draft", () => {
  it("reorders, removes and replaces without touching the input", () => {
    const rules = [rule(1), rule(2), rule(3)];
    const amounts = (list: Rule[]) =>
      list.map((r) => (r.when.type === "stockBelow" ? r.when.amount : -1));
    expect(amounts(move(rules, 0, 1))).toEqual([2, 1, 3]);
    expect(amounts(move(rules, 2, -1))).toEqual([1, 3, 2]);
    expect(amounts(move(rules, 0, -1))).toEqual([1, 2, 3]);
    expect(amounts(move(rules, 2, 1))).toEqual([1, 2, 3]);
    expect(amounts(removeAt(rules, 1))).toEqual([1, 3]);
    expect(amounts(replaceAt(rules, 1, rule(9)))).toEqual([1, 9, 3]);
    expect(amounts(rules)).toEqual([1, 2, 3]);
    expect(sameRules(rules, [rule(1), rule(2), rule(3)])).toBe(true);
    expect(sameRules(rules, move(rules, 0, 1))).toBe(false);
  });

  it("keeps what it can when the type changes", () => {
    const stock = {
      type: "stockBelow",
      resource: "cristal",
      amount: 40,
    } as const;
    expect(conditionOf("resourceInRange", stock)).toMatchObject({
      resource: "cristal",
    });
    expect(conditionOf("stockBelow", stock)).toEqual(stock);
    expect(conditionOf("cargoFull", stock)).toEqual({ type: "cargoFull" });

    const core = { x: 5, y: 6 };
    expect(actionOf("moveTo", { type: "deliver" }, core)).toEqual({
      type: "moveTo",
      x: 5,
      y: 6,
    });
    expect(actionOf("buildRoad", { type: "moveTo", x: 1, y: 2 }, core)).toEqual(
      { type: "buildRoad", x: 1, y: 2 },
    );
    expect(
      actionOf("gather", { type: "gather", resource: "cristal" }, core),
    ).toEqual({ type: "gather", resource: "cristal" });
  });

  it("offers the whole vocabulary, explore and resourceUnknown included", () => {
    expect([...CONDITION_TYPES].sort()).toEqual(
      Object.keys(CONDITION_LABELS).sort(),
    );
    expect([...ACTION_TYPES].sort()).toEqual(Object.keys(ACTION_LABELS).sort());
    expect(
      conditionOf("resourceUnknown", {
        type: "stockBelow",
        resource: "cristal",
        amount: 5,
      }),
    ).toEqual({ type: "resourceUnknown", resource: "cristal" });
    expect(actionOf("explore", { type: "deliver" }, { x: 1, y: 2 })).toEqual({
      type: "explore",
    });
  });

  it("produces only rules the sim accepts", () => {
    const world = testWorld();
    join(world, 99, 0, false);
    const creep = world.creeps.find((c) => c.team === 0)!;
    const core = world.teams[0]!.core;
    const rules: Rule[] = [];
    for (const c of CONDITION_TYPES) {
      for (const a of ACTION_TYPES) {
        const base = newRule();
        rules.push({
          when: conditionOf(c, {
            type: "stockBelow",
            resource: "cristal",
            amount: 3,
          }),
          then: actionOf(a, base.then, core),
        });
      }
    }
    for (let i = 0; i < rules.length; i += world.params.autopilot.maxRules) {
      const chunk = rules.slice(i, i + world.params.autopilot.maxRules);
      expect(setRulesRefusal(world, 99, creep.id, chunk)).toBeNull();
    }
  });

  it("reads non-negative integers only", () => {
    expect(parseCount("12")).toBe(12);
    expect(parseCount(" 0 ")).toBe(0);
    expect(parseCount("-1")).toBeNull();
    expect(parseCount("1.5")).toBeNull();
    expect(parseCount("")).toBeNull();
    expect(parseCount("1e3")).toBeNull();
  });
});
