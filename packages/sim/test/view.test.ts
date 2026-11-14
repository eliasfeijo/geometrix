import { describe, expect, test } from "vitest";
import { serialize } from "../src/serialize.ts";
import { step } from "../src/step.ts";
import { view } from "../src/view.ts";
import { createWorld, type Creep, type WorldState } from "../src/world.ts";
import { loadTestParams, run } from "./helpers.ts";

const params = loadTestParams();

/** Seed 42 after the joins and a minute of autopilot, with roads and a job. */
function busyWorld(): WorldState {
  const world = createWorld(42, params);
  step(world, [
    { playerId: 1, command: { type: "join", team: 0, bot: true } },
    { playerId: 2, command: { type: "join", team: 1, bot: true } },
  ]);
  run(world, 60);
  const { map } = world;
  for (const i of [map.width * 20 + 9, 7, map.width * 3 + 30]) map.road[i] = 1;
  world.roadJobs.push({
    id: world.nextId++,
    team: 1,
    x: 5,
    y: 6,
    remainingSeconds: 30,
  });
  return world;
}

describe("view", () => {
  test("has the dynamic state without the creeps' path, move points and trip", () => {
    const world = busyWorld();
    const seen = view(world, 1);
    expect(seen.tick).toBe(world.tick);
    expect(seen.team).toBe(1);
    expect(seen.teams).toEqual(world.teams);
    expect(seen.deposits).toEqual(world.deposits);
    expect(seen.roadJobs).toEqual(world.roadJobs);
    expect(seen.players).toEqual(world.players);
    expect(seen.players).toHaveLength(2);
    const without = (creep: Creep) => {
      const rest: Partial<Creep> = { ...creep };
      delete rest.path;
      delete rest.movePoints;
      delete rest.trip;
      return rest;
    };
    expect(seen.creeps).toEqual(world.creeps.map(without));
    for (const creep of seen.creeps) {
      expect(creep).not.toHaveProperty("path");
      expect(creep).not.toHaveProperty("movePoints");
      expect(creep).not.toHaveProperty("trip");
    }
  });

  test("keeps entities in id order and roads in increasing cell order", () => {
    const seen = view(busyWorld(), 0);
    const ids = (list: { id: number }[]) => list.map((e) => e.id);
    const sorted = (list: number[]) => [...list].sort((a, b) => a - b);
    expect(ids(seen.creeps)).toEqual(sorted(ids(seen.creeps)));
    expect(ids(seen.deposits)).toEqual(sorted(ids(seen.deposits)));
    expect(seen.roads).toEqual(sorted(seen.roads));
    expect(seen.roads).toHaveLength(3);
  });

  test("lists exactly the cells with a road", () => {
    const world = busyWorld();
    const seen = view(world, 0);
    expect(seen.roads.every((i) => world.map.road[i] === 1)).toBe(true);
    expect(world.map.road.filter((r) => r === 1)).toHaveLength(
      seen.roads.length,
    );
  });

  test("is pure: same state, same view, and the state is untouched", () => {
    const world = busyWorld();
    const before = serialize(world);
    expect(view(world, 0)).toEqual(view(world, 0));
    expect(serialize(world)).toBe(before);
  });

  test("without fog, both teams see the same world", () => {
    const world = busyWorld();
    expect({ ...view(world, 0), team: 1 }).toEqual(view(world, 1));
  });

  test("is a shallow copy: new entities, nested objects shared with the state", () => {
    const world = busyWorld();
    const seen = view(world, 0);
    const creep = world.creeps[0]!;
    expect(seen.creeps[0]).not.toBe(creep);
    expect(seen.teams[0]).not.toBe(world.teams[0]);
    expect(seen.creeps[0]!.cargo).toBe(creep.cargo);
    expect(seen.creeps[0]!.rules).toBe(creep.rules);
    // A first-level field does not follow the state; a nested one does.
    creep.x += 1;
    world.teams[0]!.stock.materia += 1;
    expect(seen.creeps[0]!.x).toBe(creep.x - 1);
    expect(seen.teams[0]!.stock.materia).toBe(world.teams[0]!.stock.materia);
  });
});
