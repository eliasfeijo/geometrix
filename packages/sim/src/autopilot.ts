// Autopilot rules, stage 2 of the tick pipeline (spec P-1/P-2; F4 details
// decided 2026-11-13). Each free creep takes as its order the action of the
// first rule whose condition holds and whose action is possible now. With no
// such rule it keeps its current order. Dominated creeps are skipped: only
// their player changes their order.

import { canAfford, capacity, cargoTotal, teamOf } from "./economy.ts";
import { isInMap, manhattan, type Cell } from "./map.ts";
import { cellModifier } from "./movement.ts";
import type { Order } from "./orders.ts";
import type { Resource } from "./params.ts";
import { canBuildRoad, findRoadJob, nextSegment } from "./roads.ts";
import type { Creep, Deposit, WorldState } from "./world.ts";

export type Condition =
  | { type: "always" }
  | { type: "cargoFull" }
  | { type: "cargoEmpty" }
  /** A deposit of `resource` with amount > 0 within `radius` cells (Manhattan). */
  | { type: "resourceInRange"; resource: Resource; radius: number }
  /** The team stock of `resource` is below `amount`. */
  | { type: "stockBelow"; resource: Resource; amount: number };

export type Action =
  /** Gather `resource` at the nearest deposit that still has some. */
  | { type: "gather"; resource: Resource }
  | { type: "deliver" }
  | ({ type: "buildRoad" } & Cell)
  | ({ type: "moveTo" } & Cell)
  | { type: "stop" };

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

function isFull(state: WorldState, creep: Creep): boolean {
  return (
    cargoTotal(creep) >= capacity(creep, teamOf(state, creep), state.params)
  );
}

/** The nearest deposit of `kind` that is not empty; ties go to the lower id. */
export function nearestDeposit(
  state: WorldState,
  from: Cell,
  kind: Resource,
): Deposit | null {
  let best: Deposit | null = null;
  let bestDistance = 0;
  for (const deposit of state.deposits) {
    if (deposit.kind !== kind || deposit.amount === 0) continue;
    const distance = manhattan(from, deposit);
    if (best === null || distance < bestDistance) {
      best = deposit;
      bestDistance = distance;
    }
  }
  return best;
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
      const deposit = nearestDeposit(state, creep, condition.resource);
      return deposit !== null && manhattan(creep, deposit) <= condition.radius;
    }
    case "stockBelow":
      return teamOf(state, creep).stock[condition.resource] < condition.amount;
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
      const deposit = nearestDeposit(state, creep, action.resource);
      return deposit === null
        ? null
        : { type: "gather", depositId: deposit.id };
    }
    case "deliver":
    case "stop":
      return { type: action.type };
    case "moveTo": {
      if (!isInMap(state.map, action)) return null;
      const index = action.y * state.map.width + action.x;
      if (cellModifier(state.map, index, state.params) === 0) return null;
      return { type: "moveTo", x: action.x, y: action.y };
    }
    case "buildRoad":
      return buildRoadFor(state, creep, action);
  }
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
  const { map, params } = state;
  if (!isInMap(state.map, target)) return null;
  if (!canBuildRoad(state, target.y * map.width + target.x)) return null;
  const team = teamOf(state, creep);
  const affordable = canAfford(team.stock, params.road.cost);
  const { order } = creep;
  let segment: number;
  if (
    order.type === "buildRoad" &&
    order.x === target.x &&
    order.y === target.y &&
    order.segment >= 0 &&
    map.road[order.segment] === 0
  ) {
    segment = order.segment;
  } else {
    // Skip the path search when nothing could pay for or resume a segment.
    if (!affordable && state.roadJobs.length === 0) return null;
    segment = nextSegment(state, team, target) ?? -1;
    if (segment < 0) return null;
  }
  const cell = { x: segment % map.width, y: Math.floor(segment / map.width) };
  if (!affordable && findRoadJob(state, cell) === undefined) return null;
  return { type: "buildRoad", x: target.x, y: target.y, segment };
}
