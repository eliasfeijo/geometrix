import { describe, expect, test } from "vitest";
import { dominate, join } from "../src/domination.ts";
import type { SimEvent } from "../src/events.ts";
import { dropSpoil } from "../src/spoils.ts";
import { speedHere } from "../src/movement.ts";
import { createRng, nextInt } from "../src/rng.ts";
import { step } from "../src/step.ts";
import { updateVision } from "../src/vision.ts";
import { maxHp, type Creep, type WorldState } from "../src/world.ts";
import { creepOf, run, textWorld } from "./helpers.ts";

// 30 cells: core A at x=0, core B at x=29; a crossing at x=14..15.
const ROW = ["A.............==.............B"];

type Setup = { world: WorldState; hunter: Creep; prey: Creep };

/**
 * A team 0 circle next to a team 1 square at x=9 / x=10 (or `at`), the
 * circle approaching it with `intent`.
 */
function setup(
  intent: "attack" | "extort",
  edit: (s: Setup) => void = () => {},
  at: [number, number] = [9, 10],
): Setup {
  const world = textWorld(ROW);
  const hunter = creepOf(world, 0, "circle");
  const prey = creepOf(world, 1, "square");
  Object.assign(hunter, { x: at[0], y: 0 });
  Object.assign(prey, { x: at[1], y: 0 });
  const s = { world, hunter, prey };
  edit(s);
  updateVision(world);
  hunter.order = { type: "approach", targetId: prey.id, intent };
  return s;
}

function dominated(world: WorldState, creep: Creep, playerId: number): void {
  join(world, playerId, creep.team, false);
  dominate(world, playerId, creep.id);
}

const tick = (world: WorldState): SimEvent[] => step(world, []);
const types = (events: SimEvent[]) => events.map((e) => e.type);

/** Steps until the encounter closes; returns every event on the way. */
function untilClosed(world: WorldState, limit = 2000): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < limit; i++) {
    all.push(...tick(world));
    if (world.encounters.length === 0 && all.length > 0) return all;
  }
  throw new Error("the encounter did not close");
}

/** Whether the next nextInt(rng, own + other) < own, without advancing. */
function wouldEscape(world: WorldState, fugitive: Creep, opponent: Creep) {
  const own = speedHere(fugitive, world.map, world.params);
  const other = speedHere(opponent, world.map, world.params);
  return nextInt([...world.rng], own + other) < own;
}

