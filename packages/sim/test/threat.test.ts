// The hard bot's threat pass (R spec D27, S-7; plan section 5, P9) on
// hand-built threats: a 30 × 7 field, team 0's core at the left, team 1's at
// the right; the creeps not placed stay on their cores. Powers with the
// junction matrix's strengths: a full ■ 310,000, ▲ 510,000, ● 640,000.

import { describe, expect, test } from "vitest";
import type { Command } from "../src/commands.ts";
import type { Difficulty } from "../src/domination.ts";
import { canonicalJson } from "../src/serialize.ts";
import { step } from "../src/step.ts";
import {
  botCommands,
  botsFor,
  standRules,
  strategistCommands,
  threatCommands,
  threatPass,
} from "../src/strategist.ts";
import {
  dropFightRules,
  dropFleeRules,
  helperRule,
  payRules,
  power,
  RISK,
  threatsIn,
} from "../src/threat.ts";
import { view } from "../src/view.ts";
import type { Creep, WorldState } from "../src/world.ts";
import {
  addWanderer,
  loadTestParams,
  placeWorld,
  type Placed,
} from "./helpers.ts";

const params = loadTestParams();
const FIELD = [0, 1, 2, 3, 4, 5, 6].map((y) =>
  y === 3 ? "A" + ".".repeat(28) + "B" : ".".repeat(30),
);

/** The field with the creeps placed and both bots joined. */
function scene(placed: readonly Placed[], difficulty: Difficulty = "hard") {
  const { world, creeps } = placeWorld(FIELD, placed, params);
  step(world, [
    { playerId: 1, command: { type: "join", team: 0, bot: true, difficulty } },
    { playerId: 2, command: { type: "join", team: 1, bot: true, difficulty } },
  ]);
  return { world, creeps };
}

const chase = (
  attacker: { order: Creep["order"] },
  victim: Creep,
  intent: "attack" | "extort" = "attack",
) => {
  attacker.order = { type: "approach", targetId: victim.id, intent };
};
const load = (creep: Creep, materia = 20) => {
  creep.cargo = { materia, cristal: 0 };
};
const pass = (world: WorldState) =>
  threatCommands(view(world, 0), world.map, world.params);
const rulesOf = (commands: Command[], id: number) =>
  commands.find(
    (c): c is Extract<Command, { type: "setRules" }> =>
      c.type === "setRules" && c.creepId === id,
  )?.rules;

describe("the risk", () => {
  test("power is the HP share times the DNA's strength; a wanderer's from its own HP", () => {
    const { world, creeps } = scene([[0, "triangle", 12, 3]]);
    const [triangle] = creeps;
    expect(
      power(
        view(world, 0).creeps.find((c) => c.id === triangle!.id)!,
        params,
      ),
    ).toBe(510_000);
    triangle!.hp = 100_000;
    expect(
      power(
        view(world, 0).creeps.find((c) => c.id === triangle!.id)!,
        params,
      ),
    ).toBe(255_000);
    const wanderer = addWanderer(world, 13, 3);
    world.memory[0]!.visible[3 * 30 + 13] = 1;
    expect(
      power(
        view(world, 0).wanderers.find((w) => w.id === wanderer.id)!,
        params,
      ),
    ).toBe(640_000);
    expect(RISK.strengthPermille).toEqual({
      square: 310,
      triangle: 510,
      circle: 640,
    });
  });
});

