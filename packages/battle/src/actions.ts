// The gambits actions (spec D14, plan section 9). Each one turns a decision
// into the participant's commands for the tick, the same vocabulary as the
// human's (spec G-2), or says it cannot be done now (null), and the next rule
// is tried. The intent they set lasts until the next decision (plan P12).
//
// The ones that stop somewhere never stop on the exit ring (only flee aims
// there; a pile on the ring is still picked up).
//
//   attack        go until the target is aligned within range, then face it
//                 and fire; melee: until next to it; one step short of the
//                 line, wait half the time (see lineUp); ranged, the way
//                 goes around the cells a melee enemy reaches (meleeReach)
//   approach      go next to the target, then stand facing it
//   keepDistance  stand aligned with the target between range − 1 and range,
//                 and fire from there; back off when it comes closer; lines
//                 up as attack does, around the melee reach too
//   dodge         step to a free cell off every incoming projectile's line
//   protect       stand next to the most wounded ally, on the side of the
//                 enemy nearest to it; there, fire at that enemy if aligned
//   flee          go to the nearest exit cell and stay
//   drop          leave the whole carry here
//   pickup        go to the nearest pile and pick it up

import {
  alignedDir,
  DIRS,
  exitCells,
  isExit,
  neighbor,
  rockStepsFrom,
  type Dir,
} from "./arena.ts";
import type { BattleCommand } from "./commands.ts";
import type { Action, Condition, Target } from "./gambits.ts";
import {
  alignedCells,
  dangerCells,
  hpBelow,
  pickTarget,
  stepsTo,
  towards,
  meleeReach,
  type Mind,
} from "./mind.ts";
import { nextInt } from "./rng.ts";
import { carryTotal } from "./state.ts";
import type { ViewParticipant } from "./view.ts";

type Commands = BattleCommand[] | null;

function still(mind: Mind): BattleCommand[] {
  return [{ type: "intent", id: mind.self.id, move: null, attack: false }];
}

function go(mind: Mind, dir: Dir): BattleCommand[] {
  return [{ type: "intent", id: mind.self.id, move: dir, attack: false }];
}

/** Turn to `dir` and keep firing until the next decision. */
function fire(mind: Mind, dir: Dir): BattleCommand[] {
  return [
    { type: "face", id: mind.self.id, dir },
    { type: "intent", id: mind.self.id, move: null, attack: true },
  ];
}

/** Walk towards `goals`; at one of them, `there` decides. */
function reach(
  mind: Mind,
  goals: readonly number[],
  there: () => Commands,
): Commands {
  const way = towards(mind, goals);
  if (way === null) return null;
  return way === "here" ? there() : go(mind, way);
}

/**
 * Line up a shot at `target` from `goals`, and fire from there. One step
 * short of the line, it waits instead half the time (one rng call): two
 * shooters that both step into the other's row swap rows forever when the
 * gap is odd, and the one that waits lets the other walk into its line.
 */
function lineUp(
  mind: Mind,
  target: ViewParticipant,
  goals: readonly number[],
): Commands {
  const ranged = mind.kit.projectileCellsPerSecond !== 0;
  const way = towards(mind, goals, ranged ? meleeReach(mind) : null);
  if (way === null) return null;
  if (way === "here") return fireAt(mind, target);
  const next = neighbor(mind.state.arena, mind.self.cell, way);
  if (goals.includes(next) && nextInt(mind.state.rng, 2) === 0) {
    return still(mind);
  }
  return go(mind, way);
}

/**
 * The cells an action may stop on: in the grid and off the exit ring, where
 * standing a while would escape (spec D7). Only flee aims at the ring.
 */
function standable(mind: Mind, cells: readonly number[]): number[] {
  return cells.filter((cell) => cell >= 0 && !isExit(mind.state.arena, cell));
}

/** Fire at `target` if it is aligned within range from where self stands. */
function fireAt(mind: Mind, target: ViewParticipant): Commands {
  const dir = alignedDir(
    mind.state.arena,
    mind.self.cell,
    target.cell,
    mind.kit.range,
  );
  return dir === null ? null : fire(mind, dir);
}

function attack(mind: Mind, by: Target): Commands {
  const target = pickTarget(mind, by);
  if (target === null) return null;
  const goals = standable(
    mind,
    alignedCells(mind, target.cell, mind.kit.range),
  );
  return lineUp(mind, target, goals);
}

function approach(mind: Mind, by: Target): Commands {
  const target = pickTarget(mind, by);
  if (target === null) return null;
  const { arena } = mind.state;
  const next = DIRS.map((dir) => neighbor(arena, target.cell, dir));
  return reach(mind, standable(mind, next), () => {
    const dir = alignedDir(arena, mind.self.cell, target.cell, 1)!;
    return [{ type: "face", id: mind.self.id, dir }, ...still(mind)];
  });
}

