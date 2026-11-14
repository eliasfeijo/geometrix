// SHA-256 with the Web Crypto API, as hex: the view hash a delta carries
// (M1.5 spec C-3) and, in the replay, the state hash of geo verify.

import { viewJson } from "@geometrix/protocol/stream";
import type { TeamView } from "@geometrix/sim";

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** The server's viewHash: sha256 of viewJson(view). */
export function viewHash(view: TeamView): Promise<string> {
  return sha256Hex(viewJson(view));
}
