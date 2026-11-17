// Carry and piles (spec C-1, C-2, D8; plan sections 7, 8): stage 7 of the
// tick. A pile is what lies on a cell, one per cell; it does not block it.
// Who dies leaves its carry in a pile (stage 6, combat.ts); the drop command
// leaves it on purpose, which also lifts the carry brake.

import { emit, participantRef, type BattleEventLog } from "./events.ts";
import {
  carryTotal,
  type BattleState,
  type Carry,
  type Pile,
} from "./state.ts";

export function pileAt(state: BattleState, cell: number): Pile | undefined {
  return state.piles.find((p) => p.cell === cell);
}

/** Adds `carry` to the pile on `cell`, creating it (with a new id) if needed. */
export function addToPile(
  state: BattleState,
  cell: number,
  carry: Carry,
): void {
  const pile = pileAt(state, cell);
  if (pile !== undefined) {
    pile.materia += carry.materia;
    pile.cristal += carry.cristal;
    return;
  }
  state.piles.push({
    id: state.nextId++,
    cell,
    materia: carry.materia,
    cristal: carry.cristal,
  });
}

/**
 * Stage 7 (spec C-1, C-2), in id order. Drop moves all of the carry to the
 * pile of the creep's cell. Pick up takes from that pile up to the free
 * capacity, cristal first; an emptied pile leaves the state. Both act once:
 * the flags are cleared. An empty bag or a cell without a pile: nothing
 * happens, with no event.
 */
export function dropAndPickUp(state: BattleState, log: BattleEventLog): void {
  for (const participant of state.participants) {
    const { intent, carry, cell } = participant;
    if (intent.drop) {
      intent.drop = false;
      if (carryTotal(carry) > 0) {
        const dropped = { materia: carry.materia, cristal: carry.cristal };
        addToPile(state, cell, dropped);
        participant.carry = { materia: 0, cristal: 0 };
        emit(log, {
          type: "dropped",
          participant: participantRef(participant),
          carry: dropped,
          cell,
        });
      }
    }
    if (intent.pickup) {
      intent.pickup = false;
      const pile = pileAt(state, cell);
      const capacity = state.params.dna[participant.dna].capacity;
      const room = capacity - carryTotal(carry);
      if (pile === undefined || room <= 0) continue;
      const cristal = Math.min(room, pile.cristal);
      const materia = Math.min(room - cristal, pile.materia);
      if (cristal + materia === 0) continue;
      pile.cristal -= cristal;
      pile.materia -= materia;
      participant.carry = {
        materia: carry.materia + materia,
        cristal: carry.cristal + cristal,
      };
      if (pile.cristal + pile.materia === 0) {
        state.piles = state.piles.filter((p) => p !== pile);
      }
      emit(log, {
        type: "picked",
        participant: participantRef(participant),
        carry: { materia, cristal },
        cell,
      });
    }
  }
}
