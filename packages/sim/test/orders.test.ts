import { describe, expect, test } from "vitest";
import { Terrain, type GameMap } from "../src/map.ts";
import type { Dna } from "../src/params.ts";
import { step } from "../src/step.ts";
import { createMemory } from "../src/vision.ts";
import { createWorld, type Creep, type WorldState } from "../src/world.ts";
import { loadTestParams, run } from "./helpers.ts";

const params = loadTestParams();

/**
 * A world on an open 12×3 jungle strip, with its first creep at (0, 1) and no
 * creep running autopilot rules.
 */
function strip(dna: Dna = "square"): { world: WorldState; creep: Creep } {
  const world = createWorld(42, params);
  const map: GameMap = {
    width: 12,
    height: 3,
    terrain: new Array(36).fill(Terrain.jungle),
    road: new Array(36).fill(0),
  };
  world.map = map;
  world.memory = createMemory(world.teams, map);
  const creep = world.creeps[0]!;
  Object.assign(creep, { dna, x: 0, y: 1 });
  for (const other of world.creeps.slice(1))
    Object.assign(other, { x: 0, y: 0 });
  for (const c of world.creeps) c.rules = [];
  return { world, creep };
}

const at = (creep: Creep) => ({ x: creep.x, y: creep.y });

describe("moveTo", () => {
  test("a square enters a jungle cell after 30 ticks (2 cells per minute)", () => {
    const { world, creep } = strip();
    creep.order = { type: "moveTo", x: 1, y: 1 };
    run(world, 29);
    expect(at(creep)).toEqual({ x: 0, y: 1 });
    run(world, 1);
    expect(at(creep)).toEqual({ x: 1, y: 1 });
  });

  test.each([
    ["square", 300],
    ["triangle", 200],
    ["circle", 120],
  ] as const)("%s crosses 10 jungle cells in %i ticks", (dna, ticks) => {
    const { world, creep } = strip(dna);
    creep.order = { type: "moveTo", x: 10, y: 1 };
    run(world, ticks - 1);
    expect(creep.x).toBe(9);
    run(world, 1);
    expect(creep.x).toBe(10);
  });

  test("roads double the speed", () => {
    const { world, creep } = strip();
    for (let x = 0; x < 12; x++) world.map.road[12 + x] = 1;
    creep.order = { type: "moveTo", x: 10, y: 1 };
    run(world, 150);
    expect(creep.x).toBe(10);
  });

  test("a loaded square carries leftover points into the next cell", () => {
    const { world, creep } = strip();
    creep.cargo.materia = 5;
    creep.order = { type: "moveTo", x: 5, y: 1 };
    // 1600 points per tick: 60000 / 1600 = 37.5 ticks per cell.
    run(world, 37);
    expect(creep.x).toBe(0);
    run(world, 1);
    expect(creep.x).toBe(1);
    expect(creep.movePoints).toBe(800);
    run(world, 36);
    expect(creep.x).toBe(1);
    run(world, 1);
    expect(creep.x).toBe(2);
    expect(creep.movePoints).toBe(0);
  });

  test("on arrival the creep stops and drops points and path", () => {
    const { world, creep } = strip("circle");
    creep.order = { type: "moveTo", x: 2, y: 1 };
    run(world, 24);
    expect(creep).toMatchObject({
      x: 2,
      y: 1,
      order: { type: "stop" },
      movePoints: 0,
      path: null,
    });
  });

  test("an unreachable target turns into stop without moving", () => {
    const { world, creep } = strip();
    world.map.terrain[12 + 5] = Terrain.rock;
    creep.order = { type: "moveTo", x: 5, y: 1 };
    run(world, 1);
    expect(at(creep)).toEqual({ x: 0, y: 1 });
    expect(creep.order).toEqual({ type: "stop" });
  });

  test("a new target mid-way reroutes from the current cell", () => {
    const { world, creep } = strip("circle");
    creep.order = { type: "moveTo", x: 10, y: 1 };
    run(world, 24);
    expect(at(creep)).toEqual({ x: 2, y: 1 });
    creep.order = { type: "moveTo", x: 2, y: 0 };
    run(world, 12);
    expect(at(creep)).toEqual({ x: 2, y: 0 });
    expect(creep.order).toEqual({ type: "stop" });
  });

  test("creeps move independently and may share a cell", () => {
    const { world, creep } = strip("circle");
    const other = world.creeps[1]!;
    Object.assign(other, { dna: "circle", x: 2, y: 1 });
    creep.order = { type: "moveTo", x: 2, y: 1 };
    other.order = { type: "moveTo", x: 0, y: 1 };
    run(world, 24);
    expect(at(creep)).toEqual({ x: 2, y: 1 });
    expect(at(other)).toEqual({ x: 0, y: 1 });
  });
});

describe("stop", () => {
  test("halts mid-way and drops the points gathered toward the next cell", () => {
    const { world, creep } = strip();
    creep.order = { type: "moveTo", x: 10, y: 1 };
    run(world, 40);
    expect(creep.x).toBe(1);
    expect(creep.movePoints).toBe(20_000);
    creep.order = { type: "stop" };
    run(world, 100);
    expect(at(creep)).toEqual({ x: 1, y: 1 });
    expect(creep.movePoints).toBe(0);
    expect(creep.path).toBeNull();
  });
});

describe("on a generated map", () => {
  test("a creep walks from its core to the other core", () => {
    const world = createWorld(42, params);
    const creep = world.creeps.find((c) => c.dna === "circle")!;
    creep.rules = [];
    const target = world.teams[1]!.core;
    creep.order = { type: "moveTo", ...target };
    let ticks = 0;
    while (creep.order.type === "moveTo" && ticks < 100_000) {
      step(world, []);
      ticks++;
    }
    expect(at(creep)).toEqual(target);
  });
});
