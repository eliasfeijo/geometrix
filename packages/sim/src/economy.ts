// Economy rules (spec section 5, R and I; F3 details decided 2026-11-13):
// carrying capacity, gathering from deposits and delivery to the core.

import type { Cost, Params } from "./params.ts";
import { recordDepositAmount } from "./stats.ts";
import type { Creep, Deposit, Stock, Team, WorldState } from "./world.ts";

const PERMILLE = 1000;

/** Team upgrades (spec I-3). Each is bought once. */
export const UPGRADES = ["capacity"] as const;
export type UpgradeId = (typeof UPGRADES)[number];

/** Units the creep can carry: its DNA's capacity, raised by the team upgrade. */
export function capacity(
  creep: Pick<Creep, "dna">,
  team: Pick<Team, "upgrades">,
  params: Params,
): number {
  const base = params.dna[creep.dna].capacity;
  const bonus = team.upgrades.capacity
    ? params.upgrade.capacity.bonusPermille
    : 0;
  return Math.floor((base * (PERMILLE + bonus)) / PERMILLE);
}

/** Units carried, both resources together. */
export function cargoTotal(creep: { cargo: Stock }): number {
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
 * Moves the resource's share from the deposit into the creep's cargo on the
 * world seconds of its pace (fog F6, E2), limited by the free capacity and by
 * what the deposit holds. Between them the creep is gathering, waiting.
 */
export function gatherFrom(
  state: WorldState,
  creep: Creep,
  deposit: Deposit,
): void {
  const { params } = state;
  const free =
    capacity(creep, teamOf(state, creep), params) - cargoTotal(creep);
  creep.activity = "gathering";
  const pace = params.gather[deposit.kind];
  const elapsed = (state.tick + 1) * params.world.tickSeconds;
  if (elapsed % pace.everySeconds !== 0) return;
  const taken = Math.max(0, Math.min(pace.units, free, deposit.amount));
  deposit.amount -= taken;
  creep.cargo[deposit.kind] += taken;
  recordDepositAmount(state, deposit);
}

/**
 * Whether an empty `deposit` fills up again: materia regenerates, cristal
 * never does (R-2). A gather waits at a deposit like this (owner decision,
 * 2026-11-14).
 */
export function regenerates(deposit: Deposit, params: Params): boolean {
  return deposit.kind === "materia" && params.deposits.materia.regen.amount > 0;
}

/** Moves the whole cargo into the team stock (spec R-3). */
export function unload(creep: Creep, team: Team): void {
  team.stock.materia += creep.cargo.materia;
  team.stock.cristal += creep.cargo.cristal;
  creep.cargo.materia = 0;
  creep.cargo.cristal = 0;
}

/**
 * Stage 6: every regen.everySeconds of world time, materia deposits gain
 * regen.amount, up to their initial amount. Cristal never regenerates (R-2):
 * an exhausted cristal deposit stays on the map at 0.
 */
export function regenerate(state: WorldState): void {
  const { materia } = state.params.deposits;
  const elapsed = (state.tick + 1) * state.params.world.tickSeconds;
  if (elapsed % materia.regen.everySeconds !== 0) return;
  for (const deposit of state.deposits) {
    if (deposit.kind !== "materia") continue;
    deposit.amount = Math.min(
      deposit.amount + materia.regen.amount,
      materia.amount,
    );
  }
}

export function canAfford(stock: Stock, cost: Cost): boolean {
  return stock.materia >= cost.materia && stock.cristal >= cost.cristal;
}

export function debit(stock: Stock, cost: Cost): void {
  stock.materia -= cost.materia;
  stock.cristal -= cost.cristal;
}

export type UpgradeRefusal = "owned" | "stock";

/** Why the team cannot buy the upgrade now, or null. Changes nothing. */
export function upgradeRefusal(
  state: WorldState,
  teamId: number,
  upgrade: UpgradeId,
): UpgradeRefusal | null {
  const team = state.teams[teamId]!;
  if (team.upgrades[upgrade]) return "owned";
  if (!canAfford(team.stock, state.params.upgrade[upgrade].cost))
    return "stock";
  return null;
}

/**
 * Buys a team upgrade, paying its cost; it applies at once to every creep of
 * the team (spec I-3). Returns why it was refused, or null; a refusal changes
 * nothing.
 */
export function buyUpgrade(
  state: WorldState,
  teamId: number,
  upgrade: UpgradeId,
): UpgradeRefusal | null {
  const refusal = upgradeRefusal(state, teamId, upgrade);
  if (refusal !== null) return refusal;
  const team = state.teams[teamId]!;
  debit(team.stock, state.params.upgrade[upgrade].cost);
  team.upgrades[upgrade] = true;
  return null;
}
