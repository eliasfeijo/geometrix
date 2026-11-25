// Deltas of a battle's view (junction plan section 7, P9): `geo net` measured
// the full view in every frame above the 16 KB/s a watcher may take, so the
// frames go through the M1.5 per-field diff (delta.ts), like the team view.
// The server keeps one BattleSent per battle, advanced with each frame every
// screen showing it gets; a screen that opens gets the full view in its
// battleOpen, from the same base, and the deltas after it.

import type {
  BattleView,
  Pile,
  ViewParticipant,
  ViewProjectile,
} from "@geometrix/battle";
import {
  applyEntities,
  diffEntities,
  type Entity,
  type EntityDelta,
  type FieldKinds,
} from "./delta.ts";

/** What changed in a battle view; unchanged parts are left out. */
export type BattleViewDelta = {
  tick: number;
  countdownTicks?: number;
  idleTicks?: number;
  ended?: BattleView["ended"];
  participants?: EntityDelta<ViewParticipant>;
  projectiles?: EntityDelta<ViewProjectile>;
  piles?: EntityDelta<Pile>;
};

/** The view a battle's screens last received, as copied values. */
export type BattleSent = {
  tick: number;
  countdownTicks: number;
  idleTicks: number;
  ended: BattleView["ended"];
  participants: Entity[];
  projectiles: Entity[];
  piles: Entity[];
};

const KINDS = {
  participants: { carry: "value" },
  projectiles: {},
  piles: {},
} satisfies Record<"participants" | "projectiles" | "piles", FieldKinds>;

const COLLECTIONS = Object.keys(KINDS) as (keyof typeof KINDS)[];

export function emptyBattleSent(): BattleSent {
  return {
    tick: -1,
    countdownTicks: -1,
    idleTicks: -1,
    ended: null,
    participants: [],
    projectiles: [],
    piles: [],
  };
}

const sameEnded = (a: BattleView["ended"], b: BattleView["ended"]) =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.tick === b.tick &&
    a.winnerSide === b.winnerSide);

/**
 * The changes from what `sent` holds to `view`, and `sent` advanced to it.
 * The delta shares objects with the view: serialize it before the battle
 * steps again.
 */
export function diffBattleView(
  sent: BattleSent,
  view: BattleView,
): BattleViewDelta {
  const delta: BattleViewDelta = { tick: view.tick };
  if (sent.countdownTicks !== view.countdownTicks) {
    delta.countdownTicks = view.countdownTicks;
  }
  if (sent.idleTicks !== view.idleTicks) delta.idleTicks = view.idleTicks;
  if (!sameEnded(sent.ended, view.ended)) delta.ended = view.ended;
  for (const name of COLLECTIONS) {
    const items = view[name] as unknown as Entity[];
    const { changes, copies } = diffEntities(sent[name], items, KINDS[name]);
    if (changes.upsert !== undefined || changes.remove !== undefined) {
      (delta as Record<string, unknown>)[name] = changes;
    }
    sent[name] = copies;
  }
  sent.tick = view.tick;
  sent.countdownTicks = view.countdownTicks;
  sent.idleTicks = view.idleTicks;
  sent.ended = view.ended === null ? null : { ...view.ended };
  return delta;
}

/** The view the screens last received, rebuilt from `sent`. */
export function sentBattleView(sent: BattleSent): BattleView {
  return {
    tick: sent.tick,
    countdownTicks: sent.countdownTicks,
    idleTicks: sent.idleTicks,
    participants: sent.participants,
    projectiles: sent.projectiles,
    piles: sent.piles,
    ended: sent.ended,
  } as unknown as BattleView;
}

/**
 * The battle view after `delta`. `previous` is left untouched: unchanged
 * entities are shared with it, changed ones are new objects.
 */
export function applyBattleDelta(
  previous: BattleView,
  delta: BattleViewDelta,
): BattleView {
  const next: BattleView = { ...previous, tick: delta.tick };
  if (delta.countdownTicks !== undefined) {
    next.countdownTicks = delta.countdownTicks;
  }
  if (delta.idleTicks !== undefined) next.idleTicks = delta.idleTicks;
  if (delta.ended !== undefined) next.ended = delta.ended;
  for (const name of COLLECTIONS) {
    const changes = delta[name] as EntityDelta<Entity> | undefined;
    if (changes === undefined) continue;
    const items = previous[name] as unknown as Entity[];
    (next as Record<string, unknown>)[name] = applyEntities(items, changes);
  }
  return next;
}
