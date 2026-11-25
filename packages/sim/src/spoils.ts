// Spoils (M2 encontro spec D11, S-1): what a fugitive drops and what the
// winner of a fight cannot carry, piled on a cell for any creep to pick up.
// Piles on the same cell add up, keeping the first pile's id. They never
// expire in this slice.

import { creepRef, emit, type EventLog } from "./events.ts";
import type { Cell } from "./map.ts";
import type { Creep, Spoil, Stock, WorldState } from "./world.ts";

export function findSpoil(state: WorldState, id: number): Spoil | undefined {
  return state.spoils.find((s) => s.id === id);
}

/** Drops `cargo` on `cell`, onto the pile there if any. Returns its id. */
export function dropSpoil(state: WorldState, cell: Cell, cargo: Stock): number {
  const pile = state.spoils.find((s) => s.x === cell.x && s.y === cell.y);
  if (pile !== undefined) {
    pile.cargo.materia += cargo.materia;
    pile.cargo.cristal += cargo.cristal;
    return pile.id;
  }
  // The newest id is the greatest: pushing keeps the id order.
  const spoil: Spoil = {
    id: state.nextId++,
    cargo: { materia: cargo.materia, cristal: cargo.cristal },
    x: cell.x,
    y: cell.y,
  };
  state.spoils.push(spoil);
  return spoil.id;
}

/**
 * The creep drops its whole load as spoils on its cell (R spec D24, DR-1)
 * and the `dropped` event says so. Nothing happens with an empty load.
 */
export function dropCargo(
  state: WorldState,
  log: EventLog,
  creep: Creep,
): void {
  const { cargo } = creep;
  if (cargo.materia + cargo.cristal === 0) return;
  const spoil = dropSpoil(state, creep, cargo);
  emit(log, {
    type: "dropped",
    creep: creepRef(creep),
    spoil,
    cargo: { materia: cargo.materia, cristal: cargo.cristal },
    x: creep.x,
    y: creep.y,
  });
  creep.cargo = { materia: 0, cristal: 0 };
}

/** Moves `amount` from one stock to another. */
export function transfer(from: Stock, to: Stock, amount: Stock): void {
  from.materia -= amount.materia;
  from.cristal -= amount.cristal;
  to.materia += amount.materia;
  to.cristal += amount.cristal;
}

/**
 * The creep takes from the spoil what fits, cristal first (S-1); an emptied
 * spoil leaves the state. Returns what it took.
 */
export function takeSpoil(
  state: WorldState,
  creep: Creep,
  spoil: Spoil,
  free: number,
): Stock {
  const cristal = Math.min(spoil.cargo.cristal, free);
  const materia = Math.min(spoil.cargo.materia, free - cristal);
  const taken = { materia, cristal };
  transfer(spoil.cargo, creep.cargo, taken);
  if (spoil.cargo.materia + spoil.cargo.cristal === 0) {
    state.spoils.splice(state.spoils.indexOf(spoil), 1);
  }
  return taken;
}
