// The hard bot's threat pass (R spec D27, S-7; plan section 5, P9): when an
// enemy in sight chases one of the team's loaded creeps, the bot chooses on
// the next world tick, from its view alone, by the estimated risk: help is
// coming (the victim keeps its rules, helpers follow it), the enemy is
// stronger (pay a small demand, or drop and flee lighter), or it is not (drop
// and fight with no carry brake). The strategist composes these parts: what
// the team is threatened by, how strong each side is, and the rules of each
// choice.

import { demandFor, stockTotal } from "./approach.ts";
import type { Rule } from "./autopilot.ts";
import type { Cell, GameMap } from "./map.ts";
import type { Dna, Params } from "./params.ts";
import { nearestTargets } from "./pathfinding.ts";
import { canonicalJson } from "./serialize.ts";
import {
  isOwnCreep,
  type CreepView,
  type ForeignCreepView,
  type TeamView,
  type WandererView,
} from "./view.ts";

/** The risk's settings (D27), printed with the strategist's. Provisional. */
export const RISK = {
  /**
   * Each DNA's strength: its mean win rate (‰) in the junction matrix (R F3,
   * seeds 1–100, every aggressor × victim pair empty and fighting, as either
   * side): ■ 31%, ▲ 51%, ● 64%. A fighter's power is its share of its
   * maximum HP times its DNA's strength.
   */
  strengthPermille: { square: 310, triangle: 510, circle: 640 },
  /**
   * How far a creep that dropped its load to fight looks for an enemy to
   * attack (cells, Manhattan): against an extortion, dropping ends the
   * approach, so the victim attacks instead.
   */
  fightRadius: 6,
  /** A demand the bot pays: at most this share of the load (D17). */
  payAtMostPermille: 250,
} as const;

/** An enemy in sight chasing one of the team's creeps. */
export type Attacker = ForeignCreepView | WandererView;

/** One of the team's creeps and the enemies in sight chasing it. */
export type Threat = { victim: CreepView; attackers: Attacker[] };

/**
 * The team's creeps that an enemy in sight targets with a hostile intent
 * (D25), by victim id, each with its attackers: creeps of any other team
 * (D18) and wanderers. Only the team's own creeps can be victims: the view
 * names a target only when the team sees it (HS-3).
 */
export function threatsIn(seen: TeamView): Threat[] {
  const byTarget = new Map<number, Attacker[]>();
  const add = (attacker: Attacker) => {
    const target = attacker.hostile?.target;
    if (target === undefined || target === null) return;
    const list = byTarget.get(target);
    if (list === undefined) byTarget.set(target, [attacker]);
    else list.push(attacker);
  };
  for (const creep of seen.creeps) if (creep.team !== seen.team) add(creep);
  for (const wanderer of seen.wanderers) add(wanderer);
  const threats: Threat[] = [];
  for (const creep of seen.creeps) {
    if (!isOwnCreep(creep) || creep.team !== seen.team) continue;
    const attackers = byTarget.get(creep.id);
    if (attackers !== undefined) threats.push({ victim: creep, attackers });
  }
  return threats;
}

/**
 * Whether the bot chooses for this victim now: loaded, free (no encounter,
 * battle or human), as the plan's threat pass reads it.
 */
export function choosesFor(victim: CreepView): boolean {
  return (
    stockTotal(victim.cargo) > 0 &&
    victim.engagement === null &&
    victim.battle === null &&
    victim.dominatedBy === null
  );
}

const isWandererView = (
  fighter: CreepView | Attacker,
): fighter is WandererView => !("team" in fighter);

/**
 * A fighter's power: its share of its maximum HP (a wanderer's from the
 * wanderers' params) × its DNA's strength.
 */
export function power(fighter: CreepView | Attacker, params: Params): number {
  const max = isWandererView(fighter)
    ? params.wanderers.hp
    : params.hp.dna[fighter.dna].max;
  return Math.floor((fighter.hp * RISK.strengthPermille[fighter.dna]) / max);
}

const always = { type: "always" } as const;

/**
 * Against a stronger enemy, with a demand it pays (D27): pay it, refuse a
 * larger one as a carrier, and go home with the load.
 */
export function payRules(): Rule[] {
  return [
    {
      when: { type: "demandAtMost", permille: RISK.payAtMostPermille },
      then: { type: "pay" },
    },
    { when: always, then: { type: "flee" } },
    { when: always, then: { type: "deliver" } },
  ];
}

/** Against a stronger enemy otherwise: drop the load and flee lighter. */
export function dropFleeRules(): Rule[] {
  return [
    { when: always, then: { type: "flee" } },
    { when: always, then: { type: "drop" } },
    { when: always, then: { type: "deliver" } },
  ];
}

