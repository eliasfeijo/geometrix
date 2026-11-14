// Stock changes of the cores between two states (F9): "+N" when creeps
// deliver, "−N" when the team pays (roads, production, upgrade). Several
// changes close in time add up in one float, so a fast replay stays legible.

import type { DynamicState } from "@geometrix/protocol";
import type { Resource } from "@geometrix/sim";

export type StockDelta = { team: number; resource: Resource; amount: number };

export const RESOURCES: readonly Resource[] = ["materia", "cristal"];

/** How each team's stock changed from `previous` to `current`. */
export function stockDeltas(
  previous: DynamicState,
  current: DynamicState,
): StockDelta[] {
  const deltas: StockDelta[] = [];
  for (const team of current.teams) {
    const before = previous.teams.find((t) => t.id === team.id);
    if (before === undefined) continue;
    for (const resource of RESOURCES) {
      const amount = team.stock[resource] - before.stock[resource];
      if (amount !== 0) deltas.push({ team: team.id, resource, amount });
    }
  }
  return deltas;
}

/** A float on screen: one team, resource and direction. */
export type StockFloat = StockDelta & { id: number; at: number };

/** How long a float rises, in ms. */
export const FLOAT_MS = 1400;
/** Changes this close to a float's start join it instead of a new one. */
export const MERGE_MS = 700;

/**
 * The floats after `deltas` arrive at `now`: expired ones dropped, each delta
 * added to a fresh float of the same team, resource and sign, or a new one.
 */
export function addFloats(
  floats: readonly StockFloat[],
  deltas: readonly StockDelta[],
  now: number,
  nextId: () => number,
): StockFloat[] {
  const live = floats
    .filter((f) => now - f.at < FLOAT_MS)
    .map((f) => ({ ...f }));
  for (const delta of deltas) {
    const join = live.find(
      (f) =>
        f.team === delta.team &&
        f.resource === delta.resource &&
        Math.sign(f.amount) === Math.sign(delta.amount) &&
        now - f.at < MERGE_MS,
    );
    if (join !== undefined) join.amount += delta.amount;
    else live.push({ ...delta, id: nextId(), at: now });
  }
  return live;
}
