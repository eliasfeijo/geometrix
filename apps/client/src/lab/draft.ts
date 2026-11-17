// The lab's setup as the form edits it (spec L-1, L-6): an arena, 2 to 4
// sides of 1 to 5 participants, each with a DNA, a starting HP in per mille,
// a load of matéria, a gambits preset and a reaction; the seed; and who the
// owner dominates from the start, or nobody (F5). It turns
// into the battle's setup, with the preset's list copied in (the setup
// carries the list, so a log replays the same whatever the presets become).

import {
  DEFAULT_PRESETS,
  presetGambits,
  type BattleParams,
  type BattleSetup,
  type Dna,
  type ParticipantSetup,
  type PresetId,
  type Reaction,
} from "@geometrix/battle";
import type { ArenaName } from "./assets.ts";
import { labName } from "./labels.ts";

export type MemberDraft = {
  dna: Dna;
  /** Starting HP in per mille of the DNA's maximum. */
  hpPermille: number;
  /** Matéria in the bag (the lab leaves cristal out). */
  materia: number;
  preset: PresetId;
  reaction: Reaction;
};

export type SetupDraft = {
  arena: ArenaName;
  seed: number;
  sides: MemberDraft[][];
  /**
   * The participant the owner dominates from the start, by its place in the
   * setup (sides in order, then members), or null to just watch.
   */
  you: number | null;
};

/** The starting HP choices of the form, in per mille. */
export const HP_CHOICES = [1000, 750, 500, 250] as const;

export function member(dna: Dna): MemberDraft {
  return {
    dna,
    hpPermille: 1000,
    materia: 0,
    preset: DEFAULT_PRESETS[dna],
    reaction: "normal",
  };
}

/** The lab opens on a 1 × 1, the owner's square against a circle. */
export function defaultDraft(): SetupDraft {
  return {
    arena: "pedras",
    seed: 1,
    sides: [[member("square")], [member("circle")]],
    you: 0,
  };
}

/**
 * The draft's choice of whom to dominate, kept in the setup: a place past the
 * last participant (one was taken out) falls back to the first.
 */
export function youOf(draft: SetupDraft): number | null {
  if (draft.you === null) return null;
  return draft.you < namesUsed(draft) ? draft.you : 0;
}

/**
 * The id of the participant at `place` once the battle is created: the
 * battle numbers the setup's participants from 1, in the setup's order.
 */
export function idOfPlace(place: number): number {
  return place + 1;
}

/** A seed for the "draw a seed" button: outside the battle, Math.random. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0x1_0000_0000);
}

/** The participant a draft member becomes, named by its place in the lab. */
export function participantOf(
  draft: MemberDraft,
  params: BattleParams,
  nameIndex: number,
): ParticipantSetup {
  const kit = params.dna[draft.dna];
  return {
    name: labName(nameIndex),
    dna: draft.dna,
    hp: Math.max(1, Math.floor((kit.hp * draft.hpPermille) / 1000)),
    carry: { materia: Math.min(draft.materia, kit.capacity), cristal: 0 },
    gambits: presetGambits(draft.preset),
    reaction: draft.reaction,
  };
}

export function setupOf(
  draft: SetupDraft,
  params: BattleParams,
  arena: string[],
): BattleSetup {
  let index = 0;
  return {
    rule: "grid",
    arena,
    seed: draft.seed,
    sides: draft.sides.map((members) =>
      members.map((m) => participantOf(m, params, index++)),
    ),
  };
}

/** How many names the setup used: reinforcements take the next ones. */
export function namesUsed(draft: SetupDraft): number {
  return draft.sides.reduce((n, members) => n + members.length, 0);
}