/**
 * Against an even or weaker enemy: drop the load and fight with no carry
 * brake, attacking the nearest enemy in sight within RISK.fightRadius (the
 * extortion's approach ends once the victim is empty).
 */
export function dropFightRules(): Rule[] {
  return [
    { when: always, then: { type: "fight" } },
    { when: always, then: { type: "drop" } },
    {
      when: always,
      then: {
        type: "approach",
        intent: "attack",
        radius: RISK.fightRadius,
        minCargo: 0,
      },
    },
  ];
}

/** The rule a helper gets on top of its own (D27): follow the victim. */
export function helperRule(victim: number): Rule {
  return { when: always, then: { type: "follow", creepId: victim } };
}

let responses: { pay: string; flee: string; fight: string } | null = null;

/** Which response a creep's rules are, if any. */
export function responseOf(
  rules: readonly Rule[],
): "pay" | "dropFlee" | "dropFight" | null {
  // Every response has three rules and starts with its own action: most
  // creeps' rules are told apart without serializing them.
  const first = rules[0]?.then.type;
  if (
    rules.length !== 3 ||
    (first !== "pay" && first !== "flee" && first !== "fight")
  ) {
    return null;
  }
  responses ??= {
    pay: canonicalJson(payRules()),
    flee: canonicalJson(dropFleeRules()),
    fight: canonicalJson(dropFightRules()),
  };
  const json = canonicalJson(rules);
  if (first === "pay" && json === responses.pay) return "pay";
  if (first === "flee" && json === responses.flee) return "dropFlee";
  if (first === "fight" && json === responses.fight) return "dropFight";
  return null;
}

/** The choice for a threat, and the helpers it sends when help is coming. */
export type Choice =
  | { kind: "help"; helpers: CreepView[] }
  | { kind: "pay" | "dropFlee" | "dropFight" };

/**
 * The D27 choice for `threat`, on the map the team knows. The fight starts
 * when the first attacker arrives (path cost over its DNA's speed); help is
 * the candidates that arrive by then, quickest first (ties to the lower id),
 * taken until the victim's side is at least as strong as the attackers. With
 * no such help: drop and fight when the victim alone is, else pay when every
 * attacker extorts and the demand looks small (the aggressor's free capacity
 * read without the upgrade, which another team's view does not show), else
 * drop and flee.
 */
export function choose(
  threat: Threat,
  candidates: readonly CreepView[],
  map: GameMap,
  params: Params,
): Choice {
  const { victim, attackers } = threat;
  const goal = new Set([victim.y * map.width + victim.x]);
  const costTo = (from: Cell, maxCost: number) =>
    nearestTargets(map, from, goal, params, maxCost)?.cost ?? null;
  const speed = (dna: Dna) => params.dna[dna].cellsPerMinute;

  let first: { cost: number; speed: number } | null = null;
  let attack = 0;
  for (const attacker of attackers) {
    attack += power(attacker, params);
    const cost = costTo(attacker, Number.MAX_SAFE_INTEGER);
    if (cost === null) continue;
    const s = speed(attacker.dna);
    if (first === null || cost * first.speed < first.cost * s) {
      first = { cost, speed: s };
    }
  }
  const own = power(victim, params);

  const arriving: { creep: CreepView; cost: number; speed: number }[] = [];
  if (first !== null) {
    for (const creep of candidates) {
      const s = speed(creep.dna);
      const cost = costTo(creep, Math.floor((first.cost * s) / first.speed));
      if (cost !== null) arriving.push({ creep, cost, speed: s });
    }
  }
  arriving.sort(
    (a, b) => a.cost * b.speed - b.cost * a.speed || a.creep.id - b.creep.id,
  );
  const helpers: CreepView[] = [];
  let side = own;
  for (const { creep } of arriving) {
    if (side >= attack && helpers.length > 0) break;
    helpers.push(creep);
    side += power(creep, params);
  }
  if (helpers.length > 0 && side >= attack) return { kind: "help", helpers };
  if (own >= attack) return { kind: "dropFight" };
  const load = stockTotal(victim.cargo);
  const small = attackers.every((attacker) => {
    if (isWandererView(attacker) || attacker.hostile?.intent !== "extort") {
      return false;
    }
    const free = params.dna[attacker.dna].capacity - stockTotal(attacker.cargo);
    const demand = stockTotal(demandFor(free, victim.cargo));
    return demand * 1000 <= load * RISK.payAtMostPermille;
  });
  return { kind: small ? "pay" : "dropFlee" };
}