describe("dialogue (spec E-4..E-8, D6, D8, D9)", () => {
  test("a free victim pays an extortion at once, cristal first", () => {
    const { world, hunter, prey } = setup("extort", ({ hunter, prey }) => {
      hunter.cargo.materia = 4;
      prey.cargo = { materia: 9, cristal: 3 };
    });
    const events = tick(world);
    expect(types(events)).toEqual(["encounter", "reaction", "paid"]);
    expect(events[1]).toMatchObject({ choice: "pay", by: "default" });
    // Circle capacity 10, 4 carried: 6 free, 3 cristal then 3 materia.
    expect(events[2]).toMatchObject({ amount: { materia: 3, cristal: 3 } });
    expect(hunter.cargo).toEqual({ materia: 7, cristal: 3 });
    expect(prey.cargo).toEqual({ materia: 6, cristal: 0 });
    expect(prey.safeConduct).toEqual({ team: 0, untilTick: 600 });
    expect(prey.extortBlocks).toEqual([
      { aggressor: hunter.id, untilTick: 1800 },
    ]);
    expect(world.encounters).toEqual([]);
    expect([hunter.engagement, prey.engagement]).toEqual([null, null]);
    expect([hunter.order, prey.order]).toEqual([
      { type: "stop" },
      { type: "stop" },
    ]);
  });

  test("the safe conduct keeps the extorting team off; the pair stays blocked", () => {
    const { world, hunter, prey } = setup("extort", ({ prey }) => {
      prey.cargo.cristal = 20;
    });
    tick(world);
    hunter.order = { type: "approach", targetId: prey.id, intent: "attack" };
    run(world, 100);
    expect(world.encounters).toEqual([]);
    // Off the safe conduct, the attack opens; the extortion stays blocked.
    prey.safeConduct = null;
    hunter.order = { type: "approach", targetId: prey.id, intent: "extort" };
    tick(world);
    expect(world.encounters).toEqual([]);
    expect(hunter.order).toEqual({ type: "stop" });
  });

  test("a dominated victim waits for its player, then its rules decide", () => {
    const { world, hunter, prey } = setup("extort", ({ world, prey }) => {
      prey.cargo.cristal = 5;
      dominated(world, prey, 9);
    });
    tick(world);
    const [encounter] = world.encounters;
    expect(encounter).toMatchObject({ stage: "dialogue", deadlineTick: 60 });
    // The window is 60 s: ticks 1 to 59 wait, tick 60 decides.
    run(world, 59);
    expect(world.encounters).toHaveLength(1);
    expect(prey.activity).toBe("talking");
    const events = tick(world);
    expect(events.find((e) => e.type === "reaction")).toMatchObject({
      choice: "pay",
      by: "default",
    });
    expect(hunter.cargo.cristal).toBe(5);
  });

  test("the player's reply is applied at the encounters stage", () => {
    const { world, prey } = setup("extort", ({ world, prey }) => {
      prey.cargo.cristal = 5;
      dominated(world, prey, 9);
    });
    tick(world);
    world.encounters[0]!.reply = "refuse";
    const events = tick(world);
    expect(events.find((e) => e.type === "reaction")).toMatchObject({
      choice: "refuse",
      by: "player",
    });
    expect(world.encounters[0]).toMatchObject({
      stage: "fight",
      deadlineTick: null,
      nextRoundTick: world.tick - 1 + 10,
    });
    expect(prey.cargo.cristal).toBe(5);
    tick(world);
    expect(prey.activity).toBe("fighting");
  });
});

