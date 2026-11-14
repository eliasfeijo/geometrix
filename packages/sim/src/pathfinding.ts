// A* on the 4-connected grid (plan section 5). Entering a cell costs the
// inverse of its speed modifier, so routes converge on roads. Ties between
// equal f-scores go to the lower cell index, which makes paths deterministic.

import type { Cell, GameMap } from "./map.ts";
import { cellModifier } from "./movement.ts";
import type { Params } from "./params.ts";
import type { Creep, WorldState } from "./world.ts";

const COST_SCALE = 1_000_000;

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
 * Cheapest path from `from` to `to`: the cell indices to enter, in order,
 * ending with `to`. [] when already there; null when `to` cannot be reached.
 */
export function findPath(
  map: GameMap,
  from: Cell,
  to: Cell,
  params: Params,
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
  g[start] = 0;
  open.push([heuristic(start), start]);

  while (open.size > 0) {
    const [, current] = open.pop();
    if (closed[current]) continue;
    if (current === goal) {
      const path: number[] = [];
      for (let i = goal; i !== start; i = parent[i]!) path.push(i);
      return path.reverse();
    }
    closed[current] = true;
    const x = current % width;
    // Neighbors in increasing index order: up, left, right, down.
    const neighbors = [
      current >= width ? current - width : -1,
      x > 0 ? current - 1 : -1,
      x < width - 1 ? current + 1 : -1,
      current + width < size ? current + width : -1,
    ];
    for (const next of neighbors) {
      if (next < 0 || closed[next]) continue;
      const cost = stepCost(map, next, params);
      if (cost < 0) continue;
      const tentative = g[current]! + cost;
      if (g[next] === -1 || tentative < g[next]!) {
        g[next] = tentative;
        parent[next] = current;
        open.push([tentative + heuristic(next), next]);
      }
    }
  }
  return null;
}

export type PathCache = {
  /** Cell index of the target the path leads to. */
  target: number;
  /** state.roadRevision when the path was computed. */
  roadRevision: number;
  /** Cells still to enter, next one first. */
  cells: number[];
};

/**
 * The creep's path to `target`, from its cache when still valid. It is
 * recomputed only when the target changes or a road was completed since
 * (plan section 5). null when the target cannot be reached.
 */
export function pathTo(
  state: WorldState,
  creep: Creep,
  target: Cell,
): number[] | null {
  const targetIndex = target.y * state.map.width + target.x;
  const cache = creep.path;
  if (
    cache !== null &&
    cache.target === targetIndex &&
    cache.roadRevision === state.roadRevision
  ) {
    return cache.cells;
  }
  const cells = findPath(state.map, creep, target, state.params);
  creep.path =
    cells === null
      ? null
      : { target: targetIndex, roadRevision: state.roadRevision, cells };
  return cells;
}
