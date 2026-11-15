import { describe, expect, test } from "vitest";
import { dominate, join } from "../src/domination.ts";
import type { SimEvent } from "../src/events.ts";
import { createRng } from "../src/rng.ts";
import { step } from "../src/step.ts";
import type { Creep, WorldState } from "../src/world.ts";
import { updateVision } from "../src/vision.ts";
import { creepOf, run, textWorld } from "./helpers.ts";

// 30 cells: core A at x=0, core B at x=29, out of each other's sight.
const ROW = ["A............................B"];

/** Steps once and returns the tick's events. */
const tick = (world: WorldState): SimEvent[] => step(world, []);

/** Steps until an encounter opens; returns the tick's events. */
function untilEncounter(world: WorldState, limit = 600): SimEvent[] {
  for (let i = 0; i < limit; i++) {
    const events = tick(world);
    if (events.some((e) => e.type === "encounter")) return events;
  }
  throw new Error("no encounter opened");
}

const place = (creep: Creep, x: number, y = 0) =>
  Object.assign(creep, { x, y });

/** Places the creeps and updates the teams' sight, as at the end of a tick. */
function placed(world: WorldState, ...at: [Creep, number][]): void {
  for (const [creep, x] of at) place(creep, x);
  updateVision(world);
}

/** Player 9 of team 1 dominates `creep`: its dialogue waits for a reply. */
function dominatedByTeam1(world: WorldState, creep: Creep): void {
  join(world, 9, creep.team, false);
  dominate(world, 9, creep.id);
}

describe("approach and opening (spec E-1..E-3, E-5, E-9)", () => {
  test("chases a moving target and opens when within the radius", () => {
    const world = textWorld(ROW);
    const hunter = creepOf(world, 0, "circle");
    const prey = creepOf(world, 1, "square");
    placed(world, [hunter, 5], [prey, 9]);
    dominatedByTeam1(world, prey);
    prey.order = { type: "moveTo", x: 20, y: 0 };
    hunter.order = { type: "approach", targetId: prey.id, intent: "attack" };
    const events = untilEncounter(world);
    expect(prey.x).toBeGreaterThan(9);
    expect(Math.abs(hunter.x - prey.x)).toBeLessThanOrEqual(1);
    const [encounter] = world.encounters;
    expect(encounter).toMatchObject({
      aggressor: hunter.id,
      victim: prey.id,
      intent: "attack",
      stage: "dialogue",
      demand: null,
      deadlineTick: world.tick - 1 + 60,
      x: prey.x,
      y: prey.y,
    });
    expect(hunter.engagement).toBe(encounter!.id);
    expect(prey.engagement).toBe(encounter!.id);
    expect(hunter.order).toEqual({ type: "stop" });
    expect(prey.order).toEqual({ type: "stop" });
    expect(events.find((e) => e.type === "encounter")).toMatchObject({
      encounter: encounter!.id,
      aggressor: { id: hunter.id, team: 0, name: hunter.name },
      victim: { id: prey.id, team: 1, name: prey.name },
      mutual: false,
      teams: [0, 1],
    });
    // Engaged creeps stand still.
    const at = [hunter.x, prey.x];
    run(world, 30);
    expect([hunter.x, prey.x]).toEqual(at);
    expect(prey.activity).toBe("talking");
  });

  test("ends when the target leaves the team's sight", () => {
    const world = textWorld(ROW);
    const hunter = creepOf(world, 0, "square");
    const prey = creepOf(world, 1, "circle");
    placed(world, [hunter, 10], [prey, 13]);
    prey.order = { type: "moveTo", x: 28, y: 0 };
    hunter.order = { type: "approach", targetId: prey.id, intent: "attack" };
    run(world, 200);
    expect(hunter.order).toEqual({ type: "stop" });
    expect(world.encounters).toEqual([]);
  });

  test("waits while the target is busy or has a safe conduct against the team", () => {
    const world = textWorld(ROW);
    const hunter = creepOf(world, 0, "circle");
    const prey = creepOf(world, 1, "square");
    placed(world, [hunter, 9], [prey, 10]);
    dominatedByTeam1(world, prey);
    prey.safeConduct = { team: 0, untilTick: world.tick + 100 };
    hunter.order = { type: "approach", targetId: prey.id, intent: "attack" };
    run(world, 50);
    expect(world.encounters).toEqual([]);
    expect(hunter.order.type).toBe("approach");
    // A safe conduct against another team does not protect.
    prey.safeConduct = { team: 2, untilTick: world.tick + 100 };
    untilEncounter(world, 1);
  });

  test("a safe conduct ends with time and in the creep's own core zone", () => {
    const world = textWorld(ROW);
    const prey = creepOf(world, 1, "square");
    place(prey, 15);
    // Protected through tick 2; gone at tick 3.
    prey.safeConduct = { team: 0, untilTick: world.tick + 3 };
    run(world, 3);
    expect(prey.safeConduct).not.toBeNull();
    run(world, 1);
    expect(prey.safeConduct).toBeNull();
    place(prey, 21);
    prey.safeConduct = { team: 0, untilTick: world.tick + 100 };
    tick(world);
    expect(prey.safeConduct).toBeNull();
  });

  test("an extortion with nothing to demand, or a blocked pair, ends the approach", () => {
    const world = textWorld(ROW);
    const hunter = creepOf(world, 0, "circle");
    const prey = creepOf(world, 1, "square");
    placed(world, [hunter, 9], [prey, 10]);
    hunter.order = { type: "approach", targetId: prey.id, intent: "extort" };
    tick(world);
    expect(hunter.order).toEqual({ type: "stop" });
    prey.cargo.cristal = 5;
    prey.extortBlocks = [{ aggressor: hunter.id, untilTick: world.tick + 5 }];
    hunter.order = { type: "approach", targetId: prey.id, intent: "extort" };
    tick(world);
    expect(hunter.order).toEqual({ type: "stop" });
    expect(world.encounters).toEqual([]);
    // Once the block is over, the extortion opens, demanding cristal first.
    run(world, 5);
    dominatedByTeam1(world, prey);
    hunter.cargo.materia = 7;
    prey.cargo.materia = 9;
    hunter.order = { type: "approach", targetId: prey.id, intent: "extort" };
    tick(world);
    // Circle capacity 10, 7 carried: 3 free, all of it cristal.
    expect(world.encounters[0]?.demand).toEqual({ materia: 0, cristal: 3 });
  });

  test("an extortion does not open on a fleeing creep; an attack goes straight to the fight", () => {
    const world = textWorld(ROW);
    const hunter = creepOf(world, 0, "circle");
    const prey = creepOf(world, 1, "square");
    placed(world, [hunter, 9], [prey, 10]);
    prey.cargo.cristal = 5;
    prey.order = { type: "flee", untilTick: world.tick + 1000 };
    hunter.order = { type: "approach", targetId: prey.id, intent: "extort" };
    tick(world);
    expect(world.encounters).toEqual([]);
    hunter.order = { type: "approach", targetId: prey.id, intent: "attack" };
    untilEncounter(world, 30);
    expect(world.encounters[0]).toMatchObject({
      stage: "fight",
      deadlineTick: null,
      nextRoundTick: world.tick - 1 + 10,
    });
  });
});

