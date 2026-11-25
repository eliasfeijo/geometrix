// The arena (spec D3, plan section 4): a grid drawn in text, with the exit
// ring included. It is setup data, not a param: the package is pure and never
// reads files (the CLI reads params/arenas/, the client imports them).
//
//   .      floor
//   #      rock: blocks movement and projectiles
//   1..4   floor of the spawn zone (entry) of side 0..3
//
// The outer row and column on each edge are the exit ring (spec D7): floor or
// rock only. A spawn zone can be anywhere off the ring; since the F3
// checkpoint, the arenas put it a quarter of the way in, away from the exit
// (spec D3). Whoever spawns there faces away from the ring edge nearest to it.

export type Dir = "up" | "right" | "down" | "left";
export const DIRS: readonly Dir[] = ["up", "right", "down", "left"];

export type Entry = {
  /** Floor cells of the spawn zone, in index order. */
  cells: number[];
  /** Inward: away from the ring edge nearest to the zone. */
  facing: Dir;
};

export type Arena = {
  width: number;
  height: number;
  /** 1 = rock, 0 = floor, by cell index (y × width + x). */
  rock: number[];
  /** The entry stretch of side i is entries[i]; 2 to 4 of them. */
  entries: Entry[];
};

export class ArenaError extends Error {
  constructor(message: string) {
    super(`invalid arena: ${message}`);
    this.name = "ArenaError";
  }
}

const MIN_SIDES = 2;
const MAX_SIDES = 4;

/** Parses an arena drawn in text; throws ArenaError with the reason. */
export function parseArena(rows: readonly string[]): Arena {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  if (width < 5 || height < 5) {
    throw new ArenaError("must be at least 5 × 5 (ring, spawn lap, middle)");
  }
  const rock: number[] = [];
  const stretches: number[][] = [[], [], [], []];
  for (let y = 0; y < height; y++) {
    const row = rows[y]!;
    if (row.length !== width) {
      throw new ArenaError(
        `row ${y} has ${row.length} cells, expected ${width}`,
      );
    }
    for (let x = 0; x < width; x++) {
      const glyph = row[x]!;
      const cell = y * width + x;
      const onRing = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      if (glyph === "#") {
        rock.push(1);
        continue;
      }
      rock.push(0);
      if (glyph === ".") continue;
      const side = "1234".indexOf(glyph);
      if (side < 0) {
        throw new ArenaError(`unknown glyph "${glyph}" at (${x}, ${y})`);
      }
      if (onRing) {
        throw new ArenaError(`entry ${glyph} on the exit ring at (${x}, ${y})`);
      }
      stretches[side]!.push(cell);
    }
  }
  const sides = stretches.findIndex((cells) => cells.length === 0);
  const count = sides < 0 ? MAX_SIDES : sides;
  if (count < MIN_SIDES) {
    throw new ArenaError("needs the spawn zones 1 and 2");
  }
  if (stretches.slice(count).some((cells) => cells.length > 0)) {
    throw new ArenaError(`entry ${count + 1} is missing before a later one`);
  }
  const entries = stretches.slice(0, count).map((cells, side) => ({
    cells,
    facing: stretchFacing(width, height, cells, side),
  }));
  return { width, height, rock, entries };
}

/**
 * Where a spawn zone faces (spec S-1): away from the ring edge nearest to it,
 * by the zone's summed distance to each edge (integers, no centroid). A zone
 * as near to two edges faces the center along the axis it is farther from
 * the center on (a zone pushed toward the middle of a wide arena: junction
 * checkpoint C1-3); with no such axis it is refused.
 */
function stretchFacing(
  width: number,
  height: number,
  cells: readonly number[],
  side: number,
): Dir {
  // The summed distance to the left, right, top and bottom edges, each with
  // the direction pointing away from that edge.
  const sums: [number, Dir][] = [
    [0, "right"],
    [0, "left"],
    [0, "down"],
    [0, "up"],
  ];
  for (const cell of cells) {
    const x = cell % width;
    const y = Math.floor(cell / width);
    sums[0]![0] += x;
    sums[1]![0] += width - 1 - x;
    sums[2]![0] += y;
    sums[3]![0] += height - 1 - y;
  }
  const nearest = Math.min(...sums.map(([sum]) => sum));
  const away = sums.filter(([sum]) => sum === nearest);
  if (away.length === 1) return away[0]![1];
  // Twice the summed offset from the center, per axis (integers).
  const dx = sums[0]![0] - sums[1]![0];
  const dy = sums[2]![0] - sums[3]![0];
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "right" : "left";
  if (Math.abs(dy) > Math.abs(dx)) return dy < 0 ? "down" : "up";
  throw new ArenaError(
    `zone ${side + 1} is as near to two edges: no inward direction`,
  );
}

export function cellX(arena: Arena, cell: number): number {
  return cell % arena.width;
}

export function cellY(arena: Arena, cell: number): number {
  return Math.floor(cell / arena.width);
}

export function isRock(arena: Arena, cell: number): boolean {
  return arena.rock[cell] === 1;
}

/** A floor cell of the outer ring: standing there long enough escapes (D7). */
export function isExit(arena: Arena, cell: number): boolean {
  if (isRock(arena, cell)) return false;
  const x = cellX(arena, cell);
  const y = cellY(arena, cell);
  return x === 0 || y === 0 || x === arena.width - 1 || y === arena.height - 1;
}

