// What the battle screen calls things, in Portuguese, shared by the lab and
// the world client's battle screen (junction plan P10): the DNA glyphs, the
// outcomes and the side letters.

import type { Dna, Outcome } from "@geometrix/battle";

export const DNA_GLYPHS: Record<Dna, string> = {
  square: "■",
  triangle: "▲",
  circle: "●",
};

export const OUTCOME_LABELS: Record<Outcome | "won", string> = {
  won: "venceu",
  died: "morreu",
  escapedEdge: "fugiu pela borda",
  escapedIdle: "fugiu por inatividade",
};

/** Side 0 is A, side 1 is B, and so on. */
export const sideLetter = (side: number): string => "ABCD"[side] ?? "?";
