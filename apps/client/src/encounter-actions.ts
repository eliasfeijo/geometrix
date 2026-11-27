// What the player can do about an encounter (M2 encontro spec C-5, C-6, plan
// section 9): approach an enemy in sight with the dominated creep (attack, or
// extort with the demand shown before confirming), and answer when the
// dominated creep is in an encounter. Pure functions over the view; the panels
// only draw them.

import {
  demandFor,
  isOwnEncounter,
  stockTotal,
  type CreepView,
  type EncounterView,
  type Params,
  type Reply,
  type Stock,
  type TeamView,
  type WandererView,
} from "@geometrix/sim";
import { viewCapacity, type Creep } from "./creep-status.ts";
import { windowSeconds } from "./map/combat-marks.ts";

/**
 * The right-click menu over an enemy in sight (C-6): another team's creep or
 * a wanderer (junction W-4).
 */
export type ApproachOption =
  | {
      kind: "creep";
      target: Creep;
      /**
       * What an extortion would demand now (D8): the target's cargo up to
       * the free room of the dominated creep, cristal first. Zero disables
       * it.
       */
      demand: Stock;
    }
  | {
      /** Attacked only: an extortion of a wanderer is refused (W-4). */
      kind: "wanderer";
      target: WandererView;
    };

export function approachOptions(
  state: TeamView,
  params: Params,
  mine: CreepView,
  targets: readonly number[],
): ApproachOption[] {
  const room =
    viewCapacity(mine, state.teams[mine.team], params) - stockTotal(mine.cargo);
  const options: ApproachOption[] = [];
  for (const id of targets) {
    const wanderer = state.wanderers.find((w) => w.id === id);
    if (wanderer !== undefined) {
      options.push({ kind: "wanderer", target: wanderer });
      continue;
    }
    const target = state.creeps.find((c) => c.id === id);
    if (target === undefined || target.team === mine.team) continue;
    options.push({
      kind: "creep",
      target,
      demand: demandFor(room, target.cargo),
    });
  }
  return options;
}

/** The dominated creep's encounter, as the reaction panel shows it (C-5). */
export type Reaction = {
  encounter: EncounterView;
  /** The dominated creep's side. */
  side: "aggressor" | "victim";
  /** The other side, when the view has it (it may have just died). */
  other: Creep | null;
  /** The answers the sim accepts now (reactRefusal), in button order. */
  choices: Reply[];
  /** The answer already sent, if any. */
  sent: Reply | null;
  /** World seconds left in the window of a dominated victim; null otherwise. */
  seconds: number | null;
};

/**
 * The victim's answers to an extortion, in the order of the buttons; an
 * attack has no dialogue, it opens the battle at once (junction O-1, D1).
 */
const CHOICES = ["pay", "refuse"] as const satisfies readonly Reply[];

export function reactionOf(
  state: TeamView,
  params: Params,
  mine: CreepView,
): Reaction | null {
  if (mine.engagement === null) return null;
  const encounter = state.encounters.find((e) => e.id === mine.engagement);
  if (encounter === undefined || !isOwnEncounter(encounter)) return null;
  const side = encounter.aggressor === mine.id ? "aggressor" : "victim";
  const otherId = side === "aggressor" ? encounter.victim : encounter.aggressor;
  const other = state.creeps.find((c) => c.id === otherId) ?? null;
  const victim = side === "victim";
  return {
    encounter,
    side,
    other,
    choices: victim ? [...CHOICES] : [],
    sent: victim ? encounter.reply : null,
    seconds: victim
      ? windowSeconds(encounter.deadlineTick, state.tick, params)
      : null,
  };
}

/**
 * The encounter or battle a creep is in, as the inspector says it (spec C-7,
 * junction K-3): with whom and what for; null when it is in none. Another
 * team's creep shows only what its encounter's public fields say.
 */
export function engagementText(state: TeamView, creep: Creep): string | null {
  if (creep.battle !== null) return "em batalha";
  if (creep.engagement === null) return null;
  const encounter = state.encounters.find((e) => e.id === creep.engagement);
  if (encounter === undefined) return "num encontro";
  const aggressor = encounter.aggressor === creep.id;
  const otherId = aggressor ? encounter.victim : encounter.aggressor;
  const other = state.creeps.find((c) => c.id === otherId);
  const name = other?.name ?? `#${otherId}`;
  return aggressor
    ? `abordou ${name} para extorquir`
    : `abordado por ${name}, que quer extorquir`;
}

/**
 * The safe conduct of a creep that paid (D9): against which team and for how
 * many world seconds more; null without one (or once it ran out).
 */
export function safeConductLeft(
  safeConduct: CreepView["safeConduct"],
  tick: number,
  params: Params,
): { team: number; seconds: number } | null {
  if (safeConduct === null || safeConduct.untilTick <= tick) return null;
  return {
    team: safeConduct.team,
    seconds: (safeConduct.untilTick - tick) * params.world.tickSeconds,
  };
}

/**
 * Whether the dominated creep may drop its load now (R spec D24, DR-2): it
 * carries something, is in no battle and not fleeing, and in an encounter
 * only as the victim of an extortion, which dropping refuses (DR-3).
 */
export function canDrop(state: TeamView, creep: CreepView): boolean {
  if (stockTotal(creep.cargo) === 0) return false;
  if (creep.battle !== null || creep.order.type === "flee") return false;
  if (creep.engagement === null) return true;
  return state.encounters.some(
    (e) => e.id === creep.engagement && e.victim === creep.id,
  );
}