/** The cell next to `cell` towards `dir`, or -1 off the grid. */
export function neighbor(arena: Arena, cell: number, dir: Dir): number {
  const x = cellX(arena, cell);
  const y = cellY(arena, cell);
  switch (dir) {
    case "up":
      return y > 0 ? cell - arena.width : -1;
    case "down":
      return y < arena.height - 1 ? cell + arena.width : -1;
    case "left":
      return x > 0 ? cell - 1 : -1;
    case "right":
      return x < arena.width - 1 ? cell + 1 : -1;
  }
}

/**
 * The clear line (plan section 8): the cells from the one in front of `cell`
 * towards `dir`, up to `range` of them, stopping before a rock or the grid's
 * edge. A target there is aligned within range.
 */
export function clearLine(
  arena: Arena,
  cell: number,
  dir: Dir,
  range: number,
): number[] {
  const line: number[] = [];
  let current = cell;
  for (let i = 0; i < range; i++) {
    current = neighbor(arena, current, dir);
    if (current < 0 || isRock(arena, current)) break;
    line.push(current);
  }
  return line;
}

export function opposite(dir: Dir): Dir {
  switch (dir) {
    case "up":
      return "down";
    case "down":
      return "up";
    case "left":
      return "right";
    case "right":
      return "left";
  }
}

/**
 * Steps from the nearest of `sources` to every cell, walking around rock
 * (plan section 9): a breadth-first search over floor. Cells in `blocked`
 * are not entered (sources too are skipped if blocked); -1 where no source
 * reaches. With `stopAt`, it stops as soon as that cell is reached: every
 * cell one step nearer to the sources already has its distance then. The
 * AI's hot path: it walks the grid by index, without neighbor().
 */
export function stepsFrom(
  arena: Arena,
  sources: readonly number[],
  blocked: ReadonlySet<number> | null = null,
  stopAt = -1,
): Int32Array {
  const { width, rock } = arena;
  const size = rock.length;
  const steps = new Int32Array(size).fill(-1);
  // -2 marks what cannot be entered: rock and blocked cells.
  for (let cell = 0; cell < size; cell++)
    if (rock[cell] === 1) steps[cell] = -2;
  if (blocked !== null) for (const cell of blocked) steps[cell] = -2;
  const queue = new Int32Array(size);
  let tail = 0;
  for (const cell of sources) {
    if (cell < 0 || cell >= size || steps[cell] !== -1) continue;
    steps[cell] = 0;
    queue[tail++] = cell;
  }
  if (stopAt >= 0 && steps[stopAt] === 0) return clean(steps);
  for (let head = 0; head < tail; head++) {
    const cell = queue[head]!;
    const next = steps[cell]! + 1;
    const x = cell % width;
    for (let k = 0; k < 4; k++) {
      let there: number;
      if (k === 0) there = cell >= width ? cell - width : -1;
      else if (k === 1) there = x < width - 1 ? cell + 1 : -1;
      else if (k === 2) there = cell < size - width ? cell + width : -1;
      else there = x > 0 ? cell - 1 : -1;
      if (there < 0 || steps[there] !== -1) continue;
      steps[there] = next;
      if (there === stopAt) return clean(steps);
      queue[tail++] = there;
    }
  }
  return clean(steps);
}

/** Turns the "cannot enter" marks back into "unreached". */
function clean(steps: Int32Array): Int32Array {
  for (let cell = 0; cell < steps.length; cell++) {
    if (steps[cell] === -2) steps[cell] = -1;
  }
  return steps;
}

const rockSteps = new WeakMap<Arena, (Int32Array | undefined)[]>();

/**
 * stepsFrom(arena, [cell]), around rock only, memoized per arena: it depends
 * on nothing else, and the AI asks for it on every decision. A pure cache
 * outside the state (a restored battle has a new arena object and fills its
 * own). The result is shared: never write to it.
 */
export function rockStepsFrom(arena: Arena, cell: number): Int32Array {
  let byCell = rockSteps.get(arena);
  if (byCell === undefined) {
    byCell = [];
    rockSteps.set(arena, byCell);
  }
  let steps = byCell[cell];
  if (steps === undefined) {
    steps = stepsFrom(arena, [cell]);
    byCell[cell] = steps;
  }
  return steps;
}

/**
 * The direction from `from` in which `to` is on the clear line within
 * `range` (aligned, with no rock between), or null.
 */
export function alignedDir(
  arena: Arena,
  from: number,
  to: number,
  range: number,
): Dir | null {
  const dx = cellX(arena, to) - cellX(arena, from);
  const dy = cellY(arena, to) - cellY(arena, from);
  let dir: Dir;
  let distance: number;
  if (dx === 0 && dy !== 0) {
    dir = dy < 0 ? "up" : "down";
    distance = dy < 0 ? -dy : dy;
  } else if (dy === 0 && dx !== 0) {
    dir = dx < 0 ? "left" : "right";
    distance = dx < 0 ? -dx : dx;
  } else {
    return null;
  }
  if (distance > range) return null;
  const line = clearLine(arena, from, dir, distance);
  return line.length === distance ? dir : null;
}

/** The floor cells of the exit ring, in index order (spec D7). */
export function exitCells(arena: Arena): number[] {
  const cells: number[] = [];
  for (let cell = 0; cell < arena.width * arena.height; cell++) {
    if (isExit(arena, cell)) cells.push(cell);
  }
  return cells;
}
