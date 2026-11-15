// Deltas of a team's view (M1.5 plan sections 3-4, ADR-0006). The server keeps
// a Sent per team stream: copies of the values the team already received.
// diffView compares a fresh view against it, field by field, and advances it;
// applyDelta rebuilds the next view on the client from the previous one,
// creating new objects only for what changed. Both sides agree on the same
// view, checked by hashing viewJson.

import {
  canonicalJson,
  type CreepView,
  type Deposit,
  type ForeignCreepView,
  type ForeignPlayer,
  type ForeignTeam,
  type Player,
  type RoadJob,
  type Team,
  type TeamView,
} from "@geometrix/sim";

/**
 * Changes of one collection: new entities whole, and `{id, ...changed fields}`
 * for existing ones, both in id order; ids removed, in id order.
 */
export type EntityDelta<T extends { id: number }> = {
  upsert?: (Partial<T> & { id: number })[];
  remove?: number[];
};

/** What changed in a view. Collections without changes are left out. */
export type Delta = {
  tick: number;
  teams?: EntityDelta<Team | ForeignTeam>;
  creeps?: EntityDelta<CreepView | ForeignCreepView>;
  deposits?: EntityDelta<Deposit>;
  roadJobs?: EntityDelta<RoadJob>;
  players?: EntityDelta<Player | ForeignPlayer>;
  /** Cells that got a road, increasing. Roads never go away in M1. */
  roads?: number[];
  /** [cell, terrain] of the cells whose known terrain changed (fog plan §8). */
  known?: [number, number][];
  /** Cells that came into sight and that left it, increasing. */
  visible?: { add?: number[]; remove?: number[] };
};

type Entity = { id: number } & Record<string, unknown>;

/**
 * What the team already received, as copied values: the state mutates its
 * objects in place, so nothing here may be one of them. The exception is
 * creep rules, kept by reference (plan R4: rules are replaced whole, never
 * mutated). Build one with emptySent; diffView advances it.
 */
export type Sent = {
  /** Tick and team of the view last diffed (-1 before any). */
  tick: number;
  team: number;
  teams: Entity[];
  creeps: Entity[];
  deposits: Entity[];
  roadJobs: Entity[];
  players: Entity[];
  roads: Set<number>;
  /**
   * The view's known and visible arrays as last diffed. Views build them anew
   * and nothing mutates them, so they are kept by reference.
   */
  known: number[];
  visible: number[];
};

export function emptySent(): Sent {
  return {
    tick: -1,
    team: -1,
    teams: [],
    creeps: [],
    deposits: [],
    roadJobs: [],
    players: [],
    roads: new Set(),
    known: [],
    visible: [],
  };
}

/**
 * A view with nothing in it on a map of `cells` cells: what a client starts
 * from when it rebuilds a stream from its first delta (tests and geo net; a
 * real client starts from a welcome).
 */
export function emptyView(team: number, cells: number): TeamView {
  return {
    tick: 0,
    team,
    teams: [],
    creeps: [],
    deposits: [],
    roads: [],
    roadJobs: [],
    players: [],
    known: new Array<number>(cells).fill(-1),
    visible: [],
  };
}

/**
 * How a field is compared and copied; fields not listed are primitives.
 * "value": an object of primitives or null (orders are recreated every tick
 * with the same value, plan section 1). "ref": compared by reference.
 */
type FieldKinds = Record<string, "value" | "ref">;

const KINDS = {
  teams: {
    core: "value",
    stock: "value",
    upgrades: "value",
    production: "value",
  },
  creeps: {
    cargo: "value",
    order: "value",
    rules: "ref",
    safeConduct: "value",
  },
  deposits: {},
  roadJobs: {},
  players: {},
} satisfies Record<
  keyof Omit<Sent, "roads" | "tick" | "team" | "known" | "visible">,
  FieldKinds
>;

const COLLECTIONS = Object.keys(KINDS) as (keyof typeof KINDS)[];

/**
 * The changes from what `sent` holds to `view`, and `sent` advanced to it.
 * The delta shares objects with the view (and so with the state): serialize
 * it before the next step.
 */
export function diffView(sent: Sent, view: TeamView): Delta {
  const delta: Delta = { tick: view.tick };
  sent.tick = view.tick;
  sent.team = view.team;
  for (const name of COLLECTIONS) {
    const items = view[name] as unknown as Entity[];
    const { changes, copies } = diffEntities(sent[name], items, KINDS[name]);
    if (changes.upsert !== undefined || changes.remove !== undefined) {
      (delta as Record<string, unknown>)[name] = changes;
    }
    sent[name] = copies;
  }
  const roads = view.roads.filter((cell) => !sent.roads.has(cell));
  if (sent.roads.size + roads.length !== view.roads.length) {
    throw new Error("diffView: a road went away; deltas cannot remove roads");
  }
  if (roads.length > 0) {
    delta.roads = roads;
    for (const cell of roads) sent.roads.add(cell);
  }
  const known = diffKnown(sent.known, view.known);
  if (known.length > 0) delta.known = known;
  sent.known = view.known;
  const visible = diffSorted(sent.visible, view.visible);
  if (visible.add !== undefined || visible.remove !== undefined) {
    delta.visible = visible;
  }
  sent.visible = view.visible;
  return delta;
}

/** The cells whose value changed; a cell missing from `before` was -1. */
function diffKnown(
  before: readonly number[],
  after: readonly number[],
): [number, number][] {
  if (before.length > after.length) {
    throw new Error("diffView: the known map shrank");
  }
  const changed: [number, number][] = [];
  for (let i = 0; i < after.length; i++) {
    if ((before[i] ?? -1) !== after[i]) changed.push([i, after[i]!]);
  }
  return changed;
}

