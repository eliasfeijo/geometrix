// Editing a creep's autopilot rules (spec C-4) as a local draft: a list of
// `condition -> action` in the closed vocabulary (spec P-2), sent whole with
// setRules. Pure functions, so the editor can stay a thin view.

import {
  DNAS,
  isReaction,
  type Action,
  type Cell,
  type Condition,
  type Dna,
  type Resource,
  type Rule,
} from "@geometrix/sim";

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

/**
 * The editor's two groups (M2 encontro plan section 9): the rules that run
 * the creep outside an encounter, and its reactions ("Quando abordado"),
 * decided only in one (spec A-2). The order only matters within a group.
 */
export type RuleGroup = "plain" | "reaction";

export const groupOf = (rule: Rule): RuleGroup =>
  isReaction(rule.then) ? "reaction" : "plain";

/** What each group offers: a reaction rule is one whose action is one. */
export const GROUP_ACTIONS: Record<RuleGroup, readonly Action["type"][]> = {
  plain: ACTION_TYPES.filter((t) => !isReaction({ type: t } as Action)),
  reaction: ACTION_TYPES.filter((t) => isReaction({ type: t } as Action)),
};

/** The demand only exists in an encounter; resources and stock only outside. */
export const GROUP_CONDITIONS: Record<RuleGroup, readonly Condition["type"][]> =
  {
    plain: CONDITION_TYPES.filter((t) => t !== "demandAtMost"),
    reaction: ["always", "hpBelow", "demandAtMost", "cargoFull", "cargoEmpty"],
  };

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

/** A new rule of the group; editor defaults only, changed right there. */
export function newRule(group: RuleGroup = "plain"): Rule {
  return group === "plain"
    ? { when: { type: "always" }, then: { type: "deliver" } }
    : {
        when: { type: "hpBelow", permille: DEFAULT_PERMILLE },
        then: { type: "flee" },
      };
}

/**
 * Moves rule i up (-1) or down (+1) past the next rule of its own group;
 * the rules of the other group in between keep their places.
 */
export function moveInGroup(
  rules: readonly Rule[],
  i: number,
  delta: -1 | 1,
): Rule[] {
  const rule = rules[i];
  if (rule === undefined) return [...rules];
  const group = groupOf(rule);
  let j = i + delta;
  while (j >= 0 && j < rules.length && groupOf(rules[j]!) !== group) j += delta;
  if (j < 0 || j >= rules.length) return [...rules];
  const next = [...rules];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/** The indices of the rules of a group, in order. */
export const indicesOf = (rules: readonly Rule[], group: RuleGroup) =>
  rules.flatMap((rule, i) => (groupOf(rule) === group ? [i] : []));

/**
 * The DNA filter after a click on `dna` (D13): no filter (undefined) means
 * all three. Turning the last one off is not allowed (nothing would match).
 */
export function toggleDna(
  filter: readonly Dna[] | undefined,
  dna: Dna,
): Dna[] | undefined {
  const on = new Set(filter ?? DNAS);
  if (on.has(dna)) {
    if (on.size === 1) return filter === undefined ? undefined : [...filter];
    on.delete(dna);
  } else {
    on.add(dna);
  }
  const next = DNAS.filter((d) => on.has(d));
  return next.length === DNAS.length ? undefined : next;
}

/** Per mille as the editor shows it, in whole percent, and back. */
export const percentOf = (permille: number) => Math.floor(permille / 10);
export const permilleOf = (percent: number) => Math.min(percent, 100) * 10;

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
