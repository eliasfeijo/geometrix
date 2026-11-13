// Seeded map generation (plan section 6): the top side is generated, the bottom
// side is the top rotated 180° (point symmetry), and the river splits them.

import type { Params, Resource } from "./params.ts";
import { createRng, nextInt, type RngState } from "./rng.ts";

export const Terrain = { jungle: 0, river: 1, crossing: 2, rock: 3 } as const;
export type Terrain = (typeof Terrain)[keyof typeof Terrain];

export type Cell = { x: number; y: number };

export type GameMap = {
  width: number;
  height: number;
  /** Index = y * width + x. */
  terrain: Terrain[];
  /** 1 where a road is built. Same indexing as terrain. */
  road: number[];
};

export type DepositSite = { kind: Resource } & Cell;

export type MapLayout = {
  map: GameMap;
  /** cores[team]: team 0 owns the top side, team 1 the bottom side. */
  cores: [Cell, Cell];
  /** Top-side sites first, then their mirrors in the same order. */
  deposits: DepositSite[];
};

export type GeneratedMap = {
  layout: MapLayout;
  /** RNG state after generation; the world continues from it. */
  rng: RngState;
  /** The seed that produced a connected map (seed, seed+1, ...). */
  mapSeed: number;
};

const MAX_ATTEMPTS = 100;

/** A placement found no free cell: the attempt is invalid, try the next seed. */
class PlacementFailed extends Error {}

export function isPassable(terrain: Terrain): boolean {
  return terrain === Terrain.jungle || terrain === Terrain.crossing;
}

export function mirrorCell({ x, y }: Cell, map: GameMap): Cell {
  return { x: map.width - 1 - x, y: map.height - 1 - y };
}

const manhattan = (a: Cell, b: Cell) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Left column of each crossing, symmetric around the vertical center. */
export function crossingColumns(params: Params): number[] {
  const { width, crossings, crossingWidth } = params.map;
  const centers: number[] = [];
  for (let i = 0; i < Math.floor(crossings / 2); i++) {
    centers.push(Math.floor(((i + 1) * width) / (crossings + 1)));
  }
  const mirrored = centers.map((c) => width - c).reverse();
  if (crossings % 2 === 1) centers.push(width / 2);
  return [...centers, ...mirrored].map((c) => c - crossingWidth / 2);
}

export function generateMap(seed: number, params: Params): GeneratedMap {
  let mapSeed = seed;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = createRng(mapSeed);
    const layout = tryGenerateLayout(rng, params);
    if (layout && isConnected(layout)) return { layout, rng, mapSeed };
    mapSeed = (mapSeed + 1) >>> 0;
  }
  throw new Error(
    `no valid map within ${MAX_ATTEMPTS} seeds from ${seed}: check map params`,
  );
}

function tryGenerateLayout(rng: RngState, params: Params): MapLayout | null {
  try {
    return generateLayout(rng, params);
  } catch (error) {
    if (error instanceof PlacementFailed) return null;
    throw error;
  }
}

