// A* on the 4-connected grid (plan section 5). Entering a cell costs the
// inverse of its speed modifier, so routes converge on roads. Ties between
// equal f-scores go to the lower cell index, which makes paths deterministic.
// On the rotated side (team 1) the index order is rotated too: on the
// point-symmetric map, a route of team 1 is the mirror of the same route of
// team 0, not just one of the same cost. Lower-index ties alone gave the teams
// differently shaped roads and up to ~20% apart in delivered materia.

import { knownMap, memoryOf } from "./known.ts";
import { isPassable, isRotatedSide, type Cell, type GameMap } from "./map.ts";
import { cellModifier } from "./movement.ts";
import type { Params } from "./params.ts";
import type { Creep, WorldState } from "./world.ts";

const COST_SCALE = 1_000_000;
/**
 * A step cost is COST_SCALE / modifier (per mille), and a cell at modifier
 * 1000 takes 60 / cellsPerMinute seconds: seconds = cost * 60 /
 * (cellsPerMinute * COST_SCALE / 1000).
 */
const COST_SCALE_PER_MILLE = 1_000;

/** Cost of entering cell `index`, or -1 if impassable. */
export function stepCost(map: GameMap, index: number, params: Params): number {
  const modifier = cellModifier(map, index, params);
  return modifier === 0 ? -1 : Math.floor(COST_SCALE / modifier);
}

/** Min-heap of [f, index] pairs, ordered by f, then index. */
class OpenSet {
  private readonly items: [number, number][] = [];

  get size(): number {
    return this.items.length;
  }

  private static less(a: [number, number], b: [number, number]): boolean {
    return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
  }

  push(item: [number, number]): void {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!OpenSet.less(items[i]!, items[parent]!)) break;
      [items[i], items[parent]] = [items[parent]!, items[i]!];
      i = parent;
    }
  }

  pop(): [number, number] {
    const items = this.items;
    const top = items[0]!;
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (
          left < items.length &&
          OpenSet.less(items[left]!, items[smallest]!)
        ) {
          smallest = left;
        }
        if (
          right < items.length &&
          OpenSet.less(items[right]!, items[smallest]!)
        ) {
          smallest = right;
        }
        if (smallest === i) break;
        [items[i], items[smallest]] = [items[smallest]!, items[i]!];
        i = smallest;
      }
    }
    return top;
  }
}

/**
 * The cheapest cost from `from` at which some cell of `targets` is reached,
 * with the A* step costs (fog spec §11, E1), and every target reached at that
 * cost, in increasing index; null when none is reached at a cost up to
 * `maxCost`. A* toward the nearest target: the heuristic is the Manhattan
 * distance to the closest target times the cheapest step (a road), which
 * never overestimates, so the costs are exact.
 */
export function nearestTargets(
  map: GameMap,
  from: Cell,
  targets: ReadonlySet<number>,
  params: Params,
  maxCost: number,
): { cost: number; cells: number[] } | null {
  if (targets.size === 0) return null;
  const { width } = map;
  const size = width * map.height;
  const { road, jungle, crossing } = params.movementPermille;
  const minStep = Math.floor(COST_SCALE / Math.max(road, jungle, crossing));
  const goals = [...targets].map((t) => [t % width, Math.floor(t / width)]);
  const h = (i: number) => {
    const x = i % width;
    const y = Math.floor(i / width);
    let best = Number.MAX_SAFE_INTEGER;
    for (const [gx, gy] of goals) {
      const d = Math.abs(gx! - x) + Math.abs(gy! - y);
      if (d < best) best = d;
    }
    return best * minStep;
  };
  const cost = new Map<number, number>();
  const done = new Set<number>();
  const open = new OpenSet();
  const start = from.y * width + from.x;
  cost.set(start, 0);
  open.push([h(start), start]);
  let found: { cost: number; cells: number[] } | null = null;
  while (open.size > 0) {
    const [f, i] = open.pop();
    if (done.has(i)) continue;
    if (f > maxCost || (found !== null && f > found.cost)) break;
    done.add(i);
    const g = cost.get(i)!;
    if (targets.has(i)) {
      if (found === null) found = { cost: g, cells: [] };
      found.cells.push(i);
      continue;
    }
    const x = i % width;
    for (const next of [i - width, i - 1, i + 1, i + width]) {
      if (next < 0 || next >= size || done.has(next)) continue;
      if ((next === i - 1 && x === 0) || (next === i + 1 && x === width - 1))
        continue;
      const step = stepCost(map, next, params);
      if (step < 0) continue;
      const total = g + step;
      const known = cost.get(next);
      if (known === undefined || total < known) {
        cost.set(next, total);
        open.push([total + h(next), next]);
      }
    }
  }
  if (found !== null) found.cells.sort((a, b) => a - b);
  return found;
}

