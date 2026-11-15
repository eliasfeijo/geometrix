// Autopilot rules, stage 2 of the tick pipeline (spec P-1/P-2; F4 details
// decided 2026-11-13). Each free creep takes as its order the action of the
// first rule whose condition holds and whose action is possible now. With no
// such rule it keeps its current order. Dominated creeps are skipped: only
// their player changes their order. Rules decide by what the creep's team
// knows (M1.5 fog spec A-1): deposits from its memory, cells from its known
// map.

import {
  canAfford,
  capacity,
  cargoTotal,
  regenerates,
  teamOf,
} from "./economy.ts";
import { isInMap, manhattan, type Cell } from "./map.ts";
import { cellModifier } from "./movement.ts";
import type { Order } from "./orders.ts";
import type { Resource } from "./params.ts";
import {
  exploreTarget,
  knownMap,
  knownRoadContext,
  knownRoadJob,
  memoryOf,
} from "./known.ts";
import { costWithin, nearestTargets } from "./pathfinding.ts";
import { canBuildRoad, nextSegment } from "./roads.ts";
import type { Creep, Deposit, WorldState } from "./world.ts";

export type Condition =
  | { type: "always" }
  | { type: "cargoFull" }
  | { type: "cargoEmpty" }
  /** A deposit of `resource` with amount > 0 within `radius` cells (Manhattan). */
  | { type: "resourceInRange"; resource: Resource; radius: number }
  /** The team stock of `resource` is below `amount`. */
  | { type: "stockBelow"; resource: Resource; amount: number }
  /**
   * The team knows no deposit of `resource` with some left or that
   * regenerates (fog plan section 6).
   */
  | { type: "resourceUnknown"; resource: Resource };

export type Action =
  /**
   * Gather `resource` at the nearest deposit that still has some, and stay
   * with it until full, waiting there if it runs dry and regenerates.
   */
  | { type: "gather"; resource: Resource }
  | { type: "deliver" }
  | ({ type: "buildRoad" } & Cell)
  | ({ type: "moveTo" } & Cell)
  | { type: "stop" }
  /**
   * Go toward the nearest cell never seen that no teammate is exploring
   * (fog spec D4, A-3); impossible when none can be reached.
   */
  | { type: "explore" };

export type Rule = { when: Condition; then: Action };

export function runAutopilot(state: WorldState): void {
  for (const creep of state.creeps) {
    if (creep.dominatedBy !== null) continue;
    for (const rule of creep.rules) {
      if (!holds(state, creep, rule.when)) continue;
      const order = orderFor(state, creep, rule.then);
      if (order === null) continue;
      creep.order = order;
      break;
    }
  }
}

/** The creep's team memory. */
const known = (state: WorldState, creep: Creep) => memoryOf(state, creep.team);

function isFull(state: WorldState, creep: Creep): boolean {
  return (
    cargoTotal(creep) >= capacity(creep, teamOf(state, creep), state.params)
  );
}

/**
 * The nearest deposit of `kind` among `deposits` (the team's memory) that is
 * not empty; ties go to the lower id.
 */
