// What a creep is doing, as the player reads it. The sim's activity says what
// it did in the last tick; a gather that stands empty at its drained deposit
// is waiting for it to regenerate (owner decision, 2026-11-14), not stuck.

import type { Activity, CreepView, Deposit } from "@geometrix/sim";

export type Creep = CreepView;

export type CreepStatus = Activity | "waiting";

export function creepStatus(creep: Creep, deposits: Deposit[]): CreepStatus {
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

export const STATUS_TEXTS: Record<CreepStatus, string> = {
  gathering: "coletando",
  carrying: "carregando",
  walkingEmpty: "andando vazio",
  building: "construindo estrada",
  idle: "parado",
  waiting: "esperando o depósito regenerar",
};
