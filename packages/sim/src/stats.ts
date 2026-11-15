// Stats accumulators and metric samples (spec section 7, plan section 9).
// Events are counted where they happen (a delivery, a finished trip, a road
// segment, a deposit running dry, an accepted command); per-tick totals
// (creep activity, idle core, domination, contested deposits, the first sight
// of an enemy core) are added at stage 8. sampleMetrics reads them, with no side
// effects. Everything is a cumulative integer or the tick something first
// happened: rates and averages are left to the reader (the CLI).

import { COMMAND_TYPES, type CommandType } from "./commands.ts";
import { DNAS, type Dna, type Resource } from "./params.ts";
import { PRESETS, type PresetId } from "./presets.ts";
import type { Creep, Deposit, Stock, Team, WorldState } from "./world.ts";

/**
 * What a creep did in a tick (set at stage 3): gathering, moving with cargo,
 * moving empty, advancing a road job, in an encounter's dialogue or fight
 * (M2 encontro), running from one, or nothing.
 */
export const ACTIVITIES = [
  "gathering",
  "carrying",
  "walkingEmpty",
  "building",
  "talking",
  "fighting",
  "fleeing",
  "idle",
] as const;
export type Activity = (typeof ACTIVITIES)[number];

/**
 * A trip runs from the first tick a creep moves away from rest to the
 * delivery of a cargo at its core. Arriving at the core empty drops it.
 */
export type Trip = { startTick: number; cells: number };

export type TeamStats = {
  team: number;
  /** Units delivered at the core since tick 0. */
  delivered: Stock;
  /** Tick of the first delivery of each resource, or null (fog spec §7). */
  firstDeliveryTick: Record<Resource, number | null>;
  /** First tick the team had seen another team's core, or null. */
  enemyCoreSeenTick: number | null;
  /** Creep-seconds per activity. */
  activitySeconds: Record<Activity, number>;
  /** Seconds the core spent with nothing in production. */
  coreIdleSeconds: number;
  /** Finished trips, with their total duration and cells walked. */
  trips: number;
  tripSeconds: number;
  tripCells: number;
  /** Road segments finished on jobs this team paid for. */
  roadSegments: number;
  /** Creep-seconds spent dominated by a player. */
  dominatedSeconds: number;
  /** Accepted commands from this team's players, by type. */
  commands: Record<CommandType, number>;
  /** applyPreset commands accepted, by preset. */
  presets: Record<PresetId, number>;
};

export type DepositStats = {
  deposit: number;
  /** First tick the deposit reached 0, or null. */
  emptiedAtTick: number | null;
  /** Seconds in which creeps of both teams had a gather order on it. */
  contestedSeconds: number;
};

export type Stats = { teams: TeamStats[]; deposits: DepositStats[] };

const countBy = <K extends string>(keys: readonly K[]): Record<K, number> =>
  Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;

export function createStats(teams: Team[], deposits: Deposit[]): Stats {
  return {
    teams: teams.map((team) => ({
      team: team.id,
      delivered: { materia: 0, cristal: 0 },
      firstDeliveryTick: { materia: null, cristal: null },
      enemyCoreSeenTick: null,
      activitySeconds: countBy(ACTIVITIES),
      coreIdleSeconds: 0,
      trips: 0,
      tripSeconds: 0,
      tripCells: 0,
      roadSegments: 0,
      dominatedSeconds: 0,
      commands: countBy(COMMAND_TYPES),
      presets: countBy(PRESETS),
    })),
    deposits: deposits.map((d) => ({
      deposit: d.id,
      emptiedAtTick: null,
      contestedSeconds: 0,
    })),
  };
}

/** Counts a delivery and closes the creep's trip, before the cargo leaves. */
export function recordDelivery(state: WorldState, creep: Creep): void {
  const stats = state.stats.teams[creep.team]!;
  const { cargo, trip } = creep;
  creep.trip = null;
  if (cargo.materia + cargo.cristal === 0) return;
  stats.delivered.materia += cargo.materia;
  stats.delivered.cristal += cargo.cristal;
  const first = stats.firstDeliveryTick;
  if (cargo.materia > 0 && first.materia === null) first.materia = state.tick;
  if (cargo.cristal > 0 && first.cristal === null) first.cristal = state.tick;
  if (trip === null) return;
  stats.trips += 1;
  stats.tripSeconds +=
    (state.tick + 1 - trip.startTick) * state.params.world.tickSeconds;
  stats.tripCells += trip.cells;
}

