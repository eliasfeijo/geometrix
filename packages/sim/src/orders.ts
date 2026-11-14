// Order resolution, stage 3 of the tick pipeline (plan section 5). An order is
// what a creep is doing now; it is set by a dominating player or by the
// autopilot (F4). A creep spends the tick it arrives somewhere moving; the work
// there (gathering, building) starts on the next tick.

import {
  capacity,
  cargoTotal,
  findDeposit,
  gatherFrom,
  teamOf,
  unload,
} from "./economy.ts";
import type { Cell } from "./map.ts";
import { CELL_COST, movePointsPerTick } from "./movement.ts";
import { pathTo } from "./pathfinding.ts";
import type { Creep, WorldState } from "./world.ts";

export type Order =
  | { type: "stop" }
  | ({ type: "moveTo" } & Cell)
  | { type: "gather"; depositId: number }
  | { type: "deliver" };

export function resolveOrders(state: WorldState): void {
  for (const creep of state.creeps) {
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
 * order is left to the caller.
 */
function walk(state: WorldState, creep: Creep, target: Cell): WalkResult {
  const path = pathTo(state, creep, target);
  if (path === null) return "unreachable";
  if (path.length > 0) {
    const { map, params } = state;
    creep.movePoints += movePointsPerTick(creep, map, path[0]!, params);
    while (path.length > 0 && creep.movePoints >= CELL_COST) {
      const next = path.shift()!;
      creep.x = next % map.width;
      creep.y = Math.floor(next / map.width);
      creep.movePoints -= CELL_COST;
    }
    if (path.length > 0) return "moving";
  }
  creep.movePoints = 0;
  creep.path = null;
  return "arrived";
}

/** Walks to the deposit, then gathers until full or the deposit is empty. */
function gather(state: WorldState, creep: Creep, depositId: number): void {
  const deposit = findDeposit(state, depositId);
  const full =
    cargoTotal(creep) >= capacity(creep, teamOf(state, creep), state.params);
  if (deposit === undefined || deposit.amount === 0 || full) {
    halt(creep);
    return;
  }
  if (!isAt(creep, deposit)) {
    if (walk(state, creep, deposit) === "unreachable") halt(creep);
    return;
  }
  if (!gatherFrom(state, creep, deposit)) halt(creep);
}

/**
 * Walks to the team's core and unloads on arrival, in the same tick
 * (spec R-3). Stops there, or at once if the core cannot be reached.
 */
function deliver(state: WorldState, creep: Creep): void {
  const team = teamOf(state, creep);
  if (!isAt(creep, team.core) && walk(state, creep, team.core) === "moving") {
    return;
  }
  if (isAt(creep, team.core)) unload(creep, team);
  halt(creep);
}
