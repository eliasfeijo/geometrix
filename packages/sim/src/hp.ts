// Hit points (M2 encontro spec H-1..H-3, D3, D4; plan P1). HP lives in the
// creep in thousandths, so per-mille rates of the maximum are whole numbers
// and the same share for every DNA. A creep regenerates once per world
// minute, outside an encounter, faster within the zone of its own core. At 0
// it dies: it leaves the state, and with it any domination over it.

import type { Cell } from "./map.ts";
import { maxHp, type Creep, type WorldState } from "./world.ts";

/** Whether `cell` is within the core zone of `team` (Manhattan, spec H-2). */
export function inCoreZone(
  state: WorldState,
  team: number,
  cell: Cell,
): boolean {
  const { core } = state.teams[team]!;
  const distance = Math.abs(cell.x - core.x) + Math.abs(cell.y - core.y);
  return distance <= state.params.hp.coreZoneRadius;
}

/**
 * Stage 6, with the deposits: on each world minute, every creep outside an
 * encounter gets back its per-mille share of the maximum HP, up to the
 * maximum. Runs on the tick that ends the minute, like regenerate.
 */
export function regenerateHp(state: WorldState): void {
  const { params } = state;
  const elapsed = (state.tick + 1) * params.world.tickSeconds;
  if (elapsed % 60 !== 0) return;
  const { map, coreZone } = params.hp.regenPermillePerMinute;
  for (const creep of state.creeps) {
    // In an encounter or a battle a creep does not heal (junction O-5).
    if (creep.engagement !== null || creep.battle !== null) continue;
    const full = maxHp(params, creep.dna);
    if (creep.hp >= full) continue;
    const permille = inCoreZone(state, creep.team, creep) ? coreZone : map;
    // maxHp is max × 1000, so its per-mille share is max × permille.
    creep.hp = Math.min(
      creep.hp + params.hp.dna[creep.dna].max * permille,
      full,
    );
  }
}

/**
 * Removes a dead creep from the state (spec H-3, D4) and counts it as lost. A
 * domination over it ends with it, like a release and with no cooldown: it
 * lives on the creep. Its id is never reused (nextId only grows). What happens
 * to its cargo is the caller's (loot and spoil, F2). Returns whether it is
 * the match's first blood (E-min D15): no team had lost a creep before.
 */
export function kill(state: WorldState, creep: Creep): boolean {
  const at = state.creeps.indexOf(creep);
  if (at < 0) throw new Error(`kill: creep ${creep.id} is not in the world`);
  state.creeps.splice(at, 1);
  const firstBlood = state.stats.teams.every((team) => team.lost === 0);
  state.stats.teams[creep.team]!.lost += 1;
  return firstBlood;
}
