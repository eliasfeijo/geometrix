import { describe, expect, test } from "vitest";
import type { Rule } from "../src/autopilot.ts";
import { dominate, join } from "../src/domination.ts";
import type { SimEvent } from "../src/events.ts";
import { raiderRules } from "../src/presets.ts";
import { step } from "../src/step.ts";
import { updateVision } from "../src/vision.ts";
import { maxHp, type Creep, type WorldState } from "../src/world.ts";
import { creepOf, textWorld } from "./helpers.ts";

// 30 cells, no crossing: core A at x=0, core B at x=29.
const ROW = ["A............................B"];

function world(at: [Creep["dna"], number, number][]): {
  w: WorldState;
  creeps: Creep[];
} {
  const w = textWorld(ROW);
  const creeps = at.map(([dna, team, x]) => {
    const creep = creepOf(w, team, dna);
    Object.assign(creep, { x, y: 0 });
    return creep;
  });
  updateVision(w);
  return { w, creeps };
}

const always = { type: "always" } as const;
const reactionOf = (events: SimEvent[]) =>
  events.find((e) => e.type === "reaction");
/** How `creep` entered its battle (junction D2): its stance in the stub. */
const stanceOf = (w: WorldState, creep: Creep) =>
  w.battles.flatMap((b) => b.participants).find((p) => p.id === creep.id)
    ?.stance;

describe("encounter conditions (spec D13, A-1)", () => {
  test("enemyInSight: within the radius, the DNA filter and the cargo, only what the team sees", () => {
    const { w, creeps } = world([
      ["square", 0, 10],
      ["triangle", 1, 13],
    ]);
    const [own, enemy] = creeps as [Creep, Creep];
    const rule = (when: Rule["when"]): Rule[] => [
      { when, then: { type: "moveTo", x: 1, y: 0 } },
    ];
    const check = (when: Rule["when"]) => {
      own.order = { type: "stop" } as Creep["order"];
      own.rules = rule(when);
      step(w, []);
      Object.assign(own, { x: 10, y: 0 });
      return own.order.type === "moveTo";
    };
    enemy.cargo.materia = 3;
    updateVision(w);
    expect(check({ type: "enemyInSight", radius: 3, minCargo: 0 })).toBe(true);
    expect(check({ type: "enemyInSight", radius: 2, minCargo: 0 })).toBe(false);
    expect(check({ type: "enemyInSight", radius: 3, minCargo: 4 })).toBe(false);
    expect(
      check({ type: "enemyInSight", radius: 3, dna: ["circle"], minCargo: 0 }),
    ).toBe(false);
    expect(
      check({
        type: "enemyInSight",
        radius: 3,
        dna: ["triangle"],
        minCargo: 3,
      }),
    ).toBe(true);
    // Out of the square's sight (3), the enemy is not known.
    Object.assign(enemy, { x: 14, y: 0 });
    updateVision(w);
    expect(check({ type: "enemyInSight", radius: 20, minCargo: 0 })).toBe(
      false,
    );
  });

  test("hpBelow compares the HP share", () => {
    const { w, creeps } = world([["square", 0, 10]]);
    const [own] = creeps as [Creep];
    own.rules = [
      {
        when: { type: "hpBelow", permille: 400 },
        then: { type: "moveTo", x: 1, y: 0 },
      },
    ];
    own.hp = (maxHp(w.params, "square") * 4) / 10;
    step(w, []);
    expect(own.order.type).toBe("stop");
    own.hp -= 1;
    step(w, []);
    expect(own.order.type).toBe("moveTo");
  });

  test("reaction rules are skipped outside an encounter", () => {
    const { w, creeps } = world([["square", 0, 10]]);
    const [own] = creeps as [Creep];
    own.rules = [
      { when: always, then: { type: "fight" } },
      { when: always, then: { type: "moveTo", x: 1, y: 0 } },
    ];
    step(w, []);
    expect(own.order.type).toBe("moveTo");
  });
});

