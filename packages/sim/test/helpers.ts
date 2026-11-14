import { readFileSync } from "node:fs";
import { Terrain, type Cell, type GameMap } from "../src/map.ts";
import {
  parseParams,
  type Dna,
  type Params,
  type Resource,
} from "../src/params.ts";
import { createStats } from "../src/stats.ts";
import { step } from "../src/step.ts";
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
  return world;
}

/** The first creep of the team with that DNA. */
export function creepOf(world: WorldState, team: number, dna: Dna): Creep {
  const creep = world.creeps.find((c) => c.team === team && c.dna === dna);
  if (creep === undefined) throw new Error(`no ${dna} in team ${team}`);
  return creep;
}
