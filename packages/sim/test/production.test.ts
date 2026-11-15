import { describe, expect, test } from "vitest";
import { population, startProduction } from "../src/production.ts";
import { nameAt } from "../src/names.ts";
import { newCreep, type WorldState } from "../src/world.ts";
import { paramsWith, run, textWorld } from "./helpers.ts";

const MAP = ["A......B"];

/** Team 0 with enough stock for `creeps` creeps (40 materia + 10 cristal each). */
function funded(creeps: number): WorldState {
  const world = textWorld(MAP);
  world.teams[0]!.stock = { materia: 40 * creeps, cristal: 10 * creeps };
  return world;
}

const teamCreeps = (world: WorldState, team = 0) =>
  world.creeps.filter((c) => c.team === team);

/** Adds stopped creeps to team 0 until its population reaches `total`. */
function fillPopulation(world: WorldState, total: number): void {
  const team = world.teams[0]!;
  while (population(world, team) < total) {
    world.creeps.push(
      newCreep(world.nextId++, world.births++, team, "circle", world.params),
    );
  }
}

describe("startProduction", () => {
  test("pays the cost at once and spawns the creep on the core after 10 minutes", () => {
    const world = funded(1);
    const team = world.teams[0]!;
    const id = world.nextId;
    const birth = world.births;
    expect(startProduction(world, 0, "triangle", false)).toBeNull();
    expect(team.stock).toEqual({ materia: 0, cristal: 0 });
    expect(team.production).toEqual({ dna: "triangle", remainingSeconds: 600 });
    run(world, 599);
    expect(teamCreeps(world)).toHaveLength(6);
    run(world, 1);
    expect(teamCreeps(world)).toHaveLength(7);
    expect(world.creeps.at(-1)).toEqual({
      ...newCreep(id, birth, team, "triangle", world.params),
    });
    expect(world.creeps.at(-1)!.name).toBe(nameAt(birth));
    expect(world.creeps.at(-1)!.hp).toBe(200_000);
    expect(world.nextId).toBe(id + 1);
    expect(world.births).toBe(birth + 1);
    expect(team.production).toBeNull();
  });

  test("without repeat the core goes idle after one creep", () => {
    const world = funded(2);
    startProduction(world, 0, "circle", false);
    run(world, 1200);
    expect(teamCreeps(world)).toHaveLength(7);
    expect(world.teams[0]!.production).toBeNull();
  });

  test("refuses while the core is busy, without paying", () => {
    const world = funded(2);
    startProduction(world, 0, "circle", false);
    expect(startProduction(world, 0, "square", true)).toBe("busy");
    expect(world.teams[0]!.stock).toEqual({ materia: 40, cristal: 10 });
    expect(world.teams[0]!.repeat).toBeNull();
  });

  test.each([
    ["materia", { materia: 39, cristal: 10 }],
    ["cristal", { materia: 40, cristal: 9 }],
  ])("refuses without enough %s", (_, stock) => {
    const world = textWorld(MAP);
    world.teams[0]!.stock = { ...stock };
    expect(startProduction(world, 0, "circle", true)).toBe("stock");
    expect(world.teams[0]).toMatchObject({
      stock,
      production: null,
      repeat: null,
    });
  });

  test("refuses at the population cap of 30", () => {
    const world = funded(1);
    fillPopulation(world, 30);
    expect(startProduction(world, 0, "circle", false)).toBe("populationCap");
  });

  test("the creep in production counts toward the cap", () => {
    const world = funded(2);
    fillPopulation(world, 29);
    expect(startProduction(world, 0, "circle", false)).toBeNull();
    expect(population(world, world.teams[0]!)).toBe(30);
    run(world, 600);
    expect(startProduction(world, 0, "circle", false)).toBe("populationCap");
  });

  test("teams produce independently", () => {
    const world = funded(1);
    world.teams[1]!.stock = { materia: 40, cristal: 10 };
    startProduction(world, 0, "square", false);
    startProduction(world, 1, "circle", false);
    run(world, 600);
    expect(teamCreeps(world, 0).at(-1)!.dna).toBe("square");
    expect(teamCreeps(world, 1).at(-1)!.dna).toBe("circle");
    expect(teamCreeps(world, 1).at(-1)).toMatchObject(world.teams[1]!.core);
  });

  test("follows creep.productionSeconds", () => {
    const params = paramsWith((p) => {
      p.creep.productionSeconds = 5;
    });
    const world = textWorld(MAP, params);
    world.teams[0]!.stock = { materia: 40, cristal: 10 };
    startProduction(world, 0, "circle", false);
    run(world, 5);
    expect(teamCreeps(world)).toHaveLength(7);
  });
});

describe("repeat", () => {
  test("starts the same DNA again as each creep is born", () => {
    const world = funded(3);
    startProduction(world, 0, "square", true);
    run(world, 600);
    expect(world.teams[0]!.production).toEqual({
      dna: "square",
      remainingSeconds: 600,
    });
    expect(world.teams[0]!.stock).toEqual({ materia: 40, cristal: 10 });
    run(world, 1200);
    expect(
      teamCreeps(world)
        .map((c) => c.dna)
        .slice(6),
    ).toEqual(["square", "square", "square"]);
  });

  test("waits armed without stock and starts the tick the stock arrives", () => {
    const world = funded(1);
    const team = world.teams[0]!;
    startProduction(world, 0, "circle", true);
    run(world, 900);
    expect(team.production).toBeNull();
    expect(team.repeat).toBe("circle");
    team.stock = { materia: 40, cristal: 10 };
    run(world, 1);
    expect(team.production).toEqual({ dna: "circle", remainingSeconds: 600 });
    expect(team.stock).toEqual({ materia: 0, cristal: 0 });
  });

  test("waits armed at the population cap", () => {
    const world = funded(5);
    fillPopulation(world, 29);
    startProduction(world, 0, "circle", true);
    run(world, 1200);
    expect(population(world, world.teams[0]!)).toBe(30);
    expect(world.teams[0]).toMatchObject({
      production: null,
      repeat: "circle",
      stock: { materia: 160, cristal: 40 },
    });
  });

  test("a new order without repeat drops the armed repeat", () => {
    const world = funded(2);
    const team = world.teams[0]!;
    startProduction(world, 0, "circle", true);
    team.stock = { materia: 0, cristal: 0 };
    run(world, 600);
    team.stock = { materia: 40, cristal: 10 };
    // The armed repeat restarts on the next tick unless the core is taken first.
    expect(startProduction(world, 0, "square", false)).toBeNull();
    expect(team.repeat).toBeNull();
    run(world, 1200);
    expect(
      teamCreeps(world)
        .map((c) => c.dna)
        .slice(6),
    ).toEqual(["circle", "square"]);
  });
});
