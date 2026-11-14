import { describe, expect, it } from "vitest";
import { creepName, NAME_STRIDE, nameAt, NAMES } from "../src/names.ts";

function edits(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  let row = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const next = [i];
    for (let j = 1; j <= y.length; j++) {
      next[j] = Math.min(
        row[j]! + 1,
        next[j - 1]! + 1,
        row[j - 1]! + (x[i - 1] === y[j - 1] ? 0 : 1),
      );
    }
    row = next;
  }
  return row[y.length]!;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

describe("creep names", () => {
  it("are short words, pairwise at least 2 edits apart", () => {
    // No initial I: it reads as l in sans-serif fonts.
    for (const name of NAMES) expect(name).toMatch(/^[A-HJ-Z][a-z]{1,6}$/);
    for (let i = 0; i < NAMES.length; i++) {
      for (let j = i + 1; j < NAMES.length; j++) {
        expect(
          edits(NAMES[i]!, NAMES[j]!),
          `${NAMES[i]} × ${NAMES[j]}`,
        ).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("give every creep of a world a different name", () => {
    expect(gcd(NAME_STRIDE, NAMES.length)).toBe(1);
    const first = Array.from({ length: NAMES.length }, (_, i) => nameAt(i));
    expect(new Set(first).size).toBe(NAMES.length);
    // Past the list, names come back with a numeral.
    expect(nameAt(NAMES.length)).toBe(`${nameAt(0)} II`);
    expect(nameAt(2 * NAMES.length + 5)).toBe(`${nameAt(5)} III`);
  });

  it("follow the birth order in the state", () => {
    const creeps = [{ id: 3 }, { id: 4 }, { id: 46 }];
    expect(creepName(creeps, 3)).toBe(nameAt(0));
    expect(creepName(creeps, 46)).toBe(nameAt(2));
    expect(creepName(creeps, 99)).toBe("#99");
  });
});
