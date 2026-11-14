// Where each creep is drawn. Creeps do not collide in the sim, so several can
// share a cell; each one stays its own marker (it can differ from the others,
// and the player must be able to pick it). Zoomed in, the creeps of a cell sit
// side by side in a grid of slots; zoomed out, when a slot would be too small
// to tell them apart, the cell shows one stack with a count instead.

import type { Point } from "./view.ts";
import { markerScale } from "./view.ts";

type Placed = { id: number; x: number; y: number };

/** One creep; `scale` multiplies the size of a lone creep at close zoom. */
export type CreepMarker = Point & { kind: "creep"; id: number; scale: number };

/** Creeps of one cell drawn as one marker: `lead` is the one shown. */
export type StackMarker = Point & {
  kind: "stack";
  ids: number[];
  lead: number;
  scale: number;
};

export type Marker = CreepMarker | StackMarker;

/** Smallest on-screen slot (pixels) that still shows creeps side by side. */
export const MIN_SLOT_PX = 18;
/** Hit radius of a marker, in cells, before its scale. */
export const HIT_RADIUS = 0.5;

/** Columns and rows of slots for `n` creeps in a cell: 2 → 2×1, 4 → 2×2. */
export function slotGrid(n: number): { cols: number; rows: number } {
  const cols = Math.ceil(Math.sqrt(n));
  return { cols, rows: Math.ceil(n / cols) };
}

/** Side of a slot, as a fraction of the cell. */
export function slotSize(n: number): number {
  const { cols, rows } = slotGrid(n);
  return 1 / Math.max(cols, rows);
}

/**
 * Markers for the creeps, grouped by their current cell. `positions` are the
 * glided top-left corners; `viewScale` is pixels per cell; `lead` picks which
 * creep of a stack is shown.
 */
export function layoutCreeps(
  creeps: readonly Placed[],
  positions: ReadonlyMap<number, Point>,
  viewScale: number,
  lead: (ids: number[]) => number,
): Marker[] {
  const byCell = new Map<string, Placed[]>();
  for (const creep of creeps) {
    const key = `${creep.x},${creep.y}`;
    const group = byCell.get(key);
    if (group === undefined) byCell.set(key, [creep]);
    else group.push(creep);
  }
  const markers: Marker[] = [];
  const at = (creep: Placed) => positions.get(creep.id) ?? creep;
  for (const unsorted of byCell.values()) {
    const group = [...unsorted].sort((a, b) => a.id - b.id);
    if (group.length === 1) {
      const p = at(group[0]!);
      markers.push({
        kind: "creep",
        id: group[0]!.id,
        x: p.x + 0.5,
        y: p.y + 0.5,
        scale: markerScale(viewScale),
      });
      continue;
    }
    const size = slotSize(group.length);
    if (viewScale * size < MIN_SLOT_PX) {
      const ids = group.map((c) => c.id);
      const shown = lead(ids);
      const p = at(group.find((c) => c.id === shown) ?? group[0]!);
      markers.push({
        kind: "stack",
        ids,
        lead: shown,
        x: p.x + 0.5,
        y: p.y + 0.5,
        scale: markerScale(viewScale),
      });
      continue;
    }
    const { cols, rows } = slotGrid(group.length);
    group.forEach((creep, i) => {
      const p = at(creep);
      const col = i % cols;
      const row = Math.floor(i / cols);
      markers.push({
        kind: "creep",
        id: creep.id,
        x: p.x + 0.5 + (col - (cols - 1) / 2) * size,
        y: p.y + 0.5 + (row - (rows - 1) / 2) * size,
        scale: size,
      });
    });
  }
  return markers;
}

/** The marker under a point (map coordinates), the nearest if several. */
export function markerAt(point: Point, markers: readonly Marker[]) {
  let best: Marker | null = null;
  let bestDistance = Infinity;
  for (const marker of markers) {
    const d = Math.hypot(marker.x - point.x, marker.y - point.y);
    if (d <= HIT_RADIUS * marker.scale && d < bestDistance) {
      best = marker;
      bestDistance = d;
    }
  }
  return best;
}

/** The marker that draws creep `id`. */
export function markerOf(markers: readonly Marker[], id: number) {
  return markers.find((m) =>
    m.kind === "creep" ? m.id === id : m.ids.includes(id),
  );
}
