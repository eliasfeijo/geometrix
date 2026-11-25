// Ready-made autopilot rules (spec P-3; F4 details decided 2026-11-13).
// Creeps are born with the materia collector.

import type { Rule } from "./autopilot.ts";
import type { Resource } from "./params.ts";

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

/** The preset's rules. */
export function presetRules(preset: PresetId): Rule[] {
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
