// Order resolution, stage 3 of the tick pipeline (plan section 5). An order is
// what a creep is doing now; it is set by a dominating player or by the
// autopilot (F4). A creep spends the tick it arrives somewhere moving; the work
// there (gathering, building) starts on the next tick.

import {
  canAfford,
  capacity,
  cargoTotal,
  debit,
  findDeposit,
  gatherFrom,
  regenerates,
  teamOf,
  unload,
} from "./economy.ts";
import { knownRoadContext, memoryOf } from "./known.ts";
import type { Cell } from "./map.ts";
import { CELL_COST, movePointsPerTick } from "./movement.ts";
import { pathTo } from "./pathfinding.ts";
import {
  canBuildRoad,
  completeRoadJob,
  findRoadJob,
  nextSegment,
} from "./roads.ts";
import { findCreep } from "./domination.ts";
import { creepRef, emit, type EventLog } from "./events.ts";
import { findSpoil, takeSpoil } from "./spoils.ts";
import { recordDelivery, type Activity } from "./stats.ts";
import type { Creep, Deposit, WorldState } from "./world.ts";

export type Order =
  | { type: "stop" }
  | ({ type: "moveTo" } & Cell)
  /** Walk toward a cell never seen until the team has seen it (fog N5). */
  | ({ type: "explore" } & Cell)
  | { type: "gather"; depositId: number }
  | { type: "deliver" }
  | BuildRoadOrder
  /**
   * Chase an enemy creep in sight to open an encounter with it (M2 encontro
   * spec D5, E-2); ends when the target leaves the team's sight.
   */
  | { type: "approach"; targetId: number; intent: "attack" | "extort" }
  /** Pick up a spoil the team knows (spec D11, S-1). */
  | { type: "pickup"; spoilId: number }
  /**
   * Run to the team's core with the flee bonus until `untilTick` or there
   * (spec D10, plan P4). The autopilot does not change it, nor can a player.
   */
  | { type: "flee"; untilTick: number };

/**
 * Build road until cell (x, y) has one. `segment` is the cell index being
 * built now, or -1 until the next one is chosen (see buildRoadOrder).
 */
export type BuildRoadOrder = { type: "buildRoad"; segment: number } & Cell;

export function resolveOrders(state: WorldState, log: EventLog): void {
  // Road jobs already advanced this tick: one builder per job.
  const built = new Set<number>();
  for (const creep of state.creeps) {
    creep.activity = "idle";
    // In an encounter a creep neither moves nor works (spec L-3).
    if (creep.engagement !== null) {
      creep.activity = engagedActivity(state, creep.engagement);
      continue;
    }
    const { order } = creep;
    switch (order.type) {
      case "stop":
        halt(creep);
        break;
      case "moveTo":
        if (walk(state, creep, order) !== "moving") halt(creep);
        break;
      case "explore":
        if (
          memoryOf(state, creep.team).explored[
            order.y * state.map.width + order.x
          ] === 1 ||
          walk(state, creep, order) !== "moving"
        ) {
          halt(creep);
        }
        break;
      case "gather":
        gather(state, creep, order.depositId);
        break;
      case "deliver":
        deliver(state, creep);
        break;
      case "buildRoad":
        buildRoad(state, creep, order, built);
        break;
      case "approach":
        approach(state, creep, order.targetId);
        break;
      case "flee":
        flee(state, creep, order.untilTick);
        break;
      case "pickup":
        pickup(state, log, creep, order.spoilId);
        break;
    }
  }
}

function engagedActivity(state: WorldState, id: number): Activity {
  const encounter = state.encounters.find((e) => e.id === id);
  return encounter?.stage === "fight" ? "fighting" : "talking";
}

/**
 * Walks toward the target's cell, the path recomputed when the target moves
 * (the path cache keys on the target cell). Ends when the target is gone
 * from the team's sight at the end of the last tick (spec E-2), or dead.
 */
function approach(state: WorldState, creep: Creep, targetId: number): void {
  const target = findCreep(state, targetId);
  const visible = memoryOf(state, creep.team).visible;
  if (
    target === undefined ||
    visible[target.y * state.map.width + target.x] !== 1
  ) {
    halt(creep);
    return;
  }
  if (walk(state, creep, target) === "unreachable") halt(creep);
}

/**
 * Walks to a spoil the team remembers and takes what fits on arrival, cristal
 * first (spec S-1). It goes by the memory: a pile already gone is found out
 * there, like a deposit's amount.
 */
function pickup(
  state: WorldState,
  log: EventLog,
  creep: Creep,
  spoilId: number,
): void {
  const known = memoryOf(state, creep.team).spoils.find(
    (s) => s.id === spoilId,
  );
  if (known === undefined || isFull(state, creep)) {
    halt(creep);
    return;
  }
  if (!isAt(creep, known)) {
    const result = walk(state, creep, known);
    if (result === "unreachable") halt(creep);
    if (result !== "arrived") return;
  }
  const spoil = findSpoil(state, spoilId);
  if (spoil !== undefined && isAt(creep, spoil)) {
    const free =
      capacity(creep, teamOf(state, creep), state.params) - cargoTotal(creep);
    const taken = takeSpoil(state, creep, spoil, free);
    emit(log, {
      type: "pickedUp",
      creep: creepRef(creep),
      spoil: spoilId,
      taken,
      x: spoil.x,
      y: spoil.y,
    });
  }
  halt(creep);
}

/**
 * Runs to the team's core with the flee bonus (spec D10, plan P4), until
 * there or until the bonus is over.
 */
