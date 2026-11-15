// Vision (M1.5 fog plan section 3, spec V-1, decision N2). A cell is in sight
// of a viewer within Manhattan radius r when no rock lies strictly between the
// two on the integer Bresenham line from the viewer to the cell; the rock
// itself is seen. River and crossings do not block. The line is traced in the
// team's frame, like paths (isRotatedSide): on the rotated side the tracer
// works on the map rotated 180°, so what team 1 sees is the exact mirror of
// what team 0 sees from the mirrored cell. (This Bresenham depends only on
// the offset's magnitudes and signs, so it is point-symmetric already; the
// frame keeps the guarantee if the tracer ever changes.)

import {
  isPassable,
  isRotatedSide,
  Terrain,
  type Cell,
  type GameMap,
} from "./map.ts";
import type { Deposit, RoadJob, Spoil, WorldState } from "./world.ts";

/**
 * Whether no rock lies strictly between (x0, y0) and (x1, y1), both given in
 * the team's frame. Integer Bresenham: 8-connected, error kept as an integer.
 */
function clearLine(
  map: GameMap,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rotated: boolean,
): boolean {
  const { width, height, terrain } = map;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    if (x === x1 && y === y1) return true;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
    if (x === x1 && y === y1) return true;
    const real = rotated
      ? (height - 1 - y) * width + (width - 1 - x)
      : y * width + x;
    if (terrain[real] === Terrain.rock) return false;
  }
}

/**
 * Cells in sight from `from` within `radius`, as increasing cell indices.
 * Recomputes the lines; sightCells caches this.
 */
export function computeSight(
  map: GameMap,
  from: Cell,
  radius: number,
  rotated: boolean,
): number[] {
  const { width, height } = map;
  // The viewer in the team's frame; targets are offsets from it.
  const fx = rotated ? width - 1 - from.x : from.x;
  const fy = rotated ? height - 1 - from.y : from.y;
  const cells: number[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    const y = from.y + dy;
    if (y < 0 || y >= height) continue;
    const span = radius - Math.abs(dy);
    for (let dx = -span; dx <= span; dx++) {
      const x = from.x + dx;
      if (x < 0 || x >= width) continue;
      // The real offset (dx, dy) is (-dx, -dy) in the rotated frame.
      const tx = rotated ? fx - dx : fx + dx;
      const ty = rotated ? fy - dy : fy + dy;
      if (clearLine(map, fx, fy, tx, ty, rotated)) cells.push(y * width + x);
    }
  }
  return cells;
}

/**
 * Sight lists per terrain array: terrain never changes during a world, so the
 * cells a viewer sees depend only on its cell, radius and side. A derived
 * cache, rebuilt from the state after a restore; it holds nothing the state
 * does not determine.
 */
const sightCache = new WeakMap<
  readonly Terrain[],
  Map<number, readonly number[]>
>();

/** computeSight, cached per map terrain. The terrain must not be mutated. */
export function sightCells(
  map: GameMap,
  from: Cell,
  radius: number,
  rotated: boolean,
): readonly number[] {
  let byKey = sightCache.get(map.terrain);
  if (byKey === undefined) {
    byKey = new Map();
    sightCache.set(map.terrain, byKey);
  }
  const size = map.width * map.height;
  const key =
    (radius * 2 + (rotated ? 1 : 0)) * size + from.y * map.width + from.x;
  let cells = byKey.get(key);
  if (cells === undefined) {
    cells = computeSight(map, from, radius, rotated);
    byKey.set(key, cells);
  }
  return cells;
}

/**
 * What a team has seen and remembers (plan section 3, N1). Bitmaps are
 * number[] of 0 and 1, one entry per cell (y * width + x).
 */
export type TeamMemory = {
  team: number;
  /** 1 where the team has ever seen the cell (spec V-2). */
  explored: number[];
  /** 1 where the cell was in sight at the end of the last tick (spec V-1). */
  visible: number[];
  /** Known terrain; a cell never seen is kept as jungle (spec P-1). */
  terrain: Terrain[];
  /** Known roads (spec V-4); the team's own enter as they are completed. */
  road: number[];
  /** +1 for each road the team comes to know: invalidates paths. */
  roadRevision: number;
  /** +1 for each impassable cell (rock, river) the team discovers. */
  blockRevision: number;
  /** Copies of the deposits seen, by id, with the last amount seen (V-3). */
  deposits: Deposit[];
  /** Copies of other teams' road jobs seen, by id (V-5); own ones are state. */
  roadJobs: RoadJob[];
  /** Other teams' cores seen (V-6), by team id. */
  cores: ({ team: number } & Cell)[];
  /**
   * Copies of the spoils seen, by id, with the last cargo seen; forgotten
   * when their cell is in sight without them (M2 encontro plan section 3).
   */
  spoils: Spoil[];
};

/** Nothing seen yet, for each team; updateVision fills it in. */
export function createMemory(
  teams: readonly { id: number }[],
  map: Pick<GameMap, "width" | "height">,
): TeamMemory[] {
  const size = map.width * map.height;
  return teams.map((team) => ({
    team: team.id,
    explored: new Array<number>(size).fill(0),
    visible: new Array<number>(size).fill(0),
    terrain: new Array<Terrain>(size).fill(Terrain.jungle),
    road: new Array<number>(size).fill(0),
    roadRevision: 0,
    blockRevision: 0,
    deposits: [],
    roadJobs: [],
    cores: [],
    spoils: [],
  }));
}

