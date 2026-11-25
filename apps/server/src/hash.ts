import { createHash } from "node:crypto";
import { serializeBattle, type BattleState } from "@geometrix/battle";
import { viewJson } from "@geometrix/protocol";
import { serialize, type TeamView, type WorldState } from "@geometrix/sim";

/** sha256 of the canonical serialization (plan section 3), as geo verify. */
export function stateHash(state: WorldState): string {
  return createHash("sha256").update(serialize(state)).digest("hex");
}

/** sha256 of a team's view as viewJson: the hash a delta carries (S-4). */
export function viewHash(seen: TeamView): string {
  return createHash("sha256").update(viewJson(seen)).digest("hex");
}

/** sha256 of serializeBattle, as the lab and `geo battle verify`. */
export function battleHash(state: BattleState): string {
  return createHash("sha256").update(serializeBattle(state)).digest("hex");
}
