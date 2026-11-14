import { describe, expect, test } from "vitest";
import { completeRoadJob } from "../src/roads.ts";
import { restore, serialize } from "../src/serialize.ts";
import { step } from "../src/step.ts";
import { botCommands, botsFor } from "../src/strategist.ts";
import { createWorld, type RoadJob } from "../src/world.ts";
import {
  manhattan,
  mirrorCell,
  Terrain,
  type Cell,
  type GameMap,
} from "../src/map.ts";
import { computeSight, sightCells } from "../src/vision.ts";
import {
  creepOf,
  loadTestParams,
  parseMap,
  run,
  textWorld,
} from "./helpers.ts";

/** The map with `o` on every cell in sight that is not a rock, `@` the viewer. */
function picture(map: GameMap, from: Cell, cells: readonly number[]): string {
  const symbols = [".", "~", "=", "#"];
  const seen = new Set(cells);
  const rows: string[] = [];
  for (let y = 0; y < map.height; y++) {
    let row = "";
    for (let x = 0; x < map.width; x++) {
      const i = y * map.width + x;
      if (x === from.x && y === from.y) row += "@";
      else if (map.terrain[i] === Terrain.rock) row += seen.has(i) ? "#" : "%";
      else row += seen.has(i) ? "o" : symbols[map.terrain[i]!]!;
    }
    rows.push(row);
  }
  return `\n${rows.join("\n")}\n`;
}

describe("line of sight", () => {
  test("a rock hides what is behind it and is seen itself", () => {
    const map = parseMap(["...#....."]);
    const from = { x: 0, y: 0 };
    expect(picture(map, from, computeSight(map, from, 8, false))).toBe(
      "\n@oo#.....\n",
    );
  });

  test("river and crossings do not block", () => {
    const map = parseMap([".....", "~~=~~", ".....", "~~~~~", "....."]);
    const from = { x: 2, y: 0 };
    const cells = computeSight(map, from, 4, false);
    expect(cells).toContain(4 * 5 + 2);
    expect(cells).toHaveLength(
      map.terrain.filter(
        (_, i) => manhattan(from, { x: i % 5, y: Math.floor(i / 5) }) <= 4,
      ).length,
    );
  });

  test("the radius is Manhattan and the map edge cuts it", () => {
    const map = parseMap([".......", ".......", ".......", "......."]);
    const from = { x: 1, y: 1 };
    expect(picture(map, from, computeSight(map, from, 2, false)))
      .toMatchInlineSnapshot(`
        "
        ooo....
        o@oo...
        ooo....
        .o.....
        "
      `);
  });

  test("a wall of rocks casts a shadow", () => {
    const map = parseMap([
      "...........",
      "...........",
      "....###....",
      "...........",
      "...........",
      "...........",
    ]);
    const from = { x: 5, y: 5 };
    expect(picture(map, from, computeSight(map, from, 6, false)))
      .toMatchInlineSnapshot(`
        "
        ...........
        ...o...o...
        ..oo###oo..
        .ooooooooo.
        ooooooooooo
        ooooo@ooooo
        "
      `);
  });

  test("radius 0 sees only the viewer's own cell", () => {
    const map = parseMap(["...", "..."]);
    expect(computeSight(map, { x: 1, y: 1 }, 0, false)).toEqual([4]);
  });

  test("sightCells caches computeSight per cell, radius and side", () => {
    const map = createWorld(42, loadTestParams()).map;
    const from = { x: 20, y: 10 };
    const first = sightCells(map, from, 6, false);
    expect(first).toEqual(computeSight(map, from, 6, false));
    expect(sightCells(map, from, 6, false)).toBe(first);
    expect(sightCells(map, from, 6, true)).toEqual(
      computeSight(map, from, 6, true),
    );
    expect(sightCells(map, from, 4, false)).toEqual(
      computeSight(map, from, 4, false),
    );
  });

  test("on the generated map, team 1 sees the mirror of what team 0 sees", () => {
    const map = createWorld(42, loadTestParams()).map;
    const size = map.width * map.height;
    const mirrored = (cells: readonly number[]) =>
      cells.map((i) => size - 1 - i).sort((a, b) => a - b);
    // The same map without rocks: what each viewer would see unblocked.
    const open: GameMap = {
      ...map,
      terrain: map.terrain.map((t) =>
        t === Terrain.rock ? Terrain.jungle : t,
      ),
    };
    let shadowed = 0;
    for (let i = 0; i < size; i++) {
      const cell = { x: i % map.width, y: Math.floor(i / map.width) };
      const mirror = mirrorCell(cell, map);
      for (const radius of [3, 4, 6, 8]) {
        const top = computeSight(map, cell, radius, false);
        expect(mirrored(computeSight(map, mirror, radius, true))).toEqual(top);
        if (top.length < computeSight(open, cell, radius, false).length) {
          shadowed++;
        }
      }
    }
    // Rocks do hide cells on this map: the test is not vacuous.
    expect(shadowed).toBeGreaterThan(100);
  });
});