/**
 * Stage 7 of the tick (plan section 3, N10), also run at the end of
 * createWorld: for each team, what its core and creeps see now, and the
 * memory updated from it.
 */
export function updateVision(state: WorldState): void {
  for (const memory of state.memory) see(state, memory);
}

/**
 * How many of the team's viewers see each cell, and what each viewer saw last
 * (its sightCells list, by viewer key: -1 the core, else the creep id). Creeps
 * change cell every 12 to 30 ticks, so updating only the viewers that moved
 * is far cheaper than redrawing every sight each tick. Derived from the state:
 * a memory without a tracker (a restored state) rebuilds it from scratch, with
 * the same result.
 */
type Tracker = { counts: number[]; sights: Map<number, readonly number[]> };

const trackers = new WeakMap<TeamMemory, Tracker>();

function see(state: WorldState, memory: TeamMemory): void {
  const { map, params } = state;
  const { visible, explored } = memory;
  const team = state.teams[memory.team]!;
  const rotated = isRotatedSide(team.id);

  let tracker = trackers.get(memory);
  if (tracker === undefined) {
    tracker = {
      counts: new Array<number>(visible.length).fill(0),
      sights: new Map(),
    };
    trackers.set(memory, tracker);
    visible.fill(0);
  }
  const { counts, sights } = tracker;

  /** A cell comes into sight: explored for good, terrain and road copied. */
  const reveal = (i: number) => {
    visible[i] = 1;
    if (explored[i] === 0) {
      explored[i] = 1;
      const terrain = map.terrain[i]!;
      memory.terrain[i] = terrain;
      if (!isPassable(terrain)) memory.blockRevision += 1;
    }
    if (memory.road[i] !== map.road[i]) {
      memory.road[i] = map.road[i]!;
      memory.roadRevision += 1;
    }
  };
  let viewers = 0;
  const update = (key: number, sight: readonly number[]) => {
    viewers++;
    const before = sights.get(key);
    if (before === sight) return;
    // Add first, so a cell both lists share never leaves sight.
    for (const i of sight) if (counts[i]++ === 0) reveal(i);
    if (before !== undefined) {
      for (const i of before) if (--counts[i]! === 0) visible[i] = 0;
    }
    sights.set(key, sight);
  };
  update(-1, sightCells(map, team.core, params.vision.core, rotated));
  for (const creep of state.creeps) {
    if (creep.team !== team.id) continue;
    update(
      creep.id,
      sightCells(map, creep, params.vision.dna[creep.dna], rotated),
    );
  }
  if (sights.size > viewers) dropGoneViewers(state, team.id, tracker);

  const at = (cell: Cell) => visible[cell.y * map.width + cell.x] === 1;
  rememberDeposits(memory, state.deposits.filter(at));

  const foreignJobs = state.roadJobs.filter((j) => j.team !== team.id);
  if (foreignJobs.length > 0 || memory.roadJobs.length > 0) {
    // Jobs in sight replace what was remembered on visible cells (V-5).
    memory.roadJobs = [
      ...memory.roadJobs.filter((j) => !at(j)),
      ...foreignJobs.filter(at).map((j) => ({ ...j })),
    ].sort((a, b) => a.id - b.id);
  }

  if (state.spoils.length > 0 || memory.spoils.length > 0) {
    // Spoils in sight replace what was remembered on visible cells.
    memory.spoils = [
      ...memory.spoils.filter((s) => !at(s)),
      ...state.spoils.filter(at).map((s) => ({ ...s, cargo: { ...s.cargo } })),
    ].sort((a, b) => a.id - b.id);
  }

  for (const other of state.teams) {
    if (other.id === team.id || !at(other.core)) continue;
    if (memory.cores.some((c) => c.team === other.id)) continue;
    memory.cores.push({ team: other.id, x: other.core.x, y: other.core.y });
    memory.cores.sort((a, b) => a.team - b.team);
  }
}

/** Updates or adds the copies of `seen` (in id order), keeping id order. */
function rememberDeposits(memory: TeamMemory, seen: readonly Deposit[]): void {
  const { deposits } = memory;
  let i = 0;
  for (const deposit of seen) {
    while (i < deposits.length && deposits[i]!.id < deposit.id) i++;
    const copy = deposits[i];
    if (copy !== undefined && copy.id === deposit.id) {
      copy.amount = deposit.amount;
    } else {
      deposits.splice(i, 0, { ...deposit });
    }
    i++;
  }
}

/** Viewers that are no longer the team's creeps stop seeing. */
function dropGoneViewers(
  state: WorldState,
  team: number,
  { counts, sights }: Tracker,
): void {
  const alive = new Set(
    state.creeps.filter((c) => c.team === team).map((c) => c.id),
  );
  for (const [key, sight] of sights) {
    if (key === -1 || alive.has(key)) continue;
    for (const i of sight)
      if (--counts[i]! === 0) state.memory[team]!.visible[i] = 0;
    sights.delete(key);
  }
}

/**
 * A road was completed on cell `index`: the team that paid for it knows it at
 * once (plan section 3, step 4), and so does every team that has the cell in
 * sight (vision only re-reads roads of cells coming into sight).
 */
export function rememberCompletedRoad(
  state: WorldState,
  team: number,
  index: number,
): void {
  for (const memory of state.memory) {
    if (memory.team !== team && memory.visible[index] !== 1) continue;
    if (memory.road[index] === 1) continue;
    memory.road[index] = 1;
    memory.roadRevision += 1;
  }
}
