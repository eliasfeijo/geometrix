import { createHash } from "node:crypto";
import { serialize, type WorldState } from "@geometrix/sim";

/** sha256 of the canonical serialization (plan section 3). */
export function stateHash(state: WorldState): string {
  return createHash("sha256").update(serialize(state)).digest("hex");
}
