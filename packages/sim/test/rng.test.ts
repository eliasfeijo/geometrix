import { describe, expect, test } from "vitest";
import {
  createRng,
  nextInt,
  nextRange,
  nextUint32,
  type RngState,
} from "../src/rng.ts";

const take = (rng: RngState, n: number) =>
  Array.from({ length: n }, () => nextUint32(rng));

describe("xoshiro128**", () => {
  test("matches the C reference implementation", () => {
    // Output of the reference xoshiro128** 1.1 (prng.di.unimi.it) from state
    // {1, 2, 3, 4}.
    expect(take([1, 2, 3, 4], 8)).toEqual([
      11520, 0, 5927040, 70819200, 2031721883, 1637235492, 1287239034,
      3734860849,
    ]);
  });

  test("the sequence for a seed is stable", () => {
    // Golden values: if this changes, every saved world and replay breaks.
    expect(take(createRng(42), 6)).toMatchInlineSnapshot(`
      [
        2837322924,
        544945897,
        479756282,
        3500138142,
        339756180,
        113173290,
      ]
    `);
  });

  test("different seeds give different sequences", () => {
    expect(take(createRng(1), 4)).not.toEqual(take(createRng(2), 4));
  });

  test("the state round-trips through JSON and continues identically", () => {
    const rng = createRng(7);
    take(rng, 100);
    const copy = JSON.parse(JSON.stringify(rng)) as RngState;
    expect(take(copy, 50)).toEqual(take(rng, 50));
  });

  test.each([-1, 1.5, 2 ** 32, Number.NaN])("rejects seed %s", (seed) => {
    expect(() => createRng(seed)).toThrow(RangeError);
  });
});

describe("nextInt / nextRange", () => {
  test("stay within bounds and hit every value", () => {
    const rng = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = nextRange(rng, -2, 2);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThanOrEqual(2);
      seen.add(v);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2]);
  });

  test("bound 1 always returns 0", () => {
    const rng = createRng(5);
    for (let i = 0; i < 10; i++) expect(nextInt(rng, 1)).toBe(0);
  });

  test.each([0, -3, 2.5])("rejects bound %s", (bound) => {
    expect(() => nextInt(createRng(1), bound)).toThrow(RangeError);
  });

  test("rejects an empty range", () => {
    expect(() => nextRange(createRng(1), 3, 2)).toThrow(RangeError);
  });
});