describe("reaction rules (spec D13, A-2)", () => {
  function extortion(victimRules: Rule[], cargo: number) {
    const { w, creeps } = world([
      ["circle", 0, 9],
      ["square", 1, 10],
    ]);
    const [hunter, prey] = creeps as [Creep, Creep];
    prey.cargo.materia = cargo;
    prey.rules = victimRules;
    hunter.order = { type: "approach", targetId: prey.id, intent: "extort" };
    return { w, hunter, prey, events: step(w, []) };
  }

  const pickyPayer: Rule[] = [
    { when: { type: "demandAtMost", permille: 500 }, then: { type: "pay" } },
    { when: always, then: { type: "fight" } },
  ];

  test("demandAtMost pays a small demand and refuses a big one", () => {
    // Circle capacity 10: 10 of 30 is a third; 10 of 12 is too much.
    const small = extortion(pickyPayer, 30);
    expect(reactionOf(small.events)).toMatchObject({
      choice: "pay",
      by: "rule",
    });
    const big = extortion(pickyPayer, 12);
    expect(reactionOf(big.events)).toMatchObject({
      choice: "refuse",
      by: "rule",
    });
    // Refusing opens the battle; the fight rule enters with the preset.
    expect(big.w.encounters).toEqual([]);
    expect(stanceOf(big.w, big.prey)).toBe("fight");
  });

  test("a flee rule refuses an extortion and enters the battle as a carrier (junction D2)", () => {
    const fleer = extortion([{ when: always, then: { type: "flee" } }], 12);
    expect(reactionOf(fleer.events)).toMatchObject({
      choice: "refuse",
      by: "rule",
    });
    expect(stanceOf(fleer.w, fleer.prey)).toBe("flee");
    expect(stanceOf(fleer.w, fleer.hunter)).toBe("fight");
  });

  test("an attack has no dialogue: the reaction rules choose the stance (junction D2)", () => {
    const attacked = (rules: Rule[], hp?: number) => {
      const { w, creeps } = world([
        ["circle", 0, 9],
        ["square", 1, 10],
      ]);
      const [hunter, prey] = creeps as [Creep, Creep];
      prey.rules = rules;
      if (hp !== undefined) prey.hp = hp;
      hunter.order = { type: "approach", targetId: prey.id, intent: "attack" };
      const events = step(w, []);
      expect(reactionOf(events)).toBeUndefined();
      return stanceOf(w, prey);
    };
    const wary: Rule[] = [
      { when: { type: "hpBelow", permille: 1000 }, then: { type: "flee" } },
      { when: always, then: { type: "fight" } },
    ];
    // Pay is impossible against an attack: the next rule decides.
    expect(
      attacked([
        { when: always, then: { type: "pay" } },
        { when: always, then: { type: "fight" } },
      ]),
    ).toBe("fight");
    expect(attacked(wary)).toBe("fight");
    expect(attacked(wary, 1_000)).toBe("flee");
    // With no reaction rule, the DNA's preset.
    expect(attacked([])).toBe("fight");
  });
});

describe("the approach action (spec D13, A-1)", () => {
  const approach = (
    intent: "attack" | "extort",
    minCargo = 0,
    dna?: Creep["dna"][],
  ): Rule[] => [
    {
      when: always,
      then: {
        type: "approach",
        intent,
        radius: 10,
        minCargo,
        ...(dna === undefined ? {} : { dna }),
      },
    },
  ];

  test("goes for the nearest approachable enemy in sight that passes the filter", () => {
    const { w, creeps } = world([
      ["circle", 0, 10],
      ["square", 1, 12],
      ["triangle", 1, 13],
    ]);
    const [hunter, square, triangle] = creeps as [Creep, Creep, Creep];
    hunter.rules = approach("attack");
    step(w, []);
    expect(hunter.order).toEqual({
      type: "approach",
      targetId: square.id,
      intent: "attack",
    });
    hunter.rules = approach("attack", 0, ["triangle"]);
    hunter.order = { type: "stop" };
    step(w, []);
    expect(hunter.order).toMatchObject({ targetId: triangle.id });
    // A protected square is skipped; an empty one cannot be extorted.
    square.safeConduct = { team: 0, untilTick: 999 };
    hunter.rules = approach("attack");
    hunter.order = { type: "stop" };
    step(w, []);
    expect(hunter.order).toMatchObject({ targetId: triangle.id });
    hunter.rules = approach("extort");
    hunter.order = { type: "stop" };
    step(w, []);
    expect(hunter.order).toEqual({ type: "stop" });
  });

  test("keeps its target while it stays valid", () => {
    const { w, creeps } = world([
      ["circle", 0, 10],
      ["square", 1, 14],
      ["triangle", 1, 15],
    ]);
    const [hunter, square, triangle] = creeps as [Creep, Creep, Creep];
    hunter.rules = approach("attack");
    hunter.order = {
      type: "approach",
      targetId: triangle.id,
      intent: "attack",
    };
    step(w, []);
    expect(hunter.order).toMatchObject({ targetId: triangle.id });
    expect(square.id).not.toBe(triangle.id);
  });

  test("breaks a distance tie by the cell in the team's frame, the same on both sides", () => {
    // Team 0 at x=14 between enemies at 12 and 16; team 1 mirrored at x=15.
    const left = world([
      ["circle", 0, 14],
      ["square", 1, 12],
      ["triangle", 1, 16],
    ]);
    left.creeps[0]!.rules = approach("attack");
    step(left.w, []);
    const right = world([
      ["circle", 1, 15],
      ["square", 0, 17],
      ["triangle", 0, 13],
    ]);
    right.creeps[0]!.rules = approach("attack");
    step(right.w, []);
    const target = (s: typeof left) =>
      s.w.creeps.find(
        (c) =>
          s.creeps[0]!.order.type === "approach" &&
          c.id === s.creeps[0]!.order.targetId,
      )!;
    // Both pick the one at the lower cell index of their own frame.
    expect(target(left).x).toBe(12);
    expect(target(right).x).toBe(17);
  });
});