describe("mutual encounter (spec D12, E-9)", () => {
  // Mirror-symmetric (180°): x ↔ 9 − x. A crossing at x=4 and x=5.
  const MIRRORED = ["A...==...B"];

  function mutual(edit: (a: Creep, b: Creep, world: WorldState) => void) {
    const world = textWorld(MIRRORED);
    const a = creepOf(world, 0, "triangle");
    const b = creepOf(world, 1, "triangle");
    edit(a, b, world);
    a.order = { type: "approach", targetId: b.id, intent: "attack" };
    b.order = { type: "approach", targetId: a.id, intent: "attack" };
    const events = untilEncounter(world, 1);
    const opened = events.find((e) => e.type === "encounter")!;
    if (opened.type !== "encounter") throw new Error("unreachable");
    expect(opened.mutual).toBe(true);
    return { aggressor: opened.aggressor.id, a, b, world };
  }

  test("who is not on the crossing chooses first, on both sides", () => {
    const one = mutual((a, b) => {
      place(a, 3);
      place(b, 4);
    });
    expect(one.aggressor).toBe(one.a.id);
    const other = mutual((a, b) => {
      place(a, 5);
      place(b, 6);
    });
    expect(other.aggressor).toBe(other.b.id);
  });

  test("then who carries less for its capacity, on both sides", () => {
    const one = mutual((a, b) => {
      place(a, 2);
      place(b, 3);
      b.cargo.materia = 1;
    });
    expect(one.aggressor).toBe(one.a.id);
    const other = mutual((a, b) => {
      place(a, 6);
      place(b, 7);
      a.cargo.materia = 1;
    });
    expect(other.aggressor).toBe(other.b.id);
  });

  test("a full tie goes to the rng, never to the id", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 16; seed++) {
      const { aggressor, a, world } = mutual((a, b, world) => {
        place(a, 2);
        place(b, 3);
        world.rng = createRng(seed);
      });
      seen.add(aggressor === a.id ? "a" : "b");
      expect(world.tick).toBe(1);
    }
    expect(seen).toEqual(new Set(["a", "b"]));
  });
});
