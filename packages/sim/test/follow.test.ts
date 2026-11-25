import { describe, expect, test } from "vitest";
import { validate, type Command } from "../src/commands.ts";
import { dominate, join } from "../src/domination.ts";
import { kill } from "../src/hp.ts";
import { manhattan } from "../src/map.ts";
import { step } from "../src/step.ts";
import type { Creep, WorldState } from "../src/world.ts";
import { placeWorld, run, runUntil, type Placed } from "./helpers.ts";

// 30 × 7, the cores in opposite corners (R spec F-1..F-6).
const MAP = [
  "A.............................",
  "..............................",
  "..............................",
  "..............................",
  "..............................",
  "..............................",
  ".............................B",
];

function world(placed: Placed[]) {
  const { world: w, creeps } = placeWorld(MAP, placed);
  return { w, creeps };
}

const PLAYER = 1;

/** Player 1 joins team 0 and dominates `creep`. */
function dominated(w: WorldState, creep: Creep): void {
  join(w, PLAYER, 0, false);
  dominate(w, PLAYER, creep.id);
}

const order = (creepId: number, targetId: number): Command => ({
  type: "order",
  creepId,
  order: { type: "follow", targetId },
});

describe("follow walks with its target (F-1)", () => {
  test("an order keeps the follower within 2 cells, then it stands", () => {
    const { w, creeps } = world([
      [0, "square", 2, 3],
      [0, "triangle", 3, 3],
    ]);
    const [leader, follower] = creeps as [Creep, Creep];
    dominated(w, follower);
    leader.order = { type: "moveTo", x: 15, y: 3 };
    step(w, [{ playerId: PLAYER, command: order(follower.id, leader.id) }]);
    expect(follower.order).toEqual({ type: "follow", targetId: leader.id });
    runUntil(w, () => leader.x === 15 && manhattan(follower, leader) <= 2);
    const at = { x: follower.x, y: follower.y };
    run(w, 20);
    expect(follower).toMatchObject(at);
    expect(follower.order.type).toBe("follow");
  });

  test("a rule does the same for a free creep, and falls through once the target is dead (F-4)", () => {
    const { w, creeps } = world([
      [0, "square", 2, 3],
      [0, "triangle", 3, 3],
    ]);
    const [leader, follower] = creeps as [Creep, Creep];
    follower.rules = [
      {
        when: { type: "always" },
        then: { type: "follow", creepId: leader.id },
      },
      { when: { type: "always" }, then: { type: "moveTo", x: 0, y: 6 } },
    ];
    leader.order = { type: "moveTo", x: 15, y: 3 };
    runUntil(w, () => leader.x === 15 && manhattan(follower, leader) <= 2);
    kill(w, leader);
    step(w, []);
    expect(follower.order).toEqual({ type: "moveTo", x: 0, y: 6 });
  });

  test("an order ends (stop) when the target dies (F-4)", () => {
    const { w, creeps } = world([
      [0, "square", 2, 3],
      [0, "triangle", 8, 3],
    ]);
    const [leader, follower] = creeps as [Creep, Creep];
    dominated(w, follower);
    step(w, [{ playerId: PLAYER, command: order(follower.id, leader.id) }]);
    kill(w, leader);
    step(w, []);
    expect(follower.order).toEqual({ type: "stop" });
  });
});

describe("follow joins its target's battle (F-2, F-3)", () => {
  test("the follower walks to a battle its target is in and joins on its side", () => {
    const { w, creeps } = world([
      [0, "square", 20, 3],
      [1, "square", 21, 3],
      [0, "triangle", 2, 3],
    ]);
    const [leader, enemy, follower] = creeps as [Creep, Creep, Creep];
    leader.order = { type: "approach", targetId: enemy.id, intent: "attack" };
    step(w, []);
    expect(leader.battle).not.toBeNull();
    follower.rules = [
      {
        when: { type: "always" },
        then: { type: "follow", creepId: leader.id },
      },
    ];
    runUntil(w, (events) =>
      events.some(
        (e) => e.type === "battleJoined" && e.creep.id === follower.id,
      ),
    );
    const battle = w.battles.find((b) => b.id === leader.battle)!;
    const side = (c: Creep) =>
      battle.participants.find((p) => p.id === c.id)!.side;
    expect(follower.battle).toBe(battle.id);
    expect(side(follower)).toBe(side(leader));
  });

  test("a follower next to its target joins the battle its target opens, in the same tick", () => {
    const { w, creeps } = world([
      [0, "square", 10, 3],
      [1, "square", 11, 3],
      [0, "triangle", 9, 3],
    ]);
    const [leader, enemy, follower] = creeps as [Creep, Creep, Creep];
    dominated(w, follower);
    step(w, [{ playerId: PLAYER, command: order(follower.id, leader.id) }]);
    leader.order = { type: "approach", targetId: enemy.id, intent: "attack" };
    const events = step(w, []);
    expect(events.map((e) => e.type)).toEqual(
      expect.arrayContaining(["battleOpened", "battleJoined"]),
    );
    expect(follower.battle).toBe(leader.battle);
  });

  test("a follower stays out of its target's extortion dialogue", () => {
    const { w, creeps } = world([
      [0, "square", 10, 3],
      [1, "square", 11, 3],
      [0, "triangle", 9, 3],
    ]);
    const [leader, enemy, follower] = creeps as [Creep, Creep, Creep];
    enemy.cargo = { materia: 10, cristal: 0 };
    enemy.dominatedBy = 99;
    follower.rules = [
      {
        when: { type: "always" },
        then: { type: "follow", creepId: leader.id },
      },
    ];
    leader.order = { type: "approach", targetId: enemy.id, intent: "extort" };
    step(w, []);
    expect(leader.engagement).not.toBeNull();
    expect(follower.engagement).toBeNull();
    expect(follower.battle).toBeNull();
  });
});

