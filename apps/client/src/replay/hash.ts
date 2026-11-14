// The state hash of geo verify and the server (sha256 of serialize(state)),
// with the Web Crypto API instead of node:crypto.

import { serialize, type WorldState } from "@geometrix/sim";
import { sha256Hex } from "../hash.ts";

export function stateHash(state: WorldState): Promise<string> {
  return sha256Hex(serialize(state));
}
