import { describe, expect, test } from "vitest";
import type { Rule } from "../src/autopilot.ts";
import { step } from "../src/step.ts";
import { maxHp, type Creep } from "../src/world.ts";
import { placeWorld, revealWorld, runUntil, textWorld } from "./helpers.ts";

// 30 × 7, team 0's core on the left of row 3 (R spec H-1..H-4).
const MAP = [
  "..............................",
  "..............................",
  "..............................",
  "A.............................",
  "..............................",
  "..............................",
  ".............................B",
];
// The same with a road from the core to x = 9 on row 3.
const ROAD_MAP = [
  "..............................",
  "..............................",
  "..............................",
  "Arrrrrrrrr....................",
  "..............................",
  "..............................",
  ".............................B",
];

/**
 * A battle at (17, 3), the victim's cell: team 0's square attacks team 1's
 * square there and both are locked; `helper` (team 0's triangle) stands at
 * `helperAt`. Every team remembers the whole map.
 */
function battleWorld(rows: string[], helperAt: [number, number]) {
  const { world: w, creeps } = placeWorld(rows, [
    [0, "square", 16, 3],
    [1, "square", 17, 3],
    [0, "triangle", ...helperAt],
  ]);
  revealWorld(w);
  const [ally, enemy, helper] = creeps as [Creep, Creep, Creep];
  ally.order = { type: "approach", targetId: enemy.id, intent: "attack" };
  step(w, []);
  expect(ally.battle).not.toBeNull();
  return { w, ally, enemy, helper };
}

const help = (radius: number, minHpPermille = 0): Rule[] => [
  {
    when: { type: "allyInBattle", radius },
    then: { type: "joinBattle", minHpPermille },
  },
  { when: { type: "always" }, then: { type: "moveTo", x: 5, y: 0 } },
];

describe("allyInBattle (H-1)", () => {
  test("holds within the radius of the battle's cell, not one cell beyond", () => {
    const near = battleWorld(MAP, [11, 3]);
    near.helper.rules = help(6);
    step(near.w, []);
    expect(near.helper.order).toEqual({
      type: "approach",
      targetId: near.enemy.id,
      intent: "attack",
    });

    const far = battleWorld(MAP, [10, 3]);
    far.helper.rules = help(6);
    step(far.w, []);
    expect(far.helper.order).toEqual({ type: "moveTo", x: 5, y: 0 });
  });

  test("does not hold with no battle", () => {
    const w = textWorld(MAP);
    const creep = w.creeps.find((c) => c.team === 0)!;
    creep.rules = help(50);
    step(w, []);
    expect(creep.order).toEqual({ type: "moveTo", x: 5, y: 0 });
  });
});

describe("joinBattle (H-2)", () => {
  test("approaches an enemy participant and joins on the team's side", () => {
    const { w, ally, helper } = battleWorld(MAP, [11, 3]);
    helper.rules = help(6);
    runUntil(w, (events) =>
      events.some((e) => e.type === "battleJoined" && e.creep.id === helper.id),
    );
    const battle = w.battles.find((b) => b.id === ally.battle)!;
    const side = (c: Creep) =>
      battle.participants.find((p) => p.id === c.id)!.side;
    expect(side(helper)).toBe(side(ally));
  });

  test("is not possible below its HP floor: the next rule decides", () => {
    const { w, helper } = battleWorld(MAP, [11, 3]);
    helper.rules = help(6, 500);
    helper.hp = Math.floor(maxHp(w.params, helper.dna) / 2) - 1;
    step(w, []);
    expect(helper.order).toEqual({ type: "moveTo", x: 5, y: 0 });
    helper.hp = Math.floor(maxHp(w.params, helper.dna) / 2);
    step(w, []);
    expect(helper.order.type).toBe("approach");
  });
});

describe("helping with a load (H-4)", () => {
  test("with no road, the battle is cheaper than the core: it helps loaded", () => {
    const { w, helper } = battleWorld(MAP, [11, 3]);
    helper.cargo = { materia: 5, cristal: 0 };
    helper.rules = help(6);
    step(w, []);
    expect(helper.order.type).toBe("approach");
    expect(helper.cargo.materia).toBe(5);
  });

  test("with a road home cheaper than the way to the battle, it delivers first, then helps", () => {
    const { w, helper } = battleWorld(ROAD_MAP, [10, 3]);
    helper.cargo = { materia: 5, cristal: 0 };
    helper.rules = help(20);
    step(w, []);
    expect(helper.order).toEqual({ type: "deliver" });
    const stock = w.teams[0]!.stock.materia;
    runUntil(w, () => helper.cargo.materia === 0);
    expect(w.teams[0]!.stock.materia).toBe(stock + 5);
    step(w, []);
    expect(helper.order.type).toBe("approach");
  });
});
