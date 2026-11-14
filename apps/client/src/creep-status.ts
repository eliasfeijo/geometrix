// What a creep is doing, as the player reads it. The sim's activity says what
// it did in the last tick; a gather that stands empty at its drained deposit
// is waiting for it to regenerate (owner decision, 2026-11-14), not stuck.

import {
  capacity,
  isOwnCreep,
  isOwnTeam,
  type Activity,
  type CreepView,
  type Deposit,
  type ForeignCreepView,
  type ForeignTeam,
  type Params,
  type Team,
} from "@geometrix/sim";

/** A creep of the view: the team's own whole, another team's with D7 fields. */
export type Creep = CreepView | ForeignCreepView;

export type CreepStatus = Activity | "waiting";

/** What the creep is doing; null for another team's creep (spec D7). */
export function creepStatus(
  creep: Creep,
  deposits: Deposit[],
): CreepStatus | null {
  if (!isOwnCreep(creep)) return null;
  const { order } = creep;
  if (order.type === "gather" && creep.activity === "idle") {
    const deposit = deposits.find((d) => d.id === order.depositId);
    if (
      deposit !== undefined &&
      deposit.amount === 0 &&
      deposit.x === creep.x &&
      deposit.y === creep.y
    ) {
      return "waiting";
    }
  }
  return creep.activity;
}

/**
 * The creep's capacity as the view tells it: another team's upgrades are
 * hidden (spec D7), so its creeps show the base capacity of their DNA.
 */
export function viewCapacity(
  creep: Pick<Creep, "dna">,
  team: Team | ForeignTeam | undefined,
  params: Params,
): number {
  const upgrades =
    team !== undefined && isOwnTeam(team)
      ? team
      : { upgrades: { capacity: false } };
  return capacity(creep, upgrades, params);
}

export const STATUS_TEXTS: Record<CreepStatus, string> = {
  gathering: "coletando",
  carrying: "carregando",
  walkingEmpty: "andando vazio",
  building: "construindo estrada",
  idle: "parado",
  waiting: "esperando o depósito regenerar",
};
