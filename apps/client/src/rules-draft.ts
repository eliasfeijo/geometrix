// Editing a creep's autopilot rules (spec C-4) as a local draft: a list of
// `condition -> action` in the closed vocabulary (spec P-2), sent whole with
// setRules. Pure functions, so the editor can stay a thin view.

import type { Action, Cell, Condition, Resource, Rule } from "@geometrix/sim";

export const CONDITION_TYPES = [
  "always",
  "cargoFull",
  "cargoEmpty",
  "resourceInRange",
  "stockBelow",
  "resourceUnknown",
  "enemyInSight",
  "hpBelow",
  "demandAtMost",
] as const satisfies readonly Condition["type"][];

export const ACTION_TYPES = [
  "gather",
  "deliver",
  "buildRoad",
  "moveTo",
  "explore",
  "pickup",
  "approach",
  "stop",
  "pay",
  "fight",
  "flee",
] as const satisfies readonly Action["type"][];

export const CONDITION_LABELS: Record<Condition["type"], string> = {
  always: "sempre",
  cargoFull: "carga cheia",
  cargoEmpty: "carga vazia",
  resourceInRange: "recurso a até R células",
  stockBelow: "estoque abaixo de N",
  resourceUnknown: "não conhece depósito de",
  enemyInSight: "inimigo à vista",
  hpBelow: "HP abaixo de",
  demandAtMost: "exigência até",
};

export const ACTION_LABELS: Record<Action["type"], string> = {
  gather: "coletar",
  deliver: "entregar no Núcleo",
  buildRoad: "construir estrada até",
  moveTo: "ir até",
  stop: "ficar parado",
  explore: "explorar",
  pickup: "catar despojo",
  approach: "abordar",
  pay: "pagar (quando abordado)",
  fight: "lutar (quando abordado)",
  flee: "fugir (quando abordado)",
};

/**
 * Starting values when the player switches a condition to one with numbers.
 * Editor defaults only: the player changes them right there.
 */
const DEFAULT_RADIUS = 10;
const DEFAULT_AMOUNT = 100;
const DEFAULT_PERMILLE = 500;

/** A condition of `type`, keeping the resource of `from` when it has one. */
export function conditionOf(
  type: Condition["type"],
  from: Condition,
): Condition {
  const resource: Resource = "resource" in from ? from.resource : "materia";
  switch (type) {
    case "always":
    case "cargoFull":
    case "cargoEmpty":
      return { type };
    case "resourceUnknown":
      return { type, resource };
    case "resourceInRange":
      return {
        type,
        resource,
        radius: from.type === type ? from.radius : DEFAULT_RADIUS,
      };
    case "stockBelow":
      return {
        type,
        resource,
        amount: from.type === type ? from.amount : DEFAULT_AMOUNT,
      };
    case "enemyInSight":
      return from.type === type
        ? from
        : { type, radius: DEFAULT_RADIUS, minCargo: 1 };
    case "hpBelow":
    case "demandAtMost":
      return {
        type,
        permille: "permille" in from ? from.permille : DEFAULT_PERMILLE,
      };
  }
}

/** An action of `type`; a point defaults to the one in `from`, else `cell`. */
export function actionOf(
  type: Action["type"],
  from: Action,
  cell: Cell,
): Action {
  switch (type) {
    case "deliver":
    case "stop":
    case "explore":
    case "pickup":
    case "pay":
    case "fight":
    case "flee":
      return { type };
    case "approach":
      return from.type === type
        ? from
        : { type, intent: "extort", radius: DEFAULT_RADIUS, minCargo: 1 };
    case "gather":
      return {
        type,
        resource: from.type === "gather" ? from.resource : "materia",
      };
    case "buildRoad":
    case "moveTo": {
      const point = "x" in from ? { x: from.x, y: from.y } : cell;
      return { type, ...point };
    }
  }
}

export function newRule(): Rule {
  return { when: { type: "always" }, then: { type: "deliver" } };
}

export function replaceAt(
  rules: readonly Rule[],
  i: number,
  rule: Rule,
): Rule[] {
  return rules.map((r, j) => (j === i ? rule : r));
}

export function removeAt(rules: readonly Rule[], i: number): Rule[] {
  return rules.filter((_, j) => j !== i);
}

/** Moves rule i up (-1) or down (+1); out of range changes nothing. */
export function move(rules: readonly Rule[], i: number, delta: -1 | 1): Rule[] {
  const j = i + delta;
  if (i < 0 || i >= rules.length || j < 0 || j >= rules.length) {
    return [...rules];
  }
  const next = [...rules];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

export const sameRules = (a: readonly Rule[], b: readonly Rule[]) =>
  JSON.stringify(a) === JSON.stringify(b);

/** A non-negative integer typed in a field, or null when it is not one. */
export function parseCount(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : null;
}