/** What `after` added to and removed from `before`, both increasing. */
function diffSorted(
  before: readonly number[],
  after: readonly number[],
): { add?: number[]; remove?: number[] } {
  const add: number[] = [];
  const remove: number[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length || j < after.length) {
    if (j >= after.length || (i < before.length && before[i]! < after[j]!)) {
      remove.push(before[i++]!);
    } else if (i >= before.length || after[j]! < before[i]!) {
      add.push(after[j++]!);
    } else {
      i++;
      j++;
    }
  }
  const changes: { add?: number[]; remove?: number[] } = {};
  if (add.length > 0) changes.add = add;
  if (remove.length > 0) changes.remove = remove;
  return changes;
}

/**
 * Both lists in id order: a merge walk. `copies` is the sent list for `after`:
 * the old copy of an unchanged entity, a new one of a changed entity.
 */
function diffEntities(
  before: readonly Entity[],
  after: readonly Entity[],
  kinds: FieldKinds,
): { changes: EntityDelta<Entity>; copies: Entity[] } {
  const upsert: Entity[] = [];
  const remove: number[] = [];
  const copies: Entity[] = [];
  let i = 0;
  for (const item of after) {
    while (i < before.length && before[i]!.id < item.id) {
      remove.push(before[i++]!.id);
    }
    const old = before[i];
    if (old === undefined || old.id !== item.id) {
      upsert.push(item);
      copies.push(copyEntity(item, kinds));
      continue;
    }
    i++;
    let patch: Entity | null = null;
    const keys = Object.keys(item);
    for (const key of keys) {
      if (!sameField(old[key], item[key], kinds[key])) {
        patch ??= { id: item.id };
        patch[key] = item[key];
      }
    }
    if (Object.keys(old).length !== keys.length) {
      throw new Error(`diffView: #${item.id} lost a field`);
    }
    if (patch === null) {
      copies.push(old);
    } else {
      upsert.push(patch);
      copies.push(copyEntity(item, kinds));
    }
  }
  while (i < before.length) remove.push(before[i++]!.id);
  const changes: EntityDelta<Entity> = {};
  if (upsert.length > 0) changes.upsert = upsert;
  if (remove.length > 0) changes.remove = remove;
  return { changes, copies };
}

function sameField(
  a: unknown,
  b: unknown,
  kind: "value" | "ref" | undefined,
): boolean {
  if (a === b) return true;
  if (kind !== "value" || a === null || b === null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  const keys = Object.keys(y);
  if (Object.keys(x).length !== keys.length) return false;
  for (const key of keys) if (x[key] !== y[key]) return false;
  return true;
}

function copyEntity(item: Entity, kinds: FieldKinds): Entity {
  const copy: Entity = { ...item };
  for (const key in kinds) {
    const value = copy[key];
    if (kinds[key] === "value" && value !== null && typeof value === "object") {
      copy[key] = { ...value };
    }
  }
  return copy;
}

/**
 * The view the team last received, rebuilt from `sent`: what a welcome
 * carries (spec S-1). Its objects are never mutated afterwards: diffView
 * replaces what changes.
 */
export function sentView(sent: Sent): TeamView {
  return {
    tick: sent.tick,
    team: sent.team,
    teams: sent.teams,
    creeps: sent.creeps,
    deposits: sent.deposits,
    roads: [...sent.roads].sort((a, b) => a - b),
    roadJobs: sent.roadJobs,
    players: sent.players,
    known: sent.known,
    visible: sent.visible,
  } as unknown as TeamView;
}

/**
 * The view after `delta`. `previous` is left untouched: unchanged entities
 * and collections are shared with it, changed ones are new objects.
 */
export function applyDelta(previous: TeamView, delta: Delta): TeamView {
  const next: TeamView = { ...previous, tick: delta.tick };
  for (const name of COLLECTIONS) {
    const changes = delta[name] as EntityDelta<Entity> | undefined;
    if (changes === undefined) continue;
    const items = previous[name] as unknown as Entity[];
    (next as Record<string, unknown>)[name] = applyEntities(items, changes);
  }
  if (delta.roads !== undefined) {
    next.roads = mergeSorted(previous.roads, delta.roads);
  }
  if (delta.known !== undefined) {
    next.known = [...previous.known];
    for (const [cell, terrain] of delta.known) next.known[cell] = terrain;
  }
  if (delta.visible !== undefined) {
    const removed = new Set(delta.visible.remove);
    next.visible = mergeSorted(
      previous.visible.filter((cell) => !removed.has(cell)),
      delta.visible.add ?? [],
    );
  }
  return next;
}

function applyEntities(
  items: readonly Entity[],
  changes: EntityDelta<Entity>,
): Entity[] {
  const removed = new Set(changes.remove);
  const upsert = changes.upsert ?? [];
  const result: Entity[] = [];
  let u = 0;
  for (const item of items) {
    while (u < upsert.length && upsert[u]!.id < item.id) {
      result.push(upsert[u++]!);
    }
    if (u < upsert.length && upsert[u]!.id === item.id) {
      result.push({ ...item, ...upsert[u++]! });
    } else if (!removed.has(item.id)) {
      result.push(item);
    }
  }
  while (u < upsert.length) result.push(upsert[u++]!);
  return result;
}

function mergeSorted(a: readonly number[], b: readonly number[]): number[] {
  const merged: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (j >= b.length || (i < a.length && a[i]! < b[j]!)) merged.push(a[i++]!);
    else merged.push(b[j++]!);
  }
  return merged;
}

/** The view as canonical JSON: what the stream's periodic hash covers. */
export function viewJson(view: TeamView): string {
  return canonicalJson(view);
}
