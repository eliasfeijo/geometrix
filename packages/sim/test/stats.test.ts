import { describe, expect, test } from "vitest";
import type { Command, CommandInput } from "../src/commands.ts";
import { serialize } from "../src/serialize.ts";
import { ACTIVITIES, sampleMetrics } from "../src/stats.ts";
import { step } from "../src/step.ts";
import { createWorld } from "../src/world.ts";
import { creepOf, loadDefaultParams, run, textWorld } from "./helpers.ts";

const params = loadDefaultParams();

// Core A at (0, 1); a materia deposit 4 cells away; team B far off.
const LANE = ["..........B", "A...m......", "..........."];

const as = (playerId: number, command: Command): CommandInput => ({
  playerId,
  command,
});

function lane() {
  const world = textWorld(LANE, params);
  const creep = creepOf(world, 0, "circle");
  const deposit = world.deposits[0]!;
  const stats = world.stats.teams[0]!;
  return { world, creep, deposit, stats };
}

describe("creep activity", () => {
  test("each tick is one activity: walking empty, gathering, carrying, then idle", () => {
    const { world, creep, deposit, stats } = lane();
    // A circle walks 5 cells per minute: 12 ticks per cell.
    creep.order = { type: "gather", depositId: deposit.id };
    run(world, 48);
    expect(creep.x).toBe(4);
    expect(creep.activity).toBe("walkingEmpty");
    run(world, 10); // capacity 10 at 1 unit per second
    expect(creep.activity).toBe("gathering");
    creep.order = { type: "deliver" };
    run(world, 1);
    expect(creep.activity).toBe("carrying");
    expect(stats.activitySeconds).toMatchObject({
      walkingEmpty: 48,
      gathering: 10,
      carrying: 1,
    });
  });

  test("activity seconds add up to creeps × seconds", () => {
    const world = createWorld(42, params);
    run(world, 3000);
    const total = world.stats.teams
      .flatMap((t) => ACTIVITIES.map((a) => t.activitySeconds[a]))
      .reduce((a, b) => a + b, 0);
    expect(total).toBe(world.creeps.length * 3000);
  });

  test("a builder advancing a road job is building", () => {
    const world = textWorld(LANE, params);
    world.teams[0]!.stock.materia = 100;
    const creep = creepOf(world, 0, "circle");
    creep.order = { type: "buildRoad", x: 1, y: 1, segment: -1 };
    run(world, 12); // walks onto (1, 1)
    run(world, 1);
    expect(creep.activity).toBe("building");
    run(world, params.road.buildSeconds - 1);
    expect(world.map.road[1 * 11 + 1]).toBe(1);
    expect(world.stats.teams[0]!.roadSegments).toBe(1);
    expect(world.stats.teams[0]!.activitySeconds.building).toBe(
      params.road.buildSeconds,
    );
  });
});

describe("trips and deliveries", () => {
  test("a gather and deliver round counts one trip with its time and cells", () => {
    const { world, creep, deposit, stats } = lane();
    creep.order = { type: "gather", depositId: deposit.id };
    run(world, 58);
    creep.order = { type: "deliver" };
    // Loaded circle: 4000 points per tick, 15 ticks per cell.
    run(world, 60);
    expect(creep.x).toBe(0);
    expect(stats.delivered).toEqual({ materia: 10, cristal: 0 });
    expect(world.teams[0]!.stock.materia).toBe(10);
    expect(stats).toMatchObject({ trips: 1, tripSeconds: 118, tripCells: 8 });
    expect(creep.trip).toBeNull();
  });

  test("arriving at the core empty drops the trip without counting it", () => {
    const { world, creep, stats } = lane();
    creep.order = { type: "moveTo", x: 2, y: 1 };
    run(world, 24);
    expect(creep.trip).toEqual({ startTick: 0, cells: 2 });
    creep.order = { type: "deliver" };
    run(world, 24);
    expect(creep.trip).toBeNull();
    expect(stats).toMatchObject({ trips: 0, tripSeconds: 0, tripCells: 0 });
  });
});

