// What the map shows of the encounters (M2 encontro spec C-1..C-3, plan
// section 9), as data the layers draw: the HP bar of a wounded creep, the
// color of a spoil, and the lines between the two sides of an extortion.

import {
  isOwnCreep,
  isOwnEncounter,
  maxHp,
  type Cell,
  type Params,
  type Spoil,
  type TeamView,
} from "@geometrix/sim";
import type { Creep } from "../creep-status.ts";

/** The creep's HP as a share of its maximum, or null when full (C-1). */
export function hpShare(
  creep: Pick<Creep, "dna" | "hp">,
  params: Params,
): number | null {
  const full = maxHp(params, creep.dna);
  if (creep.hp >= full) return null;
  return Math.max(0, creep.hp) / full;
}

/** HP in whole points, as the player reads it (the state keeps thousandths). */
export const hpPoints = (hp: number) => Math.floor(hp / 1000);

/** The color band of an HP share: healthy, hurt, near death. */
export function hpBand(share: number): "high" | "mid" | "low" {
  if (share > 0.5) return "high";
  if (share > 0.25) return "mid";
  return "low";
}

/** The resource a spoil shows (plan section 9): the most of it, cristal on ties. */
export function spoilKind(spoil: Spoil): "materia" | "cristal" {
  return spoil.cargo.materia > spoil.cargo.cristal ? "materia" : "cristal";
}

/** What links two creeps on the map, from the team's point of view. */
export type Link =
  /** One of the team's creeps chasing an enemy (approach order). */
  | { kind: "chase"; from: number; to: number; intent: "attack" | "extort" }
  /**
   * An extortion's dialogue. `seconds` is what is left of the dominated
   * victim's window (only for the team's own encounters). A battle has no
   * link: its creeps are in the arena (junction O-5).
   */
  | {
      kind: "dialogue";
      encounter: number;
      from: number;
      to: number;
      intent: "extort";
      seconds: number | null;
    };

/**
 * The links to draw: chases of the team's creeps whose target is in sight,
 * and every encounter of the view whose two creeps are in it.
 */
export function linksOf(state: TeamView, params: Params): Link[] {
  const ids = new Set(state.creeps.map((c) => c.id));
  const links: Link[] = [];
  for (const creep of state.creeps) {
    if (!isOwnCreep(creep) || creep.engagement !== null) continue;
    const { order } = creep;
    if (order.type !== "approach" || !ids.has(order.targetId)) continue;
    links.push({
      kind: "chase",
      from: creep.id,
      to: order.targetId,
      intent: order.intent,
    });
  }
  for (const encounter of state.encounters) {
    if (!ids.has(encounter.aggressor) || !ids.has(encounter.victim)) continue;
    const own = isOwnEncounter(encounter);
    links.push({
      kind: "dialogue",
      encounter: encounter.id,
      from: encounter.aggressor,
      to: encounter.victim,
      intent: encounter.intent,
      seconds: own
        ? windowSeconds(encounter.deadlineTick, state.tick, params)
        : null,
    });
  }
  return links;
}

/**
 * World seconds left in a reaction window ending at `deadlineTick` (D6), or
 * null for a free victim, which has none.
 */
export function windowSeconds(
  deadlineTick: number | null,
  tick: number,
  params: Params,
): number | null {
  if (deadlineTick === null) return null;
  return Math.max(0, deadlineTick - tick) * params.world.tickSeconds;
}

/** Screen pixels of a battle sign's radius (junction D16). */
export const BATTLE_SIGN_PX = 9;

/**
 * Where a battle's sign stands (junction D16): over the battle's cell, above
 * the creep ring there, about BATTLE_SIGN_PX on screen at any zoom, never
 * smaller than a third of a cell.
 */
export function battleSign(
  battle: Cell,
  viewScale: number,
): { x: number; y: number; r: number } {
  const r = Math.max(BATTLE_SIGN_PX / viewScale, 0.35);
  return { x: battle.x + 0.5, y: battle.y + 0.05 - r, r };
}
