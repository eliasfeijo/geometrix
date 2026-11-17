// The arena (spec D3, plan section 4): a small grid drawn in text, with the
// exit ring included. It is setup data, not a param: the package is pure and
// never reads files (the CLI reads params/arenas/, the client imports them).
//
//   .      floor
//   #      rock: blocks movement and projectiles
//   1..4   floor of the entry stretch of side 0..3
//
// The outer row and column on each edge are the exit ring (spec D7): floor or
// rock only. Entry stretches sit on the first inner lap, against the ring and
// off its corners, so whoever spawns is not on an exit and faces inward.

export type Dir = "up" | "right" | "down" | "left";
export const DIRS: readonly Dir[] = ["up", "right", "down", "left"];

export type Entry = {
  /** Floor cells of the stretch, in index order. */
  cells: number[];
  /** Inward, away from the ring the stretch is against. */
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
    throw new ArenaError("must be at least 5 × 5 (ring, entry lap, middle)");
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
    throw new ArenaError("needs the entry stretches 1 and 2");
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

/** The inward direction of a stretch, whose cells all touch one ring edge. */
function stretchFacing(
  width: number,
  height: number,
  cells: readonly number[],
  side: number,
): Dir {
  const edgeOf = (cell: number): Dir | null => {
    const x = cell % width;
    const y = Math.floor(cell / width);
    const edges: Dir[] = [];
    if (x === 1) edges.push("right");
    if (x === width - 2) edges.push("left");
    if (y === 1) edges.push("down");
    if (y === height - 2) edges.push("up");
    return edges.length === 1 ? edges[0]! : null;
  };
  const facing = edgeOf(cells[0]!);
  if (facing === null || cells.some((cell) => edgeOf(cell) !== facing)) {
    throw new ArenaError(
      `entry ${side + 1} must lie along one edge of the first inner lap, off its corners`,
    );
  }
  return facing;
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
 * (plan section 9): a breadth-first search over floor, in DIRS order. Cells
 * in `blocked` are not entered (sources too are skipped if blocked); -1 where
 * no source reaches. With `stopAt`, it stops as soon as that cell is reached:
 * every cell one step nearer to the sources already has its distance then.
 */
export function stepsFrom(
  arena: Arena,
  sources: readonly number[],
  blocked: ReadonlySet<number> | null = null,
  stopAt = -1,
): number[] {
  const steps = new Array<number>(arena.width * arena.height).fill(-1);
  const queue: number[] = [];
  for (const cell of sources) {
    if (steps[cell] !== -1 || isRock(arena, cell)) continue;
    if (blocked?.has(cell) === true) continue;
    steps[cell] = 0;
    queue.push(cell);
  }
  if (stopAt >= 0 && steps[stopAt] === 0) return steps;
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]!;
    const next = steps[cell]! + 1;
    for (const dir of DIRS) {
      const there = neighbor(arena, cell, dir);
      if (there < 0 || steps[there] !== -1 || isRock(arena, there)) continue;
      if (blocked?.has(there) === true) continue;
      steps[there] = next;
      if (there === stopAt) return steps;
      queue.push(there);
    }
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
