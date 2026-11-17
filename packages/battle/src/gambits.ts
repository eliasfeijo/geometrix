// The gambits vocabulary (spec D14, plan section 9): an ordered list of
// condition → action per participant. The state carries it; the setGambits
// command replaces it whole, with the list checked against this closed
// vocabulary and copied field by field (like the sim's rules.ts), so nothing
// else from the command reaches the state. The evaluation comes with the AI
// (F3).

import { DNAS, type Dna } from "./params.ts";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isCount = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

const isPermille = (value: unknown): value is number =>
  isCount(value) && value <= 1000;

function copyTarget(t: unknown): Target | null {
  if (!isRecord(t)) return null;
  switch (t.by) {
    case "nearest":
    case "weakest":
      return { by: t.by };
    case "dna":
      return DNAS.includes(t.dna as Dna)
        ? { by: "dna", dna: t.dna as Dna }
        : null;
    default:
      return null;
  }
}

function copyCondition(c: unknown): Condition | null {
  if (!isRecord(c)) return null;
  switch (c.type) {
    case "always":
    case "enemyAligned":
    case "projectileIncoming":
      return { type: c.type };
    case "hpBelow":
    case "carryAbove":
      return isPermille(c.permille)
        ? { type: c.type, permille: c.permille }
        : null;
    case "enemyWithin":
      return isCount(c.cells) ? { type: c.type, cells: c.cells } : null;
    case "allyHpBelow":
      return isPermille(c.permille) && isCount(c.cells)
        ? { type: c.type, permille: c.permille, cells: c.cells }
        : null;
    default:
      return null;
  }
}

function copyAction(a: unknown): Action | null {
  if (!isRecord(a)) return null;
  switch (a.type) {
    case "attack":
    case "approach":
    case "keepDistance": {
      const target = copyTarget(a.target);
      return target === null ? null : { type: a.type, target };
    }
    case "dodge":
    case "protect":
    case "flee":
    case "drop":
    case "pickup":
      return { type: a.type };
    default:
      return null;
  }
}

/**
 * A gambit list from untrusted input, copied field by field, or why it is
 * invalid: at most `maxRules` rules, each a known condition and action with
 * valid fields.
 */
export function copyGambits(
  value: unknown,
  maxRules: number,
): Gambit[] | string {
  if (!Array.isArray(value)) return "gambits must be a list";
  if (value.length > maxRules) return `at most ${maxRules} gambits`;
  const list: Gambit[] = [];
  for (let i = 0; i < value.length; i++) {
    const rule: unknown = value[i];
    if (!isRecord(rule)) return `gambit ${i}: expected an object`;
    const when = copyCondition(rule.when);
    if (when === null) return `gambit ${i}: invalid condition`;
    const then = copyAction(rule.then);
    if (then === null) return `gambit ${i}: invalid action`;
    list.push({ when, then });
  }
  return list;
}
