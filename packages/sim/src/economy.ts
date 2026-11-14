// Economy rules (spec section 5, R and I; F3 details decided 2026-11-13):
// carrying capacity, gathering from deposits and delivery to the core.

import type { Params } from "./params.ts";
import type { Creep, Deposit, Team, WorldState } from "./world.ts";

const PERMILLE = 1000;

/** Team upgrades (spec I-3). Each is bought once. */
export const UPGRADES = ["capacity"] as const;
export type UpgradeId = (typeof UPGRADES)[number];

/** Units the creep can carry: its DNA's capacity, raised by the team upgrade. */
export function capacity(creep: Creep, team: Team, params: Params): number {
  const base = params.dna[creep.dna].capacity;
  const bonus = team.upgrades.capacity
    ? params.upgrade.capacity.bonusPermille
    : 0;
  return Math.floor((base * (PERMILLE + bonus)) / PERMILLE);
}

/** Units carried, both resources together. */
export function cargoTotal(creep: Creep): number {
  return creep.cargo.materia + creep.cargo.cristal;
}

export function teamOf(state: WorldState, creep: Creep): Team {
  return state.teams[creep.team]!;
}

export function findDeposit(
  state: WorldState,
  id: number,
): Deposit | undefined {
  return state.deposits.find((d) => d.id === id);
}

/**
 * Moves this tick's share from the deposit into the creep's cargo, limited by
 * the free capacity and by what the deposit holds. Returns true while the
 * creep can keep gathering there.
 */
export function gatherFrom(
  state: WorldState,
  creep: Creep,
  deposit: Deposit,
): boolean {
  const { params } = state;
  const free =
    capacity(creep, teamOf(state, creep), params) - cargoTotal(creep);
  const rate = params.gather.unitsPerSecond * params.world.tickSeconds;
  const taken = Math.max(0, Math.min(rate, free, deposit.amount));
  deposit.amount -= taken;
  creep.cargo[deposit.kind] += taken;
  return free - taken > 0 && deposit.amount > 0;
}
