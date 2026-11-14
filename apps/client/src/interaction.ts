// Mouse and keyboard on the map: a left click selects (owner decision, F7),
// Esc clears, F centers the view on the selection.

import { centersNow } from "./map/creep-layer.tsx";
import { pickAt } from "./map/pick.ts";
import { cellAt, centerOn, type Point } from "./map/view.ts";
import type { GameStore } from "./store.ts";

export function select(store: GameStore, point: Point, now: number): void {
  const mode = store.mode.value;
  if (mode.type === "pickCell") {
    store.mode.value = { type: "select" };
    mode.pick(cellAt(point));
    return;
  }
  const state = store.current.value?.state;
  const info = store.info.value;
  if (state === undefined || info === null) return;
  store.selection.value = pickAt(
    point,
    centersNow(store, now),
    state.deposits,
    info.cores,
    store.selection.value,
  );
}

/** The cell of the selection, or of this player's core when none. */
function focusCell(store: GameStore, team: number) {
  const state = store.current.value?.state;
  if (state === undefined) return null;
  const selection = store.selection.value;
  switch (selection?.kind) {
    case "creep":
      return state.creeps.find((c) => c.id === selection.id) ?? null;
    case "deposit":
      return state.deposits.find((d) => d.id === selection.id) ?? null;
    case "core":
      return state.teams[selection.team]?.core ?? null;
    default:
      return state.teams[team]?.core ?? null;
  }
}

/** Handles a key pressed anywhere but in a form field; true if used. */
export function handleKey(
  store: GameStore,
  team: number,
  event: KeyboardEvent,
): boolean {
  const target = event.target as HTMLElement | null;
  if (target?.closest("input, select, textarea") != null) return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  switch (event.key) {
    case "Escape":
      if (store.mode.value.type !== "select") {
        store.mode.value = { type: "select" };
      } else {
        store.selection.value = null;
      }
      return true;
    case "f":
    case "F": {
      const cell = focusCell(store, team);
      const view = store.view.value;
      const info = store.info.value;
      if (cell === null || view === null || info === null) return false;
      store.view.value = centerOn(view, cell, info.map, store.mapSize.value);
      return true;
    }
    default:
      return false;
  }
}