export function nearestDeposit(
  deposits: readonly Deposit[],
  from: Cell,
  kind: Resource,
): Deposit | null {
  let best: Deposit | null = null;
  let bestDistance = 0;
  for (const deposit of deposits) {
    if (deposit.kind !== kind || deposit.amount === 0) continue;
    const distance = manhattan(from, deposit);
    if (best === null || distance < bestDistance) {
      best = deposit;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * The deposit of `kind` with some left that the creep reaches first, by
 * travel time on the team's known map (fog spec §11, E1); ties go to the
 * lower id. null when the team knows none it can reach.
 */
function quickestDeposit(
  state: WorldState,
  creep: Creep,
  kind: Resource,
): Deposit | null {
  const deposits = known(state, creep).deposits.filter(
    (d) => d.kind === kind && d.amount > 0,
  );
  return reachFirst(state, creep, deposits, Number.MAX_SAFE_INTEGER);
}

/**
 * Which of `deposits` the creep reaches first within a path cost of
 * `maxCost`, ties to the lower id; null when none.
 */
function reachFirst(
  state: WorldState,
  creep: Creep,
  deposits: readonly Deposit[],
  maxCost: number,
): Deposit | null {
  if (deposits.length === 0) return null;
  const { width } = state.map;
  const byCell = new Map<number, Deposit>();
  for (const d of deposits) {
    const cell = d.y * width + d.x;
    const other = byCell.get(cell);
    if (other === undefined || d.id < other.id) byCell.set(cell, d);
  }
  const reached = nearestTargets(
    knownMap(state, creep.team),
    creep,
    new Set(byCell.keys()),
    state.params,
    maxCost,
  );
  if (reached === null) return null;
  let best: Deposit | null = null;
  for (const cell of reached.cells) {
    const d = byCell.get(cell)!;
    if (best === null || d.id < best.id) best = d;
  }
  return best;
}

/**
 * The deposit of `kind` the creep keeps gathering at, while the team
 * remembers it with some left or it regenerates (owner decision, 2026-11-14):
 * no switching on the way. At an empty materia deposit it waits only when
 * that is quicker than walking to the nearest known one with enough for its
 * free cargo (owner, fog F6, E1); it weighs that once per regeneration
 * interval, in its middle second. The same second for every creep: a phase
 * spread by id would differ between the mirrored teams, whose creeps have
 * other ids.
 */
function committedDeposit(
  state: WorldState,
  creep: Creep,
  kind: Resource,
): Deposit | null {
  if (creep.order.type !== "gather") return null;
  const { depositId } = creep.order;
  const deposits = known(state, creep).deposits;
  const deposit = deposits.find((d) => d.id === depositId);
  if (deposit === undefined || deposit.kind !== kind) return null;
  if (deposit.amount > 0) return deposit;
  if (!regenerates(deposit, state.params)) return null;
  if (creep.x !== deposit.x || creep.y !== deposit.y) return deposit;
  const { regen } = state.params.deposits.materia;
  const elapsed = state.tick * state.params.world.tickSeconds;
  if (elapsed % regen.everySeconds !== Math.floor(regen.everySeconds / 2)) {
    return deposit;
  }
  const free = freeCargo(state, creep);
  // The team's creeps of lower id gathering here take the regeneration first.
  let need = free;
  for (const other of state.creeps) {
    if (
      other.id < creep.id &&
      other.team === creep.team &&
      other.order.type === "gather" &&
      other.order.depositId === deposit.id &&
      other.x === deposit.x &&
      other.y === deposit.y
    ) {
      need += freeCargo(state, other);
    }
  }
  const regens = Math.floor((need + regen.amount - 1) / regen.amount);
  const wait = regens * regen.everySeconds;
  const { cellsPerMinute } = state.params.dna[creep.dna];
  const elsewhere = reachFirst(
    state,
    creep,
    deposits.filter(
      (d) => d.kind === kind && d.id !== deposit.id && d.amount >= free,
    ),
    costWithin(wait, cellsPerMinute) - 1,
  );
  return elsewhere ?? deposit;
}

function freeCargo(state: WorldState, creep: Creep): number {
  return (
    capacity(creep, teamOf(state, creep), state.params) - cargoTotal(creep)
  );
}

function holds(state: WorldState, creep: Creep, condition: Condition): boolean {
  switch (condition.type) {
    case "always":
      return true;
    case "cargoFull":
      return isFull(state, creep);
    case "cargoEmpty":
      return cargoTotal(creep) === 0;
    case "resourceInRange": {
      const deposits = known(state, creep).deposits;
      const deposit = nearestDeposit(deposits, creep, condition.resource);
      return deposit !== null && manhattan(creep, deposit) <= condition.radius;
    }
    case "stockBelow":
      return teamOf(state, creep).stock[condition.resource] < condition.amount;
    case "resourceUnknown":
      return !known(state, creep).deposits.some(
        (d) =>
          d.kind === condition.resource &&
          (d.amount > 0 || regenerates(d, state.params)),
      );
  }
}

/** The order that carries out `action` now, or null if it is impossible. */
function orderFor(
  state: WorldState,
  creep: Creep,
  action: Action,
): Order | null {
  switch (action.type) {
    case "gather": {
      if (isFull(state, creep)) return null;
      const deposit =
        committedDeposit(state, creep, action.resource) ??
        quickestDeposit(state, creep, action.resource);
      return deposit === null
        ? null
        : { type: "gather", depositId: deposit.id };
    }
    case "deliver":
    case "stop":
      return { type: action.type };
    case "moveTo": {
      if (!isInMap(state.map, action)) return null;
      // A cell never seen counts as jungle: the creep goes and finds out.
      const map = knownMap(state, creep.team);
      const index = action.y * map.width + action.x;
      if (cellModifier(map, index, state.params) === 0) return null;
      return { type: "moveTo", x: action.x, y: action.y };
    }
    case "buildRoad":
      return buildRoadFor(state, creep, action);
    case "explore":
      return exploreFor(state, creep);
  }
}

/**
 * Keeps exploring toward the current target while it is still never seen,
 * else toward a new one (fog plan section 6).
 */
function exploreFor(state: WorldState, creep: Creep): Order | null {
  const { order } = creep;
  if (
    order.type === "explore" &&
    known(state, creep).explored[order.y * state.map.width + order.x] === 0
  ) {
    return { type: "explore", x: order.x, y: order.y };
  }
  const target = exploreTarget(state, creep);
  return target === null ? null : { type: "explore", ...target };
}

/**
 * A buildRoad order toward `target` with its next segment chosen, or null when
 * no segment can be built now: the target cannot take a road (or has one), the
 * path is blocked, or the team cannot pay for a new segment. A segment already
 * paid for (a job on it) needs no stock.
 */
function buildRoadFor(
  state: WorldState,
  creep: Creep,
  target: Cell,
): Order | null {
  const { params } = state;
  if (!isInMap(state.map, target)) return null;
  const team = teamOf(state, creep);
  const known = knownRoadContext(state, team.id);
  const { map } = known;
  if (!canBuildRoad(known, target.y * map.width + target.x)) return null;
  const affordable = canAfford(team.stock, params.road.cost);
  const { order } = creep;
  let segment: number;
  if (
    order.type === "buildRoad" &&
    order.x === target.x &&
    order.y === target.y &&
    order.segment >= 0 &&
    canBuildRoad(known, order.segment)
  ) {
    segment = order.segment;
  } else {
    // Skip the path search when nothing could pay for or resume a segment.
    const jobs =
      memoryOf(state, team.id).roadJobs.length > 0 ||
      state.roadJobs.some((j) => j.team === team.id);
    if (!affordable && !jobs) return null;
    segment = nextSegment(known, team, target) ?? -1;
    if (segment < 0) return null;
  }
  const cell = { x: segment % map.width, y: Math.floor(segment / map.width) };
  if (!affordable && knownRoadJob(state, team.id, cell) === undefined) {
    return null;
  }
  return { type: "buildRoad", x: target.x, y: target.y, segment };
}
