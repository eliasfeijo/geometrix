// Mouse and keyboard on the map (owner decision, F7): a left click selects,
// a right click orders the dominated creep, R toggles road mode, Esc
// cancels, F centers the view on the selection.

import { markersNow } from "./map/creep-layer.tsx";
import type { ClientCommand } from "@geometrix/protocol";
import { CURSORS, cursorKind, type CursorKind } from "./map/cursor.ts";
import {
  actorsAt,
  alliesIn,
  creepsUnder,
  enemiesIn,
  orderAt,
  signAt,
  wanderersAt,
  type Scene,
  type Selection,
} from "./map/pick.ts";
import { roadPreview } from "./map/road-plan.ts";
import { cellAt, centerOn, type Point } from "./map/view.ts";
import type { GameStore, Mode } from "./store.ts";

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
  if (state === undefined) return;
  const actors = actorsAt(
    point,
    sceneNow(store, now),
    store.view.value?.scale ?? 1,
  );
  if (mode.type === "pickAlly") {
    pickAlly(store, mode, actors, px, now);
    return;
  }
  store.approach.value = null;
  store.hovered.value = null;
  if (actors.length > 1) {
    store.list.value = { actors, at: px };
    return;
  }
  store.list.value = null;
  store.selection.value = actors[0] ?? null;
}

/**
 * "Seguir…" (R spec D9): the click picks a creep of the team; with several
 * in reach, the list asks which.
 */
function pickAlly(
  store: GameStore,
  mode: Extract<Mode, { type: "pickAlly" }>,
  actors: readonly Selection[],
  px: Point,
  now: number,
): void {
  const team = store.info.value?.team;
  const creeps = store.current.value?.state.creeps ?? [];
  const allies = actors.filter(
    (a) =>
      a.kind === "creep" &&
      a.id !== mode.exclude &&
      creeps.some((c) => c.id === a.id && c.team === team),
  );
  const choose = (actor: Selection) => {
    if (actor.kind !== "creep") return;
    store.mode.value = { type: "select" };
    mode.pick(actor.id);
  };
  store.list.value = null;
  if (allies.length === 0) {
    store.notify("Clique num outro creep do seu time.", now);
  } else if (allies.length === 1) {
    choose(allies[0]!);
  } else {
    store.list.value = { actors: allies, at: px, pick: choose };
  }
}

/** What the map shows now, as the click's pick reads it. */
export function sceneNow(store: GameStore, now: number): Scene {
  const state = store.current.value?.state;
  return {
    markers: markersNow(store, now),
    wanderers: state?.wanderers ?? [],
    deposits: state?.deposits ?? [],
    spoils: state?.spoils ?? [],
    cores: store.cores.value,
    battles: state?.battles ?? [],
  };
}

/**
 * In road mode, whether the stock is short for the road to the cell under the
 * pointer. Reads the cell, not the point: the path search runs once per cell.
 */
export function roadShortAt(store: GameStore, team: number): boolean {
  const cell = store.pointerCell.value;
  const state = store.current.value?.state;
  const info = store.info.value;
  const map = store.map.value;
  if (store.mode.value.type !== "road" || cell === null) return false;
  if (state === undefined || info === null || map === null) return false;
  return roadPreview(map, state, info.params, team, cell).short;
}

/**
 * What the cursor over the map shows (fog F6, E4): the main action of a
 * click at the pointer. `orders` is false in a replay; `team` is the viewer's.
 */
export function cursorAt(
  store: GameStore,
  orders: boolean,
  team: number,
  roadShort: boolean,
  now: number,
): CursorKind {
  const point = store.pointer.value;
  const state = store.current.value?.state;
  if (point === null || state === undefined) return "default";
  const scale = store.view.value?.scale ?? 1;
  const actors = actorsAt(point, sceneNow(store, now), scale);
  const core = state.teams[team]?.core;
  const dominated = orders && store.myCreep.value !== null;
  const enemy =
    signAt(point, state.battles, scale) === undefined &&
    (enemiesIn(
      creepsUnder(point, markersNow(store, now), scale),
      state.creeps,
      team,
    ).length > 0 ||
      wanderersAt(point, state.wanderers).length > 0);
  return cursorKind({
    mode: store.mode.value.type,
    pick: enemy
      ? "enemy"
      : actors.length === 0
        ? null
        : actors.some((a) => a.kind === "creep")
          ? "creep"
          : "other",
    order:
      dominated && core !== undefined && core !== null
        ? orderAt(point, state.deposits, state.spoils, core, false).type
        : null,
    roadShort,
  });
}

/** The inline style that puts the cursor of `kind` on the map. */
export const cursorStyle = (kind: CursorKind) => `cursor: ${CURSORS[kind]}`;

let pings = 0;

/**
 * Right click: an order for the creep this player dominates; over enemies in
 * sight, the menu to attack or extort them (M2 encontro C-6), at `px`.
 */
export function order(
  store: GameStore,
  point: Point,
  send: (command: ClientCommand) => Promise<boolean>,
  now: number,
  px: Point,
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
  store.approach.value = null;
  if (!roadMode) {
    const ids = creepsUnder(
      point,
      markersNow(store, now),
      store.view.value?.scale ?? 1,
    );
    // Another team's creeps, then the wanderers under the click (W-4).
    const enemies = [
      ...enemiesIn(ids, state.creeps, me.team),
      ...wanderersAt(point, state.wanderers),
    ];
    const allies = alliesIn(ids, state.creeps, me.team, creep.id);
    if (enemies.length > 0 || allies.length > 0) {
      const core = state.teams[me.team]?.core;
      // An ally hides no order: the menu also offers the cell's (D8).
      const cell =
        allies.length > 0 && core !== undefined && core !== null
          ? {
              cell: cellAt(point),
              order: orderAt(point, state.deposits, state.spoils, core, false),
            }
          : null;
      store.list.value = null;
      store.approach.value = { ids: enemies, allies, cell, at: px };
      return;
    }
  }
  if (roadMode) store.mode.value = { type: "select" };
  const core = state.teams[me.team]?.core;
  if (core === undefined || core === null) return;
  const input = orderAt(point, state.deposits, state.spoils, core, roadMode);
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
    case "wanderer":
      return state.wanderers.find((w) => w.id === selection.id) ?? null;
    case "spoil":
      return state.spoils.find((s) => s.id === selection.id) ?? null;
    case "battle":
      return state.battles.find((b) => b.id === selection.id) ?? null;
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
      if (store.approach.value !== null) {
        store.approach.value = null;
      } else if (store.list.value !== null) {
        store.list.value = null;
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
