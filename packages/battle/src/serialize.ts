// Snapshots of a battle (spec S-3, plan section 11): canonical JSON, the same
// string for the same state. The hash (sha256 of this string) is computed
// outside the package.

import { canonicalJson } from "./canonical.ts";
import { parseBattleParams } from "./params.ts";
import { BATTLE_VERSION, type BattleState } from "./state.ts";

/** Throws a TypeError on anything that is not plain JSON data (Map, Set…). */
export function serializeBattle(state: BattleState): string {
  return canonicalJson(state, "state");
}

export class BattleVersionError extends Error {
  constructor(found: unknown) {
    super(
      `battle snapshot is from version ${String(found)}, this is ${BATTLE_VERSION}`,
    );
    this.name = "BattleVersionError";
  }
}

/** Rebuilds a battle from `serializeBattle` output. */
export function restoreBattle(json: string): BattleState {
  const data: unknown = JSON.parse(json);
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new TypeError("battle snapshot: expected an object");
  }
  const { battleVersion, params } = data as Record<string, unknown>;
  if (battleVersion !== BATTLE_VERSION) {
    throw new BattleVersionError(battleVersion);
  }
  parseBattleParams(params);
  return data as BattleState;
}
