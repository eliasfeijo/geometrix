import { readFileSync } from "node:fs";
import { Terrain, type GameMap } from "../src/map.ts";
import { parseParams, type Params } from "../src/params.ts";
import { step } from "../src/step.ts";
import type { WorldState } from "../src/world.ts";

const DEFAULT_PARAMS_URL = new URL(
  "../../../params/default.json",
  import.meta.url,
);

/** params/default.json as parsed JSON, before validation. */
export function readDefaultParamsJson(): unknown {
  return JSON.parse(readFileSync(DEFAULT_PARAMS_URL, "utf8"));
}

/** params/default.json, validated. */
export function loadDefaultParams(): Params {
  return parseParams(readDefaultParamsJson());
}

/** `.` jungle · `r` road on jungle · `=` crossing · `~` river · `#` rock */
export function parseMap(rows: string[]): GameMap {
  const terrainOf: Record<string, number> = {
    ".": Terrain.jungle,
    r: Terrain.jungle,
    "=": Terrain.crossing,
    "~": Terrain.river,
    "#": Terrain.rock,
  };
  const cells = rows.join("").split("");
  return {
    width: rows[0]!.length,
    height: rows.length,
    terrain: cells.map((c) => terrainOf[c]!) as GameMap["terrain"],
    road: cells.map((c) => (c === "r" ? 1 : 0)),
  };
}

/** Steps the world `ticks` times with no commands. */
export function run(world: WorldState, ticks: number): void {
  for (let i = 0; i < ticks; i++) step(world, []);
}
