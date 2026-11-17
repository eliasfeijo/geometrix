// What the map shows of the encounters (M2 encontro spec C-1..C-3, plan
// section 9), as data the layers draw: the HP bar of a wounded creep, the
// color of a spoil, and the lines between the two sides of an encounter.

import {
  isOwnCreep,
  isOwnEncounter,
  maxHp,
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
   * An encounter in dialogue or in a fight. `seconds` is what is left of the
   * dominated victim's window; `rounds`, the fight's (both only for the
   * team's own encounters).
   */
  | {
      kind: "dialogue" | "fight";
      encounter: number;
      from: number;
      to: number;
      intent: "attack" | "extort";
      seconds: number | null;
      rounds: number | null;
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
      kind: encounter.stage,
      encounter: encounter.id,
      from: encounter.aggressor,
      to: encounter.victim,
      intent: encounter.intent,
      seconds:
        own && encounter.stage === "dialogue"
          ? windowSeconds(encounter.deadlineTick, state.tick, params)
          : null,
      rounds: own && encounter.stage === "fight" ? encounter.rounds : null,
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
