// Vision (M1.5 fog plan section 3, spec V-1, decision N2). A cell is in sight
// of a viewer within Manhattan radius r when no rock lies strictly between the
// two on the integer Bresenham line from the viewer to the cell; the rock
// itself is seen. River and crossings do not block. The line is traced in the
// team's frame, like paths (isRotatedSide): on the rotated side the tracer
// works on the map rotated 180°, so what team 1 sees is the exact mirror of
// what team 0 sees from the mirrored cell. (This Bresenham depends only on
// the offset's magnitudes and signs, so it is point-symmetric already; the
// frame keeps the guarantee if the tracer ever changes.)

import { Terrain, type Cell, type GameMap } from "./map.ts";

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
