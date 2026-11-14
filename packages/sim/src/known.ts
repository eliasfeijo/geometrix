// What a team knows of the map (M1.5 fog plan section 5, spec P-1): the
// terrain it has seen, with cells never seen as passable jungle, and the roads
// it knows. Paths, road building and the autopilot think on this map; moving
// (the speed of a step) still reads the real one.

import { isPassable, isRotatedSide, type Cell, type GameMap } from "./map.ts";
import type { RoadContext } from "./roads.ts";
import type { TeamMemory } from "./vision.ts";
import type { Creep, RoadJob, WorldState } from "./world.ts";

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

/**
 * Where the creep explores next (fog spec D4, plan N4): the cell never seen
 * that is fewest steps away on the team's known map (cells never seen count
 * as passable), and that no other creep of the team is exploring toward. Ties
 * go to the lower index in the team's frame, as in paths. null when no cell
 * never seen can be reached.
 */
export function exploreTarget(state: WorldState, creep: Creep): Cell | null {
  const memory = memoryOf(state, creep.team);
  const { width, height } = state.map;
  const size = width * height;
  const rotated = isRotatedSide(creep.team);
  const taken = new Set<number>();
  for (const other of state.creeps) {
    if (other === creep || other.team !== creep.team) continue;
    if (other.order.type === "explore") {
      taken.add(other.order.y * width + other.order.x);
    }
  }
  const start = creep.y * width + creep.x;
  const steps = new Array<number>(size).fill(-1);
  steps[start] = 0;
  const queue = [start];
  let best = -1;
  // The queue is in step order: once a target is found, only cells at the
  // same number of steps can still beat it, on the tie-break.
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head]!;
    if (best >= 0 && steps[i]! > steps[best]!) break;
    if (memory.explored[i] === 0 && !taken.has(i)) {
      const key = rotated ? size - 1 - i : i;
      const bestKey = rotated ? size - 1 - best : best;
      if (best < 0 || key < bestKey) best = i;
    }
    const x = i % width;
    const neighbors = [
      i >= width ? i - width : -1,
      x > 0 ? i - 1 : -1,
      x < width - 1 ? i + 1 : -1,
      i + width < size ? i + width : -1,
    ];
    if (rotated) neighbors.reverse();
    for (const next of neighbors) {
      if (next < 0 || steps[next] !== -1) continue;
      if (!isPassable(memory.terrain[next]!)) continue;
      steps[next] = steps[i]! + 1;
      queue.push(next);
    }
  }
  return best < 0 ? null : { x: best % width, y: Math.floor(best / width) };
}