describe("the raider preset (spec D14)", () => {
  test("extorts a loaded collector, which pays by default, and delivers when full", () => {
    const { w, creeps } = world([
      ["triangle", 0, 8],
      ["square", 1, 12],
    ]);
    const [raider, collector] = creeps as [Creep, Creep];
    raider.rules = raiderRules();
    collector.cargo.cristal = 25;
    const events: SimEvent[] = [];
    for (let i = 0; i < 120 && raider.cargo.cristal === 0; i++) {
      events.push(...step(w, []));
    }
    expect(events.map((e) => e.type)).toEqual(
      expect.arrayContaining(["encounter", "reaction", "paid"]),
    );
    // Triangle capacity 20: cristal first.
    expect(raider.cargo.cristal).toBe(20);
    expect(collector.cargo.cristal).toBe(5);
    step(w, []);
    expect(raider.order.type).toBe("deliver");
  });

  test("leaves alone a target carrying less than 10 (plan C11)", () => {
    const run = (cargo: number) => {
      const { w, creeps } = world([
        ["triangle", 0, 8],
        ["square", 1, 12],
      ]);
      const [raider, collector] = creeps as [Creep, Creep];
      raider.rules = raiderRules();
      collector.cargo.materia = cargo;
      step(w, []);
      return raider.order.type;
    };
    expect(run(9)).not.toBe("approach");
    expect(run(10)).toBe("approach");
  });

  test("fights when attacked and flees when wounded (junction D2)", () => {
    const attacked = (hp: number | null) => {
      const { w, creeps } = world([
        ["circle", 0, 9],
        ["square", 1, 10],
      ]);
      const [hunter, raider] = creeps as [Creep, Creep];
      raider.rules = raiderRules();
      if (hp !== null) raider.hp = hp;
      hunter.order = {
        type: "approach",
        targetId: raider.id,
        intent: "attack",
      };
      step(w, []);
      return stanceOf(w, raider);
    };
    expect(attacked(null)).toBe("fight");
    expect(attacked(maxHp(textWorld(ROW).params, "square") / 4)).toBe("flee");
  });

  test("a dominated victim's rules decide once the window is over", () => {
    const { w, creeps } = world([
      ["circle", 0, 9],
      ["square", 1, 10],
    ]);
    const [hunter, raider] = creeps as [Creep, Creep];
    raider.rules = raiderRules();
    raider.cargo.materia = 12;
    join(w, 9, 1, false);
    dominate(w, 9, raider.id);
    hunter.order = { type: "approach", targetId: raider.id, intent: "extort" };
    const events: SimEvent[] = [];
    for (let i = 0; i < 61; i++) events.push(...step(w, []));
    expect(reactionOf(events)).toMatchObject({ choice: "refuse", by: "rule" });
    expect(stanceOf(w, raider)).toBe("fight");
  });
});
