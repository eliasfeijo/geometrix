import { ownTeam, productionRefusal, step } from "@geometrix/sim";
import { describe, expect, it } from "vitest";
import { viewOf, testWorld } from "./helpers.ts";

describe("production checks on the wire state", () => {
  it("match the sim's on the full state", () => {
    const world = testWorld();
    const team = world.teams[0]!;
    const check = () => {
      const wire = viewOf(world);
      expect(
        productionRefusal(
          { params: world.params, creeps: wire.creeps },
          ownTeam(wire),
        ),
      ).toBe(productionRefusal(world, team));
    };
    check(); // no stock
    team.stock = { materia: 1e6, cristal: 1e6 };
    check(); // allowed
    team.production = { dna: "circle", remainingSeconds: 5 };
    check(); // busy
    team.production = null;
    while (
      world.creeps.filter((c) => c.team === 0).length <
      world.params.population.cap
    ) {
      world.creeps.push({
        ...structuredClone(world.creeps[0]!),
        id: world.nextId++,
      });
    }
    step(world, []);
    check(); // population cap
  });
});
