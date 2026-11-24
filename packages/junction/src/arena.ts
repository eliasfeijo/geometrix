// The arena of a world battle (junction spec D5, O-4; plan P7): the battle's
// window of world cells, each drawn as a `cellBlock` × `cellBlock` block of
// arena cells, plus the exit ring. Rock stays rock; river, ford, road and
// jungle become floor. North stays up. The four spawn zones are always floor:
// sides 0 and 1 on the left and right, halfway between the border and the
// center, sides 2 and 3 at the top and bottom, as in the lab's arenas.

import {
  isStandable,
  Terrain,
  type BattleWindow,
  type Cell,
  type WorldState,
} from "@geometrix/sim";

/** The exit ring: one arena cell on each edge (battle spec D7). */
const RING = 1;

export type ArenaShape = { width: number; height: number };

/** Width and height of the arena of `window`, ring included. */
export function arenaShape(
  state: WorldState,
  window: BattleWindow,
): ArenaShape {
  const { cellBlock } = state.params.battle.window;
  return {
    width: window.width * cellBlock + 2 * RING,
    height: window.height * cellBlock + 2 * RING,
  };
}

/** A zone: a rectangle of arena cells, both ends inclusive. */
type Rect = { x0: number; y0: number; x1: number; y1: number };

/** The four spawn zones, by side (P7). */
function zones(state: WorldState, shape: ArenaShape): Rect[] {
  const { depth, breadth } = state.params.battle.zone;
  const cx = Math.floor((shape.width - 1) / 2);
  const cy = Math.floor((shape.height - 1) / 2);
  // Halfway between the border and the center.
  const qx = Math.floor(cx / 2);
  const qy = Math.floor(cy / 2);
  const d = (depth - 1) / 2;
  const b = (breadth - 1) / 2;
  const across = (x: number): Rect => ({
    x0: x - d,
    x1: x + d,
    y0: cy - b,
    y1: cy + b,
  });
  const along = (y: number): Rect => ({
    x0: cx - b,
    x1: cx + b,
    y0: y - d,
    y1: y + d,
  });
  return [
    across(qx),
    across(shape.width - 1 - qx),
    along(qy),
    along(shape.height - 1 - qy),
  ];
}

export class JunctionArenaError extends Error {
  constructor(message: string) {
    super(`junction arena: ${message}`);
    this.name = "JunctionArenaError";
  }
}

/**
 * The world cell under arena cell (`ax`, `ay`) before the walkable fix:
 * floor division by the block; the ring maps to the window's outer cells.
 */
function cellUnder(
  state: WorldState,
  window: BattleWindow,
  ax: number,
  ay: number,
): Cell {
  const { cellBlock } = state.params.battle.window;
  const clamp = (value: number, max: number) =>
    Math.min(Math.max(value, 0), max);
  return {
    x: window.x + clamp(Math.floor((ax - RING) / cellBlock), window.width - 1),
    y: window.y + clamp(Math.floor((ay - RING) / cellBlock), window.height - 1),
  };
}

/**
 * The arena of a battle, in the battle package's text (O-4): `#` where the
 * world cell under it is rock, `1`–`4` the spawn zones, `.` elsewhere.
 */
export function arenaOf(state: WorldState, window: BattleWindow): string[] {
  const shape = arenaShape(state, window);
  const rects = zones(state, shape);
  for (const [i, r] of rects.entries()) {
    if (
      r.x0 < RING ||
      r.y0 < RING ||
      r.x1 > shape.width - 1 - RING ||
      r.y1 > shape.height - 1 - RING
    ) {
      throw new JunctionArenaError(
        `zone ${i + 1} does not fit inside the ring`,
      );
    }
  }
  const rows: string[] = [];
  for (let ay = 0; ay < shape.height; ay++) {
    let row = "";
    for (let ax = 0; ax < shape.width; ax++) {
      const zone = rects.findIndex(
        (r) => ax >= r.x0 && ax <= r.x1 && ay >= r.y0 && ay <= r.y1,
      );
      if (zone >= 0) {
        row += String(zone + 1);
        continue;
      }
      const cell = cellUnder(state, window, ax, ay);
      const terrain = state.map.terrain[cell.y * state.map.width + cell.x];
      row += terrain === Terrain.rock ? "#" : ".";
    }
    rows.push(row);
  }
  return rows;
}

/**
 * The world cell a creep or a pile comes back on from arena cell `cell` (D7,
 * D8): the cell under it, or, when a creep cannot stand there (rock, river),
 * the nearest one it can, by a breadth-first search over the map in the
 * order up, right, down, left.
 */
export function worldCellOf(
  state: WorldState,
  window: BattleWindow,
  cell: number,
): Cell {
  const shape = arenaShape(state, window);
  const start = cellUnder(
    state,
    window,
    cell % shape.width,
    Math.floor(cell / shape.width),
  );
  if (isStandable(state, start)) return start;
  const { width, height } = state.map;
  const seen = new Uint8Array(width * height);
  const queue: Cell[] = [start];
  seen[start.y * width + start.x] = 1;
  const steps = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head]!;
    for (const step of steps) {
      const next = { x: at.x + step.x, y: at.y + step.y };
      if (next.x < 0 || next.y < 0 || next.x >= width || next.y >= height) {
        continue;
      }
      const i = next.y * width + next.x;
      if (seen[i] === 1) continue;
      seen[i] = 1;
      if (isStandable(state, next)) return next;
      queue.push(next);
    }
  }
  throw new JunctionArenaError("no walkable cell in the map");
}
