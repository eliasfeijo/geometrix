// The rng and the canonical JSON are copies of the sim's (plan P1). Until the
// junction extracts a common package, these tests keep the copies equal: the
// sim is a devDependency for this file only, the battle's runtime never
// imports it (ADR-0008 rule 2).
import * as sim from "@geometrix/sim";
import { describe, expect, test } from "vitest";
import { canonicalJson } from "../src/canonical.ts";
import {
  createRng,
  nextInt,
  nextRange,
  nextUint32,
  type RngState,
} from "../src/rng.ts";

describe("rng equals the sim's", () => {
  test.each([0, 1, 42, 649, 2 ** 32 - 1])(
    "same state and sequence for seed %s",
    (seed) => {
      const ours = createRng(seed);
      const theirs = sim.createRng(seed);
      expect(ours).toEqual(theirs);
      for (let i = 0; i < 1000; i++) {
        expect(nextUint32(ours)).toBe(sim.nextUint32(theirs));
      }
    },
  );

  test("same bounded draws", () => {
    const ours: RngState = createRng(7);
    const theirs = sim.createRng(7);
    for (let i = 1; i <= 500; i++) {
      expect(nextInt(ours, i)).toBe(sim.nextInt(theirs, i));
      expect(nextRange(ours, -i, i)).toBe(sim.nextRange(theirs, -i, i));
    }
    expect(ours).toEqual(theirs);
  });

  test("matches the C reference implementation", () => {
    // Reference xoshiro128** 1.1 (prng.di.unimi.it) from state {1, 2, 3, 4}.
    const rng: RngState = [1, 2, 3, 4];
    expect(Array.from({ length: 4 }, () => nextUint32(rng))).toEqual([
      11520, 0, 5927040, 70819200,
    ]);
  });
});

describe("canonicalJson equals the sim's", () => {
  test.each([
    null,
    true,
    0,
    -17,
    'a "quoted" é',
    [],
    {},
    [3, [1, { b: 2, a: 1 }], "x"],
    { z: { y: [1, 2, { c: null, b: false }] }, a: "1" },
  ])("same output for %j", (value) => {
    expect(canonicalJson(value)).toBe(sim.canonicalJson(value));
  });

  test.each([
    ["undefined", { a: undefined }],
    ["NaN", { a: [Number.NaN] }],
    ["Map", { a: new Map() }],
    ["function", { a: () => 1 }],
  ])("refuses %s with the same message", (_, value) => {
    expect(() => sim.canonicalJson(value)).toThrow(TypeError);
    const simMessage = messageOf(() => sim.canonicalJson(value));
    expect(messageOf(() => canonicalJson(value))).toBe(simMessage);
  });
});

function messageOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return (error as Error).message;
  }
  return "(no error)";
}

describe("canonicalJson sorts keys", () => {
  test("at every level", () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { z: 0, y: 1 }], c: "x" } })).toBe(
      '{"a":{"c":"x","d":[2,{"y":1,"z":0}]},"b":1}',
    );
  });
});