/** The path cost an empty creep of `cellsPerMinute` covers in `seconds`. */
export function costWithin(seconds: number, cellsPerMinute: number): number {
  return Math.floor((seconds * cellsPerMinute * COST_SCALE_PER_MILLE) / 60);
}

/**
 * Cheapest path from `from` to `to`: the cell indices to enter, in order,
 * ending with `to`. [] when already there; null when `to` cannot be reached.
 * With `rotated`, ties go to the higher cell index (the lower one in the map
 * rotated 180°): the route a team on the rotated side takes.
 */
export function findPath(
  map: GameMap,
  from: Cell,
  to: Cell,
  params: Params,
  rotated = false,
): number[] | null {
  const { width, height } = map;
  const start = from.y * width + from.x;
  const goal = to.y * width + to.x;
  if (start === goal) return [];
  if (stepCost(map, goal, params) < 0) return null;

  const { road, jungle, crossing } = params.movementPermille;
  const minCost = Math.floor(COST_SCALE / Math.max(road, jungle, crossing));
  const heuristic = (i: number) =>
    (Math.abs((i % width) - to.x) + Math.abs(Math.floor(i / width) - to.y)) *
    minCost;

  const size = width * height;
  const g = new Array<number>(size).fill(-1);
  const parent = new Array<number>(size).fill(-1);
  const closed = new Array<boolean>(size).fill(false);
  const open = new OpenSet();
  // The open set orders ties by this key; it maps to itself both ways.
  const key = (i: number) => (rotated ? size - 1 - i : i);
  g[start] = 0;
  open.push([heuristic(start), key(start)]);

  while (open.size > 0) {
    const current = key(open.pop()[1]);
    if (closed[current]) continue;
    if (current === goal) {
      const path: number[] = [];
      for (let i = goal; i !== start; i = parent[i]!) path.push(i);
      return path.reverse();
    }
    closed[current] = true;
    const x = current % width;
    // Neighbors in increasing key order: up, left, right, down (reversed on
    // the rotated side).
    const neighbors = [
      current >= width ? current - width : -1,
      x > 0 ? current - 1 : -1,
      x < width - 1 ? current + 1 : -1,
      current + width < size ? current + width : -1,
    ];
    if (rotated) neighbors.reverse();
    for (const next of neighbors) {
      if (next < 0 || closed[next]) continue;
      const cost = stepCost(map, next, params);
      if (cost < 0) continue;
      const tentative = g[current]! + cost;
      if (g[next] === -1 || tentative < g[next]!) {
        g[next] = tentative;
        parent[next] = current;
        open.push([tentative + heuristic(next), key(next)]);
      }
    }
  }
  return null;
}

export type PathCache = {
  /** Cell index of the target the path leads to. */
  target: number;
  /** The team memory's roadRevision when the path was computed. */
  roadRevision: number;
  /** The team memory's blockRevision the path was last checked against. */
  blockRevision: number;
  /** Cells still to enter, next one first. */
  cells: number[];
};

/**
 * The creep's path to `target` on the map its team knows (fog plan section
 * 5, spec P-1), from its cache when still valid. It is recomputed when the
 * target changes or the team came to know a road since. When the team only
 * discovered impassable cells, the cached path is kept unless one of its
 * cells is among them (N3). null when the target cannot be reached.
 */
export function pathTo(
  state: WorldState,
  creep: Creep,
  target: Cell,
): number[] | null {
  const map = knownMap(state, creep.team);
  const { roadRevision, blockRevision } = memoryOf(state, creep.team);
  const targetIndex = target.y * map.width + target.x;
  const cache = creep.path;
  if (
    cache !== null &&
    cache.target === targetIndex &&
    cache.roadRevision === roadRevision
  ) {
    if (cache.blockRevision === blockRevision) return cache.cells;
    if (cache.cells.every((i) => isPassable(map.terrain[i]!))) {
      cache.blockRevision = blockRevision;
      return cache.cells;
    }
  }
  const cells = findPath(
    map,
    creep,
    target,
    state.params,
    isRotatedSide(creep.team),
  );
  creep.path =
    cells === null
      ? null
      : { target: targetIndex, roadRevision, blockRevision, cells };
  return cells;
}
