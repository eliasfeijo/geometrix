// Road building (spec I-2; F3 details decided 2026-11-13). A segment is one
// cell. buildRoad toward P follows the cheapest path from the team's core to P,
// which already prefers existing roads; the next segment is the first cell of
// that path without a road, so it always touches the network (a road or the
// core). Roads are neutral: both teams move on them.

import {
  isRotatedSide,
  manhattan,
  Terrain,
  type Cell,
  type GameMap,
} from "./map.ts";
import { findPath } from "./pathfinding.ts";
import type { Order } from "./orders.ts";
import type { Params } from "./params.ts";
import { rememberCompletedRoad } from "./vision.ts";
import type { Deposit, RoadJob, Team, WorldState } from "./world.ts";

/**
 * What the road checks read: the map with its road layer, the params and the
 * cores. The state fits it, and so does what a team sees (a bot builds the road
 * layer from its view, M1.5 plan R3).
 */
export type RoadContext = {
  map: GameMap;
  params: Params;
  teams: readonly { core: Cell }[];
};

/** Order to build road, segment by segment, until cell P has one. */
export function buildRoadOrder(target: Cell): Order {
  return { type: "buildRoad", x: target.x, y: target.y, segment: -1 };
}

/**
 * Whether a segment can be built on cell `index`: jungle without a road, and
 * not a core. Crossings stay as they are, the river's slow choke points.
 */
export function canBuildRoad(state: RoadContext, index: number): boolean {
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
  state: RoadContext,
  team: Pick<Team, "id" | "core">,
  target: Cell,
): number | null {
  const path = findPath(
    state.map,
    team.core,
    target,
    state.params,
    isRotatedSide(team.id),
  );
  const next = path?.find((i) => state.map.road[i] === 0);
  return next !== undefined && canBuildRoad(state, next) ? next : null;
}

/**
 * The road target: the non-empty deposit nearest to the core (Manhattan, ties
 * to the first cell in the team's frame, as explore: the deposit ids are not
 * mirrored between the teams) without a road on its cell and with a segment
 * that can be built toward it. null when there is none. The strategist's
 * rule, which the road-builder preset resolves on the team's knowledge (R
 * spec D12, RB-1). `keep` is a target already being built with a segment
 * that can still take a road: while it is still the nearest candidate it is
 * kept without a new path search (the autopilot decides every tick).
 */
export function roadTarget(
  state: RoadContext & { deposits: readonly Deposit[] },
  team: Pick<Team, "id" | "core">,
  keep: Cell | null = null,
): Cell | null {
  const { map } = state;
  const { width, height } = map;
  const frameIndex = (c: Cell) =>
    isRotatedSide(team.id)
      ? (height - 1 - c.y) * width + (width - 1 - c.x)
      : c.y * width + c.x;
  const candidates = state.deposits
    .filter((d) => d.amount > 0 && map.road[d.y * map.width + d.x] === 0)
    .sort(
      (a, b) =>
        manhattan(team.core, a) - manhattan(team.core, b) ||
        frameIndex(a) - frameIndex(b),
    );
  const first = candidates[0];
  if (first !== undefined && keep?.x === first.x && keep.y === first.y) {
    return { x: first.x, y: first.y };
  }
  for (const deposit of candidates) {
    if (nextSegment(state, team, deposit) !== null) {
      return { x: deposit.x, y: deposit.y };
    }
  }
  return null;
}

export function findRoadJob(
  state: WorldState,
  cell: Cell,
): RoadJob | undefined {
  return state.roadJobs.find((j) => j.x === cell.x && j.y === cell.y);
}

/**
 * Lays the road on the job's cell and makes it known to the team that paid
 * for it and to the teams that see it (which invalidates their cached paths).
 */
export function completeRoadJob(state: WorldState, job: RoadJob): void {
  const index = job.y * state.map.width + job.x;
  state.map.road[index] = 1;
  rememberCompletedRoad(state, job.team, index);
  state.stats.teams[job.team]!.roadSegments += 1;
  state.roadJobs.splice(state.roadJobs.indexOf(job), 1);
}
