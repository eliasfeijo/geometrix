// Editing autopilot rules (plan section 4, P4): any player of the team can set
// a creep's rules or apply a preset, without dominating it. Rules from a
// command are checked against the closed vocabulary (spec P-2) and copied field
// by field, so nothing else from the command reaches the state.

import type { Action, Condition, Rule } from "./autopilot.ts";
import {
  findCreep,
  teamCreepRefusal,
  type TeamCreepRefusal,
} from "./domination.ts";
import { isInMap, type Cell, type GameMap } from "./map.ts";
import { DNAS, RESOURCES, type Dna, type Resource } from "./params.ts";
import { PRESETS, presetRules, type PresetId } from "./presets.ts";
import type { WorldState } from "./world.ts";

export type RulesRefusal =
  | TeamCreepRefusal
  | "tooManyRules"
  | "invalidRule"
  | "invalidPreset"
  | "invalidTarget";

const isResource = (value: unknown): value is Resource =>
  RESOURCES.includes(value as Resource);

const isCount = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

const isPermille = (value: unknown): value is number =>
  isCount(value) && value <= 1000;

/**
 * An optional DNA filter: absent, or a list of DNAs without repeats. Copied
 * as a new array; `invalid` when it is anything else.
 */
function copyDnas(value: unknown): Dna[] | undefined | "invalid" {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return "invalid";
  const dnas = value as unknown[];
  if (!dnas.every((d) => DNAS.includes(d as Dna))) return "invalid";
  if (new Set(dnas).size !== dnas.length) return "invalid";
  return [...(dnas as Dna[])];
}

/** The filter fields of enemyInSight and approach, or null if invalid. */
function copyFilter(c: {
  radius: unknown;
  minCargo: unknown;
  dna?: unknown;
}): { radius: number; minCargo: number; dna?: Dna[] } | null {
  const dna = copyDnas(c.dna);
  if (dna === "invalid" || !isCount(c.radius) || !isCount(c.minCargo)) {
    return null;
  }
  return dna === undefined
    ? { radius: c.radius, minCargo: c.minCargo }
    : { radius: c.radius, dna, minCargo: c.minCargo };
}

function copyCondition(c: Condition): Condition | null {
  switch (c.type) {
    case "always":
    case "cargoFull":
    case "cargoEmpty":
      return { type: c.type };
    case "resourceInRange":
      return isResource(c.resource) && isCount(c.radius)
        ? { type: c.type, resource: c.resource, radius: c.radius }
        : null;
    case "stockBelow":
      return isResource(c.resource) && isCount(c.amount)
        ? { type: c.type, resource: c.resource, amount: c.amount }
        : null;
    case "resourceUnknown":
      return isResource(c.resource)
        ? { type: c.type, resource: c.resource }
        : null;
    case "enemyInSight": {
      const filter = copyFilter(c);
      return filter === null ? null : { type: c.type, ...filter };
    }
    case "hpBelow":
    case "demandAtMost":
      return isPermille(c.permille)
        ? { type: c.type, permille: c.permille }
        : null;
    default:
      return null;
  }
}

function copyAction(a: Action, map: GameMap): Action | null {
  switch (a.type) {
    case "deliver":
    case "stop":
    case "explore":
    case "pickup":
    case "pay":
    case "fight":
    case "flee":
      return { type: a.type };
    case "approach": {
      const filter = copyFilter(a);
      if (filter === null) return null;
      if (a.intent !== "attack" && a.intent !== "extort") return null;
      return { type: a.type, intent: a.intent, ...filter };
    }
    case "gather":
      return isResource(a.resource)
        ? { type: a.type, resource: a.resource }
        : null;
    case "moveTo":
    case "buildRoad":
      return isInMap(map, a) ? { type: a.type, x: a.x, y: a.y } : null;
    default:
      return null;
  }
}

/** The rules as plain vocabulary data, or null if any of them is invalid. */
function copyRules(rules: readonly Rule[], map: GameMap): Rule[] | null {
  const copies: Rule[] = [];
  for (const rule of rules) {
    const when = copyCondition(rule.when);
    const then = copyAction(rule.then, map);
    if (when === null || then === null) return null;
    copies.push({ when, then });
  }
  return copies;
}

export function setRulesRefusal(
  state: WorldState,
  playerId: number,
  creepId: number,
  rules: readonly Rule[],
): RulesRefusal | null {
  const refusal = teamCreepRefusal(state, playerId, creepId);
  if (refusal !== null) return refusal;
  if (rules.length > state.params.autopilot.maxRules) return "tooManyRules";
  return copyRules(rules, state.map) === null ? "invalidRule" : null;
}

export function setRules(
  state: WorldState,
  creepId: number,
  rules: readonly Rule[],
): void {
  findCreep(state, creepId)!.rules = copyRules(rules, state.map)!;
}

export function applyPresetRefusal(
  state: WorldState,
  playerId: number,
  creepId: number,
  preset: PresetId,
  target: Cell | null,
): RulesRefusal | null {
  const refusal = teamCreepRefusal(state, playerId, creepId);
  if (refusal !== null) return refusal;
  if (!PRESETS.includes(preset)) return "invalidPreset";
  if (preset === "roadBuilder") {
    if (target === null || !isInMap(state.map, target)) return "invalidTarget";
  }
  return null;
}

/** Replaces the creep's rules with the preset's; only roadBuilder uses target. */
export function applyPreset(
  state: WorldState,
  creepId: number,
  preset: PresetId,
  target: Cell | null,
): void {
  findCreep(state, creepId)!.rules = presetRules(
    preset,
    preset === "roadBuilder" ? target : null,
  );
}