describe("core and deposits", () => {
  test("the core is idle on every tick it ends with nothing in production", () => {
    const world = textWorld(LANE, params);
    world.teams[0]!.stock = { materia: 40, cristal: 10 };
    world.teams[0]!.production = null;
    run(world, 5);
    world.teams[0]!.production = { dna: "square", remainingSeconds: 3 };
    run(world, 10);
    // 5 idle; busy at the end of 2 ticks (the 3rd spawns the creep); 8 idle.
    expect(world.stats.teams[0]!.coreIdleSeconds).toBe(13);
    expect(world.stats.teams[1]!.coreIdleSeconds).toBe(15);
  });

  test("records the first tick a deposit runs dry", () => {
    const { world, creep, deposit } = lane();
    deposit.amount = 3;
    creep.order = { type: "gather", depositId: deposit.id };
    run(world, 48 + 3);
    expect(deposit.amount).toBe(0);
    expect(world.stats.deposits[0]).toEqual({
      deposit: deposit.id,
      emptiedAtTick: 50,
      contestedSeconds: 0,
    });
  });

  test("a deposit is contested while both teams have a gather order on it", () => {
    const { world, deposit } = lane();
    creepOf(world, 0, "square").order = {
      type: "gather",
      depositId: deposit.id,
    };
    run(world, 5);
    expect(world.stats.deposits[0]!.contestedSeconds).toBe(0);
    creepOf(world, 1, "square").order = {
      type: "gather",
      depositId: deposit.id,
    };
    run(world, 7);
    expect(world.stats.deposits[0]!.contestedSeconds).toBe(7);
  });
});

describe("players", () => {
  test("counts accepted commands by team, presets and domination time", () => {
    const world = textWorld(LANE, params);
    const creep = creepOf(world, 0, "circle");
    step(world, [
      as(1, { type: "join", team: 0 }),
      as(2, { type: "join", team: 1 }),
      as(1, { type: "dominate", creepId: creep.id }),
      as(1, { type: "applyPreset", creepId: creep.id, preset: "roadBuilder" }),
      as(1, {
        type: "applyPreset",
        creepId: creep.id,
        preset: "cristalCollector",
      }),
      // Refused: not this player's creep.
      as(2, { type: "dominate", creepId: creep.id }),
    ]);
    run(world, 9);
    const [a, b] = world.stats.teams;
    expect(a!.commands).toMatchObject({ join: 1, dominate: 1, applyPreset: 1 });
    expect(a!.presets).toEqual({
      materiaCollector: 0,
      cristalCollector: 1,
      roadBuilder: 0,
    });
    expect(a!.dominatedSeconds).toBe(10);
    expect(b!.commands).toMatchObject({ join: 1, dominate: 0 });
  });
});

describe("sampleMetrics", () => {
  test("reads stock, cargo in transit, creeps by DNA and roads", () => {
    const world = textWorld(LANE, params);
    world.teams[1]!.stock = { materia: 7, cristal: 3 };
    creepOf(world, 1, "square").cargo = { materia: 4, cristal: 2 };
    world.map.road[5] = 1;
    world.map.road[6] = 1;
    world.teams[1]!.production = { dna: "circle", remainingSeconds: 9 };
    const sample = sampleMetrics(world);
    expect(sample.tick).toBe(0);
    expect(sample.roadCells).toBe(2);
    expect(sample.teams[1]).toMatchObject({
      team: 1,
      stock: { materia: 7, cristal: 3 },
      inTransit: { materia: 4, cristal: 2 },
      creeps: { square: 2, triangle: 2, circle: 2 },
      producing: "circle",
      capacityUpgrade: false,
    });
    expect(sample.deposits).toEqual([
      {
        deposit: world.deposits[0]!.id,
        kind: "materia",
        amount: 500,
        emptiedAtTick: null,
        contestedSeconds: 0,
      },
    ]);
  });

  test("is pure and does not alias the state", () => {
    const world = createWorld(7, params);
    run(world, 600);
    const before = serialize(world);
    const sample = sampleMetrics(world);
    sample.teams[0]!.delivered.materia += 1000;
    sample.teams[0]!.stock.materia += 1000;
    sample.teams[0]!.activitySeconds.idle += 1000;
    expect(serialize(world)).toBe(before);
    expect(sampleMetrics(world)).toEqual(sampleMetrics(world));
  });
});
