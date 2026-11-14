// Ready-made autopilot rules (spec P-3; F4 details decided 2026-11-13).
// Creeps are born with the materia collector.

import type { Rule } from "./autopilot.ts";
import type { Cell } from "./map.ts";
import type { Resource } from "./params.ts";

export const PRESETS = [
  "materiaCollector",
  "cristalCollector",
  "roadBuilder",
  "scout",
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
 * Builds road toward `target`; while it cannot (no materia in stock, or the
 * road is done) it gathers materia, which pays for the next segments.
 */
export function roadBuilderRules(target: Cell): Rule[] {
  return [
    deliverWhenFull(),
    {
      when: { type: "always" },
      then: { type: "buildRoad", x: target.x, y: target.y },
    },
    gather("materia"),
    deliverLeftover(),
  ];
}

/** The preset's rules; roadBuilder needs its target. */
export function presetRules(preset: PresetId, target: Cell | null): Rule[] {
  switch (preset) {
    case "materiaCollector":
      return collectorRules("materia");
    case "cristalCollector":
      return collectorRules("cristal");
    case "roadBuilder":
      if (target === null) throw new Error("roadBuilder needs a target");
      return roadBuilderRules(target);
    case "scout":
      return scoutRules();
  }
}
