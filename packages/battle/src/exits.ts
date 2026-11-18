// Leaving the battle and its end (spec F-1..F-4, D7, D9; plan section 7):
// stages 8 and 9 of the tick. There is no battle clock, only an idle one: a
// creep leaves by the edge or dead, everyone leaves when nobody took HP off
// anyone for a while, and the battle ends when at most one side is
// left in the arena.

import { isExit } from "./arena.ts";
import {
  emit,
  participantRef,
  type BattleEventLog,
  type Result,
} from "./events.ts";
import { msToTicks } from "./params.ts";
import { depart, type BattleState, type Participant } from "./state.ts";

function escape(
  state: BattleState,
  log: BattleEventLog,
  participant: Participant,
  reason: "edge" | "idle",
): void {
  const carry = { ...participant.carry };
  depart(state, {
    ...participantRef(participant),
    outcome: reason === "edge" ? "escapedEdge" : "escapedIdle",
    hp: participant.hp,
    carry,
    tick: log.tick,
  });
  emit(log, {
    type: "escaped",
    participant: participantRef(participant),
    reason,
    hp: participant.hp,
    carry,
  });
}

/**
 * Stage 8. First the edge, in id order: on an exit cell the count goes up,
 * off it it goes back to 0 (a blow in stage 6 also zeroed it); after
 * `exit.dwellMs` the creep escapes by the edge with its HP and carry (F-1).
 * Then the battle's idle clock goes up (a blow that took HP zeroed it in
 * stage 6); when it reaches `inactivity.timeoutMs`, everyone still in the
 * arena escapes on the spot, in id order (F-2, D9), and the battle ends with
 * no winner. Whoever runs out of the edge count in that same tick leaves by
 * the edge: the creep chose it.
 */
export function leaveArena(state: BattleState, log: BattleEventLog): void {
  const dwell = msToTicks(state.params, state.params.exit.dwellMs);
  const timeout = msToTicks(state.params, state.params.inactivity.timeoutMs);
  const gone = new Set<Participant>();
  for (const participant of state.participants) {
    participant.exitTicks = isExit(state.arena, participant.cell)
      ? participant.exitTicks + 1
      : 0;
    if (participant.exitTicks >= dwell) {
      escape(state, log, participant, "edge");
      gone.add(participant);
    }
  }
  state.idleTicks += 1;
  if (state.idleTicks >= timeout) {
    for (const participant of state.participants) {
      if (gone.has(participant)) continue;
      escape(state, log, participant, "idle");
      gone.add(participant);
    }
  }
  if (gone.size > 0) {
    state.participants = state.participants.filter((p) => !gone.has(p));
  }
}

/**
 * Stage 9 (spec F-3): when at most one side is left in the arena, the battle
 * ends; that side wins, or nobody if the arena is empty. The event has every
 * participant's outcome, by id (those still in the arena won), and the piles
 * left behind.
 */
export function checkEnd(state: BattleState, log: BattleEventLog): void {
  const sides = new Set(state.participants.map((p) => p.side));
  if (sides.size > 1) return;
  const winnerSide = state.participants[0]?.side ?? null;
  state.ended = { tick: log.tick, winnerSide };
  const results: Result[] = state.totals.map(({ id, dealt, taken }) => {
    const alive = state.participants.find((p) => p.id === id);
    if (alive !== undefined) {
      return {
        participant: participantRef(alive),
        outcome: "won",
        hp: alive.hp,
        carry: { ...alive.carry },
        dealt,
        taken,
      };
    }
    const gone = state.departed.find((d) => d.id === id)!;
    return {
      participant: participantRef(gone),
      outcome: gone.outcome,
      hp: gone.hp,
      carry: { ...gone.carry },
      dealt,
      taken,
    };
  });
  emit(log, {
    type: "ended",
    winnerSide,
    results,
    piles: state.piles.map((pile) => ({ ...pile })),
  });
}
