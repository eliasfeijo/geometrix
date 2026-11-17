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
} from "@geometrix/sim";
import { viewCapacity, type Creep } from "./creep-status.ts";
import { windowSeconds } from "./map/combat-marks.ts";

/** The right-click menu over an enemy in sight (C-6). */
export type ApproachOption = {
  target: Creep;
  /**
   * What an extortion would demand now (D8): the target's cargo up to the
   * free room of the dominated creep, cristal first. Zero disables it.
   */
  demand: Stock;
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
    const target = state.creeps.find((c) => c.id === id);
    if (target === undefined || target.team === mine.team) continue;
    options.push({ target, demand: demandFor(room, target.cargo) });
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
  /** The answer already sent this round, if any. */
  sent: Reply | null;
  /** World seconds left in the window of a dominated victim; null otherwise. */
  seconds: number | null;
};

/** The choices of each moment of an encounter, in the order of the buttons. */
const CHOICES = {
  attack: ["fight", "flee"],
  extort: ["pay", "refuse", "flee"],
  fight: ["flee"],
} as const satisfies Record<string, readonly Reply[]>;

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
  const fight = encounter.stage === "fight";
  const choices: Reply[] = fight
    ? [...CHOICES.fight]
    : side === "victim"
      ? [...CHOICES[encounter.intent]]
      : [];
  const sent =
    side === "aggressor"
      ? fight
        ? encounter.aggressorReply
        : null
      : encounter.reply;
  return {
    encounter,
    side,
    other,
    choices,
    sent,
    seconds:
      !fight && side === "victim"
        ? windowSeconds(encounter.deadlineTick, state.tick, params)
        : null,
  };
}

/**
 * The encounter a creep is in, as the inspector says it (spec C-7): with
 * whom, what for and at which stage; null when it is in none. Another team's
 * creep shows only what its encounter's public fields say.
 */
export function engagementText(state: TeamView, creep: Creep): string | null {
  if (creep.engagement === null) return null;
  const encounter = state.encounters.find((e) => e.id === creep.engagement);
  if (encounter === undefined) return "num encontro";
  const aggressor = encounter.aggressor === creep.id;
  const otherId = aggressor ? encounter.victim : encounter.aggressor;
  const other = state.creeps.find((c) => c.id === otherId);
  const name = other?.name ?? `#${otherId}`;
  if (encounter.stage === "fight") {
    return isOwnEncounter(encounter)
      ? `lutando com ${name}, rodada ${encounter.rounds}`
      : `lutando com ${name}`;
  }
  const what = encounter.intent === "attack" ? "atacar" : "extorquir";
  return aggressor
    ? `abordou ${name} para ${what}`
    : `abordado por ${name}, que quer ${what}`;
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
