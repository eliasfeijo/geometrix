// What a click hits. A left click lists every inspectable actor in its area
// (R spec D23, owner 2026-11-27): the creeps of any team, the wanderers, the
// deposit, the core, a spoil and a battle; one alone is selected at once. The
// area is the creeps' hit radius, which grows as the map zooms out. A right
// click keeps the narrower pick of the creeps under it (fog F6, E3).

import type {
  BattleStubView,
  Cell,
  Deposit,
  OrderInput,
  Spoil,
} from "@geometrix/sim";
import { battleSign } from "./combat-marks.ts";
import {
  HIT_RADIUS,
  MIN_HIT_PX,
  markerAt,
  markersAt,
  type Marker,
} from "./layout.ts";
import { cellAt, type Point } from "./view.ts";

export type Selection =
  | { kind: "creep"; id: number }
  | { kind: "wanderer"; id: number }
  | { kind: "deposit"; id: number }
  | { kind: "core"; team: number }
  | { kind: "spoil"; id: number }
  /** A battle, by its sign on the map (junction D16). */
  | { kind: "battle"; id: number };

/** Hit radius of a core around its cell center. */
export const CORE_HIT_RADIUS = 1;

/** What a click can hit, as the view and the map's markers have it. */
export type Scene = {
  markers: readonly Marker[];
  wanderers?: readonly (Cell & { id: number })[];
  deposits?: readonly Deposit[];
  spoils?: readonly Spoil[];
  /** By team; null for a core the team has not seen. */
  cores?: readonly (Cell | null)[];
  battles?: readonly BattleStubView[];
};

/** Whether the battle sign at `point`, if any (it sits on top of the map). */
export function signAt(
  point: Point,
  battles: readonly BattleStubView[],
  viewScale: number,
): BattleStubView | undefined {
  return battles.find((b) => {
    const { x, y, r } = battleSign(b, viewScale);
    return Math.hypot(point.x - x, point.y - y) <= r;
  });
}

/**
 * Every actor in the click's area (D23): the battle whose sign is hit, the
 * creeps by id, the wanderers, the spoils, the deposits and the cores. A
 * deposit or spoil counts when the click is on its cell or, zoomed out,
 * within MIN_HIT_PX of its middle.
 */
export function actorsAt(
  point: Point,
  scene: Scene,
  viewScale: number,
): Selection[] {
  const reach = MIN_HIT_PX / viewScale;
  const cell = cellAt(point);
  const distance = (c: Cell) =>
    Math.hypot(c.x + 0.5 - point.x, c.y + 0.5 - point.y);
  const near = (c: Cell, radius: number) =>
    distance(c) <= Math.max(radius, reach);
  const onCell = (c: Cell) =>
    (c.x === cell.x && c.y === cell.y) || distance(c) <= reach;
  const byDistance = <T extends Cell & { id: number }>(list: readonly T[]) =>
    [...list].sort((a, b) => distance(a) - distance(b) || a.id - b.id);

  const actors: Selection[] = [];
  const sign = signAt(point, scene.battles ?? [], viewScale);
  if (sign !== undefined) actors.push({ kind: "battle", id: sign.id });
  const creeps = markersAt(point, scene.markers, viewScale)
    .flatMap(({ marker: m }) => (m.kind === "creep" ? [m.id] : m.ids))
    .sort((a, b) => a - b);
  for (const id of creeps) actors.push({ kind: "creep", id });
  for (const w of byDistance(scene.wanderers ?? [])) {
    if (near(w, HIT_RADIUS)) actors.push({ kind: "wanderer", id: w.id });
  }
  for (const s of byDistance(scene.spoils ?? [])) {
    if (onCell(s)) actors.push({ kind: "spoil", id: s.id });
  }
  for (const d of byDistance(scene.deposits ?? [])) {
    if (onCell(d)) actors.push({ kind: "deposit", id: d.id });
  }
  (scene.cores ?? []).forEach((core, team) => {
    if (core !== null && near(core, CORE_HIT_RADIUS)) {
      actors.push({ kind: "core", team });
    }
  });
  return actors;
}

/**
 * The creeps a right click or the cursor hits: the one it clearly lands on,
 * else all those under it, by id.
 */
export function creepsUnder(
  point: Point,
  markers: readonly Marker[],
  viewScale: number,
): number[] {
  const marker = markerAt(point, markers, viewScale);
  const hits =
    marker !== null
      ? [marker]
      : markersAt(point, markers, viewScale).map((h) => h.marker);
  return hits
    .flatMap((m) => (m.kind === "creep" ? [m.id] : m.ids))
    .sort((a, b) => a - b);
}

/** Ids of the creeps on the same cell as creep `id`, itself included. */
export function cellmates(
  creeps: readonly (Cell & { id: number })[],
  id: number,
): number[] {
  const creep = creeps.find((c) => c.id === id);
  if (creep === undefined) return [];
  return creeps
    .filter((c) => c.x === creep.x && c.y === creep.y)
    .map((c) => c.id)
    .sort((a, b) => a - b);
}

/**
 * The wanderers in the view within a marker's hit radius of `point`, nearest
 * first (junction W-4: a team's creep may attack one).
 */
export function wanderersAt(
  point: Point,
  wanderers: readonly (Cell & { id: number })[],
): number[] {
  const distance = (w: Cell) =>
    Math.hypot(w.x + 0.5 - point.x, w.y + 0.5 - point.y);
  return wanderers
    .filter((w) => distance(w) <= HIT_RADIUS)
    .sort((a, b) => distance(a) - distance(b) || a.id - b.id)
    .map((w) => w.id);
}

/** Of the creeps under a click, those of another team (M2 encontro C-6). */
export function enemiesIn(
  ids: readonly number[],
  creeps: readonly { id: number; team: number }[],
  team: number,
): number[] {
  return ids.filter((id) => {
    const creep = creeps.find((c) => c.id === id);
    return creep !== undefined && creep.team !== team;
  });
}

/** Of the creeps under a click, the team's own other than `except` (D8). */
export function alliesIn(
  ids: readonly number[],
  creeps: readonly { id: number; team: number }[],
  team: number,
  except: number,
): number[] {
  return ids.filter(
    (id) => id !== except && creeps.some((c) => c.id === id && c.team === team),
  );
}

export const sameSelection = (a: Selection | null, b: Selection | null) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * The order a right click gives the dominated creep (plan section 8, owner
 * decision F7): build road in road mode; else pick up a spoil the team knows
 * (M2 encontro D11), gather at a deposit, deliver at the own core, move
 * anywhere else. An enemy creep opens a menu instead (approachTargets).
 */
export function orderAt(
  point: Point,
  deposits: readonly Deposit[],
  spoils: readonly Spoil[],
  ownCore: Cell,
  roadMode: boolean,
): OrderInput {
  const cell = cellAt(point);
  if (roadMode) return { type: "buildRoad", ...cell };
  const spoil = spoils.find((s) => s.x === cell.x && s.y === cell.y);
  if (spoil !== undefined) return { type: "pickup", spoilId: spoil.id };
  const deposit = deposits.find((d) => d.x === cell.x && d.y === cell.y);
  if (deposit !== undefined) return { type: "gather", depositId: deposit.id };
  if (
    Math.hypot(ownCore.x + 0.5 - point.x, ownCore.y + 0.5 - point.y) <=
    CORE_HIT_RADIUS
  ) {
    return { type: "deliver" };
  }
  return { type: "moveTo", ...cell };
}
