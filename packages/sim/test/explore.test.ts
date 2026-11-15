import { describe, expect, test } from "vitest";
import type { Rule } from "../src/autopilot.ts";
import { exploreTarget } from "../src/known.ts";
import { mirrorCell, Terrain } from "../src/map.ts";
import { collectorRules, scoutRules } from "../src/presets.ts";
import { step } from "../src/step.ts";
import { updateVision } from "../src/vision.ts";
import { createWorld, type WorldState } from "../src/world.ts";
import { creepOf, loadTestParams, run, textWorld } from "./helpers.ts";

/** Marks the cells of `rows` drawn as `?` never seen by team 0, the rest seen. */
function knownAs(world: WorldState, rows: string[]): void {
  const memory = world.memory[0]!;
  rows
    .join("")
    .split("")
    .forEach((symbol, i) => {
      memory.explored[i] = symbol === "?" ? 0 : 1;
      memory.terrain[i] =
        symbol === "#" ? Terrain.rock : symbol === "~" ? Terrain.river : 0;
    });
}

describe("exploreTarget", () => {
  test("is the cell never seen fewest steps away, equal ties to the lower index", () => {
    const world = textWorld(["A........B", "..........", ".........."]);
    knownAs(world, ["..?.......", "..........", "?........."]);
    const creep = creepOf(world, 0, "circle");
    // (2, 0) and (0, 2) are both 2 steps from the core at (0, 0).
    expect(exploreTarget(world, creep)).toEqual({ x: 2, y: 0 });
  });

  test("among cells equally near, goes where it would see the most never seen", () => {
    const world = textWorld([
      "A..........B",
      "............",
      "............",
      "............",
      "............",
    ]);
    knownAs(world, [
      "..?.........",
      "............",
      "???.........",
      "???.........",
      "???.........",
    ]);
    // (2, 0) and (0, 2) are both 2 steps from the core. Within the square's
    // sight (3), (2, 0) has 4 cells never seen, (0, 2) has 8: it wins over
    // the lower index.
    expect(exploreTarget(world, creepOf(world, 0, "square"))).toEqual({
      x: 0,
      y: 2,
    });
  });

  test("counts steps on the known map, not Manhattan", () => {
    const world = textWorld(["A........B", "..........", ".........."]);
    // (2, 0) is 2 cells away, behind a known wall: 6 steps around it.
    knownAs(world, [".#?.......", ".#........", "......?..."]);
    const creep = creepOf(world, 0, "circle");
    expect(exploreTarget(world, creep)).toEqual({ x: 2, y: 0 });
    knownAs(world, [".#?.......", ".#........", "..?......."]);
    expect(exploreTarget(world, creep)).toEqual({ x: 2, y: 2 });
  });

  test("ignores a pocket walled in by known rock", () => {
    const world = textWorld(["A........B", "..........", ".........."]);
    knownAs(world, ["...#?#....", "...###....", "........?."]);
    const creep = creepOf(world, 0, "circle");
    expect(exploreTarget(world, creep)).toEqual({ x: 8, y: 2 });
    knownAs(world, ["...#?#....", "...###....", ".........."]);
    expect(exploreTarget(world, creep)).toBeNull();
  });

  test("skips the targets teammates already explore toward", () => {
    const world = textWorld(["A........B", "..........", ".........."]);
    knownAs(world, ["..?.......", "..........", "?........."]);
    const creep = creepOf(world, 0, "circle");
    creepOf(world, 0, "square").order = { type: "explore", x: 2, y: 0 };
    expect(exploreTarget(world, creep)).toEqual({ x: 0, y: 2 });
    // An enemy's target does not count.
    creepOf(world, 0, "square").order = { type: "stop" };
    creepOf(world, 1, "square").order = { type: "explore", x: 2, y: 0 };
    expect(exploreTarget(world, creep)).toEqual({ x: 2, y: 0 });
  });

  test("team 1 picks the mirror of team 0's target on the generated map", () => {
    const world = createWorld(42, loadTestParams());
    const ids = world.creeps.filter((c) => c.team === 0).map((c) => c.id);
    for (const id of ids) {
      const ours = world.creeps.find((c) => c.id === id)!;
      const theirs = world.creeps.find(
        (c) => c.team === 1 && c.dna === ours.dna && c.order.type === "stop",
      )!;
      const target = exploreTarget(world, ours)!;
      expect(exploreTarget(world, theirs)).toEqual(
        mirrorCell(target, world.map),
      );
      ours.order = { type: "explore", ...target };
      theirs.order = { type: "explore", ...mirrorCell(target, world.map) };
    }
  });
});