describe("the D27 choice", () => {
  test("no help, the enemy even or weaker: drop and fight", () => {
    const { world, creeps } = scene([
      [0, "square", 12, 3],
      [1, "circle", 15, 3],
    ]);
    const [victim, attacker] = creeps as [Creep, Creep];
    load(victim);
    attacker.hp = 48_000; // 40%: 256,000 against the square's 310,000
    chase(attacker, victim);
    expect(rulesOf(pass(world), victim.id)).toEqual(dropFightRules());
    expect(dropFightRules().map((r) => r.then.type)).toEqual([
      "fight",
      "drop",
      "approach",
    ]);
  });

  test("no help, the enemy stronger and attacking: drop and flee lighter", () => {
    const { world, creeps } = scene([
      [0, "triangle", 12, 3],
      [1, "circle", 15, 3],
    ]);
    const [victim, attacker] = creeps as [Creep, Creep];
    load(victim);
    chase(attacker, victim);
    expect(rulesOf(pass(world), victim.id)).toEqual(dropFleeRules());
  });

  test("no help, the enemy stronger and extorting a small demand: pay it", () => {
    const { world, creeps } = scene([
      [0, "triangle", 12, 3],
      [1, "circle", 15, 3],
    ]);
    const [victim, attacker] = creeps as [Creep, Creep];
    load(victim, 20);
    // The circle carries 10: 5 free, a demand of 5 = 250‰ of 20.
    attacker.cargo = { materia: 5, cristal: 0 };
    chase(attacker, victim, "extort");
    expect(rulesOf(pass(world), victim.id)).toEqual(payRules());
    // 6 free: 300‰, more than it pays.
    attacker.cargo = { materia: 4, cristal: 0 };
    expect(rulesOf(pass(world), victim.id)).toEqual(dropFleeRules());
  });

  test("help coming: the victim keeps its rules, the helper that arrives in time follows it", () => {
    const { world, creeps } = scene([
      [0, "triangle", 12, 3],
      [0, "square", 12, 4],
      [1, "circle", 15, 3],
    ]);
    const [victim, helper, attacker] = creeps as [Creep, Creep, Creep];
    load(victim);
    helper.rules = [];
    chase(attacker, victim);
    // The circle needs 3 cells at 5 a minute; the square, 1 at 2: in time.
    // 510,000 + 310,000 against 640,000.
    const commands = pass(world);
    expect(rulesOf(commands, victim.id)).toBeUndefined();
    const rules = rulesOf(commands, helper.id)!;
    expect(rules[0]).toEqual(helperRule(victim.id));
    expect(rules.slice(1, 4)).toEqual(standRules());
    // Too far to arrive before the fight: no help, so it drops and flees.
    helper.x = 12;
    helper.y = 0;
    expect(rulesOf(pass(world), helper.id)).toBeUndefined();
    expect(rulesOf(pass(world), victim.id)).toEqual(dropFleeRules());
  });

  test("helpers are taken quickest first until the side is as strong", () => {
    const { world, creeps } = scene([
      [0, "circle", 12, 3],
      [0, "circle", 11, 3],
      [0, "triangle", 12, 2],
      [1, "square", 15, 3],
      [1, "square", 16, 3],
      [1, "triangle", 15, 4],
    ]);
    const [victim, near, other, a, b, c] = creeps as Creep[];
    for (const attacker of [a!, b!, c!]) chase(attacker, victim!);
    load(victim!, 5);
    // 640,000 + 640,000 (1 cell) + 510,000 (1 cell, slower) against
    // 310,000 × 2 + 510,000 = 1,130,000: the circle alone is enough.
    const commands = pass(world);
    expect(rulesOf(commands, near!.id)?.[0]).toEqual(helperRule(victim!.id));
    expect(rulesOf(commands, other!.id)).toBeUndefined();
  });
});

