// Movement points (plan section 3). A creep gains points every tick and enters
// the next cell of its path once it has CELL_COST points. The gain depends on
// the DNA speed and on per-mille modifiers for the cell being entered (road,
// else terrain) and for carrying cargo.

import { Terrain, type GameMap } from "./map.ts";
import type { Params } from "./params.ts";
import type { Creep } from "./world.ts";

/** Points needed to enter one cell. Divisible by 60, so cells per minute map to whole points per second. */
export const CELL_COST = 60_000;

const PERMILLE = 1000;

/**
 * Per-mille speed modifier for entering cell `index`: the road modifier if a
 * road is built there, else the terrain's. 0 for impassable cells.
 */
export function cellModifier(
  map: GameMap,
  index: number,
  params: Params,
): number {
  const { movementPermille } = params;
  const terrain = map.terrain[index];
  if (terrain !== Terrain.jungle && terrain !== Terrain.crossing) return 0;
  if (map.road[index] === 1) return movementPermille.road;
  return terrain === Terrain.jungle
    ? movementPermille.jungle
    : movementPermille.crossing;
}

export function isLoaded(creep: Pick<Creep, "cargo">): boolean {
  return creep.cargo.materia + creep.cargo.cristal > 0;
}

/**
 * Points the creep (or a wanderer, at its DNA's speed) gains this tick while
 * heading into cell `index`.
 */
export function movePointsPerTick(
  creep: Pick<Creep, "dna" | "cargo">,
  map: GameMap,
  index: number,
  params: Params,
): number {
  const { cellsPerMinute } = params.dna[creep.dna];
  const base = (cellsPerMinute * CELL_COST * params.world.tickSeconds) / 60;
  const load = isLoaded(creep) ? params.movementPermille.loaded : PERMILLE;
  const modifier = cellModifier(map, index, params);
  return Math.floor((base * modifier * load) / (PERMILLE * PERMILLE));
}

/**
 * The creep's speed where it stands, in points per tick: its DNA, its cargo
 * and its own cell, without the flee bonus (M2 encontro spec D10, plan P11).
 * The chance to escape weighs it against the opponent's.
 */
export function speedHere(creep: Creep, map: GameMap, params: Params): number {
  return movePointsPerTick(creep, map, creep.y * map.width + creep.x, params);
}
