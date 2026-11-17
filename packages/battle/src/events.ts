// Events of the battle (spec D19, plan section 10; ADR-0007): what happened in
// a tick, as structured data, outside the state and its hash. stepBattle
// returns them; the same state and commands give the same list in the same
// order. They are the battle side of the internal contract v0 (ADR-0008 rule
// 8), versioned by BATTLE_VERSION. F1 defines them and the collector; the
// combat stages that emit them come with F2.

import type { Dir } from "./arena.ts";
import type { Dna } from "./params.ts";
import type { Carry, Controller, Outcome, Participant, Pile } from "./state.ts";

/** A participant as events name it: those who leave the arena leave the state. */
export type ParticipantRef = {
  id: number;
  side: number;
  dna: Dna;
  name: string;
};

/** How a participant ended the battle (spec F-3). */
export type Result = {
  participant: ParticipantRef;
  outcome: Outcome | "won";
  hp: number;
  carry: Carry;
  dealt: number;
  taken: number;
};

/** What an event says, without its place in the tick. */
export type BattleEventBody =
  | { type: "attacked"; participant: ParticipantRef; dir: Dir }
  | {
      type: "hit";
      by: ParticipantRef;
      target: ParticipantRef;
      damage: number;
      hp: number;
    }
  | { type: "died"; participant: ParticipantRef; by: ParticipantRef | null }
  | { type: "dropped"; participant: ParticipantRef; carry: Carry; cell: number }
  | { type: "picked"; participant: ParticipantRef; carry: Carry; cell: number }
  | { type: "joined"; participant: ParticipantRef; cell: number }
  | {
      type: "escaped";
      participant: ParticipantRef;
      reason: "edge" | "idle";
      hp: number;
      carry: Carry;
    }
  | {
      type: "controlChanged";
      participant: ParticipantRef;
      controller: Controller;
    }
  | {
      type: "ended";
      winnerSide: number | null;
      results: Result[];
      /** What stays in the arena, for the world at the junction (spec F-3). */
      piles: Pile[];
    };

export type BattleEvent = BattleEventBody & {
  /** The tick being stepped (the state's tick before the step). */
  tick: number;
  /** Position in the tick's list. */
  index: number;
};

/** The events of the tick being stepped, in emission order. */
export type BattleEventLog = { tick: number; events: BattleEvent[] };

export function createEventLog(tick: number): BattleEventLog {
  return { tick, events: [] };
}

export function emit(log: BattleEventLog, body: BattleEventBody): void {
  log.events.push({ ...body, tick: log.tick, index: log.events.length });
}

export function participantRef(participant: Participant): ParticipantRef {
  return {
    id: participant.id,
    side: participant.side,
    dna: participant.dna,
    name: participant.name,
  };
}
