import { describe, expect, test } from "vitest";
import {
  dominate,
  dominatedCreep,
  dominateRefusal,
  join,
} from "../src/domination.ts";
import { inCoreZone, kill } from "../src/hp.ts";
import { step } from "../src/step.ts";
import { maxHp, type Creep, type WorldState } from "../src/world.ts";
import { creepOf, run, textWorld } from "./helpers.ts";

// Core A at x=0, core B at x=29. The core zone radius is 8 (test params).
const ROW = ["A............................B"];

/** Ticks to the end of the current world minute (tickSeconds is 1). */
const toMinute = (world: WorldState) => 60 - (world.tick % 60);

function wounded(world: WorldState, creep: Creep, x: number, hp: number) {
  creep.x = x;
  creep.hp = hp;
}

describe("HP (spec H-1..H-3, D3)", () => {
  test("a creep is born with the full HP of its DNA, in thousandths", () => {
    const world = textWorld(ROW);
    for (const creep of world.creeps) {
      expect(creep.hp).toBe(world.params.hp.dna[creep.dna].max * 1000);
      expect(creep.engagement).toBeNull();
    }
    expect(maxHp(world.params, "square")).toBe(300_000);
  });

  test("the core zone is a Manhattan radius around the team's own core", () => {
    const world = textWorld(ROW);
    expect(inCoreZone(world, 0, { x: 8, y: 0 })).toBe(true);
    expect(inCoreZone(world, 0, { x: 9, y: 0 })).toBe(false);
    expect(inCoreZone(world, 1, { x: 21, y: 0 })).toBe(true);
    expect(inCoreZone(world, 1, { x: 8, y: 0 })).toBe(false);
  });

  test("regenerates once per world minute: 10‰ on the map, 100‰ in the core zone", () => {
    const world = textWorld(ROW);
    const far = creepOf(world, 0, "square");
    const near = creepOf(world, 0, "triangle");
    wounded(world, far, 12, 1_000);
    wounded(world, near, 8, 1_000);
    run(world, toMinute(world) - 1);
    expect(far.hp).toBe(1_000);
    run(world, 1);
    // 300 HP × 10‰ = 3 HP; 200 HP × 100‰ = 20 HP.
    expect(far.hp).toBe(1_000 + 3_000);
    expect(near.hp).toBe(1_000 + 20_000);
    run(world, 59);
    expect(far.hp).toBe(4_000);
    run(world, 1);
    expect(far.hp).toBe(7_000);
  });

  test("the share is of the maximum, so every DNA heals in the same time", () => {
    const world = textWorld(ROW);
    for (const creep of world.creeps.filter((c) => c.team === 0)) {
      wounded(world, creep, 12, 0);
    }
    run(world, toMinute(world));
    for (const creep of world.creeps.filter((c) => c.team === 0)) {
      expect(creep.hp * 100).toBe(maxHp(world.params, creep.dna));
    }
  });

  test("never passes the maximum", () => {
    const world = textWorld(ROW);
    const creep = creepOf(world, 0, "circle");
    const full = maxHp(world.params, "circle");
    wounded(world, creep, 0, full - 1);
    run(world, toMinute(world));
    expect(creep.hp).toBe(full);
  });

  test("does not regenerate in an encounter", () => {
    const world = textWorld(ROW);
    const creep = creepOf(world, 0, "square");
    wounded(world, creep, 0, 1_000);
    creep.engagement = 999;
    run(world, toMinute(world));
    expect(creep.hp).toBe(1_000);
  });

  test("kill removes the creep and ends its domination; ids are not reused", () => {
    const world = textWorld(ROW);
    join(world, 1, 0, false);
    const victim = creepOf(world, 0, "square");
    const other = creepOf(world, 0, "circle");
    dominate(world, 1, victim.id);
    const nextId = world.nextId;
    kill(world, victim);
    expect(world.creeps).not.toContain(victim);
    expect(dominatedCreep(world, 1)).toBeUndefined();
    // As after a release, the player may dominate another creep.
    expect(dominateRefusal(world, 1, other.id)).toBeNull();
    step(world, []);
    expect(world.nextId).toBe(nextId);
    expect(world.creeps.map((c) => c.id)).not.toContain(victim.id);
  });
});
