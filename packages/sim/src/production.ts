// Creep production at the core (spec I-1, plan P5; F3 details decided
// 2026-11-13): one creep at a time, paid when it starts, spawned on the core
// after creep.productionSeconds. "Repeat" starts the same DNA again whenever the
// core is free, waiting while the stock or the population cap does not allow.

import { canAfford, debit } from "./economy.ts";
import { creepRef, emit, type EventLog } from "./events.ts";
import type { Dna, Params } from "./params.ts";
import { spawnCreep, type Team, type WorldState } from "./world.ts";

export type ProductionRefusal = "busy" | "populationCap" | "stock";

/**
 * The part of the state that production checks read. The client passes the
 * state it gets over the wire, whose creeps have no cached path.
 */
export type ProductionView = {
  params: Params;
  creeps: readonly { team: number }[];
};

/** Living creeps of the team plus the one in production. */
export function population(state: ProductionView, team: Team): number {
  let count = team.production === null ? 0 : 1;
  for (const creep of state.creeps) if (creep.team === team.id) count++;
  return count;
}

/**
 * Starts producing a creep of `dna`, paying its cost now. With `repeat`, the
 * core produces that DNA again after each one; without it, any armed repeat is
 * dropped. Returns why it was refused, or null; a refusal changes nothing.
 */
export function startProduction(
  state: WorldState,
  teamId: number,
  dna: Dna,
  repeat: boolean,
): ProductionRefusal | null {
  const team = state.teams[teamId]!;
  const refusal = tryStart(state, team, dna);
  if (refusal === null) team.repeat = repeat ? dna : null;
  return refusal;
}

/** Why the team cannot start producing now, or null. Changes nothing. */
export function productionRefusal(
  state: ProductionView,
  team: Team,
): ProductionRefusal | null {
  const { params } = state;
  if (team.production !== null) return "busy";
  if (population(state, team) >= params.population.cap) return "populationCap";
  if (!canAfford(team.stock, params.creep.cost)) return "stock";
  return null;
}

function tryStart(
  state: WorldState,
  team: Team,
  dna: Dna,
): ProductionRefusal | null {
  const refusal = productionRefusal(state, team);
  if (refusal !== null) return refusal;
  const { params } = state;
  debit(team.stock, params.creep.cost);
  team.production = { dna, remainingSeconds: params.creep.productionSeconds };
  return null;
}

/**
 * Stage 4: advances each core's production, spawns finished creeps (a born
 * event each), and restarts armed repeats. Teams in id order.
 */
export function runProduction(state: WorldState, log: EventLog): void {
  for (const team of state.teams) {
    const { production } = team;
    if (production !== null) {
      production.remainingSeconds -= state.params.world.tickSeconds;
      if (production.remainingSeconds <= 0) {
        const creep = spawnCreep(state, team, production.dna);
        emit(log, {
          type: "born",
          creep: creepRef(creep),
          x: creep.x,
          y: creep.y,
        });
        team.production = null;
      }
    }
    if (team.production === null && team.repeat !== null) {
      tryStart(state, team, team.repeat);
    }
  }
}
