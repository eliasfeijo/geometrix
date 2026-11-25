import { readFileSync } from "node:fs";
import type { SimEvent } from "../src/events.ts";
import { Terrain, type Cell, type GameMap } from "../src/map.ts";
import {
  parseParams,
  type Dna,
  type Params,
  type Resource,
} from "../src/params.ts";
import { createStats } from "../src/stats.ts";
import { step } from "../src/step.ts";
import { createMemory, updateVision } from "../src/vision.ts";
import {
  createWorld,
  type Creep,
  type Deposit,
  type WorldState,
} from "../src/world.ts";

const DEFAULT_PARAMS_URL = new URL(
  "../../../params/default.json",
  import.meta.url,
);
const TEST_PARAMS_URL = new URL("./params.json", import.meta.url);

/** params/default.json as parsed JSON, before validation. */
export function readDefaultParamsJson(): unknown {
  return JSON.parse(readFileSync(DEFAULT_PARAMS_URL, "utf8"));
}

/**
 * test/params.json as parsed JSON: the fixed params the tests run on. They are
 * the F5 values and do not follow balancing, so a new params/default.json
 * does not break tests of mechanics that spell out costs and distances.
 */
export function readTestParamsJson(): unknown {
  return JSON.parse(readFileSync(TEST_PARAMS_URL, "utf8"));
}

/** test/params.json, validated. */
export function loadTestParams(): Params {
  return parseParams(readTestParamsJson());
}

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };

/** test/params.json changed by `edit`, then validated. */
export function paramsWith(edit: (params: Mutable<Params>) => void): Params {
  const params = readTestParamsJson() as Mutable<Params>;
  edit(params);
  return parseParams(params);
}

/** `.` jungle · `r` road on jungle · `=` crossing · `~` river · `#` rock */
export function parseMap(rows: string[]): GameMap {
  const terrainOf: Record<string, number> = {
    ".": Terrain.jungle,
    r: Terrain.jungle,
    "=": Terrain.crossing,
    "~": Terrain.river,
    "#": Terrain.rock,
  };
  const cells = rows.join("").split("");
  return {
    width: rows[0]!.length,
    height: rows.length,
    terrain: cells.map((c) => terrainOf[c]!) as GameMap["terrain"],
    road: cells.map((c) => (c === "r" ? 1 : 0)),
  };
}

/** Steps the world `ticks` times with no commands. */
export function run(world: WorldState, ticks: number): void {
  for (let i = 0; i < ticks; i++) step(world, []);
}

/**
 * The seed-42 world moved onto a map drawn in text: parseMap symbols plus
 * `A` / `B` the core of team 0 / 1, `m` a materia deposit and `c` a cristal
 * deposit, all on jungle. Deposits are full and get fresh ids in reading
 * order; every creep starts stopped on its team's core, with no rules, so
 * tests drive orders and rules explicitly.
 */
export function textWorld(
  rows: string[],
  params: Params = loadTestParams(),
): WorldState {
  const world = createWorld(42, params);
  world.map = parseMap(rows.map((row) => row.replace(/[ABmc]/g, ".")));
  const cells = rows.join("").split("");
  const cellAt = (i: number): Cell => ({
    x: i % world.map.width,
    y: Math.floor(i / world.map.width),
  });
  const kinds: Record<string, Resource> = { m: "materia", c: "cristal" };
  const deposits: Deposit[] = [];
  cells.forEach((symbol, i) => {
    const kind = kinds[symbol];
    if (kind !== undefined) {
      deposits.push({
        id: world.nextId++,
        kind,
        amount: params.deposits[kind].amount,
        ...cellAt(i),
      });
    }
  });
  world.deposits = deposits;
  world.stats = createStats(world.teams, deposits);
  ["A", "B"].forEach((symbol, team) => {
    const i = cells.indexOf(symbol);
    if (i < 0) throw new Error(`textWorld: no core ${symbol} drawn`);
    world.teams[team]!.core = cellAt(i);
  });
  for (const creep of world.creeps) {
    Object.assign(creep, world.teams[creep.team]!.core);
    creep.rules = [];
  }
  world.memory = createMemory(world.teams, world.map);
  updateVision(world);
  return world;
}

/** A creep a test places: its team, its DNA and its cell. */
export type Placed = [team: number, dna: Dna, x: number, y: number];

/**
 * A textWorld with some of its creeps placed: each entry moves the first
 * creep of that team and DNA not placed yet onto its cell, in order; the
 * others stay on their cores. The vision is updated after.
 */
export function placeWorld(
  rows: string[],
  placed: readonly Placed[],
  params: Params = loadTestParams(),
): { world: WorldState; creeps: Creep[] } {
  const world = textWorld(rows, params);
  const used = new Set<Creep>();
  const creeps = placed.map(([team, dna, x, y]) => {
    const creep = world.creeps.find(
      (c) => c.team === team && c.dna === dna && !used.has(c),
    );
    if (creep === undefined) throw new Error(`no ${dna} left in team ${team}`);
    used.add(creep);
    Object.assign(creep, { x, y });
    return creep;
  });
  updateVision(world);
  return { world, creeps };
}

/**
 * Steps the world with no commands until `done` holds after a tick (given
 * that tick's events), and returns how many ticks it took; fails after
 * `max`. For tests that wait on a moment instead of guessing its tick.
 */
export function runUntil(
  world: WorldState,
  done: (events: SimEvent[]) => boolean,
  max = 10_000,
): number {
  for (let i = 1; i <= max; i++) {
    if (done(step(world, []))) return i;
  }
  throw new Error(`runUntil: not done after ${max} ticks`);
}

/** The first creep of the team with that DNA. */
export function creepOf(world: WorldState, team: number, dna: Dna): Creep {
  const creep = world.creeps.find((c) => c.team === team && c.dna === dna);
  if (creep === undefined) throw new Error(`no ${dna} in team ${team}`);
  return creep;
}

/**
 * Every team remembers the whole world as it is now: terrain, roads, every
 * deposit and the other cores. For tests of decisions (the strategist) that
 * are not about fog. Sight itself is left as it is.
 */
export function revealWorld(world: WorldState): void {
  for (const memory of world.memory) {
    memory.explored.fill(1);
    memory.terrain = [...world.map.terrain];
    memory.road = [...world.map.road];
    memory.deposits = world.deposits.map((d) => ({ ...d }));
    memory.cores = world.teams
      .filter((t) => t.id !== memory.team)
      .map((t) => ({ team: t.id, ...t.core }));
  }
}
