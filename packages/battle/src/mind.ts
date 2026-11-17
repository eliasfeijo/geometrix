// What one gambits decision knows and the reasoning it shares between the
// conditions and the actions (plan section 9): who is who on the view, the
// steps around rock, the targets, the lines of the projectiles coming, and
// the way towards a set of cells. Ties are never broken by id (spec D5, the
// fog's F6): a target keeps the previous one and then asks the rng, and
// shortest paths that tie on the first step ask the rng too, so the 180°
// mirror of an arena plays the same in distribution.

import { clearLine, DIRS, neighbor, stepsFrom, type Dir } from "./arena.ts";
import type { Target } from "./gambits.ts";
import type { DnaParams } from "./params.ts";
import { nextInt } from "./rng.ts";
import { carryTotal, type BattleState, type Participant } from "./state.ts";
import type { BattleView, ViewParticipant } from "./view.ts";

export type Mind = {
  state: BattleState;
  view: BattleView;
  /** The deciding participant on the view. */
  self: ViewParticipant;
  /** The same participant in the state, for the AI's memory. */
  participant: Participant;
  kit: DnaParams;
  enemies: ViewParticipant[];
  /** Same side, without self. */
  allies: ViewParticipant[];
  /** Cells of everyone else: one cell, one creep (spec D5). */
  occupied: Set<number>;
  /** Steps from self around rock, bodies ignored (they move); lazy. */
  stepsCache: number[] | null;
};

export function createMind(
  state: BattleState,
  view: BattleView,
  participant: Participant,
): Mind {
  const self = view.participants.find((p) => p.id === participant.id)!;
  const enemies: ViewParticipant[] = [];
  const allies: ViewParticipant[] = [];
  const occupied = new Set<number>();
  for (const other of view.participants) {
    if (other.id === self.id) continue;
    occupied.add(other.cell);
    if (other.side === self.side) allies.push(other);
    else enemies.push(other);
  }
  return {
    state,
    view,
    self,
    participant,
    kit: state.params.dna[self.dna],
    enemies,
    allies,
    occupied,
    stepsCache: null,
  };
}

/** Steps from self to `cell` around rock (bodies ignored), or -1. */
export function stepsTo(mind: Mind, cell: number): number {
  mind.stepsCache ??= stepsFrom(mind.state.arena, [mind.self.cell]);
  return mind.stepsCache[cell]!;
}

/** `p.hp` below `permille` of its maximum (spec D14). */
export function hpBelow(
  state: BattleState,
  p: ViewParticipant,
  permille: number,
): boolean {
  return p.hp * 1000 < permille * state.params.dna[p.dna].hp;
}

/** `p`'s carry above `permille` of its capacity (spec D14). */
export function carryAbove(
  state: BattleState,
  p: ViewParticipant,
  permille: number,
): boolean {
  return (
    carryTotal(p.carry) * 1000 > permille * state.params.dna[p.dna].capacity
  );
}

/** a's HP is a smaller share of its maximum than b's (exact, cross-multiplied). */
function weaker(state: BattleState, a: ViewParticipant, b: ViewParticipant) {
  return a.hp * state.params.dna[b.dna].hp - b.hp * state.params.dna[a.dna].hp;
}

/**
 * One of `tied` (non-empty): the previous target if it is there, else one
 * drawn by the rng (one call, only when more than one tie).
 */
function breakTie(mind: Mind, tied: readonly ViewParticipant[]) {
  const previous = mind.participant.ai.target;
  const kept = tied.find((p) => p.id === previous);
  if (kept !== undefined) return kept;
  if (tied.length === 1) return tied[0]!;
  return tied[nextInt(mind.state.rng, tied.length)]!;
}

/** The candidates with the smallest key (ties kept), in view order. */
function smallest<T>(list: readonly T[], compare: (a: T, b: T) => number): T[] {
  let best: T[] = [];
  for (const item of list) {
    const order = best.length === 0 ? -1 : compare(item, best[0]!);
    if (order < 0) best = [item];
    else if (order === 0) best.push(item);
  }
  return best;
}

/**
 * The enemy a targeted action goes for (plan section 9), among those reachable
 * around rock: the nearest in steps, the weakest by share of HP, or the
 * nearest of a DNA. Ties keep the previous target, then the rng. The choice
 * becomes the AI's memory. Null when there is none.
 */
export function pickTarget(mind: Mind, target: Target): ViewParticipant | null {
  let candidates = mind.enemies.filter((e) => stepsTo(mind, e.cell) >= 0);
  if (target.by === "dna") {
    candidates = candidates.filter((e) => e.dna === target.dna);
  }
  if (candidates.length === 0) return null;
  const nearest = (a: ViewParticipant, b: ViewParticipant) =>
    stepsTo(mind, a.cell) - stepsTo(mind, b.cell);
  const tied =
    target.by === "weakest"
      ? smallest(candidates, (a, b) => weaker(mind.state, a, b))
      : smallest(candidates, nearest);
  const chosen = breakTie(mind, tied);
  mind.participant.ai.target = chosen.id;
  return chosen;
}

/**
 * The cells ahead of each enemy projectile, as far as it can still go: where
 * standing gets hit (the projectile's own cell is checked again in stage 5).
 */
export function dangerCells(mind: Mind): Set<number> {
  const cells = new Set<number>();
  for (const projectile of mind.view.projectiles) {
    if (projectile.side === mind.self.side) continue;
    cells.add(projectile.cell);
    const line = clearLine(
      mind.state.arena,
      projectile.cell,
      projectile.dir,
      projectile.cellsLeft,
    );
    for (const cell of line) cells.add(cell);
  }
  return cells;
}

/** An enemy projectile whose line passes through self (spec D14). */
export function projectileIncoming(mind: Mind): boolean {
  return dangerCells(mind).has(mind.self.cell);
}

/**
 * The first step towards the nearest of `goals` (plan section 9): "here" when
 * self stands on one, null when none can be reached. The path goes around
 * rock and around the others' bodies, to goals nobody else stands on; when
 * bodies close every way, it heads on as if they were not there (it will wait
 * at them). First steps that tie ask the rng.
 */
export function towards(
  mind: Mind,
  goals: readonly number[],
): Dir | "here" | null {
  const { self, state, occupied } = mind;
  if (goals.includes(self.cell)) return "here";
  const free = goals.filter((cell) => !occupied.has(cell));
  let steps = stepsFrom(state.arena, free, occupied, self.cell);
  if (steps[self.cell] === -1) {
    steps = stepsFrom(state.arena, goals, null, self.cell);
  }
  const here = steps[self.cell]!;
  if (here === -1) return null;
  const ways = DIRS.filter((dir) => {
    const there = neighbor(state.arena, self.cell, dir);
    return there >= 0 && steps[there] === here - 1;
  });
  if (ways.length === 1) return ways[0]!;
  return ways[nextInt(state.rng, ways.length)]!;
}

/**
 * The cells from which `cell` is aligned within `range` with a clear line:
 * the clear lines out of `cell` itself, since rock blocks both ways alike.
 * `minDistance` keeps only those at least that far along the line.
 */
export function alignedCells(
  mind: Mind,
  cell: number,
  range: number,
  minDistance = 1,
): number[] {
  const cells: number[] = [];
  for (const dir of DIRS) {
    const line = clearLine(mind.state.arena, cell, dir, range);
    for (let i = minDistance - 1; i < line.length; i++) cells.push(line[i]!);
  }
  return cells;
}
