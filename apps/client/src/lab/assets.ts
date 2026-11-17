// The lab's data: the battle params and the arenas of params/, imported as
// text by Vite (plan section 4: the package never reads files), checked like
// the CLI checks them.

import { parseBattleParams, type BattleParams } from "@geometrix/battle";
import aberta from "../../../../params/arenas/aberta.txt?raw";
import corredor from "../../../../params/arenas/corredor.txt?raw";
import pedras from "../../../../params/arenas/pedras.txt?raw";
import battleJson from "../../../../params/battle.json?raw";

export const LAB_PARAMS: BattleParams = parseBattleParams(
  JSON.parse(battleJson),
);

/** The lab's three arenas (spec D3); the 3× one is only for the report. */
export const ARENA_NAMES = ["aberta", "pedras", "corredor"] as const;
export type ArenaName = (typeof ARENA_NAMES)[number];

const rows = (text: string) => text.trimEnd().split("\n");

export const LAB_ARENAS: Record<ArenaName, string[]> = {
  aberta: rows(aberta),
  pedras: rows(pedras),
  corredor: rows(corredor),
};
