// Who can be approached and what an extortion demands (M2 encontro spec D8,
// D9, E-3, E-5, F-4): shared by the encounter stage, the autopilot's approach
// action and the client, which shows the demand before confirming (C-6).

import { capacity, cargoTotal, teamOf } from "./economy.ts";
import type { Creep, Stock, WorldState } from "./world.ts";

/**
 * What an extortion demands (spec D8): the victim's cargo up to the
 * aggressor's free capacity, cristal first. Works on views too (the client
 * shows it before confirming, C-6).
 */
export function demandFor(free: number, cargo: Stock): Stock {
  const cristal = Math.max(0, Math.min(cargo.cristal, free));
  const materia = Math.max(0, Math.min(cargo.materia, free - cristal));
  return { materia, cristal };
}

export const stockTotal = (stock: Stock) => stock.materia + stock.cristal;

/** Units the creep can still carry. */
export function freeCapacity(state: WorldState, creep: Creep): number {
  return (
    capacity(creep, teamOf(state, creep), state.params) - cargoTotal(creep)
  );
}

/** Whether the aggressor `aggressorId` may not extort `victim` again yet (D9). */
export function extortBlocked(
  victim: Creep,
  aggressorId: number,
  tick: number,
): boolean {
  return victim.extortBlocks.some(
    (b) => b.aggressor === aggressorId && b.untilTick > tick,
  );
}

/** World seconds in ticks; the params keep durations whole ticks. */
export const ticks = (state: WorldState, seconds: number) =>
  seconds / state.params.world.tickSeconds;

/**
 * Whether `aggressor` can open an encounter with `victim` now: "open"; "wait"
 * while the victim is busy, protected against the aggressor's team, or (for
 * an extortion) fleeing; "end" for an extortion with nothing to demand or a
 * blocked pair (spec E-5, D9): the approach is over. A victim in a battle can
 * only be attacked, which joins the battle (junction J-1, J-2).
 */
export function opening(
  state: WorldState,
  aggressor: Creep,
  victim: Creep,
  intent: "attack" | "extort",
): "open" | "wait" | "end" {
  if (victim.battle !== null) return intent === "attack" ? "open" : "end";
  if (victim.engagement !== null) return "wait";
  if (victim.safeConduct?.team === aggressor.team) return "wait";
  if (intent === "attack") return "open";
  if (victim.order.type === "flee") return "wait";
  if (extortBlocked(victim, aggressor.id, state.tick)) return "end";
  const demand = demandFor(freeCapacity(state, aggressor), victim.cargo);
  return stockTotal(demand) === 0 ? "end" : "open";
}
