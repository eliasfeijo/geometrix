// World state (plan section 3) and world creation. Arrays are ordered by id;
// ids come from one increasing counter and are never reused.

import { generateMap, type Cell, type GameMap } from "./map.ts";
import { DNAS, type Dna, type Params, type Resource } from "./params.ts";
import type { RngState } from "./rng.ts";

/**
 * Bump when a rule or state change makes old snapshots or replays invalid
 * (ADR-0004). Nothing is persisted before the server exists (F6), so until then
 * it stays at 1 and only the golden hash test is updated.
 */
export const SIM_VERSION = 1;

export type Stock = Record<Resource, number>;

export type Team = { id: number; core: Cell; stock: Stock };

export type Creep = {
  id: number;
  team: number;
  dna: Dna;
  /** What the creep carries. Any amount above 0 counts as loaded. */
  cargo: Stock;
} & Cell;

export type Deposit = { id: number; kind: Resource; amount: number } & Cell;

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
  teams: Team[];
  creeps: Creep[];
  deposits: Deposit[];
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
  }));

  const creeps: Creep[] = [];
  for (const team of teams) {
    for (const dna of DNAS) {
      for (let i = 0; i < params.population.initial[dna]; i++) {
        creeps.push({
          id: nextId++,
          team: team.id,
          dna,
          ...team.core,
          cargo: { materia: 0, cristal: 0 },
        });
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
    teams,
    creeps,
    deposits,
    nextId,
  };
}
