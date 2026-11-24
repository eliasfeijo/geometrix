// The lab's data: the battle params and the arenas of params/, imported as
// text by Vite (plan section 4: the package never reads files), checked like
// the CLI checks them; and each DNA's max HP and capacity, which the world's
// params own (junction spec D9, plan section 5).

import {
  DNAS,
  parseBattleParams,
  type BattleParams,
  type Dna,
} from "@geometrix/battle";
import aberta from "../../../../params/arenas/aberta.txt?raw";
import corredor from "../../../../params/arenas/corredor.txt?raw";
import pedras from "../../../../params/arenas/pedras.txt?raw";
import battleJson from "../../../../params/battle.json?raw";
import worldJson from "../../../../params/default.json?raw";

export const LAB_PARAMS: BattleParams = parseBattleParams(
  JSON.parse(battleJson),
);

/** A DNA's max HP and capacity, as the world gives them to a battle. */
export type Kit = { maxHp: number; capacity: number };

/**
 * The kits of params/default.json (`hp.dna.<dna>.max` and
 * `dna.<dna>.capacity`, the base capacity): read as JSON, not through the
 * sim, and checked to be positive integers.
 */
export function kitsOf(world: unknown): Record<Dna, Kit> {
  const at = (path: string[]): number => {
    let value: unknown = world;
    for (const key of path) {
      value =
        typeof value === "object" && value !== null
          ? (value as Record<string, unknown>)[key]
          : undefined;
    }
    if (!Number.isSafeInteger(value) || (value as number) < 1) {
      throw new Error(`world params: ${path.join(".")} must be >= 1`);
    }
    return value as number;
  };
  return Object.fromEntries(
    DNAS.map((dna) => [
      dna,
      {
        maxHp: at(["hp", "dna", dna, "max"]),
        capacity: at(["dna", dna, "capacity"]),
      },
    ]),
  ) as Record<Dna, Kit>;
}

export const LAB_KITS: Record<Dna, Kit> = kitsOf(JSON.parse(worldJson));

/** The lab's three arenas (spec D3); the 3× one is only for the report. */
export const ARENA_NAMES = ["aberta", "pedras", "corredor"] as const;
export type ArenaName = (typeof ARENA_NAMES)[number];

const rows = (text: string) => text.trimEnd().split("\n");

export const LAB_ARENAS: Record<ArenaName, string[]> = {
  aberta: rows(aberta),
  pedras: rows(pedras),
  corredor: rows(corredor),
};
