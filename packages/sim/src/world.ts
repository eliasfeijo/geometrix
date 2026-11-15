// World state (plan section 3) and world creation. Arrays are ordered by id;
// ids come from one increasing counter and are never reused.

import type { Rule } from "./autopilot.ts";
import type { Player } from "./domination.ts";
import type { UpgradeId } from "./economy.ts";
import { collectorRules } from "./presets.ts";
import { generateMap, type Cell, type GameMap } from "./map.ts";
import { DNAS, type Dna, type Params, type Resource } from "./params.ts";
import type { Order } from "./orders.ts";
import type { PathCache } from "./pathfinding.ts";
import type { RngState } from "./rng.ts";
import { createStats, type Activity, type Stats, type Trip } from "./stats.ts";
import { createMemory, updateVision, type TeamMemory } from "./vision.ts";
import { nameAt } from "./names.ts";

/**
 * Bump when a rule or state change makes old snapshots or replays invalid
 * (ADR-0004): the server persists worlds since F6 and refuses to recover one
 * of another version. 2: gather keeps its deposit and waits for regeneration.
 * 3: fog of war, vision and team memory (M1.5 fog). 4: the explore target
 * ties go to the most cells never seen in sight (fog F5 checkpoint). 5: gather
 * picks the deposit by travel time and waits at a dry one only when quicker
 * (fog F6, E1), and each resource has its own gather pace (E2). 6: creeps
 * have a name from the birth counter, HP that regenerates, and can die; step
 * returns events (M2 encontro F1). 7: encounters, fights, flight, spoils
 * and the encounter vocabulary (M2 encontro F2).
 */
export const SIM_VERSION = 7;

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
  /** Given at birth from state.births (spec D1, plan P5); never changes. */
  name: string;
  /** Hit points in thousandths (plan P1): 300 HP is 300_000. */
  hp: number;
  /** Id of the Encounter the creep is in, or null (plan P2). */
  engagement: number | null;
  /**
   * After paying an extortion (spec D9): immune to approaches of `team` until
   * `untilTick`, entering its own core zone, or approaching someone itself.
   */
  safeConduct: SafeConduct | null;
  /** Aggressors that cannot extort this creep again yet (D9), by creep id. */
  extortBlocks: ExtortBlock[];
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
  /** What it did in the last tick (stats). */
  activity: Activity;
  /** The trip under way (stats), or null at rest. */
  trip: Trip | null;
} & Cell;

export type SafeConduct = { team: number; untilTick: number };
export type ExtortBlock = { aggressor: number; untilTick: number };

/** A reply of the player dominating a creep in an encounter (command react). */
export type Reply = "pay" | "refuse" | "fight" | "flee";

/**
 * An encounter between two creeps (M2 encontro plan section 3, P2): a
 * dialogue, then maybe a fight. Its cell is the victim's when it opened.
 */
export type Encounter = {
  id: number;
  aggressor: number;
  victim: number;
  intent: "attack" | "extort";
  stage: "dialogue" | "fight";
  /** What the aggressor demands (D8), set when an extortion opens. */
  demand: Stock | null;
  /** When the dominated victim's window ends (D6); null for a free one. */
  deadlineTick: number | null;
  /** The victim's player's answer, applied at the encounters stage. */
  reply: Reply | null;
  /** The aggressor's player asking to flee the fight (the victim's is reply). */
  aggressorReply: "flee" | null;
  /** Tick of the next round of the fight; null in the dialogue. */
  nextRoundTick: number | null;
  rounds: number;
} & Cell;

/** A pile of resources on a cell that any creep can pick up (spec D11). */
export type Spoil = { id: number; cargo: Stock } & Cell;

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
  teams: Team[];
  /** Players who joined, by id (system command join). */
  players: Player[];
  creeps: Creep[];
  deposits: Deposit[];
  /** Segments under construction, by id. */
  roadJobs: RoadJob[];
  /** Open encounters, by id (plan P2). */
  encounters: Encounter[];
  /** Spoils on the map, by id; one per cell at most (D11). */
  spoils: Spoil[];
  /** What each team has seen and remembers, by team id (fog plan N1). */
  memory: TeamMemory[];
  nextId: number;
  /** Creeps born so far, the initial ones included: the next name (plan P5). */
  births: number;
  /** Accumulators behind the metrics (spec section 7). */
  stats: Stats;
};

export function createWorld(seed: number, params: Params): WorldState {
  const { layout, rng, mapSeed } = generateMap(seed, params);
  let nextId = 1;
  let births = 0;

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
        creeps.push(newCreep(nextId++, births++, team, dna, params));
      }
    }
  }

  const state: WorldState = {
    simVersion: SIM_VERSION,
    seed,
    mapSeed,
    params,
    tick: 0,
    rng,
    map: layout.map,
    teams,
    players: [],
    creeps,
    deposits,
    roadJobs: [],
    encounters: [],
    spoils: [],
    memory: createMemory(teams, layout.map),
    nextId,
    births,
    stats: createStats(teams, deposits),
  };
  // The vision of tick 0 (fog plan N10).
  updateVision(state);
  return state;
}

/**
 * A creep standing stopped and empty on its team's core, with full HP and the
 * materia collector rules (F4 decision, spec section 5). `birth` is its rank
 * in the world's births, which names it.
 */
export function newCreep(
  id: number,
  birth: number,
  team: Team,
  dna: Dna,
  params: Params,
): Creep {
  return {
    id,
    team: team.id,
    dna,
    name: nameAt(birth),
    hp: maxHp(params, dna),
    engagement: null,
    safeConduct: null,
    extortBlocks: [],
    ...team.core,
    cargo: { materia: 0, cristal: 0 },
    order: { type: "stop" },
    movePoints: 0,
    path: null,
    rules: collectorRules("materia"),
    dominatedBy: null,
    activity: "idle",
    trip: null,
  };
}

/** A creep's full HP, in thousandths (plan P1). */
export function maxHp(params: Params, dna: Dna): number {
  return params.hp.dna[dna].max * 1000;
}

/**
 * Spawns a creep of `dna` on the team's core (production), with the next id
 * and the next name. Returns it, already in state.creeps.
 */
export function spawnCreep(state: WorldState, team: Team, dna: Dna): Creep {
  const creep = newCreep(
    state.nextId++,
    state.births++,
    team,
    dna,
    state.params,
  );
  state.creeps.push(creep);
  return creep;
}
