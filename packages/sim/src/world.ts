// World state (plan section 3) and world creation. Arrays are ordered by id;
// ids come from one increasing counter and are never reused.

import type { Rule } from "./autopilot.ts";
import type { UpgradeId } from "./economy.ts";
import { collectorRules } from "./presets.ts";
import { generateMap, type Cell, type GameMap } from "./map.ts";
import { DNAS, type Dna, type Params, type Resource } from "./params.ts";
import type { Order } from "./orders.ts";
import type { PathCache } from "./pathfinding.ts";
import type { RngState } from "./rng.ts";

/**
 * Bump when a rule or state change makes old snapshots or replays invalid
 * (ADR-0004). Nothing is persisted before the server exists (F6), so until then
 * it stays at 1 and only the golden hash test is updated.
 */
export const SIM_VERSION = 1;

export type Stock = Record<Resource, number>;

/** Team ids match their index in WorldState.teams. */
export type Team = {
  id: number;
  core: Cell;
  stock: Stock;
  /** Upgrades bought (spec I-3). */
  upgrades: Record<UpgradeId, boolean>;
  /** The creep the core is producing; one at a time, no queue. */
  production: Production | null;
  /**
   * DNA to produce again whenever the core is free ("repeat", plan P5). It
   * waits, armed, while the stock or the population cap does not allow it.
   */
  repeat: Dna | null;
};

export type Production = { dna: Dna; remainingSeconds: number };

export type Creep = {
  id: number;
  team: number;
  dna: Dna;
  /** What the creep carries. Any amount above 0 counts as loaded. */
  cargo: Stock;
  /** What the creep is doing now. */
  order: Order;
  /** Points gathered toward the next cell (CELL_COST enters it). */
  movePoints: number;
  /** Cached route; see pathTo. */
  path: PathCache | null;
  /** Autopilot rules, in priority order (spec P-1). */
  rules: Rule[];
  /** Id of the player dominating the creep, or null when it is free. */
  dominatedBy: number | null;
} & Cell;

export type Deposit = { id: number; kind: Resource; amount: number } & Cell;

/** A road segment under construction, already paid for by `team`. */
export type RoadJob = {
  id: number;
  team: number;
  /** Build time still missing; the segment is done at 0. */
  remainingSeconds: number;
} & Cell;

export type WorldState = {
  simVersion: number;
  /** Seed the world was created with. */
  seed: number;
  /** Seed that produced the map (seed, or seed + n after retries). */
  mapSeed: number;
  /** Part of the state, so a snapshot is self-contained and hashed with it. */
  params: Params;
  tick: number;
  rng: RngState;
  map: GameMap;
  /** Incremented when a road is completed: invalidates cached paths. */
  roadRevision: number;
  teams: Team[];
  creeps: Creep[];
  deposits: Deposit[];
  /** Segments under construction, by id. */
  roadJobs: RoadJob[];
  nextId: number;
};

export function createWorld(seed: number, params: Params): WorldState {
  const { layout, rng, mapSeed } = generateMap(seed, params);
  let nextId = 1;

  const deposits: Deposit[] = layout.deposits.map((site) => ({
    id: nextId++,
    kind: site.kind,
    x: site.x,
    y: site.y,
    amount: params.deposits[site.kind].amount,
  }));

  const teams: Team[] = layout.cores.map((core, id) => ({
    id,
    core: { x: core.x, y: core.y },
    stock: {
      materia: params.teams.initialStock.materia,
      cristal: params.teams.initialStock.cristal,
    },
    upgrades: { capacity: false },
    production: null,
    repeat: null,
  }));

  const creeps: Creep[] = [];
  for (const team of teams) {
    for (const dna of DNAS) {
      for (let i = 0; i < params.population.initial[dna]; i++) {
        creeps.push(newCreep(nextId++, team, dna));
      }
    }
  }

  return {
    simVersion: SIM_VERSION,
    seed,
    mapSeed,
    params,
    tick: 0,
    rng,
    map: layout.map,
    roadRevision: 0,
    teams,
    creeps,
    deposits,
    roadJobs: [],
    nextId,
  };
}

/**
 * A creep standing stopped and empty on its team's core, with the materia
 * collector rules (F4 decision, spec section 5).
 */
export function newCreep(id: number, team: Team, dna: Dna): Creep {
  return {
    id,
    team: team.id,
    dna,
    ...team.core,
    cargo: { materia: 0, cristal: 0 },
    order: { type: "stop" },
    movePoints: 0,
    path: null,
    rules: collectorRules("materia"),
    dominatedBy: null,
  };
}