describe("fleeing (spec F-1..F-4, D10)", () => {
  test("escapes with the chance of its speed over both speeds, by the rng", () => {
    let escapes = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const { world, hunter, prey } = setup("attack", ({ world, prey }) => {
        world.rng = createRng(seed);
        prey.cargo.materia = 5;
      });
      // Opening consumes no rng: the flee is the first draw.
      const expected = wouldEscape(world, prey, hunter);
      const events = tick(world);
      const attempt = events.find((e) => e.type === "fleeAttempt")!;
      expect(attempt).toMatchObject({ escaped: expected });
      if (expected) escapes++;
    }
    // A loaded square (2 cells/min × 800‰) against an empty circle (5):
    // 1600 / (1600 + 5000), about 24%.
    expect(escapes).toBeGreaterThan(25);
    expect(escapes).toBeLessThan(75);
  }, 30_000);

  test("a loaded square on a crossing almost never escapes a circle", () => {
    const world = textWorld(ROW);
    const square = creepOf(world, 1, "square");
    const circle = creepOf(world, 0, "circle");
    Object.assign(square, { x: 14, y: 0, cargo: { materia: 30, cristal: 0 } });
    Object.assign(circle, { x: 13, y: 0 });
    const own = speedHere(square, world.map, world.params);
    const other = speedHere(circle, world.map, world.params);
    // 2000 × 500‰ × 800‰ = 800 against 5000: under 14%.
    expect([own, other]).toEqual([800, 5000]);
  });

  function escaping(seedFrom = 1) {
    for (let seed = seedFrom; seed < seedFrom + 100; seed++) {
      const s = setup("attack", ({ world, prey }) => {
        world.rng = createRng(seed);
        prey.cargo = { materia: 20, cristal: 10 };
      });
      if (wouldEscape(s.world, s.prey, s.hunter)) return s;
    }
    throw new Error("no escaping seed");
  }

  test("who escapes drops 50–100% of each resource in a spoil and runs home", () => {
    const { world, hunter, prey } = escaping();
    const events = tick(world);
    const attempt = events.find((e) => e.type === "fleeAttempt")!;
    if (attempt.type !== "fleeAttempt") throw new Error("unreachable");
    const dropped = attempt.dropped!;
    expect(dropped.materia).toBeGreaterThanOrEqual(10);
    expect(dropped.materia).toBeLessThanOrEqual(20);
    expect(dropped.cristal).toBeGreaterThanOrEqual(5);
    expect(dropped.cristal).toBeLessThanOrEqual(10);
    expect(prey.cargo).toEqual({
      materia: 20 - dropped.materia,
      cristal: 10 - dropped.cristal,
    });
    expect(world.spoils).toEqual([
      { id: attempt.spoil, cargo: dropped, x: 10, y: 0 },
    ]);
    expect(world.encounters).toEqual([]);
    expect(prey.order).toEqual({
      type: "flee",
      untilTick: world.tick - 1 + 60,
    });
    expect(hunter.order).toEqual({ type: "stop" });
    // It runs to its core (x=29) with the bonus; the autopilot leaves it be.
    prey.rules = [{ when: { type: "always" }, then: { type: "stop" } }];
    run(world, 30);
    expect(prey.order.type).toBe("flee");
    expect(prey.activity).toBe("fleeing");
    expect(prey.x).toBeGreaterThan(10);
    run(world, 30);
    expect(prey.order).toEqual({ type: "stop" });
  });

  test("the flee bonus speeds the run up", () => {
    const FLAT = ["A............................B"];
    const plain = textWorld(FLAT);
    const runner = creepOf(plain, 1, "square");
    Object.assign(runner, { x: 10, y: 0 });
    runner.order = { type: "moveTo", x: 29, y: 0 };
    const fled = textWorld(FLAT);
    const fugitive = creepOf(fled, 1, "square");
    Object.assign(fugitive, { x: 10, y: 0 });
    fugitive.order = { type: "flee", untilTick: 1000 };
    run(plain, 300);
    run(fled, 300);
    // 2 cells/min for 5 min, 1.5× with the bonus.
    expect(runner.x - 10).toBe(10);
    expect(fugitive.x - 10).toBe(15);
  });

  test("a failed flee drops nothing and starts the fight", () => {
    for (let seed = 1; seed < 100; seed++) {
      const { world, hunter, prey } = setup("attack", ({ world, prey }) => {
        world.rng = createRng(seed);
        prey.cargo.materia = 8;
      });
      if (wouldEscape(world, prey, hunter)) continue;
      const events = tick(world);
      expect(events.find((e) => e.type === "fleeAttempt")).toMatchObject({
        escaped: false,
        dropped: null,
        spoil: null,
      });
      expect(prey.cargo.materia).toBe(8);
      expect(world.encounters[0]?.stage).toBe("fight");
      expect(world.spoils).toEqual([]);
      return;
    }
    throw new Error("no failing seed");
  });
});

