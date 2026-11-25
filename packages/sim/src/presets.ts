// Ready-made autopilot rules (spec P-3; F4 details decided 2026-11-13).
// Creeps are born with the materia collector. The functions per preset give
// its rules without the help rule; presetRules adds the DNA's (R spec D11).

import { isReaction, type Rule } from "./autopilot.ts";
import type { Dna, Resource } from "./params.ts";

export const PRESETS = [
  "materiaCollector",
  "cristalCollector",
  "roadBuilder",
  "scout",
  "raider",
] as const;
export type PresetId = (typeof PRESETS)[number];

// Each call builds fresh rule objects: creeps never share rule data.
const deliverWhenFull = (): Rule => ({
  when: { type: "cargoFull" },
  then: { type: "deliver" },
});
/** Brings home what is left when there is nothing to gather. */
const deliverLeftover = (): Rule => ({
  when: { type: "always" },
  then: { type: "deliver" },
});
const gather = (resource: Resource): Rule => ({
  when: { type: "always" },
  then: { type: "gather", resource },
});

/**
 * Gathers `resource` and delivers when full; explores while the team knows
 * no deposit of it (fog spec A-4, D3).
 */
export function collectorRules(resource: Resource): Rule[] {
  return [
    deliverWhenFull(),
    gather(resource),
    {
      when: { type: "resourceUnknown", resource },
      then: { type: "explore" },
    },
    deliverLeftover(),
  ];
}

/**
 * Explores; with nothing left to explore it goes back to the core (fog spec
 * A-4, D3).
 */
export function scoutRules(): Rule[] {
  return [
    { when: { type: "always" }, then: { type: "explore" } },
    deliverLeftover(),
  ];
}

/**
 * Builds road toward the target the autopilot resolves each time (the known
 * deposit nearest the core with no road, R spec D12, RB-1); while it cannot
 * (no target, or no materia for the next segment) it gathers materia, which
 * pays for the next segments (RB-2).
 */
export function roadBuilderRules(): Rule[] {
  return [
    deliverWhenFull(),
    { when: { type: "always" }, then: { type: "buildRoad" } },
    gather("materia"),
    deliverLeftover(),
  ];
}

/**
 * The raider (M2 encontro spec D14, plan section 6): extorts a loaded enemy
 * in sight, picks up spoils, delivers when full, explores; refuses when
 * extorted and enters a battle with its DNA's preset, or as a carrier below
 * 400‰ of its HP (junction D2). Targets carry at least 10, the circle's
 * capacity (plan C11). Both numbers belong to the rule, not params.
 */
export function raiderRules(): Rule[] {
  return [
    { when: { type: "hpBelow", permille: 400 }, then: { type: "flee" } },
    { when: { type: "always" }, then: { type: "fight" } },
    {
      when: { type: "always" },
      then: { type: "approach", intent: "extort", radius: 10, minCargo: 10 },
    },
    { when: { type: "always" }, then: { type: "pickup" } },
    deliverWhenFull(),
    { when: { type: "always" }, then: { type: "explore" } },
    deliverLeftover(),
  ];
}

/**
 * Helping an ally, per DNA (R spec D10): the radius of allyInBattle and the
 * HP floor of joinBattle, in thousandths. Provisional; like the raider's
 * numbers, they belong to the preset, not the params.
 */
export const HELP: Record<Dna, { radius: number; minHpPermille: number }> = {
  square: { radius: 6, minHpPermille: 400 },
  triangle: { radius: 6, minHpPermille: 500 },
  circle: { radius: 8, minHpPermille: 500 },
};

/** The DNA's help rule: join a teammate's battle in sight nearby (D10). */
export function helpRule(dna: Dna): Rule {
  const { radius, minHpPermille } = HELP[dna];
  return {
    when: { type: "allyInBattle", radius },
    then: { type: "joinBattle", minHpPermille },
  };
}

/**
 * `rules` with the DNA's help rule after their leading reaction rules and
 * before everything else (R spec D11, H-3): every preset has it, the
 * strategist's rules too.
 */
export function withHelp(rules: readonly Rule[], dna: Dna): Rule[] {
  let at = 0;
  while (at < rules.length && isReaction(rules[at]!.then)) at++;
  return [...rules.slice(0, at), helpRule(dna), ...rules.slice(at)];
}

/** The preset's rules for a creep of `dna`, the help rule included. */
export function presetRules(preset: PresetId, dna: Dna): Rule[] {
  return withHelp(baseRules(preset), dna);
}

function baseRules(preset: PresetId): Rule[] {
  switch (preset) {
    case "materiaCollector":
      return collectorRules("materia");
    case "cristalCollector":
      return collectorRules("cristal");
    case "roadBuilder":
      return roadBuilderRules();
    case "scout":
      return scoutRules();
    case "raider":
      return raiderRules();
  }
}
