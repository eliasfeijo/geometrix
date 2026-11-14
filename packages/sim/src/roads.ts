// Road building (spec I-2; F3 details decided 2026-11-13). A segment is one
// cell. buildRoad toward P follows the cheapest path from the team's core to P,
// which already prefers existing roads; the next segment is the first cell of
// that path without a road, so it always touches the network (a road or the
// core). Roads are neutral: both teams move on them.

import { Terrain, type Cell } from "./map.ts";
import { findPath } from "./pathfinding.ts";
import type { Order } from "./orders.ts";
import type { RoadJob, Team, WorldState } from "./world.ts";

/** Order to build road, segment by segment, until cell P has one. */
export function buildRoadOrder(target: Cell): Order {
  return { type: "buildRoad", x: target.x, y: target.y, segment: -1 };
}

/**
 * Whether a segment can be built on cell `index`: jungle without a road, and
 * not a core. Crossings stay as they are, the river's slow choke points.
 */
export function canBuildRoad(state: WorldState, index: number): boolean {
  const { map } = state;
  if (map.terrain[index] !== Terrain.jungle || map.road[index] === 1) {
    return false;
  }
  return !state.teams.some((t) => t.core.y * map.width + t.core.x === index);
}

/**
 * The next segment toward `target` for the team: the first cell without a
 * road on the cheapest path from its core. null when there is none to build
 * (the path is unreachable or is blocked by a cell that cannot take a road).
 */
export function nextSegment(
  state: WorldState,
  team: Team,
  target: Cell,
): number | null {
  const path = findPath(state.map, team.core, target, state.params);
  const next = path?.find((i) => state.map.road[i] === 0);
  return next !== undefined && canBuildRoad(state, next) ? next : null;
}

export function findRoadJob(
  state: WorldState,
  cell: Cell,
): RoadJob | undefined {
  return state.roadJobs.find((j) => j.x === cell.x && j.y === cell.y);
}

/** Lays the road on the job's cell and invalidates cached paths. */
export function completeRoadJob(state: WorldState, job: RoadJob): void {
  state.map.road[job.y * state.map.width + job.x] = 1;
  state.roadRevision += 1;
  state.stats.teams[job.team]!.roadSegments += 1;
  state.roadJobs.splice(state.roadJobs.indexOf(job), 1);
}