describe("the fight (spec L-1..L-3, D7, D11)", () => {
  /** An extortion refused by the dominated victim: a fight from full HP. */
  function fight(edit: (s: Setup) => void = () => {}) {
    const s = setup("extort", (s) => {
      s.prey.cargo.cristal = 5;
      dominated(s.world, s.prey, 9);
      edit(s);
    });
    tick(s.world);
    s.world.encounters[0]!.reply = "refuse";
    tick(s.world);
    return s;
  }

  test("a round every 10 s; a hit takes 250‰ of the maximum HP", () => {
    const { world, hunter, prey } = fight();
    run(world, 9);
    expect([hunter.hp, prey.hp]).toEqual([
      maxHp(world.params, "circle"),
      maxHp(world.params, "square"),
    ]);
    tick(world);
    const lost =
      maxHp(world.params, "circle") -
      hunter.hp +
      (maxHp(world.params, "square") - prey.hp);
    expect([30_000, 75_000]).toContain(lost);
    expect(world.encounters[0]!.rounds).toBe(1);
  });

  test("ends in a death: the winner loots up to its free capacity, the rest is a spoil", () => {
    const { world, hunter, prey } = fight(({ prey }) => {
      prey.cargo = { materia: 30, cristal: 5 };
    });
    const events = untilClosed(world);
    const ended = events.find((e) => e.type === "fightEnded")!;
    if (ended.type !== "fightEnded") throw new Error("unreachable");
    expect(types(events).slice(-3)).toEqual(["fightEnded", "died", "looted"]);
    expect(ended.rounds).toBeGreaterThanOrEqual(4);
    const winner = world.creeps.find((c) => c.id === ended.winner.id)!;
    expect(world.creeps.find((c) => c.id === ended.loser.id)).toBeUndefined();
    expect(winner.engagement).toBeNull();
    if (winner === hunter) {
      // Circle, empty: 10 free, cristal first.
      expect(hunter.cargo).toEqual({ materia: 5, cristal: 5 });
      expect(world.spoils).toMatchObject([
        { cargo: { materia: 25, cristal: 0 }, x: 10, y: 0 },
      ]);
      // The dead creep's domination ended with it.
      expect(world.creeps.some((c) => c.dominatedBy === 9)).toBe(false);
    } else {
      expect(prey.cargo).toEqual({ materia: 30, cristal: 5 });
      expect(world.spoils).toEqual([]);
    }
  });

  test("the wounded lose more often: the chance follows the HP share", () => {
    let hunterHits = 0;
    const rounds = 200;
    for (let seed = 1; seed <= rounds; seed++) {
      const { world, hunter, prey } = fight(({ world, hunter }) => {
        world.rng = createRng(seed);
        hunter.hp = maxHp(world.params, "circle") / 4;
      });
      const before = prey.hp;
      run(world, 10);
      if (prey.hp < before) hunterHits++;
      expect(hunter.hp).toBeGreaterThanOrEqual(0);
    }
    // 250 against 1000: 20%.
    expect(hunterHits).toBeGreaterThan(20);
    expect(hunterHits).toBeLessThan(65);
  }, 30_000);

  test("the dominated victim can flee in the middle of the fight", () => {
    for (let seed = 1; seed < 100; seed++) {
      const { world, hunter, prey } = fight(({ world }) => {
        world.rng = createRng(seed);
      });
      run(world, 9);
      world.encounters[0]!.reply = "flee";
      if (!wouldEscape(world, prey, hunter)) continue;
      const events = tick(world);
      expect(types(events)).toEqual(["reaction", "fleeAttempt"]);
      expect(events[0]).toMatchObject({ choice: "flee", by: "player" });
      expect(prey.order.type).toBe("flee");
      expect(world.encounters).toEqual([]);
      return;
    }
    throw new Error("no escaping seed");
  });

  test("HP does not regenerate in an encounter", () => {
    const { world, hunter, prey } = setup(
      "extort",
      ({ world, prey, hunter }) => {
        prey.cargo.cristal = 5;
        dominated(world, prey, 9);
        prey.hp = 1_000;
        hunter.hp = 1_000;
      },
    );
    // The dialogue waits through tick 59, which ends the first minute.
    run(world, 60);
    expect(world.encounters).toHaveLength(1);
    expect([hunter.hp, prey.hp]).toEqual([1_000, 1_000]);
  });
});

describe("spoils (spec D11)", () => {
  test("piles on the same cell add up, keeping the first id", () => {
    const world = textWorld(ROW);
    const first = dropSpoil(world, { x: 10, y: 0 }, { materia: 3, cristal: 1 });
    const other = dropSpoil(world, { x: 11, y: 0 }, { materia: 1, cristal: 0 });
    const again = dropSpoil(world, { x: 10, y: 0 }, { materia: 2, cristal: 4 });
    expect(again).toBe(first);
    expect(world.spoils).toEqual([
      { id: first, cargo: { materia: 5, cristal: 5 }, x: 10, y: 0 },
      { id: other, cargo: { materia: 1, cristal: 0 }, x: 11, y: 0 },
    ]);
  });
});
