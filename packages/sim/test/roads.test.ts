import { describe, expect, test } from "vitest";
import type { Cell } from "../src/map.ts";
import { buildRoadOrder, canBuildRoad, nextSegment } from "../src/roads.ts";
import { step } from "../src/step.ts";
import { createWorld, type WorldState } from "../src/world.ts";
import {
  creepOf,
  loadTestParams,
  paramsWith,
  run,
  textWorld,
} from "./helpers.ts";

const params = loadTestParams();

/** The map rows with `r` where a road is built (cores and deposits as `.`). */
function roads(world: WorldState): string[] {
  const { width, height, road } = world.map;
  const rows: string[] = [];
  for (let y = 0; y < height; y++) {
    rows.push(
      road
        .slice(y * width, (y + 1) * width)
        .map((r) => (r === 1 ? "r" : "."))
        .join(""),
    );
  }
  return rows;
}

function funded(rows: string[], materia = 100): WorldState {
  const world = textWorld(rows);
  world.teams[0]!.stock.materia = materia;
  return world;
}

const STRIP = ["A........B"];

describe("buildRoad", () => {
  test("builds segment by segment from the core: 5 materia and 2 minutes each", () => {
    const world = funded(STRIP);
    const creep = creepOf(world, 0, "square");
    creep.order = buildRoadOrder({ x: 3, y: 0 });
    // 30 ticks to walk into the segment, 120 to build it.
    run(world, 30);
    expect(creep.x).toBe(1);
    expect(world.roadJobs).toEqual([]);
    run(world, 1);
    expect(world.teams[0]!.stock.materia).toBe(95);
    expect(world.roadJobs).toEqual([
      { id: world.nextId - 1, team: 0, x: 1, y: 0, remainingSeconds: 119 },
    ]);
    run(world, 119);
    expect(roads(world)).toEqual([".r........"]);
    expect(world.memory[0]!.roadRevision).toBe(1);
    expect(world.roadJobs).toEqual([]);
    run(world, 300);
    expect(roads(world)).toEqual([".rrr......"]);
    expect(world.memory[0]!.roadRevision).toBe(3);
    expect(world.teams[0]!.stock.materia).toBe(85);
    expect(creep).toMatchObject({ x: 3, order: { type: "stop" } });
  });

  test("starts from the closest connected segment, along existing roads", () => {
    const world = funded(["Arrrr..", ".......", "......B"]);
    const creep = creepOf(world, 0, "circle");
    creep.order = buildRoadOrder({ x: 4, y: 2 });
    run(world, 2000);
    expect(roads(world)).toEqual([".rrrr..", "....r..", "....r.."]);
    expect(world.teams[0]!.stock.materia).toBe(90);
  });

  test("stops at a crossing: roads cannot be built on it", () => {
    const world = funded(["A....", "~~=~~", "....B"]);
    const creep = creepOf(world, 0, "circle");
    creep.order = buildRoadOrder({ x: 0, y: 2 });
    run(world, 2000);
    expect(roads(world)).toEqual([".rr..", ".....", "....."]);
    expect(creep).toMatchObject({ x: 2, y: 0, order: { type: "stop" } });
  });

  test("without materia for the next segment the order stops", () => {
    const world = funded(STRIP, 7);
    const creep = creepOf(world, 0, "circle");
    creep.order = buildRoadOrder({ x: 3, y: 0 });
    run(world, 1000);
    expect(roads(world)).toEqual([".r........"]);
    expect(world.teams[0]!.stock.materia).toBe(2);
    expect(world.roadJobs).toEqual([]);
    expect(creep).toMatchObject({ x: 2, order: { type: "stop" } });
  });

  test("a job left behind pauses and the next builder finishes it unpaid", () => {
    const world = funded(STRIP);
    const [first, second] = world.creeps.filter(
      (c) => c.team === 0 && c.dna === "circle",
    );
    first!.order = buildRoadOrder({ x: 1, y: 0 });
    run(world, 12 + 50);
    first!.order = { type: "moveTo", x: 0, y: 0 };
    run(world, 200);
    expect(world.roadJobs).toMatchObject([{ x: 1, remainingSeconds: 70 }]);
    second!.order = buildRoadOrder({ x: 1, y: 0 });
    run(world, 12 + 69);
    expect(roads(world)).toEqual([".........."]);
    run(world, 1);
    expect(roads(world)).toEqual([".r........"]);
    expect(world.teams[0]!.stock.materia).toBe(95);
  });

  test("a second builder on the same job does not speed it up", () => {
    const world = funded(STRIP);
    const [first, second] = world.creeps.filter(
      (c) => c.team === 0 && c.dna === "circle",
    );
    for (const creep of [first!, second!]) {
      Object.assign(creep, { x: 1 });
      creep.order = buildRoadOrder({ x: 1, y: 0 });
    }
    run(world, 119);
    expect(world.roadJobs).toMatchObject([{ remainingSeconds: 1 }]);
    run(world, 1);
    expect(roads(world)).toEqual([".r........"]);
    expect(world.teams[0]!.stock.materia).toBe(95);
    expect([first!.order, second!.order]).toEqual([
      { type: "stop" },
      { type: "stop" },
    ]);
  });

  test.each<[string, string[], Cell]>([
    ["a crossing", ["A.=.B"], { x: 2, y: 0 }],
    ["the river", ["A.~.B"], { x: 2, y: 0 }],
    ["a rock", ["A.#.B"], { x: 2, y: 0 }],
    ["a core", ["A...B"], { x: 4, y: 0 }],
    ["a cell with a road", ["A.r.B"], { x: 2, y: 0 }],
  ])("a target on %s turns into stop", (_, rows, target) => {
    const world = funded(rows);
    const creep = creepOf(world, 0, "circle");
    creep.order = buildRoadOrder(target);
    run(world, 1);
    expect(creep.order).toEqual({ type: "stop" });
    expect(world.teams[0]!.stock.materia).toBe(100);
  });

  test("an unreachable target turns into stop", () => {
    const world = funded(["A.#.B"]);
    const creep = creepOf(world, 0, "circle");
    creep.order = buildRoadOrder({ x: 3, y: 0 });
    run(world, 1);
    expect(creep.order).toEqual({ type: "stop" });
  });

  test("roads are neutral: the other team moves fast on them", () => {
    const world = funded(["A....B"]);
    const enemy = creepOf(world, 1, "square");
    world.map.road = world.map.road.map(() => 1);
    enemy.order = { type: "moveTo", x: 0, y: 0 };
    run(world, 75);
    expect(enemy.x).toBe(0);
  });

  test("canBuildRoad accepts only jungle without a road, off the cores", () => {
    const world = textWorld(["A.r=~#B"]);
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => canBuildRoad(world, i))).toEqual([
      false,
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  test("the checks need only the map, the params and the cores", () => {
    // What a bot has from its team view (M1.5 plan R3), not the whole state.
    const world = textWorld(["A.r.......", "......#..B"]);
    const context = {
      map: { ...world.map, road: [...world.map.road] },
      params: world.params,
      teams: world.teams.map((t) => ({ core: { ...t.core } })),
    };
    const team = { id: 0, core: world.teams[0]!.core };
    expect(canBuildRoad(context, 1)).toBe(true);
    expect(canBuildRoad(context, 2)).toBe(false);
    expect(nextSegment(context, team, { x: 8, y: 0 })).toBe(
      nextSegment(world, world.teams[0]!, { x: 8, y: 0 }),
    );
    expect(nextSegment(context, team, { x: 8, y: 0 })).toBe(1);
  });

  test("follows road.cost and road.buildSeconds", () => {
    const custom = paramsWith((p) => {
      p.road.cost = { materia: 2, cristal: 1 };
      p.road.buildSeconds = 10;
    });
    const world = textWorld(STRIP, custom);
    world.teams[0]!.stock = { materia: 10, cristal: 10 };
    const creep = creepOf(world, 0, "circle");
    Object.assign(creep, { x: 1 });
    creep.order = buildRoadOrder({ x: 1, y: 0 });
    run(world, 10);
    expect(roads(world)).toEqual([".r........"]);
    expect(world.teams[0]!.stock).toEqual({ materia: 8, cristal: 9 });
  });
});

describe("on a generated map", () => {
  test("a road toward a deposit is one chain connected to the core", () => {
    const world = createWorld(42, params);
    for (const c of world.creeps) c.rules = [];
    const team = world.teams[0]!;
    team.stock.materia = 1000;
    const deposit = world.deposits.find((d) => d.kind === "materia")!;
    const creep = creepOf(world, 0, "circle");
    creep.order = buildRoadOrder(deposit);
    let ticks = 0;
    while (creep.order.type === "buildRoad" && ticks < 100_000) {
      step(world, []);
      ticks++;
    }
    const { width, road } = world.map;
    const built = road.flatMap((r, i) => (r === 1 ? [i] : []));
    expect(built).toContain(deposit.y * width + deposit.x);
    expect(team.stock.materia).toBe(1000 - 5 * built.length);
    // Every road cell is reachable from the core through road cells.
    const coreIndex = team.core.y * width + team.core.x;
    const seen = [coreIndex];
    for (let i = 0; i < seen.length; i++) {
      const c = seen[i]!;
      for (const n of [c - width, c - 1, c + 1, c + width]) {
        const sameRow = Math.abs((n % width) - (c % width)) <= 1;
        if (road[n] === 1 && sameRow && !seen.includes(n)) seen.push(n);
      }
    }
    expect(seen.slice(1).sort((a, b) => a - b)).toEqual(built);
  });
});
