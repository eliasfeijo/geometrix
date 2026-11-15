import { describe, expect, it } from "vitest";
import { NAME_STRIDE, nameAt, NAMES } from "../src/names.ts";
import { startProduction } from "../src/production.ts";
import { fullView, view } from "../src/view.ts";
import { createWorld } from "../src/world.ts";
import { loadTestParams, run } from "./helpers.ts";

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

  it("are given at birth by the birth order and never change", () => {
    const world = createWorld(42, loadTestParams());
    // The initial creeps of both teams take the first births.
    expect(world.creeps.map((c) => c.name)).toEqual(
      world.creeps.map((_, i) => nameAt(i)),
    );
    expect(world.births).toBe(world.creeps.length);
    const team = world.teams[0]!;
    team.stock = { materia: 1000, cristal: 1000 };
    expect(startProduction(world, 0, "circle", false)).toBeNull();
    const before = world.creeps.map((c) => [c.id, c.name]);
    run(world, world.params.creep.productionSeconds);
    const born = world.creeps.at(-1)!;
    expect(born.name).toBe(nameAt(before.length));
    // Removing a creep renames nobody: the name lives in the state.
    world.creeps.splice(0, 1);
    for (const creep of world.creeps.slice(0, -1)) {
      expect(before).toContainEqual([creep.id, creep.name]);
    }
    // The team's view and the replay's full view carry the same name.
    const own = view(world, 0).creeps.find((c) => c.id === born.id)!;
    expect(own.name).toBe(born.name);
    expect(fullView(world).creeps.find((c) => c.id === born.id)!.name).toBe(
      born.name,
    );
  });
});
