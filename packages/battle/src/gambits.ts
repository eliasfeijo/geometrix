// The gambits vocabulary (spec D14, plan section 9): an ordered list of
// condition → action per participant. F1 only defines the types, which the
// state carries; the evaluation comes with the AI (F3).

import type { Dna } from "./params.ts";

export type Target =
  { by: "nearest" } | { by: "weakest" } | { by: "dna"; dna: Dna };

export type Condition =
  | { type: "always" }
  | { type: "hpBelow"; permille: number }
  | { type: "enemyWithin"; cells: number }
  /** An enemy within range, with a clear line. */
  | { type: "enemyAligned" }
  /** An enemy projectile whose line passes through me. */
  | { type: "projectileIncoming" }
  | { type: "carryAbove"; permille: number }
  | { type: "allyHpBelow"; permille: number; cells: number };

export type Action =
  | { type: "attack"; target: Target }
  | { type: "approach"; target: Target }
  | { type: "keepDistance"; target: Target }
  | { type: "dodge" }
  | { type: "protect" }
  | { type: "flee" }
  | { type: "drop" }
  | { type: "pickup" };

export type Gambit = { when: Condition; then: Action };
