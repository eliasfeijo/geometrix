// The battle state (plan section 5): plain JSON only, arrays ordered by id, ids
// from `nextId`, never reused (spec S-3). stepBattle mutates it in place.

import type { Arena, Dir } from "./arena.ts";
import type { Gambit } from "./gambits.ts";
import type { BattleParams, Dna, Reaction } from "./params.ts";
import type { RngState } from "./rng.ts";

/**
 * Bumped when the same log starts giving another result (plan section 11).
 * Snapshots and logs of another version are refused.
 */
export const BATTLE_VERSION = 5;

export type Carry = { materia: number; cristal: number };

export type Controller = "gambits" | "human";

/**
 * What the creep keeps doing until told otherwise (plan P4): walk towards
 * `move` while it is not null, attack whenever the cooldown allows while
 * `attack`. `attackLatch` fires the next possible attack once, even if the key
 * was already released; `drop` and `pickup` act on the next tick. `bag` is
 * the bag key held (Q or E), which only matters at the end of the countdown
 * (spec S-4): there, what is held acts and what was asked and let go is gone.
 */
export type Intent = {
  move: Dir | null;
  attack: boolean;
  attackLatch: boolean;
  drop: boolean;
  pickup: boolean;
  bag: Bag | null;
};

/** The bag key held: drop (Q) or pick up (E). */
export type Bag = "drop" | "pickup";

export type Participant = {
  id: number;
  side: number;
  name: string;
  dna: Dna;
  /** Index of the cell in the arena. */
  cell: number;
  facing: Dir;
  /** Current HP, 1..maxHp while it is in the arena. */
  hp: number;
  /** From the setup: the world owns max HP and capacity (junction spec D9). */
  maxHp: number;
  carry: Carry;
  /** The most the carry may hold, from the setup (junction spec D9). */
  capacity: number;
  /** The setup's own damage, when it has one (junction D14). */
  damage?: number;
  controller: Controller;
  /** Replaced whole, never mutated in place (like the sim's rules). */
  gambits: Gambit[];
  /** How fast the gambits react, from the setup (spec D20). */
  reaction: Reaction;
  intent: Intent;
  /** Progress towards the next cell, in CELL_COST units (plan P2). */
  movePoints: number;
  cooldownTicks: number;
  /** Consecutive ticks on an exit cell without being hit (spec D7). */
  exitTicks: number;
  ai: { nextDecisionTick: number; target: number | null };
};

/**
 * A side and the entry stretch it uses. Side ids are 0, 1, …; a side that
 * joins later takes the first stretch with no living participants (plan
 * section 8), so the stretch is not always the side's own number.
 */
export type Side = { id: number; entry: number };

export type Projectile = {
  id: number;
  owner: number;
  side: number;
  cell: number;
  dir: Dir;
  points: number;
  cellsLeft: number;
  damage: number;
};

/** What lies on a cell; one pile per cell, which does not block it. */
export type Pile = {
  id: number;
  cell: number;
  materia: number;
  cristal: number;
};

export type Outcome = "died" | "escapedEdge" | "escapedIdle";

/** Who left the arena, and how (spec F-3). */
export type Departure = {
  id: number;
  side: number;
  name: string;
  dna: Dna;
  outcome: Outcome;
  hp: number;
  /** The setup's max HP, so the result can show HP against it. */
  maxHp: number;
  carry: Carry;
  tick: number;
};

/** Damage dealt and taken by a participant, for the result (spec F-3). */
export type Totals = { id: number; dealt: number; taken: number };

export type BattleState = {
  battleVersion: number;
  params: BattleParams;
  arena: Arena;
  rng: RngState;
  /** Ticks stepped so far. */
  tick: number;
  nextId: number;
  sides: Side[];
  participants: Participant[];
  projectiles: Projectile[];
  piles: Pile[];
  departed: Departure[];
  totals: Totals[];
  /**
   * The battle's idle clock (spec D9): fighting ticks since the last blow that
   * took HP off anyone. It starts at the end of the countdown; whoever joins
   * does not reset it.
   */
  idleTicks: number;
  ended: { tick: number; winnerSide: number | null } | null;
};

export function carryTotal(carry: Carry): number {
  return carry.materia + carry.cristal;
}

/** Records who left the arena, keeping `departed` ordered by id (spec S-3). */
export function depart(state: BattleState, departure: Departure): void {
  state.departed.push(departure);
  state.departed.sort((a, b) => a.id - b.id);
}

export function findParticipant(
  state: BattleState,
  id: number,
): Participant | undefined {
  return state.participants.find((p) => p.id === id);
}
