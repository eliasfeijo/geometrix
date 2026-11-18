// The attack (spec A-1..A-5, D4; plan sections 3, 7, P3): stages 3, 5 and 6
// of the tick. Every DNA's kit is in the params: a projectile speed of 0 is a
// melee attack that lands at once, anything else fires a projectile that
// walks cell by cell.
//
// Hits are simultaneous within a tick: stages 3 and 5 only record them, and
// stage 6 applies them all, so two creeps that strike each other in the same
// tick both land their blow, whatever their ids. Whoever is struck down still
// moves in stage 4 and dies in stage 6, where it stands.

import { clearLine, isRock, neighbor } from "./arena.ts";
import {
  emit,
  participantRef,
  refById,
  type BattleEventLog,
} from "./events.ts";
import { addToPile } from "./carry.ts";
import { CELL_COST, msToTicks, pointsPerTick } from "./params.ts";
import {
  carryTotal,
  depart,
  findParticipant,
  type BattleState,
  type Participant,
  type Projectile,
} from "./state.ts";

/** A blow that landed this tick, applied in stage 6. */
export type Hit = { by: number; target: number; damage: number };

/** The participant on `cell`, if any (one cell, one creep: spec D5). */
export function participantAt(
  state: BattleState,
  cell: number,
): Participant | undefined {
  return state.participants.find((p) => p.cell === cell);
}

/** An enemy of `side` on `cell`: allies neither block nor take the shot (D4). */
function enemyAt(
  state: BattleState,
  cell: number,
  side: number,
): Participant | undefined {
  const there = participantAt(state, cell);
  return there !== undefined && there.side !== side ? there : undefined;
}

/**
 * Stage 3, the attack (spec A-1..A-3), after the turn: everyone whose
 * cooldown is over and who means to attack (or armed the latch) strikes
 * towards where it faces, and restarts the cooldown. The cooldown counts down
 * first, so a cooldown of n ticks lets one attack out every n ticks. A melee
 * attack hits the first enemy on the clear line within range (the cell in
 * front, with range 1), or misses; a ranged one spawns a projectile on the
 * cell in front, unless that is rock or off the grid.
 */
export function attack(
  state: BattleState,
  log: BattleEventLog,
  hits: Hit[],
): void {
  for (const participant of state.participants) {
    if (participant.cooldownTicks > 0) participant.cooldownTicks -= 1;
    const { intent } = participant;
    if (participant.cooldownTicks > 0) continue;
    if (!intent.attack && !intent.attackLatch) continue;
    const kit = state.params.dna[participant.dna];
    intent.attackLatch = false;
    participant.cooldownTicks = msToTicks(state.params, kit.cooldownMs);
    const dir = participant.facing;
    emit(log, {
      type: "attacked",
      participant: participantRef(participant),
      dir,
    });
    if (kit.projectileCellsPerSecond === 0) {
      const line = clearLine(state.arena, participant.cell, dir, kit.range);
      for (const cell of line) {
        const target = enemyAt(state, cell, participant.side);
        if (target === undefined) continue;
        hits.push({
          by: participant.id,
          target: target.id,
          damage: kit.damage,
        });
        break;
      }
      continue;
    }
    const cell = neighbor(state.arena, participant.cell, dir);
    if (cell < 0 || isRock(state.arena, cell)) {
      emit(log, {
        type: "missed",
        by: participantRef(participant),
        cell: participant.cell,
        dir,
      });
      continue;
    }
    state.projectiles.push({
      id: state.nextId++,
      owner: participant.id,
      side: participant.side,
      cell,
      dir,
      points: 0,
      // The cell it is born on is the first of its range.
      cellsLeft: kit.range - 1,
      damage: kit.damage,
    });
  }
}

/**
 * Stage 5, the projectiles, in id order and after the creeps moved (plan P3).
 * Each one first checks the cell it is on (who walked into the shot), then
 * gains points at its speed and enters the next cells, checking each. It hits
 * the first enemy it finds, vanishes into rock or off the grid, and vanishes
 * when it would go past its range: it stays on its last cell as long as on
 * any other. A shot that vanishes without a hit says so (`missed`, spec
 * L-8), from the last cell it was on.
 */
export function moveProjectiles(
  state: BattleState,
  log: BattleEventLog,
  hits: Hit[],
): void {
  const spent = new Set<Projectile>();
  for (const projectile of state.projectiles) {
    const hit = (): boolean => {
      const target = enemyAt(state, projectile.cell, projectile.side);
      if (target === undefined) return false;
      hits.push({
        by: projectile.owner,
        target: target.id,
        damage: projectile.damage,
      });
      return true;
    };
    if (hit()) {
      spent.add(projectile);
      continue;
    }
    const owner = refById(state, projectile.owner);
    projectile.points += pointsPerTick(
      state.params,
      state.params.dna[owner.dna].projectileCellsPerSecond,
    );
    while (projectile.points >= CELL_COST) {
      projectile.points -= CELL_COST;
      const next = neighbor(state.arena, projectile.cell, projectile.dir);
      if (projectile.cellsLeft === 0 || next < 0 || isRock(state.arena, next)) {
        spent.add(projectile);
        emit(log, {
          type: "missed",
          by: owner,
          cell: projectile.cell,
          dir: projectile.dir,
        });
        break;
      }
      projectile.cell = next;
      projectile.cellsLeft -= 1;
      if (hit()) {
        spent.add(projectile);
        break;
      }
    }
  }
  if (spent.size > 0) {
    state.projectiles = state.projectiles.filter((p) => !spent.has(p));
  }
}

/**
 * Stage 6, damage and death (spec A-4, A-5). The hits apply in the order they
 * were recorded (melee by attacker id, then projectiles by id), which only
 * decides who is credited with a kill. A blow takes the damage off the
 * target's HP, down to 0; it resets the battle's idle clock (D9, A-4) and the
 * exit count of the target (F-1). A blow on someone already at 0 is lost. Then
 * whoever is at 0 leaves the arena, in id order, leaving its carry in a pile
 * where it stands.
 */
export function applyHits(
  state: BattleState,
  log: BattleEventLog,
  hits: readonly Hit[],
): void {
  const killers = new Map<number, number>();
  for (const { by, target: targetId, damage } of hits) {
    const target = findParticipant(state, targetId)!;
    if (target.hp === 0) continue;
    const dealt = Math.min(damage, target.hp);
    target.hp -= dealt;
    if (dealt > 0) state.idleTicks = 0;
    target.exitTicks = 0;
    state.totals.find((t) => t.id === by)!.dealt += dealt;
    state.totals.find((t) => t.id === targetId)!.taken += dealt;
    emit(log, {
      type: "hit",
      by: refById(state, by),
      target: participantRef(target),
      damage: dealt,
      hp: target.hp,
      cell: target.cell,
    });
    if (target.hp === 0) killers.set(targetId, by);
  }
  if (killers.size === 0) return;
  for (const participant of state.participants) {
    if (participant.hp > 0) continue;
    if (carryTotal(participant.carry) > 0) {
      addToPile(state, participant.cell, participant.carry);
    }
    depart(state, {
      ...participantRef(participant),
      outcome: "died",
      hp: 0,
      carry: { materia: 0, cristal: 0 },
      tick: log.tick,
    });
    emit(log, {
      type: "died",
      participant: participantRef(participant),
      by: refById(state, killers.get(participant.id)!),
    });
  }
  state.participants = state.participants.filter((p) => p.hp > 0);
}
