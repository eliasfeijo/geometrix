// What a team knows of the map (M1.5 fog plan section 5, spec P-1): the
// terrain it has seen, with cells never seen as passable jungle, and the roads
// it knows. Paths, road building and the autopilot think on this map; moving
// (the speed of a step) still reads the real one.

import type { Cell, GameMap } from "./map.ts";
import type { RoadContext } from "./roads.ts";
import type { TeamMemory } from "./vision.ts";
import type { RoadJob, WorldState } from "./world.ts";

/** The team's memory. */
export function memoryOf(state: WorldState, team: number): TeamMemory {
  const memory = state.memory[team];
  if (memory === undefined) throw new Error(`no memory for team ${team}`);
  return memory;
}

/**
 * The map as the team knows it. It shares the memory's arrays: a cell never
 * seen is stored as jungle, so the memory is the known map already.
 */
export function knownMap(state: WorldState, team: number): GameMap {
  const { terrain, road } = memoryOf(state, team);
  return { width: state.map.width, height: state.map.height, terrain, road };
}

/**
 * What road decisions read for the team: the known map and the cores it knows
 * (its own and the ones it has seen).
 */
export function knownRoadContext(state: WorldState, team: number): RoadContext {
  const memory = memoryOf(state, team);
  const own = state.teams[team]!;
  return {
    map: knownMap(state, team),
    params: state.params,
    teams: [{ core: own.core }, ...memory.cores.map((c) => ({ core: c }))],
  };
}

/**
 * The road job the team knows of on `cell`: one of its own, or another
 * team's as last seen there.
 */
export function knownRoadJob(
  state: WorldState,
  team: number,
  cell: Cell,
): RoadJob | undefined {
  const at = (j: RoadJob) => j.x === cell.x && j.y === cell.y;
  return (
    state.roadJobs.find((j) => j.team === team && at(j)) ??
    memoryOf(state, team).roadJobs.find(at)
  );
}
