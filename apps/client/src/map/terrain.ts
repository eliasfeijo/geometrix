// The static map as few SVG elements: runs of equal terrain along each row.

import { Terrain } from "@geometrix/sim";

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
