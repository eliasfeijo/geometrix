// The map the team knows as few SVG elements: runs of equal terrain along each row.

import { Terrain } from "@geometrix/sim";

/** Terrain per cell from a view's known array: never seen is jungle. */
export function knownTerrain(known: readonly number[]): Terrain[] {
  return known.map((t) => (t < 0 ? Terrain.jungle : (t as Terrain)));
}

export type Run = { terrain: Terrain; x: number; y: number; length: number };

/** Horizontal runs of every terrain but jungle (jungle is the background). */
export function terrainRuns(map: {
  width: number;
  height: number;
  terrain: readonly number[];
}): Run[] {
  const runs: Run[] = [];
  for (let y = 0; y < map.height; y++) {
    let x = 0;
    while (x < map.width) {
      const terrain = map.terrain[y * map.width + x] as Terrain;
      let end = x + 1;
      while (end < map.width && map.terrain[y * map.width + end] === terrain)
        end++;
      if (terrain !== Terrain.jungle) {
        runs.push({ terrain, x, y, length: end - x });
      }
      x = end;
    }
  }
  return runs;
}

/** Road cells as runs along each row, from the cell indices on the wire. */
export function roadRuns(
  roads: readonly number[],
  width: number,
): { x: number; y: number; length: number }[] {
  const runs: { x: number; y: number; length: number }[] = [];
  const sorted = [...roads].sort((a, b) => a - b);
  for (const index of sorted) {
    const x = index % width;
    const y = Math.floor(index / width);
    const last = runs[runs.length - 1];
    if (last !== undefined && last.y === y && last.x + last.length === x) {
      last.length++;
    } else {
      runs.push({ x, y, length: 1 });
    }
  }
  return runs;
}

/**
 * Road cells with a road right below: the runs are horizontal, so these joins
 * keep a vertical road one continuous strip (F9, owner decision).
 */
export function roadJoinsDown(
  roads: readonly number[],
  width: number,
): { x: number; y: number }[] {
  const set = new Set(roads);
  return [...roads]
    .sort((a, b) => a - b)
    .filter((index) => set.has(index + width))
    .map((index) => ({ x: index % width, y: Math.floor(index / width) }));
}

/** Width of a rock's lit and shaded edges, in cells. */
export const ROCK_EDGE = 0.14;

/**
 * The relief of the rocks as two SVG paths (F9, owner decision): a lit edge
 * on the sides that face up or left and a shaded one on those that face down
 * or right, wherever the neighbor is not rock. The map's outside counts as
 * rock, so the border gets no edge. Edges sit inside the rock cell.
 */
export function rockEdges(map: {
  width: number;
  height: number;
  terrain: readonly number[];
}): { lit: string; shade: string } {
  const rock = (x: number, y: number) =>
    x < 0 ||
    y < 0 ||
    x >= map.width ||
    y >= map.height ||
    map.terrain[y * map.width + x] === Terrain.rock;
  const half = ROCK_EDGE / 2;
  const lit: string[] = [];
  const shade: string[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (!rock(x, y)) continue;
      if (!rock(x, y - 1)) lit.push(`M${x} ${y + half}h1`);
      if (!rock(x - 1, y)) lit.push(`M${x + half} ${y}v1`);
      if (!rock(x, y + 1)) shade.push(`M${x} ${y + 1 - half}h1`);
      if (!rock(x + 1, y)) shade.push(`M${x + 1 - half} ${y}v1`);
    }
  }
  return { lit: lit.join(""), shade: shade.join("") };
}
