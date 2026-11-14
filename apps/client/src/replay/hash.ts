// The state hash of geo verify and the server (sha256 of serialize(state)),
// with the Web Crypto API instead of node:crypto.

import { serialize, type WorldState } from "@geometrix/sim";

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function stateHash(state: WorldState): Promise<string> {
  return sha256Hex(serialize(state));
}