describe("team memory", () => {
  // 40 × 3. Core A sees x ≤ 8 on row 1; core B sees x ≥ 31. The deposit, the
  // rock and the middle are out of every core's sight.
  const rows = [
    "........................................",
    "A.........m.......#.................c..B",
    "........................................",
  ];
  const width = rows[0]!.length;
  const cellIndex = (x: number, y: number) => y * width + x;

  function setup() {
    const world = textWorld(rows);
    const scout = creepOf(world, 0, "circle");
    const memory = world.memory[0]!;
    const [materia, cristal] = world.deposits;
    return { world, scout, memory, materia: materia!, cristal: cristal! };
  }

  test("at tick 0 a team knows only what its core and creeps see", () => {
    const { world, memory } = setup();
    expect(memory.visible).toEqual(memory.explored);
    expect(memory.explored[cellIndex(8, 1)]).toBe(1);
    expect(memory.explored[cellIndex(9, 1)]).toBe(0);
    expect(memory.deposits).toEqual([]);
    expect(memory.cores).toEqual([]);
    expect(world.memory[1]!.explored[cellIndex(31, 1)]).toBe(1);
  });

  test("a deposit keeps the last amount seen once out of sight", () => {
    const { world, scout, memory, materia } = setup();
    Object.assign(scout, { x: 10, y: 1 });
    run(world, 1);
    expect(memory.deposits).toEqual([materia]);
    expect(memory.deposits[0]).not.toBe(materia);
    materia.amount -= 7;
    run(world, 1);
    expect(memory.deposits[0]!.amount).toBe(materia.amount);

    const seen = materia.amount;
    Object.assign(scout, world.teams[0]!.core);
    materia.amount -= 100;
    run(world, 1);
    expect(memory.visible[cellIndex(materia.x, materia.y)]).toBe(0);
    expect(memory.explored[cellIndex(materia.x, materia.y)]).toBe(1);
    expect(memory.deposits[0]!.amount).toBe(seen);
  });

  test("terrain is copied when first seen, and rocks bump the block revision", () => {
    const { world, scout, memory } = setup();
    const rock = cellIndex(18, 1);
    expect(memory.terrain[rock]).toBe(Terrain.jungle);
    Object.assign(scout, { x: 15, y: 1 });
    run(world, 1);
    expect(memory.terrain[rock]).toBe(Terrain.rock);
    expect(memory.blockRevision).toBe(1);
    // Seeing it again changes nothing.
    run(world, 1);
    expect(memory.blockRevision).toBe(1);
    // The rock hides the cells behind it on the row.
    expect(memory.explored[cellIndex(19, 1)]).toBe(0);
  });

  test("a road is known once seen, or at once when the team completes it", () => {
    const { world, scout, memory } = setup();
    const far = cellIndex(14, 1);
    world.map.road[far] = 1;
    run(world, 1);
    expect(memory.road[far]).toBe(0);
    Object.assign(scout, { x: 12, y: 1 });
    run(world, 1);
    expect(memory.road[far]).toBe(1);
    expect(memory.roadRevision).toBe(1);
    // Out of sight again, it stays known.
    Object.assign(scout, world.teams[0]!.core);
    run(world, 1);
    expect(memory.road[far]).toBe(1);

    const job: RoadJob = {
      id: world.nextId++,
      team: 0,
      x: 25,
      y: 1,
      remainingSeconds: 0,
    };
    world.roadJobs.push(job);
    completeRoadJob(world, job);
    expect(memory.road[cellIndex(25, 1)]).toBe(1);
    expect(memory.roadRevision).toBe(2);
    expect(world.memory[1]!.road[cellIndex(25, 1)]).toBe(0);
  });

  test("an enemy road completed in sight is known at once", () => {
    const { world, scout, memory } = setup();
    Object.assign(scout, { x: 12, y: 1 });
    run(world, 1);
    const job: RoadJob = {
      id: world.nextId++,
      team: 1,
      x: 14,
      y: 1,
      remainingSeconds: 0,
    };
    world.roadJobs.push(job);
    completeRoadJob(world, job);
    expect(memory.road[cellIndex(14, 1)]).toBe(1);
    expect(world.memory[1]!.road[cellIndex(14, 1)]).toBe(1);
    // Out of sight, only the team that paid knows it.
    const hidden: RoadJob = { ...job, id: world.nextId++, x: 25 };
    world.roadJobs.push(hidden);
    completeRoadJob(world, hidden);
    expect(memory.road[cellIndex(25, 1)]).toBe(0);
  });

  test("an enemy road job is remembered as seen and forgotten when seen gone", () => {
    const { world, scout, memory } = setup();
    const job: RoadJob = {
      id: world.nextId++,
      team: 1,
      x: 12,
      y: 1,
      remainingSeconds: 90,
    };
    world.roadJobs.push(job);
    run(world, 1);
    expect(memory.roadJobs).toEqual([]);
    Object.assign(scout, { x: 12, y: 0 });
    run(world, 1);
    expect(memory.roadJobs).toEqual([job]);
    expect(memory.roadJobs[0]).not.toBe(job);
    job.remainingSeconds = 60;
    run(world, 1);
    expect(memory.roadJobs[0]!.remainingSeconds).toBe(60);

    // Out of sight it stays as last seen, even after the job is gone.
    Object.assign(scout, world.teams[0]!.core);
    world.roadJobs.splice(world.roadJobs.indexOf(job), 1);
    run(world, 1);
    expect(memory.roadJobs).toHaveLength(1);
    expect(memory.roadJobs[0]!.remainingSeconds).toBe(60);
    // Seen again without the job, it is forgotten.
    Object.assign(scout, { x: 12, y: 0 });
    run(world, 1);
    expect(memory.roadJobs).toEqual([]);
  });

  test("the team's own road jobs are not copied into its memory", () => {
    const { world, memory } = setup();
    world.roadJobs.push({
      id: world.nextId++,
      team: 0,
      x: 2,
      y: 1,
      remainingSeconds: 90,
    });
    run(world, 1);
    expect(memory.roadJobs).toEqual([]);
  });

  test("the enemy core is remembered for good once seen", () => {
    const { world, scout, memory } = setup();
    Object.assign(scout, { x: 34, y: 1 });
    run(world, 1);
    expect(memory.cores).toEqual([{ team: 1, ...world.teams[1]!.core }]);
    Object.assign(scout, world.teams[0]!.core);
    run(world, 1);
    expect(memory.cores).toEqual([{ team: 1, ...world.teams[1]!.core }]);
    expect(world.memory[1]!.cores).toEqual([]);
  });

  test("deposits stay in id order as they are discovered", () => {
    const { world, scout, memory, materia, cristal } = setup();
    Object.assign(scout, { x: 36, y: 0 });
    run(world, 1);
    expect(memory.deposits.map((d) => d.id)).toEqual([cristal.id]);
    Object.assign(scout, { x: 10, y: 0 });
    run(world, 1);
    expect(memory.deposits.map((d) => d.id)).toEqual([materia.id, cristal.id]);
  });

  test("survives serialize and restore", () => {
    const { world, scout } = setup();
    Object.assign(scout, { x: 10, y: 1 });
    run(world, 3);
    const copy = restore(serialize(world));
    run(world, 5);
    run(copy, 5);
    expect(serialize(copy)).toBe(serialize(world));
  });
});

