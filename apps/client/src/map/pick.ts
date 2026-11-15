// What a left click selects: the creep under the pointer, a stack of creeps
// (to choose one from a list), else the deposit or core at that cell. A click
// that hits several markers with none clearly lists all their creeps (fog
// F6, E3).

import type { Cell, Deposit, OrderInput } from "@geometrix/sim";
import { markerAt, markersAt, type Marker } from "./layout.ts";
import { cellAt, type Point } from "./view.ts";

export type Selection =
  | { kind: "creep"; id: number }
  | { kind: "deposit"; id: number }
  | { kind: "core"; team: number };

/** What a click hits: a selection, or a stack whose creeps to list. */
export type Pick = Selection | { kind: "stack"; ids: number[] };

/** Hit radius of a core around its cell center. */
export const CORE_HIT_RADIUS = 1;

export function pickAt(
  point: Point,
  markers: readonly Marker[],
  deposits: readonly Deposit[],
  /** By team; null for a core the team has not seen. */
  cores: readonly (Cell | null)[],
  /** Pixels per cell. */
  viewScale: number,
): Pick | null {
  const marker = markerAt(point, markers, viewScale);
  if (marker?.kind === "creep") return { kind: "creep", id: marker.id };
  if (marker?.kind === "stack") return { kind: "stack", ids: marker.ids };
  const hits = markersAt(point, markers, viewScale);
  if (hits.length > 0) {
    const ids = hits.flatMap(({ marker: m }) =>
      m.kind === "creep" ? [m.id] : m.ids,
    );
    return { kind: "stack", ids: ids.sort((a, b) => a - b) };
  }
  const cell = cellAt(point);
  const deposit = deposits.find((d) => d.x === cell.x && d.y === cell.y);
  if (deposit !== undefined) return { kind: "deposit", id: deposit.id };
  const team = cores.findIndex(
    (core) =>
      core !== null &&
      Math.hypot(core.x + 0.5 - point.x, core.y + 0.5 - point.y) <=
        CORE_HIT_RADIUS,
  );
  if (team >= 0) return { kind: "core", team };
  return null;
}

/** Ids of the creeps on the same cell as creep `id`, itself included. */
export function cellmates(
  creeps: readonly (Cell & { id: number })[],
  id: number,
): number[] {
  const creep = creeps.find((c) => c.id === id);
  if (creep === undefined) return [];
  return creeps
    .filter((c) => c.x === creep.x && c.y === creep.y)
    .map((c) => c.id)
    .sort((a, b) => a - b);
}

export const sameSelection = (a: Selection | null, b: Selection | null) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * The order a right click gives the dominated creep (plan section 8, owner
 * decision F7): build road in road mode; else gather at a deposit, deliver
 * at the own core, move anywhere else.
 */
export function orderAt(
  point: Point,
  deposits: readonly Deposit[],
  ownCore: Cell,
  roadMode: boolean,
): OrderInput {
  const cell = cellAt(point);
  if (roadMode) return { type: "buildRoad", ...cell };
  const deposit = deposits.find((d) => d.x === cell.x && d.y === cell.y);
  if (deposit !== undefined) return { type: "gather", depositId: deposit.id };
  if (
    Math.hypot(ownCore.x + 0.5 - point.x, ownCore.y + 0.5 - point.y) <=
    CORE_HIT_RADIUS
  ) {
    return { type: "deliver" };
  }
  return { type: "moveTo", ...cell };
}
