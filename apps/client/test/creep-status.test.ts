import { capacity, isOwnCreep, step } from "@geometrix/sim";
import { describe, expect, it } from "vitest";
import { creepStatus, viewCapacity } from "../src/creep-status.ts";
import { viewOf, testWorld } from "./helpers.ts";

/** A creep ordered to gather at a deposit it already stands on. */
function atDeposit(kind: "materia" | "cristal", amount: number) {
  const world = testWorld();
  const deposit = world.deposits.find((d) => d.kind === kind)!;
  deposit.amount = amount;
  const creep = world.creeps[0]!;
  creep.rules = [];
  creep.x = deposit.x;
  creep.y = deposit.y;
  creep.order = { type: "gather", depositId: deposit.id };
  step(world, []);
  const state = viewOf(world);
  return creepStatus(state.creeps[0]!, state.deposits);
}

describe("creep status", () => {
  it("is waiting at a drained materia deposit, through the real step", () => {
    expect(atDeposit("materia", 0)).toBe("waiting");
  });

  it("is gathering while the deposit has some", () => {
    expect(atDeposit("materia", 50)).toBe("gathering");
  });

  it("is idle at exhausted cristal, which never regenerates", () => {
    expect(atDeposit("cristal", 0)).toBe("idle");
  });

  it("follows the activity otherwise", () => {
    const state = viewOf(testWorld());
    expect(creepStatus(state.creeps[0]!, state.deposits)).toBe("idle");
  });
});

describe("an enemy creep in sight (spec C-2)", () => {
  /** Team 0's view with an enemy circle next to its core. */
  function withEnemy() {
    const world = testWorld();
    const enemy = world.creeps.find((c) => c.team === 1 && c.dna === "circle")!;
    const core = world.teams[0]!.core;
    enemy.x = core.x + 1;
    enemy.y = core.y;
    enemy.rules = [];
    enemy.order = { type: "stop" };
    world.teams[1]!.upgrades.capacity = true;
    step(world, []);
    const state = viewOf(world, 0);
    return {
      world,
      state,
      creep: state.creeps.find((c) => c.id === enemy.id)!,
    };
  }

  it("has no rules, order or activity, so no status", () => {
    const { state, creep } = withEnemy();
    expect(creep).toBeDefined();
    expect(isOwnCreep(creep)).toBe(false);
    expect(Object.keys(creep).sort()).toEqual(
      [
        "battle",
        "cargo",
        "dna",
        "engagement",
        "hp",
        "id",
        "name",
        "team",
        "x",
        "y",
      ].sort(),
    );
    expect(creepStatus(creep, state.deposits)).toBeNull();
  });

  it("shows the DNA's base capacity: the enemy's upgrades are hidden", () => {
    const { world, state, creep } = withEnemy();
    const base = capacity(
      creep,
      { upgrades: { capacity: false } },
      world.params,
    );
    expect(capacity(creep, world.teams[1]!, world.params)).toBeGreaterThan(
      base,
    );
    expect(viewCapacity(creep, state.teams[1], world.params)).toBe(base);
  });
});