describe("updateVision over a bot world", () => {
  test("visible is the union of every viewer's sight, and a restore agrees", () => {
    const params = loadTestParams();
    const world = createWorld(42, params);
    const bots = botsFor(["balanced", "balanced"]);
    let checks = 0;
    while (world.tick < 2 * 3600) {
      step(world, botCommands(world, bots));
      if (world.tick % 300 !== 0) continue;
      for (const memory of world.memory) {
        const team = world.teams[memory.team]!;
        const rotated = memory.team === 1;
        const union = new Set(
          computeSight(world.map, team.core, params.vision.core, rotated),
        );
        for (const creep of world.creeps) {
          if (creep.team !== team.id) continue;
          const radius = params.vision.dna[creep.dna];
          for (const i of computeSight(world.map, creep, radius, rotated)) {
            union.add(i);
          }
        }
        const visible = memory.visible.flatMap((v, i) => (v === 1 ? [i] : []));
        expect(visible).toEqual([...union].sort((a, b) => a - b));
        expect(visible.every((i) => memory.explored[i] === 1)).toBe(true);
      }
      // A restored state rebuilds its trackers from scratch.
      const copy = restore(serialize(world));
      step(world, []);
      step(copy, []);
      expect(serialize(copy)).toBe(serialize(world));
      checks++;
    }
    expect(checks).toBe(24);
    expect(world.memory[0]!.deposits.length).toBeGreaterThan(0);
  });
});