describe("explore", () => {
  const always = { type: "always" } as const;
  const exploring: Rule[] = [
    { when: always, then: { type: "explore" } },
    { when: always, then: { type: "stop" } },
  ];

  test("walks toward the target and picks a new one once it is seen", () => {
    const world = textWorld(["A..................B"]);
    const creep = creepOf(world, 0, "square");
    creep.rules = exploring;
    step(world, []);
    // The core sees 8 cells: the first never seen is (9, 0).
    expect(creep.order).toEqual({ type: "explore", x: 9, y: 0 });
    // A square sees 3 cells: from x = 6 it sees (9, 0), and aims further.
    run(world, 30 * 6);
    expect(creep.x).toBe(6);
    expect(creep.order).toEqual({ type: "explore", x: 10, y: 0 });
  });

  test("is impossible with nothing left to explore", () => {
    const world = textWorld(["A....B"]);
    const creep = creepOf(world, 0, "square");
    creep.rules = exploring;
    step(world, []);
    expect(creep.order).toEqual({ type: "stop" });
  });

  test("a dominated creep's explore order stops once the cell is seen", () => {
    const world = textWorld(["A..................B"]);
    const creep = creepOf(world, 0, "square");
    creep.dominatedBy = 1;
    creep.order = { type: "explore", x: 9, y: 0 };
    run(world, 30 * 6);
    expect(creep.x).toBe(6);
    run(world, 1);
    expect(creep.order).toEqual({ type: "stop" });
  });

  test("resourceUnknown holds until a deposit with something left is known", () => {
    const world = textWorld(["A.........m.........c.....B"]);
    const creep = creepOf(world, 0, "circle");
    const ifUnknown = (resource: "materia" | "cristal"): Rule[] => [
      {
        when: { type: "resourceUnknown", resource },
        then: { type: "moveTo", x: 5, y: 0 },
      },
      { when: always, then: { type: "stop" } },
    ];
    creep.rules = ifUnknown("materia");
    step(world, []);
    expect(creep.order.type).toBe("moveTo");
    const materia = world.deposits[0]!;
    world.memory[0]!.deposits.push({ ...materia, amount: 0 });
    step(world, []);
    // Empty, but materia regenerates: known.
    expect(creep.order.type).toBe("stop");
    world.memory[0]!.deposits.push({ ...world.deposits[1]!, amount: 0 });
    creep.rules = ifUnknown("cristal");
    step(world, []);
    // Cristal does not regenerate: an empty one is as good as none.
    expect(creep.order.type).toBe("moveTo");
  });
});

describe("presets with exploration (fog spec A-4, D3)", () => {
  test("a collector explores until it finds its resource, then gathers it", () => {
    // The materia at x = 14 is out of the core's sight.
    const world = textWorld(["A.............m.....B"]);
    const creep = creepOf(world, 0, "circle");
    creep.rules = collectorRules("materia");
    step(world, []);
    expect(creep.order.type).toBe("explore");
    run(world, 12 * 8);
    expect(world.memory[0]!.deposits).toHaveLength(1);
    expect(creep.order).toEqual({
      type: "gather",
      depositId: world.deposits[0]!.id,
    });
  });

  test("a scout goes home once there is nothing left to explore", () => {
    const world = textWorld(["A..........B"]);
    const scout = creepOf(world, 0, "circle");
    scout.rules = scoutRules();
    step(world, []);
    expect(scout.order).toEqual({ type: "explore", x: 9, y: 0 });
    // A circle sees 6 cells: from x = 5 it has seen the whole row.
    run(world, 12 * 5);
    expect(scout.x).toBe(5);
    expect(world.memory[0]!.explored.every((e) => e === 1)).toBe(true);
    run(world, 1);
    expect(scout.order.type).toBe("deliver");
    run(world, 12 * 5);
    expect(scout).toMatchObject({ x: 0, y: 0, order: { type: "stop" } });
  });

  test("in a fresh world, both teams set out the same way", () => {
    const world = createWorld(7, loadTestParams());
    updateVision(world);
    run(world, 600);
    const mirrored = (team: number) =>
      world.creeps
        .filter((c) => c.team === team)
        .map((c) =>
          team === 1 ? mirrorCell(c, world.map) : { x: c.x, y: c.y },
        );
    expect(mirrored(1)).toEqual(mirrored(0));
  });
});
