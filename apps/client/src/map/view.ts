// Pan and zoom of the map (plan section 8: they move the SVG viewBox). One SVG
// unit is one cell; the view is a center in cells and a scale in pixels per
// cell, so resizing the window keeps what is in the middle.

import type { Cell } from "@geometrix/sim";

export type View = { cx: number; cy: number; scale: number };
export type Size = { width: number; height: number };
export type Point = { x: number; y: number };
export type MapSize = { width: number; height: number };

/** Closest zoom: a cell this many pixels wide. */
export const MAX_SCALE = 96;
/** Farthest zoom, as a fraction of the scale that fits the whole map. */
export const MIN_FIT_FRACTION = 0.5;
/** Margin around the map when fitting it, in cells. */
const FIT_MARGIN = 1;

export function fitScale(map: MapSize, size: Size): number {
  const w = map.width + 2 * FIT_MARGIN;
  const h = map.height + 2 * FIT_MARGIN;
  return Math.max(Math.min(size.width / w, size.height / h), 1e-3);
}

/** The whole map, centered. */
export function fitView(map: MapSize, size: Size): View {
  return { cx: map.width / 2, cy: map.height / 2, scale: fitScale(map, size) };
}

export function scaleLimits(map: MapSize, size: Size) {
  const fit = fitScale(map, size);
  return { min: Math.min(fit * MIN_FIT_FRACTION, MAX_SCALE), max: MAX_SCALE };
}

/** Keeps the scale within limits and the center over the map. */
export function clampView(view: View, map: MapSize, size: Size): View {
  const { min, max } = scaleLimits(map, size);
  return {
    cx: clamp(view.cx, 0, map.width),
    cy: clamp(view.cy, 0, map.height),
    scale: clamp(view.scale, min, max),
  };
}

export function viewBox(view: View, size: Size) {
  const w = size.width / view.scale;
  const h = size.height / view.scale;
  return { x: view.cx - w / 2, y: view.cy - h / 2, w, h };
}

export function viewBoxAttribute(view: View, size: Size): string {
  const { x, y, w, h } = viewBox(view, size);
  return `${x} ${y} ${w} ${h}`;
}

/** Map coordinates (cells, fractional) under a pixel of the map element. */
export function toMap(view: View, size: Size, px: Point): Point {
  const box = viewBox(view, size);
  return { x: box.x + px.x / view.scale, y: box.y + px.y / view.scale };
}

/** The cell under a point in map coordinates. */
export const cellAt = (p: Point): Cell => ({
  x: Math.floor(p.x),
  y: Math.floor(p.y),
});

/** Zooms by `factor`, keeping the map point under `px` where it is. */
export function zoomAt(
  view: View,
  size: Size,
  px: Point,
  factor: number,
  map: MapSize,
): View {
  const { min, max } = scaleLimits(map, size);
  const scale = clamp(view.scale * factor, min, max);
  const anchor = toMap(view, size, px);
  // The anchor stays at the same pixel: center = anchor - offset / scale.
  const cx = anchor.x - (px.x - size.width / 2) / scale;
  const cy = anchor.y - (px.y - size.height / 2) / scale;
  return clampView({ cx, cy, scale }, map, size);
}

/** Moves the view so the map follows a drag of (dx, dy) pixels. */
export function panBy(
  view: View,
  size: Size,
  dx: number,
  dy: number,
  map: MapSize,
): View {
  return clampView(
    { ...view, cx: view.cx - dx / view.scale, cy: view.cy - dy / view.scale },
    map,
    size,
  );
}

/** Centers the view on a cell, keeping the zoom. */
export function centerOn(view: View, cell: Point, map: MapSize, size: Size) {
  return clampView({ ...view, cx: cell.x + 0.5, cy: cell.y + 0.5 }, map, size);
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);

/** Smallest on-screen size of a marker (creep, deposit), in pixels. */
export const MIN_MARKER_PX = 22;
/** Most a marker grows past its cell size when zoomed out. */
export const MAX_MARKER_SCALE = 2;

/**
 * How much to enlarge markers about a cell wide so they stay legible zoomed
 * out: 1 when zoomed in, up to MAX_MARKER_SCALE.
 */
export function markerScale(scale: number): number {
  return clamp(MIN_MARKER_PX / scale, 1, MAX_MARKER_SCALE);
}
