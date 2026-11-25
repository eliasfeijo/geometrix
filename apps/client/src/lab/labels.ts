// What the lab's page calls things, in Portuguese, and the names it gives
// its participants (plan section 8: a short list of the lab's own; the
// world's names arrive with the junction).

import type {
  Action,
  Condition,
  Dna,
  PresetId,
  Reaction,
  Target,
} from "@geometrix/battle";

export const DNA_LABELS: Record<Dna, string> = {
  square: "quadrado",
  triangle: "triângulo",
  circle: "círculo",
};

export const PRESET_LABELS: Record<PresetId, string> = {
  frontline: "linha de frente",
  marksman: "atirador",
  skirmisher: "escaramuçador",
  carrier: "portador",
};

export const REACTION_LABELS: Record<Reaction, string> = {
  easy: "fácil",
  normal: "normal",
  hard: "difícil",
};

/** The lab's names, handed out in setup order and then to reinforcements. */
export const LAB_NAMES = [
  "Ária",
  "Brasa",
  "Cobre",
  "Duna",
  "Eco",
  "Faísca",
  "Garoa",
  "Hélio",
  "Íris",
  "Jade",
  "Lume",
  "Musgo",
  "Névoa",
  "Ônix",
  "Pólen",
  "Quartzo",
  "Rocha",
  "Sálvia",
  "Turfa",
  "Urze",
] as const;

export function labName(index: number): string {
  const name = LAB_NAMES[index % LAB_NAMES.length]!;
  const round = Math.floor(index / LAB_NAMES.length);
  return round === 0 ? name : `${name} ${round + 1}`;
}

export const CONDITION_LABELS: Record<Condition["type"], string> = {
  always: "sempre",
  hpBelow: "HP abaixo de",
  enemyWithin: "inimigo a até",
  enemyAligned: "inimigo alinhado no alcance",
  projectileIncoming: "projétil vindo em mim",
  carryAbove: "carga acima de",
  allyHpBelow: "aliado com HP abaixo de",
};

export const ACTION_LABELS: Record<Action["type"], string> = {
  attack: "atacar",
  approach: "aproximar",
  keepDistance: "manter distância",
  dodge: "esquivar",
  protect: "proteger o aliado",
  flee: "fugir",
  drop: "largar a bolsa",
  pickup: "catar a pilha",
};

export function targetLabel(target: Target): string {
  switch (target.by) {
    case "nearest":
      return "o mais perto";
    case "weakest":
      return "o mais ferido";
    case "dna":
      return `o ${DNA_LABELS[target.dna]}`;
  }
}

/** One gambit as a sentence, for the editor's summary. */
export function conditionText(condition: Condition): string {
  const label = CONDITION_LABELS[condition.type];
  switch (condition.type) {
    case "hpBelow":
    case "carryAbove":
      return `${label} ${condition.permille / 10}%`;
    case "enemyWithin":
      return condition.dna === undefined
        ? `${label} ${condition.cells} células`
        : `${DNA_LABELS[condition.dna]} inimigo a até ${condition.cells} células`;
    case "allyHpBelow":
      return `${label} ${condition.permille / 10}% a até ${condition.cells} células`;
    default:
      return label;
  }
}

export function actionText(action: Action): string {
  const label = ACTION_LABELS[action.type];
  return "target" in action ? `${label} ${targetLabel(action.target)}` : label;
}
