import { readFileSync } from "node:fs";
import {
  parseBattleParams,
  type BattleParams,
  type Dna,
} from "../src/params.ts";
import type { BattleSetup, ParticipantSetup } from "../src/setup.ts";

const DEFAULT_PARAMS_URL = new URL(
  "../../../params/battle.json",
  import.meta.url,
);
const TEST_PARAMS_URL = new URL("./params.json", import.meta.url);

/** params/battle.json as parsed JSON, before validation. */
export function readDefaultParamsJson(): unknown {
  return JSON.parse(readFileSync(DEFAULT_PARAMS_URL, "utf8"));
}

/**
 * test/params.json as parsed JSON: the fixed params the tests run on (the
 * spec section 6 values). They do not follow balancing, so a new
 * params/battle.json does not break tests that spell out speeds and damage.
 */
export function readTestParamsJson(): unknown {
  return JSON.parse(readFileSync(TEST_PARAMS_URL, "utf8"));
}

/** test/params.json, validated. */
export function loadTestParams(): BattleParams {
  return parseBattleParams(readTestParamsJson());
}

export const ARENA_NAMES = ["aberta", "pedras", "corredor"] as const;

/** An arena of params/arenas, one string per row. */
export function readArenaRows(name: string): string[] {
  const url = new URL(`../../../params/arenas/${name}.txt`, import.meta.url);
  return readFileSync(url, "utf8").trimEnd().split("\n");
}

/** A participant of the setup, at full HP and with no carry unless given. */
export function member(
  dna: Dna,
  overrides: Partial<ParticipantSetup> = {},
): ParticipantSetup {
  // An unknown DNA (to test the refusal) gets HP 1.
  const hp = (loadTestParams().dna[dna] as { hp: number } | undefined)?.hp ?? 1;
  return {
    name: dna,
    dna,
    hp,
    carry: { materia: 0, cristal: 0 },
    ...overrides,
  };
}

export function setupOf(
  arena: string[],
  sides: ParticipantSetup[][],
  seed = 42,
): BattleSetup {
  return { rule: "grid", arena, seed, sides };
}

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };

/** test/params.json changed by `edit`, then validated. */
export function paramsWith(
  edit: (params: Mutable<BattleParams>) => void,
): BattleParams {
  const params = readTestParamsJson() as Mutable<BattleParams>;
  edit(params);
  return parseBattleParams(params);
}