describe("the threat pass", () => {
  test("decides once: a victim with its response or a follower on it is not new", () => {
    const { world, creeps } = scene([
      [0, "triangle", 12, 3],
      [0, "square", 12, 4],
      [1, "circle", 15, 3],
    ]);
    const [victim, helper, attacker] = creeps as [Creep, Creep, Creep];
    load(victim);
    chase(attacker, victim);
    helper.rules = [helperRule(victim.id)];
    expect(pass(world)).toEqual([]);
    helper.rules = [];
    victim.rules = dropFleeRules();
    expect(pass(world)).toEqual([]);
  });

  test("only for a loaded, free victim, at hard, of a threat the team sees", () => {
    const hard = scene([
      [0, "triangle", 12, 3],
      [1, "circle", 15, 3],
    ]);
    const [victim, attacker] = hard.creeps as [Creep, Creep];
    chase(attacker, victim);
    expect(pass(hard.world)).toEqual([]); // empty
    load(victim);
    victim.dominatedBy = 9;
    expect(pass(hard.world)).toEqual([]); // a human's
    victim.dominatedBy = null;
    expect(pass(hard.world)).not.toEqual([]);
    // An aggressor out of sight is no threat the team knows of (HS-3).
    hard.world.memory[0]!.visible[3 * 30 + 15] = 0;
    expect(threatsIn(view(hard.world, 0))).toEqual([]);
    for (const difficulty of ["easy", "normal"] as const) {
      const { world, creeps } = scene(
        [
          [0, "triangle", 12, 3],
          [1, "circle", 15, 3],
        ],
        difficulty,
      );
      load(creeps[0]!);
      chase(creeps[1]!, creeps[0]!);
      expect(pass(world)).toEqual([]);
      expect(threatPass(world, 0)).toEqual([]);
    }
  });

  test("a wanderer's attack is a threat too", () => {
    const { world, creeps } = scene([[0, "square", 12, 3]]);
    const [victim] = creeps as [Creep];
    load(victim);
    addWanderer(world, 14, 3, {
      hp: 20_000, // a third: 213,333 against 310,000
      order: { type: "approach", targetId: victim.id },
    });
    world.memory[0]!.visible[3 * 30 + 14] = 1;
    expect(rulesOf(pass(world), victim.id)).toEqual(dropFightRules());
  });

  test("the harness runs it on every tick, from the state's threats", () => {
    const { world, creeps } = scene([
      [0, "triangle", 12, 3],
      [1, "circle", 15, 3],
    ]);
    const [victim, attacker] = creeps as [Creep, Creep];
    load(victim);
    world.tick = 5; // not a full decision's tick
    const bots = botsFor(["balanced", "balanced"]);
    expect(botCommands(world, bots)).toEqual([]);
    chase(attacker, victim);
    expect(botCommands(world, bots)).toEqual([
      {
        playerId: 1,
        command: {
          type: "setRules",
          creepId: victim.id,
          rules: dropFleeRules(),
        },
      },
    ]);
    expect(threatPass(world, 0)).toEqual(pass(world));
  });

  test("through step: the victim drops before the attacker reaches it", () => {
    const { world, creeps } = scene([
      [0, "square", 12, 3],
      [1, "circle", 15, 3],
    ]);
    const [victim, attacker] = creeps as [Creep, Creep];
    load(victim);
    attacker.hp = 48_000;
    chase(attacker, victim);
    const inputs = pass(world).map((command) => ({ playerId: 1, command }));
    const events = step(world, inputs);
    expect(victim.rules).toEqual(dropFightRules());
    expect(events.map((e) => e.type)).toContain("dropped");
    expect(victim.cargo).toEqual({ materia: 0, cristal: 0 });
    expect(world.spoils).toHaveLength(1);
  });
});

describe("the full decision at hard", () => {
  const decide = (world: WorldState) =>
    strategistCommands("balanced", view(world, 0), world.map, world.params);

  test("keeps a victim's and its helpers' rules while the threat lasts, then gives the role back", () => {
    const { world, creeps } = scene([
      [0, "triangle", 12, 3],
      [0, "square", 12, 4],
      [1, "circle", 15, 3],
    ]);
    const [victim, helper, attacker] = creeps as [Creep, Creep, Creep];
    load(victim);
    chase(attacker, victim);
    // The decision makes the square a helper and leaves the victim alone.
    const first = decide(world);
    const helping = rulesOf(first, helper.id)!;
    expect(helping[0]).toEqual(helperRule(victim.id));
    expect(rulesOf(first, victim.id)).toBeUndefined();
    helper.rules = helping;
    victim.rules = standRules();
    // The threat lasts: both kept.
    const again = decide(world);
    expect(rulesOf(again, helper.id)).toBeUndefined();
    expect(rulesOf(again, victim.id)).toBeUndefined();
    // The threat is gone: the helper gets a role again, without the follow.
    attacker.order = { type: "stop" };
    const after = rulesOf(decide(world), helper.id)!;
    expect(after).not.toContainEqual(helperRule(victim.id));
    expect(after.slice(0, 3)).toEqual(standRules());
  });

  test("after dropping to fight, it picks the spoils up while the team remembers some", () => {
    const { world, creeps } = scene([
      [0, "square", 12, 3],
      [1, "circle", 17, 3],
    ]);
    const [victim] = creeps as [Creep];
    victim.rules = dropFightRules();
    expect(rulesOf(decide(world), victim.id)?.[0]?.then.type).not.toBe(
      "pickup",
    );
    world.memory[0]!.spoils.push({
      id: world.nextId++,
      x: 12,
      y: 3,
      cargo: { materia: 20, cristal: 0 },
    });
    const rules = rulesOf(decide(world), victim.id)!;
    expect(rules[0]).toEqual({
      when: { type: "always" },
      then: { type: "pickup" },
    });
    // Kept while the spoil is remembered, dropped once it is gone.
    victim.rules = rules;
    expect(rulesOf(decide(world), victim.id)).toBeUndefined();
    world.memory[0]!.spoils = [];
    expect(canonicalJson(rulesOf(decide(world), victim.id))).toBe(
      canonicalJson(rules.slice(1)),
    );
  });
});
