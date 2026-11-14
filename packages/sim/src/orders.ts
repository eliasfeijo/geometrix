// Order resolution, stage 3 of the tick pipeline (plan section 5). An order is
// what a creep is doing now; it is set by a dominating player or by the
// autopilot (F4). F2 covers moveTo and stop; gather, deliver and buildRoad
// arrive in F3.

import type { Cell } from "./map.ts";
import { CELL_COST, movePointsPerTick } from "./movement.ts";
import { pathTo } from "./pathfinding.ts";
import type { Creep, WorldState } from "./world.ts";

export type Order = { type: "stop" } | ({ type: "moveTo" } & Cell);

export function resolveOrders(state: WorldState): void {
  for (const creep of state.creeps) {
    const { order } = creep;
    switch (order.type) {
      case "stop":
        halt(creep);
        break;
      case "moveTo":
        moveToward(state, creep, order);
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

/**
 * Gains this tick's points toward the next cell of the path and enters cells
 * while the points last. Halts on arrival, or at once if the target cannot be
 * reached.
 */
function moveToward(state: WorldState, creep: Creep, target: Cell): void {
  const path = pathTo(state, creep, target);
  if (path === null || path.length === 0) {
    halt(creep);
    return;
  }
  const { map, params } = state;
  creep.movePoints += movePointsPerTick(creep, map, path[0]!, params);
  while (path.length > 0 && creep.movePoints >= CELL_COST) {
    const next = path.shift()!;
    creep.x = next % map.width;
    creep.y = Math.floor(next / map.width);
    creep.movePoints -= CELL_COST;
  }
  if (path.length === 0) halt(creep);
}
