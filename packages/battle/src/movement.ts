// Movement on the grid (spec M-1..M-3, D5, D8; plan sections 3, 7): one cell,
// one creep, four directions, at the DNA's battle speed slowed by the carry.

import { isRock, neighbor } from "./arena.ts";
import { CELL_COST, pointsPerTick } from "./params.ts";
import { nextInt } from "./rng.ts";
import { carryTotal, type BattleState, type Participant } from "./state.ts";

/**
 * The carry brake (spec D8), in per mille of the speed: linear in the load,
 * down to 1000 − fullBrakePermille with a full bag.
 */
export function brakePermille(
  state: BattleState,
  participant: Participant,
): number {
  const brake = state.params.carry.fullBrakePermille;
  return (
    1000 -
    Math.floor((brake * carryTotal(participant.carry)) / participant.capacity)
  );
}

/** Movement points a participant gains per tick, carry brake included. */
export function moveGain(state: BattleState, participant: Participant): number {
  const full = pointsPerTick(
    state.params,
    state.params.dna[participant.dna].cellsPerSecond,
  );
  return Math.floor((full * brakePermille(state, participant)) / 1000);
}

/**
 * Stage 3, the turn (plan P3): whoever means to walk faces that way, even if
 * the way is blocked (spec M-2: against rock or a body, it only turns).
 */
export function turnToIntent(state: BattleState): void {
  for (const participant of state.participants) {
    if (participant.intent.move !== null) {
      participant.facing = participant.intent.move;
    }
  }
}

/**
 * Stage 4, movement (spec M-1..M-3, D22). Points accumulate every tick at the
 * DNA's speed, slowed by the carry: while the intent is to walk, and also
 * while standing, but then only up to CELL_COST. So a creep that stood for
 * the time of a cell has its step ready and leaves on the tick after the
 * order to walk; tapping the key never walks faster than holding it, since
 * standing only caps what holding would have kept. With a full cell's worth,
 * the creep steps into the next cell unless it is off the grid, rock, or
 * taken at the start of the stage (someone leaving a cell frees it only for
 * the next tick). Points past CELL_COST carry over a step, so the pace
 * matches the speed; a blocked creep, or one that loses a dispute, holds
 * CELL_COST and steps as soon as the cell is free. Two creeps stepping into
 * the same cell: the rng picks one, among the candidates in id order, with
 * one call per dispute, disputes in the order of their first candidate's id.
 */
export function moveParticipants(state: BattleState): void {
  const taken = new Set(state.participants.map((p) => p.cell));
  const contenders = new Map<number, Participant[]>();
  for (const participant of state.participants) {
    const dir = participant.intent.move;
    participant.movePoints += moveGain(state, participant);
    if (dir === null) {
      participant.movePoints = Math.min(participant.movePoints, CELL_COST);
      continue;
    }
    if (participant.movePoints < CELL_COST) continue;
    const target = neighbor(state.arena, participant.cell, dir);
    if (target < 0 || isRock(state.arena, target) || taken.has(target)) {
      participant.movePoints = CELL_COST;
      continue;
    }
    const list = contenders.get(target);
    if (list === undefined) contenders.set(target, [participant]);
    else list.push(participant);
  }
  for (const [target, list] of contenders) {
    const winner =
      list.length === 1 ? list[0]! : list[nextInt(state.rng, list.length)]!;
    for (const participant of list) {
      if (participant === winner) {
        participant.cell = target;
        participant.movePoints -= CELL_COST;
      } else {
        participant.movePoints = CELL_COST;
      }
    }
  }
}
