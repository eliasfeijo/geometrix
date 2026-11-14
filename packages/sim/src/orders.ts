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
import type { Cell } from "./map.ts";
import { CELL_COST, movePointsPerTick } from "./movement.ts";
import { pathTo } from "./pathfinding.ts";
import {
  canBuildRoad,
  completeRoadJob,
  findRoadJob,
  nextSegment,
} from "./roads.ts";
import { recordDelivery } from "./stats.ts";
import type { Creep, Deposit, WorldState } from "./world.ts";

export type Order =
  | { type: "stop" }
  | ({ type: "moveTo" } & Cell)
  | { type: "gather"; depositId: number }
  | { type: "deliver" }
  | BuildRoadOrder;

/**
 * Build road until cell (x, y) has one. `segment` is the cell index being
 * built now, or -1 until the next one is chosen (see buildRoadOrder).
 */
export type BuildRoadOrder = { type: "buildRoad"; segment: number } & Cell;

export function resolveOrders(state: WorldState): void {
  // Road jobs already advanced this tick: one builder per job.
  const built = new Set<number>();
  for (const creep of state.creeps) {
    creep.activity = "idle";
    const { order } = creep;
    switch (order.type) {
      case "stop":
        halt(creep);
        break;
      case "moveTo":
        if (walk(state, creep, order) !== "moving") halt(creep);
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
    }
  }
}

/** Stops in place, dropping accumulated points and the cached path. */
function halt(creep: Creep): void {
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
    creep.movePoints += movePointsPerTick(creep, map, path[0]!, params);
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
 * order (owner decision, 2026-11-14).
 */
function gather(state: WorldState, creep: Creep, depositId: number): void {
  const deposit = findDeposit(state, depositId);
  if (
    deposit === undefined ||
    isFull(state, creep) ||
    exhausted(state, deposit)
  ) {
    halt(creep);
    return;
  }
  if (!isAt(creep, deposit)) {
    if (walk(state, creep, deposit) === "unreachable") halt(creep);
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
  if (!canBuildRoad(state, order.y * map.width + order.x)) {
    halt(creep);
    return;
  }
  if (order.segment < 0 || map.road[order.segment] === 1) {
    const next = nextSegment(state, team, order);
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