function flee(state: WorldState, creep: Creep, untilTick: number): void {
  if (state.tick >= untilTick) {
    halt(creep);
    return;
  }
  if (walk(state, creep, teamOf(state, creep).core) === "moving") {
    creep.activity = "fleeing";
  } else {
    halt(creep);
  }
}

/** Stops in place, dropping accumulated points and the cached path. */
export function halt(creep: Creep): void {
  creep.order = { type: "stop" };
  creep.movePoints = 0;
  creep.path = null;
}

const isAt = (creep: Creep, cell: Cell) =>
  creep.x === cell.x && creep.y === cell.y;

type WalkResult = "arrived" | "moving" | "unreachable";

/**
 * Gains this tick's points toward the next cell of the path and enters cells
 * while the points last. On arrival the points and the path are dropped; the
 * order is left to the caller. Moving starts a trip if none is under way.
 */
function walk(state: WorldState, creep: Creep, target: Cell): WalkResult {
  const path = pathTo(state, creep, target);
  if (path === null) return "unreachable";
  if (path.length > 0) {
    const { map, params } = state;
    creep.activity = cargoTotal(creep) > 0 ? "carrying" : "walkingEmpty";
    creep.trip ??= { startTick: state.tick, cells: 0 };
    const gain = movePointsPerTick(creep, map, path[0]!, params);
    creep.movePoints +=
      creep.order.type === "flee"
        ? Math.floor((gain * params.flee.speedPermille) / 1000)
        : gain;
    while (path.length > 0 && creep.movePoints >= CELL_COST) {
      const next = path.shift()!;
      creep.x = next % map.width;
      creep.y = Math.floor(next / map.width);
      creep.movePoints -= CELL_COST;
      creep.trip.cells += 1;
    }
    if (path.length > 0) return "moving";
  }
  creep.movePoints = 0;
  creep.path = null;
  return "arrived";
}

/**
 * Walks to the deposit, then gathers until full. At an empty deposit that
 * regenerates the creep waits (idle) for it; one that never does ends the
 * order (owner decision, 2026-11-14). The creep finds out how much is left
 * only there: on the way it goes by what its team remembers (fog spec A-2).
 */
function gather(state: WorldState, creep: Creep, depositId: number): void {
  const deposit = findDeposit(state, depositId);
  if (deposit === undefined || isFull(state, creep)) {
    halt(creep);
    return;
  }
  if (!isAt(creep, deposit)) {
    if (walk(state, creep, deposit) === "unreachable") halt(creep);
    return;
  }
  if (exhausted(state, deposit)) {
    halt(creep);
    return;
  }
  if (deposit.amount === 0) return;
  gatherFrom(state, creep, deposit);
  if (isFull(state, creep) || exhausted(state, deposit)) halt(creep);
}

const isFull = (state: WorldState, creep: Creep) =>
  cargoTotal(creep) >= capacity(creep, teamOf(state, creep), state.params);

/** Empty for good: nothing left and no regeneration. */
const exhausted = (state: WorldState, deposit: Deposit) =>
  deposit.amount === 0 && !regenerates(deposit, state.params);

/**
 * Walks to the team's core and unloads on arrival, in the same tick
 * (spec R-3). Stops there, or at once if the core cannot be reached.
 */
function deliver(state: WorldState, creep: Creep): void {
  const team = teamOf(state, creep);
  if (!isAt(creep, team.core) && walk(state, creep, team.core) === "moving") {
    return;
  }
  if (isAt(creep, team.core)) {
    recordDelivery(state, creep);
    unload(creep, team);
  }
  halt(creep);
}

/**
 * Walks to the next segment toward the target and builds it: pays the road
 * cost when the work starts there, then advances the job while standing on it.
 * A job left behind keeps its progress for whoever comes back. Stops when the
 * target has a road, or when the target or the next segment cannot take one,
 * cannot be reached or cannot be paid for.
 */
function buildRoad(
  state: WorldState,
  creep: Creep,
  order: BuildRoadOrder,
  built: Set<number>,
): void {
  const { map, params } = state;
  const team = teamOf(state, creep);
  // The trace follows what the team knows (fog spec D5, P-3).
  const known = knownRoadContext(state, team.id);
  if (!canBuildRoad(known, order.y * map.width + order.x)) {
    halt(creep);
    return;
  }
  if (order.segment < 0 || !canBuildRoad(known, order.segment)) {
    const next = nextSegment(known, team, order);
    if (next === null) {
      halt(creep);
      return;
    }
    order.segment = next;
  }
  const cell = {
    x: order.segment % map.width,
    y: Math.floor(order.segment / map.width),
  };
  if (!isAt(creep, cell)) {
    if (walk(state, creep, cell) === "unreachable") halt(creep);
    return;
  }
  let job = findRoadJob(state, cell);
  if (job === undefined) {
    // Before paying, the trace again: what the team saw on the way may
    // have moved it (a rock or river discovered).
    const next = nextSegment(known, team, order);
    if (next !== order.segment) {
      if (next === null) halt(creep);
      else order.segment = next;
      return;
    }
    if (!canAfford(team.stock, params.road.cost)) {
      halt(creep);
      return;
    }
    debit(team.stock, params.road.cost);
    job = {
      id: state.nextId++,
      team: team.id,
      ...cell,
      remainingSeconds: params.road.buildSeconds,
    };
    state.roadJobs.push(job);
  }
  if (built.has(job.id)) return;
  built.add(job.id);
  creep.activity = "building";
  job.remainingSeconds -= params.world.tickSeconds;
  if (job.remainingSeconds > 0) return;
  completeRoadJob(state, job);
  if (isAt(creep, order)) halt(creep);
  else order.segment = -1;
}