describe("a loaded follower delivers first when the core is cheaper (F-6, H-4)", () => {
  test("it unloads at the core, then goes to the battle", () => {
    const { w, creeps } = world([
      [0, "square", 20, 3],
      [1, "square", 21, 3],
      [0, "triangle", 2, 0],
    ]);
    const [leader, enemy, follower] = creeps as [Creep, Creep, Creep];
    follower.cargo = { materia: 5, cristal: 0 };
    leader.order = { type: "approach", targetId: enemy.id, intent: "attack" };
    step(w, []);
    follower.order = { type: "follow", targetId: leader.id };
    const stock = w.teams[0]!.stock.materia;
    runUntil(w, () => follower.cargo.materia === 0);
    expect(w.teams[0]!.stock.materia).toBe(stock + 5);
    expect(follower.order).toEqual({ type: "follow", targetId: leader.id });
    runUntil(w, () => manhattan(follower, w.teams[0]!.core) > 0);
  });

  test("closer to the battle than to its core, it helps with its load", () => {
    const { w, creeps } = world([
      [0, "square", 20, 3],
      [1, "square", 21, 3],
      [0, "triangle", 12, 3],
    ]);
    const [leader, enemy, follower] = creeps as [Creep, Creep, Creep];
    follower.cargo = { materia: 5, cristal: 0 };
    leader.order = { type: "approach", targetId: enemy.id, intent: "attack" };
    step(w, []);
    follower.order = { type: "follow", targetId: leader.id };
    const from = manhattan(follower, w.teams[0]!.core);
    step(w, []);
    step(w, []);
    expect(manhattan(follower, w.teams[0]!.core)).toBeGreaterThanOrEqual(from);
    expect(follower.cargo.materia).toBe(5);
  });
});

describe("what cannot be followed (F-5)", () => {
  test("itself, another team's creep, a wanderer, an unknown id", () => {
    const { w, creeps } = world([
      [0, "square", 2, 3],
      [1, "square", 3, 3],
    ]);
    const [mine, theirs] = creeps as [Creep, Creep];
    dominated(w, mine);
    w.wanderers.push({
      id: w.nextId++,
      dna: "circle",
      name: "W",
      hp: 1000,
      cargo: { materia: 0, cristal: 0 },
      battle: null,
      order: { type: "stop" },
      movePoints: 0,
      path: null,
      spared: [],
      x: 4,
      y: 3,
    });
    const wanderer = w.wanderers[0]!;
    expect(validate(w, order(mine.id, mine.id), PLAYER)).toBe("invalidTarget");
    expect(validate(w, order(mine.id, theirs.id), PLAYER)).toBe("unknownCreep");
    expect(validate(w, order(mine.id, wanderer.id), PLAYER)).toBe(
      "unknownCreep",
    );
    expect(validate(w, order(mine.id, 9999), PLAYER)).toBe("unknownCreep");
  });

  test("a chain of follows that comes back to the creep, by orders or rules", () => {
    const { w, creeps } = world([
      [0, "square", 2, 3],
      [0, "triangle", 3, 3],
      [0, "circle", 4, 3],
    ]);
    const [a, b, c] = creeps as [Creep, Creep, Creep];
    join(w, PLAYER, 0, false);
    b.rules = [
      { when: { type: "always" }, then: { type: "follow", creepId: c.id } },
    ];
    c.order = { type: "follow", targetId: a.id };
    const followRule = (target: Creep): Command => ({
      type: "setRules",
      creepId: a.id,
      rules: [
        {
          when: { type: "always" },
          then: { type: "follow", creepId: target.id },
        },
      ],
    });
    // a → b → c → a closes the cycle; a → c → a too.
    expect(validate(w, followRule(b), PLAYER)).toBe("invalidTarget");
    expect(validate(w, followRule(c), PLAYER)).toBe("invalidTarget");
    expect(validate(w, followRule(a), PLAYER)).toBe("invalidTarget");
    // c following someone else leaves a chain that ends: allowed.
    c.order = { type: "stop" };
    expect(validate(w, followRule(b), PLAYER)).toBeNull();
    dominate(w, PLAYER, a.id);
    expect(validate(w, order(a.id, b.id), PLAYER)).toBeNull();
  });
});