/** Notes the first tick a deposit runs dry. */
export function recordDepositAmount(state: WorldState, deposit: Deposit): void {
  if (deposit.amount !== 0) return;
  const stats = state.stats.deposits.find((d) => d.deposit === deposit.id);
  if (stats !== undefined && stats.emptiedAtTick === null) {
    stats.emptiedAtTick = state.tick;
  }
}

export function recordCommand(
  state: WorldState,
  team: number,
  type: CommandType,
  preset: PresetId | null,
): void {
  const stats = state.stats.teams[team]!;
  stats.commands[type] += 1;
  if (preset !== null) stats.presets[preset] += 1;
}

/** Stage 8: per-tick accumulators. */
export function accumulateStats(state: WorldState): void {
  const seconds = state.params.world.tickSeconds;
  const { teams, deposits } = state.stats;
  for (const team of state.teams) {
    const stats = teams[team.id]!;
    if (team.production === null) stats.coreIdleSeconds += seconds;
    // Vision runs before (stage 7): a core seen this tick is remembered.
    if (stats.enemyCoreSeenTick === null) {
      if (state.memory[team.id]!.cores.length > 0) {
        stats.enemyCoreSeenTick = state.tick;
      }
    }
  }
  // Bit per team with a gather order on each deposit (deposits by id).
  const gatherers = deposits.map(() => 0);
  for (const creep of state.creeps) {
    const stats = teams[creep.team]!;
    stats.activitySeconds[creep.activity] += seconds;
    if (creep.dominatedBy !== null) stats.dominatedSeconds += seconds;
    if (creep.order.type === "gather") {
      const at = indexById(state.deposits, creep.order.depositId);
      if (at >= 0) gatherers[at]! |= 1 << creep.team;
    }
  }
  const everyTeam = (1 << state.teams.length) - 1;
  gatherers.forEach((mask, i) => {
    if (mask === everyTeam) deposits[i]!.contestedSeconds += seconds;
  });
}

/** Binary search in an array ordered by id. */
function indexById(items: readonly { id: number }[], id: number): number {
  let lo = 0;
  let hi = items.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const at = items[mid]!.id;
    if (at === id) return mid;
    if (at < id) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

export type TeamSample = Omit<TeamStats, "team"> & {
  team: number;
  stock: Stock;
  /** Cargo carried by the team's creeps. */
  inTransit: Stock;
  creeps: Record<Dna, number>;
  /** DNA in production, or null. */
  producing: Dna | null;
  capacityUpgrade: boolean;
  /** Cells the team has ever seen. */
  exploredCells: number;
  /** The team's creeps with an explore order. */
  exploring: number;
};

export type DepositSample = DepositStats & {
  kind: Deposit["kind"];
  amount: number;
};

export type MetricsSample = {
  tick: number;
  /** Cells with a road, both teams' (roads are neutral). */
  roadCells: number;
  teams: TeamSample[];
  deposits: DepositSample[];
};

/** A snapshot of the metrics (spec section 7), from state and stats. Pure. */
export function sampleMetrics(state: WorldState): MetricsSample {
  let roadCells = 0;
  for (const cell of state.map.road) roadCells += cell;
  const teams = state.teams.map((team): TeamSample => {
    const stats = state.stats.teams[team.id]!;
    const inTransit = { materia: 0, cristal: 0 };
    const creeps = countBy(DNAS);
    let exploring = 0;
    for (const creep of state.creeps) {
      if (creep.team !== team.id) continue;
      inTransit.materia += creep.cargo.materia;
      inTransit.cristal += creep.cargo.cristal;
      creeps[creep.dna] += 1;
      if (creep.order.type === "explore") exploring += 1;
    }
    let exploredCells = 0;
    for (const cell of state.memory[team.id]!.explored) exploredCells += cell;
    return {
      ...structuredCopy(stats),
      stock: { ...team.stock },
      inTransit,
      creeps,
      producing: team.production?.dna ?? null,
      capacityUpgrade: team.upgrades.capacity,
      exploredCells,
      exploring,
    };
  });
  const deposits = state.deposits.map((deposit, i): DepositSample => ({
    ...state.stats.deposits[i]!,
    kind: deposit.kind,
    amount: deposit.amount,
  }));
  return { tick: state.tick, roadCells, teams, deposits };
}

/** A deep copy of plain JSON data, so a sample never aliases the state. */
function structuredCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
