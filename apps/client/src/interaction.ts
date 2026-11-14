// Mouse and keyboard on the map (owner decision, F7): a left click selects,
// a right click orders the dominated creep, R toggles road mode, Esc
// cancels, F centers the view on the selection.

import { markersNow } from "./map/creep-layer.tsx";
import type { ClientCommand } from "@geometrix/protocol";
import { orderAt, pickAt } from "./map/pick.ts";
import { cellAt, centerOn, type Point } from "./map/view.ts";
import type { GameStore } from "./store.ts";

export function select(
  store: GameStore,
  point: Point,
  px: Point,
  now: number,
): void {
  const mode = store.mode.value;
  if (mode.type === "pickCell") {
    store.mode.value = { type: "select" };
    mode.pick(cellAt(point));
    return;
  }
  const state = store.current.value?.state;
  const info = store.info.value;
  if (state === undefined || info === null) return;
  const pick = pickAt(
    point,
    markersNow(store, now),
    state.deposits,
    info.cores,
  );
  if (pick?.kind === "stack") {
    store.stack.value = { ids: pick.ids, at: px };
    return;
  }
  store.stack.value = null;
  store.hovered.value = null;
  store.selection.value = pick;
}

let pings = 0;

/** Right click: an order for the creep this player dominates. */
export function order(
  store: GameStore,
  point: Point,
  send: (command: ClientCommand) => Promise<boolean>,
  now: number,
): void {
  const state = store.current.value?.state;
  const me = store.me.value;
  if (state === undefined || me === null) return;
  const creep = store.myCreep.value;
  if (creep === null) {
    store.notify("Domine um creep para dar ordens com o botão direito.", now);
    return;
  }
  const roadMode = store.mode.value.type === "road";
  if (roadMode) store.mode.value = { type: "select" };
  const input = orderAt(
    point,
    state.deposits,
    state.teams[me.team]!.core,
    roadMode,
  );
  store.ping.value = { cell: cellAt(point), id: ++pings };
  void send({ type: "order", creepId: creep.id, order: input });
}

/** Road mode is for the dominated creep: on with one, off otherwise. */
export function toggleRoadMode(store: GameStore): void {
  store.mode.value =
    store.mode.value.type !== "road" && store.myCreep.value !== null
      ? { type: "road" }
      : { type: "select" };
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
      if (store.stack.value !== null) {
        store.stack.value = null;
        store.hovered.value = null;
      } else if (store.mode.value.type !== "select") {
        store.mode.value = { type: "select" };
      } else {
        store.selection.value = null;
      }
      return true;
    case "r":
    case "R":
      if (store.myCreep.value === null) return false;
      toggleRoadMode(store);
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
