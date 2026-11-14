// Creep positions between the two latest states (plan section 8): the map
// shows the previous state when the current one arrives and glides to it over
// the time between the two messages, so it runs one message behind.

import type { DynamicState } from "@geometrix/protocol";
import type { Cell } from "@geometrix/sim";
import type { Point } from "./view.ts";

export type Timed = { state: DynamicState; at: number };

/** Bounds on the glide time, in ms (messages come at most 5 per second). */
export const MIN_GLIDE_MS = 50;
export const MAX_GLIDE_MS = 1000;
/** A creep that moved farther than this between messages jumps instead. */
export const MAX_GLIDE_CELLS = 4;

/** How far (0..1) the glide from `previous` to `current` is at `now`. */
export function glideProgress(
  previous: Timed | null,
  current: Timed,
  now: number,
): number {
  if (previous === null) return 1;
  const span = clamp(current.at - previous.at, MIN_GLIDE_MS, MAX_GLIDE_MS);
  return clamp((now - current.at) / span, 0, 1);
}

/** Where a creep is drawn: between its two cells, or at the current one. */
export function glide(from: Cell | undefined, to: Cell, t: number): Point {
  if (
    from === undefined ||
    Math.abs(from.x - to.x) + Math.abs(from.y - to.y) > MAX_GLIDE_CELLS
  ) {
    return { x: to.x, y: to.y };
  }
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

/** Drawn position (top-left of the cell, in cells) of every current creep. */
export function creepPositions(
  previous: DynamicState | null,
  current: DynamicState,
  t: number,
): Map<number, Point> {
  const before = new Map<number, Cell>();
  for (const creep of previous?.creeps ?? []) before.set(creep.id, creep);
  const positions = new Map<number, Point>();
  for (const creep of current.creeps) {
    positions.set(creep.id, glide(before.get(creep.id), creep, t));
  }
  return positions;
}

/**
 * Offsets that spread `n` creeps sharing a cell around its center, so a
 * crowd at a deposit reads as several creeps. Index 0 of 1 stays centered.
 */
export function crowdOffsets(n: number): Point[] {
  if (n <= 1) return [{ x: 0, y: 0 }];
  const radius = n <= 4 ? 0.2 : 0.26;
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n - Math.PI / 2;
    return { x: radius * Math.cos(a), y: radius * Math.sin(a) };
  });
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);
