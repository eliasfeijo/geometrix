// What a left click selects: a creep under the pointer (clicking again on a
// crowd cycles through it), else the deposit or core at that cell.

import type { Cell, Deposit } from "@geometrix/sim";
import { cellAt, type Point } from "./view.ts";

export type Selection =
  | { kind: "creep"; id: number }
  | { kind: "deposit"; id: number }
  | { kind: "core"; team: number };

/** Hit radius of a creep, in cells, before its drawn scale. */
export const CREEP_HIT_RADIUS = 0.5;
/** Hit radius of a core around its cell center. */
export const CORE_HIT_RADIUS = 1;

export function pickAt(
  point: Point,
  centers: ReadonlyMap<number, Point & { scale: number }>,
  deposits: readonly Deposit[],
  cores: readonly Cell[],
  previous: Selection | null,
): Selection | null {
  const hits = [...centers]
    .filter(
      ([, c]) =>
        Math.hypot(c.x - point.x, c.y - point.y) <=
        CREEP_HIT_RADIUS * Math.max(c.scale, 0.7),
    )
    .map(([id]) => id)
    .sort((a, b) => a - b);
  if (hits.length > 0) {
    // Clicking a crowd again picks the next creep in it, by id.
    const at = previous?.kind === "creep" ? hits.indexOf(previous.id) : -1;
    return { kind: "creep", id: hits[(at + 1) % hits.length]! };
  }
  const cell = cellAt(point);
  const deposit = deposits.find((d) => d.x === cell.x && d.y === cell.y);
  if (deposit !== undefined) return { kind: "deposit", id: deposit.id };
  const team = cores.findIndex(
    (core) =>
      Math.hypot(core.x + 0.5 - point.x, core.y + 0.5 - point.y) <=
      CORE_HIT_RADIUS,
  );
  if (team >= 0) return { kind: "core", team };
  return null;
}

export const sameSelection = (a: Selection | null, b: Selection | null) =>
  JSON.stringify(a) === JSON.stringify(b);