function generateLayout(rng: RngState, params: Params): MapLayout {
  const { width, height, riverRows, crossingWidth } = params.map;
  const sideRows = (height - riverRows) / 2;
  const map: GameMap = {
    width,
    height,
    terrain: new Array<Terrain>(width * height).fill(Terrain.jungle),
    road: new Array<number>(width * height).fill(0),
  };
  const index = (c: Cell) => c.y * width + c.x;

  // River and crossings span the full width, so they are symmetric already.
  for (let y = sideRows; y < sideRows + riverRows; y++) {
    for (let x = 0; x < width; x++)
      map.terrain[index({ x, y })] = Terrain.river;
  }
  const crossings = crossingColumns(params);
  for (const left of crossings) {
    for (let y = sideRows; y < sideRows + riverRows; y++) {
      for (let x = left; x < left + crossingWidth; x++) {
        map.terrain[index({ x, y })] = Terrain.crossing;
      }
    }
  }

  const topCells: Cell[] = [];
  for (let y = 0; y < sideRows; y++) {
    for (let x = 0; x < width; x++) topCells.push({ x, y });
  }
  const occupied = new Array<boolean>(width * height).fill(false);
  const isFreeJungle = (c: Cell) =>
    map.terrain[index(c)] === Terrain.jungle && !occupied[index(c)];

  /** Picks a uniformly random cell among `candidates` (kept in index order). */
  const pick = (candidates: Cell[]): Cell => {
    if (candidates.length === 0) {
      throw new PlacementFailed();
    }
    return candidates[nextInt(rng, candidates.length)]!;
  };

  const { core: zone } = params.map;
  const core = pick(
    topCells.filter(
      (c) =>
        c.y >= zone.minRow &&
        c.y <= zone.maxRow &&
        c.x >= zone.minCol &&
        c.x <= zone.maxCol,
    ),
  );
  occupied[index(core)] = true;

  placeRocks(rng, params, map, topCells, core);

  const deposits: DepositSite[] = [];
  const placeDeposit = (kind: Resource, candidates: Cell[]) => {
    const cell = pick(candidates.filter(isFreeJungle));
    occupied[index(cell)] = true;
    deposits.push({ kind, ...cell });
  };

  const { materia, cristal } = params.deposits;
  for (let i = 0; i < materia.perSide; i++) {
    placeDeposit(
      "materia",
      topCells.filter((c) => {
        const d = manhattan(c, core);
        return d >= materia.minCoreDistance && d <= materia.maxCoreDistance;
      }),
    );
  }
  for (let i = 0; i < cristal.perSide; i++) {
    placeDeposit(
      "cristal",
      topCells.filter((c) => manhattan(c, core) >= cristal.minCoreDistance),
    );
  }
  for (let i = 0; i < cristal.contested / 2; i++) {
    const left = crossings[nextInt(rng, crossings.length)]!;
    const crossingEdge: Cell[] = [];
    for (let x = left; x < left + crossingWidth; x++) {
      crossingEdge.push({ x, y: sideRows });
    }
    placeDeposit(
      "cristal",
      topCells.filter(
        (c) =>
          sideRows - c.y <= cristal.contestedMaxRiverDistance &&
          crossingEdge.some(
            (e) => manhattan(c, e) <= cristal.contestedMaxCrossingDistance,
          ),
      ),
    );
  }

  // Bottom side = top side rotated 180°.
  for (const c of topCells) {
    map.terrain[index(mirrorCell(c, map))] = map.terrain[index(c)]!;
  }
  return {
    map,
    cores: [core, mirrorCell(core, map)],
    deposits: [
      ...deposits,
      ...deposits.map((d) => ({ kind: d.kind, ...mirrorCell(d, map) })),
    ],
  };
}

function placeRocks(
  rng: RngState,
  params: Params,
  map: GameMap,
  topCells: Cell[],
  core: Cell,
): void {
  const { rocks } = params.map;
  const sideRows = (map.height - params.map.riverRows) / 2;
  const index = (c: Cell) => c.y * map.width + c.x;
  const canRock = (c: Cell) =>
    c.x >= 0 &&
    c.x < map.width &&
    c.y >= 0 &&
    c.y < sideRows &&
    map.terrain[index(c)] === Terrain.jungle &&
    manhattan(c, core) > rocks.coreClearance;

  for (let i = 0; i < rocks.clustersPerSide; i++) {
    const start = topCells.filter(canRock);
    if (start.length === 0) return;
    const size =
      rocks.minCells + nextInt(rng, rocks.maxCells - rocks.minCells + 1);
    const cluster = [start[nextInt(rng, start.length)]!];
    map.terrain[index(cluster[0]!)] = Terrain.rock;
    while (cluster.length < size) {
      // Frontier in index order, without duplicates, so the pick is stable.
      const seen = new Set<number>();
      const frontier: Cell[] = [];
      for (const c of cluster) {
        for (const n of neighbors(c)) {
          if (canRock(n) && !seen.has(index(n))) {
            seen.add(index(n));
            frontier.push(n);
          }
        }
      }
      if (frontier.length === 0) break;
      frontier.sort((a, b) => index(a) - index(b));
      const next = frontier[nextInt(rng, frontier.length)]!;
      map.terrain[index(next)] = Terrain.rock;
      cluster.push(next);
    }
  }
}

function neighbors({ x, y }: Cell): Cell[] {
  return [
    { x, y: y - 1 },
    { x: x - 1, y },
    { x: x + 1, y },
    { x, y: y + 1 },
  ];
}

/** Both cores and every deposit are in the same 4-connected passable region. */
function isConnected({ map, cores, deposits }: MapLayout): boolean {
  const { width, height, terrain } = map;
  const index = (c: Cell) => c.y * width + c.x;
  const reached = new Array<boolean>(width * height).fill(false);
  const queue: Cell[] = [cores[0]];
  reached[index(cores[0])] = true;
  for (let head = 0; head < queue.length; head++) {
    for (const n of neighbors(queue[head]!)) {
      if (n.x < 0 || n.x >= width || n.y < 0 || n.y >= height) continue;
      const i = index(n);
      if (!reached[i] && isPassable(terrain[i]!)) {
        reached[i] = true;
        queue.push(n);
      }
    }
  }
  return [cores[1], ...deposits].every((c) => reached[index(c)]);
}