function keepDistance(mind: Mind, by: Target): Commands {
  const target = pickTarget(mind, by);
  if (target === null) return null;
  const { range } = mind.kit;
  // Where the lines out of the target are cut short by rock, the band does
  // not exist: then anywhere aligned will do.
  let goals = standable(
    mind,
    alignedCells(mind, target.cell, range, Math.max(range - 1, 1)),
  );
  if (goals.length === 0) {
    goals = standable(mind, alignedCells(mind, target.cell, range));
  }
  return lineUp(mind, target, goals);
}

function dodge(mind: Mind): Commands {
  const danger = dangerCells(mind);
  if (!danger.has(mind.self.cell)) return null;
  const { arena } = mind.state;
  const safe = DIRS.filter((dir) => {
    const cell = neighbor(arena, mind.self.cell, dir);
    return (
      cell >= 0 &&
      arena.rock[cell] === 0 &&
      !mind.occupied.has(cell) &&
      !danger.has(cell)
    );
  });
  if (safe.length === 0) return null;
  const dir =
    safe.length === 1 ? safe[0]! : safe[nextInt(mind.state.rng, safe.length)]!;
  return go(mind, dir);
}

/** The first of `list` with the smallest `key`, ties drawn by the rng. */
function drawSmallest<T>(
  mind: Mind,
  list: readonly T[],
  key: (t: T) => number,
) {
  let best: T[] = [];
  let bestKey = 0;
  for (const item of list) {
    const k = key(item);
    if (best.length === 0 || k < bestKey) {
      best = [item];
      bestKey = k;
    } else if (k === bestKey) {
      best.push(item);
    }
  }
  if (best.length <= 1) return best[0];
  return best[nextInt(mind.state.rng, best.length)];
}

/**
 * The ally to protect: the most wounded (by share of HP) among those the
 * rule's condition names (allyHpBelow), or among all allies.
 */
function wardOf(mind: Mind, when: Condition): ViewParticipant | undefined {
  let allies = mind.allies;
  if (when.type === "allyHpBelow") {
    allies = allies.filter((a) => {
      const steps = stepsTo(mind, a.cell);
      return hpBelow(a, when.permille) && steps >= 0 && steps <= when.cells;
    });
  }
  // Share of HP in per mille, floored: close enough to rank the wounded.
  return drawSmallest(mind, allies, (a) => Math.floor((a.hp * 1000) / a.maxHp));
}

function protect(mind: Mind, when: Condition): Commands {
  const ward = wardOf(mind, when);
  if (ward === undefined) return null;
  const { arena } = mind.state;
  const fromWard = rockStepsFrom(arena, ward.cell);
  const reachable = mind.enemies.filter((e) => fromWard[e.cell]! >= 0);
  const enemy = drawSmallest(mind, reachable, (e) => fromWard[e.cell]!);
  if (enemy === undefined) return null;
  // The ward's neighbours nearest to the enemy: the cells that stand between.
  const fromEnemy = rockStepsFrom(arena, enemy.cell);
  const around = DIRS.map((dir) => neighbor(arena, ward.cell, dir));
  const sides = standable(mind, around).filter(
    (cell) =>
      fromEnemy[cell]! >= 0 &&
      (cell === mind.self.cell || !mind.occupied.has(cell)),
  );
  if (sides.length === 0) return null;
  const nearest = Math.min(...sides.map((cell) => fromEnemy[cell]!));
  const goals = sides.filter((cell) => fromEnemy[cell] === nearest);
  return reach(mind, goals, () => fireAt(mind, enemy) ?? still(mind));
}

function flee(mind: Mind): Commands {
  return reach(mind, exitCells(mind.state.arena), () => still(mind));
}

function drop(mind: Mind): Commands {
  if (carryTotal(mind.self.carry) === 0) return null;
  return [{ type: "drop", id: mind.self.id }];
}

function pickup(mind: Mind): Commands {
  if (carryTotal(mind.self.carry) >= mind.self.capacity) return null;
  const piles = mind.view.piles.map((p) => p.cell);
  return reach(mind, piles, () => [
    ...still(mind),
    { type: "pickup", id: mind.self.id },
  ]);
}

/** The commands of `action` for this tick, or null if it cannot be done. */
export function actionCommands(
  mind: Mind,
  action: Action,
  when: Condition,
): Commands {
  switch (action.type) {
    case "attack":
      return attack(mind, action.target);
    case "approach":
      return approach(mind, action.target);
    case "keepDistance":
      return keepDistance(mind, action.target);
    case "dodge":
      return dodge(mind);
    case "protect":
      return protect(mind, when);
    case "flee":
      return flee(mind);
    case "drop":
      return drop(mind);
    case "pickup":
      return pickup(mind);
  }
}
