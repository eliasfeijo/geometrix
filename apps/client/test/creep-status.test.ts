import { step } from "@geometrix/sim";
import { describe, expect, it } from "vitest";
import { creepStatus } from "../src/creep-status.ts";
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
