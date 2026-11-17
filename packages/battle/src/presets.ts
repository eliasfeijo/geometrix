// The gambits presets (spec D15, G-3; plan section 9): the shape says the
// role (pillar 6). They are what the lab and the CLI start a participant from;
// the setup carries the list itself, so changing a preset never changes how
// an exported log replays. The thresholds (250‰ to flee, an enemy within 4
// for the carrier) are data of the rule, not params (spec section 6).

import { copyGambits, type Gambit } from "./gambits.ts";
import type { Dna } from "./params.ts";

export const PRESET_IDS = [
  "frontline",
  "marksman",
  "skirmisher",
  "carrier",
] as const;
export type PresetId = (typeof PRESET_IDS)[number];

const LOW_HP_PERMILLE = 250;

const fleeWhenLow: Gambit = {
  when: { type: "hpBelow", permille: LOW_HP_PERMILLE },
  then: { type: "flee" },
};

const dodge: Gambit = {
  when: { type: "projectileIncoming" },
  then: { type: "dodge" },
};

const PRESETS: Record<PresetId, readonly Gambit[]> = {
  /** Linha de frente (square): cover the wounded ally, else hit the nearest. */
  frontline: [
    {
      when: { type: "allyHpBelow", permille: 500, cells: 4 },
      then: { type: "protect" },
    },
    {
      when: { type: "always" },
      then: { type: "attack", target: { by: "nearest" } },
    },
  ],
  /** Atirador (circle): flee when low, dodge, keep away, shoot the weakest. */
  marksman: [
    fleeWhenLow,
    dodge,
    {
      when: { type: "enemyWithin", cells: 3 },
      then: { type: "keepDistance", target: { by: "nearest" } },
    },
    {
      when: { type: "always" },
      then: { type: "attack", target: { by: "weakest" } },
    },
  ],
  /** Escaramuçador (triangle): flee when low, dodge, shoot the nearest. */
  skirmisher: [
    fleeWhenLow,
    dodge,
    {
      when: { type: "always" },
      then: { type: "attack", target: { by: "nearest" } },
    },
  ],
  /**
   * Portador (any DNA): drop the bag with an enemy near (with nothing to drop
   * the rule passes), and run for the edge.
   */
  carrier: [
    { when: { type: "enemyWithin", cells: 4 }, then: { type: "drop" } },
    { when: { type: "always" }, then: { type: "flee" } },
  ],
};

/** The lab's default preset of each DNA (spec G-3). */
export const DEFAULT_PRESETS: Record<Dna, PresetId> = {
  square: "frontline",
  circle: "marksman",
  triangle: "skirmisher",
};

/** A fresh copy of a preset's list, safe to hand to a setup or a command. */
export function presetGambits(id: PresetId): Gambit[] {
  const list = PRESETS[id];
  return copyGambits(list, list.length) as Gambit[];
}

/** The default list of a DNA: its preset (spec G-3). */
export function defaultGambits(dna: Dna): Gambit[] {
  return presetGambits(DEFAULT_PRESETS[dna]);
}
