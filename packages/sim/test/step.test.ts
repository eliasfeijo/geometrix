import { describe, expect, test } from "vitest";
import { restore, serialize } from "../src/serialize.ts";
import { step } from "../src/step.ts";
import { createWorld } from "../src/world.ts";
import { loadDefaultParams } from "./helpers.ts";

const params = loadDefaultParams();

describe("step", () => {
  test("advances the tick by one, in place", () => {
    const world = createWorld(42, params);
    step(world, []);
    step(world, []);
    expect(world.tick).toBe(2);
  });

  test("without rules or orders and with full deposits, nothing but the tick changes", () => {
    const world = createWorld(42, params);
    for (const creep of world.creeps) creep.rules = [];
    const before = restore(serialize(world));
    for (let i = 0; i < 1000; i++) step(world, []);
    expect({ ...world, tick: 0 }).toEqual(before);
  });
});
