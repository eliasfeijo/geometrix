// Where the arena draws things between two frames (plan P8): one tick of
// interpolation, from the previous view to the current one, so the page runs
// one tick behind and a creep glides from cell to cell. With the
// interpolation off, everything jumps to the current cell (the BYOND look,
// for the owner to compare).

import type { BattleView } from "@geometrix/battle";

export type Point = { x: number; y: number };

/** How far (0..1) the glide to the frame that arrived at `arrivedAt` is. */
export function glideProgress(
  arrivedAt: number,
  now: number,
  glideMs: number,
  on: boolean,
): number {
  if (!on || glideMs <= 0) return 1;
  return Math.min(Math.max((now - arrivedAt) / glideMs, 0), 1);
}

export function cellPoint(width: number, cell: number): Point {
  return { x: cell % width, y: Math.floor(cell / width) };
}

/**
 * The drawn position (top-left of the cell, in cells) of everything in
 * `current` with an id: between its cell in `previous` and its cell now. A
 * thing that was not there, or moved more than one cell (entered, or a
 * projectile that was born), is drawn at its cell.
 */
export function positions(
  width: number,
  previous: BattleView | null,
  current: BattleView,
  t: number,
): { participants: Map<number, Point>; projectiles: Map<number, Point> } {
  const glide = (
    before: { id: number; cell: number }[],
    now: { id: number; cell: number }[],
  ) => {
    const from = new Map(before.map((b) => [b.id, b.cell]));
    const out = new Map<number, Point>();
    for (const thing of now) {
      const to = cellPoint(width, thing.cell);
      const was = from.get(thing.id);
      if (was === undefined) {
        out.set(thing.id, to);
        continue;
      }
      const a = cellPoint(width, was);
      if (Math.abs(a.x - to.x) + Math.abs(a.y - to.y) > 2) {
        out.set(thing.id, to);
        continue;
      }
      out.set(thing.id, {
        x: a.x + (to.x - a.x) * t,
        y: a.y + (to.y - a.y) * t,
      });
    }
    return out;
  };
  return {
    participants: glide(previous?.participants ?? [], current.participants),
    projectiles: glide(previous?.projectiles ?? [], current.projectiles),
  };
}
