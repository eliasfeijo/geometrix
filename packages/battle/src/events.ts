// Events of the battle (spec D19, plan section 10; ADR-0007): what happened in
// a tick, as structured data, outside the state and its hash. stepBattle
// returns them; the same state and commands give the same list in the same
// order. They are the battle side of the internal contract v0 (ADR-0008 rule
// 8), versioned by BATTLE_VERSION. Who emits each: attacked, hit, missed and died the
// combat (combat.ts); dropped and picked the bag (carry.ts); joined and
// controlChanged the lab's commands (commands.ts); escaped and ended the
// exits (exits.ts).

import type { Dir } from "./arena.ts";
import type { Dna } from "./params.ts";
import type {
  BattleState,
  Carry,
  Controller,
  Outcome,
  Participant,
  Pile,
} from "./state.ts";

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
  /** The setup's max HP (junction spec D9): the params no longer have it. */
  maxHp: number;
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
      /** HP taken off: the attacker's damage, down to what the target had. */
      damage: number;
      hp: number;
      /** Where the target stands when the blow lands. */
      cell: number;
    }
  | {
      /**
       * A shot that vanished without hitting anyone (spec L-8): into rock or
       * off the grid, or past its range. `cell` is the last one it was on
       * (the shooter's, when the cell in front was already rock), and `dir`
       * the way it flew.
       */
      type: "missed";
      by: ParticipantRef;
      cell: number;
      dir: Dir;
    }
  | {
      /** `cell`: where it fell, its load left there as a pile. */
      type: "died";
      participant: ParticipantRef;
      by: ParticipantRef | null;
      cell: number;
    }
  | { type: "dropped"; participant: ParticipantRef; carry: Carry; cell: number }
  | { type: "picked"; participant: ParticipantRef; carry: Carry; cell: number }
  | { type: "joined"; participant: ParticipantRef; cell: number }
  | {
      /**
       * `cell`: where it stood when it left, which the junction maps back to
       * the world (junction spec D7).
       */
      type: "escaped";
      participant: ParticipantRef;
      reason: "edge" | "idle";
      hp: number;
      carry: Carry;
      cell: number;
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

export function participantRef(
  participant: Pick<Participant, "id" | "side" | "dna" | "name">,
): ParticipantRef {
  return {
    id: participant.id,
    side: participant.side,
    dna: participant.dna,
    name: participant.name,
  };
}

/**
 * Who participant `id` is, in the arena or gone: a projectile outlives its
 * owner, and its hit still names it.
 */
export function refById(state: BattleState, id: number): ParticipantRef {
  const who =
    state.participants.find((p) => p.id === id) ??
    state.departed.find((d) => d.id === id);
  if (who === undefined) throw new Error(`no participant ${id} ever`);
  return participantRef(who);
}
