// The encounter (M2 encontro spec E, F, L; plan section 4), stage 4 of the
// tick, after the orders: an aggressor that reached its target opens an
// encounter; the dialogue is decided; the fight rounds are rolled; the ended
// encounters close. Always in id order, so the calls to state.rng come in a
// fixed order. A creep is in one encounter at most; while in it, it neither
// moves nor follows orders (L-3).

import { capacity, cargoTotal, teamOf } from "./economy.ts";
import { findCreep } from "./domination.ts";
import { creepRef, emit, type EventLog } from "./events.ts";
import { inCoreZone } from "./hp.ts";
import { manhattan, Terrain } from "./map.ts";
import { halt } from "./orders.ts";
import { nextInt } from "./rng.ts";
import type { Creep, Encounter, Stock, WorldState } from "./world.ts";

/**
 * What an extortion demands (spec D8): the victim's cargo up to the
 * aggressor's free capacity, cristal first. Works on views too (the client
 * shows it before confirming, C-6).
 */
export function demandFor(free: number, cargo: Stock): Stock {
  const cristal = Math.max(0, Math.min(cargo.cristal, free));
  const materia = Math.max(0, Math.min(cargo.materia, free - cristal));
  return { materia, cristal };
}

export const stockTotal = (stock: Stock) => stock.materia + stock.cristal;

/** Units the creep can still carry. */
export function freeCapacity(state: WorldState, creep: Creep): number {
  return (
    capacity(creep, teamOf(state, creep), state.params) - cargoTotal(creep)
  );
}

/** Whether the aggressor `aggressorId` may not extort `victim` again yet (D9). */
export function extortBlocked(
  victim: Creep,
  aggressorId: number,
  tick: number,
): boolean {
  return victim.extortBlocks.some(
    (b) => b.aggressor === aggressorId && b.untilTick > tick,
  );
}

const ticks = (state: WorldState, seconds: number) =>
  seconds / state.params.world.tickSeconds;

/**
 * Whether `aggressor` can open an encounter with `victim` now: "open"; "wait"
 * while the victim is busy, protected against the aggressor's team, or (for
 * an extortion) fleeing; "end" for an extortion with nothing to demand or a
 * blocked pair (spec E-5, D9): the approach is over.
 */
export function opening(
  state: WorldState,
  aggressor: Creep,
  victim: Creep,
  intent: Encounter["intent"],
): "open" | "wait" | "end" {
  if (victim.engagement !== null) return "wait";
  if (victim.safeConduct?.team === aggressor.team) return "wait";
  if (intent === "attack") return "open";
  if (victim.order.type === "flee") return "wait";
  if (extortBlocked(victim, aggressor.id, state.tick)) return "end";
  const demand = demandFor(freeCapacity(state, aggressor), victim.cargo);
  return stockTotal(demand) === 0 ? "end" : "open";
}

/** Stage 4 of the tick (plan section 5). */
export function runEncounters(state: WorldState, log: EventLog): void {
  expireProtections(state);
  openEncounters(state, log);
}

/**
 * Safe conducts end with time or in the creep's own core zone (spec E-8);
 * expired extortion blocks are dropped.
 */
function expireProtections(state: WorldState): void {
  const { tick } = state;
  for (const creep of state.creeps) {
    const conduct = creep.safeConduct;
    if (
      conduct !== null &&
      (conduct.untilTick <= tick || inCoreZone(state, creep.team, creep))
    ) {
      creep.safeConduct = null;
    }
    if (creep.extortBlocks.some((b) => b.untilTick <= tick)) {
      creep.extortBlocks = creep.extortBlocks.filter((b) => b.untilTick > tick);
    }
  }
}

type Pair = { a: Creep; b: Creep; mutual: boolean };

/**
 * Step 1, open (spec E-3, E-9): creeps with an approach order within the
 * encounter radius of their target. Pairs are taken by their lower creep id;
 * a creep that opened one in this step leaves the pairs after it.
 */
function openEncounters(state: WorldState, log: EventLog): void {
  const { radius } = state.params.encounter;
  const pairs: Pair[] = [];
  for (const a of state.creeps) {
    if (a.order.type !== "approach" || a.engagement !== null) continue;
    const target = findCreep(state, a.order.targetId);
    if (target === undefined || target.team === a.team) continue;
    if (manhattan(a, target) > radius) continue;
    const mutual =
      target.order.type === "approach" &&
      target.order.targetId === a.id &&
      target.engagement === null;
    // A mutual pair was taken when its lower id came by.
    if (mutual && target.id < a.id) continue;
    pairs.push({ a, b: target, mutual });
  }
  const key = (p: Pair) => Math.min(p.a.id, p.b.id);
  pairs.sort((p, q) => key(p) - key(q));
  for (const { a, b, mutual } of pairs) {
    if (a.engagement !== null || b.engagement !== null) continue;
    if (!mutual) {
      tryOpen(state, log, a, b, false);
      continue;
    }
    const [first, second] = whoChoosesFirst(state, a, b);
    if (!tryOpen(state, log, first, second, true)) {
      tryOpen(state, log, second, first, true);
    }
  }
}

/** Opens the encounter if it can, or ends the approach. Whether it opened. */
function tryOpen(
  state: WorldState,
  log: EventLog,
  aggressor: Creep,
  victim: Creep,
  mutual: boolean,
): boolean {
  if (aggressor.order.type !== "approach") return false;
  const { intent } = aggressor.order;
  const result = opening(state, aggressor, victim, intent);
  if (result === "end") halt(aggressor);
  if (result !== "open") return false;
  open(state, log, aggressor, victim, intent, mutual);
  return true;
}

/**
 * Who of a mutual pair chooses first (spec D12): the one not on the river
 * or a crossing, then the one with less cargo for its capacity, then the rng.
 * Never the id: it would break the mirror between the teams.
 */
function whoChoosesFirst(
  state: WorldState,
  a: Creep,
  b: Creep,
): [Creep, Creep] {
  const { map } = state;
  const wet = (c: Creep) => {
    const terrain = map.terrain[c.y * map.width + c.x];
    return terrain === Terrain.crossing || terrain === Terrain.river;
  };
  if (wet(a) !== wet(b)) return wet(a) ? [b, a] : [a, b];
  // cargo ÷ capacity, compared by cross-multiplying.
  const capA = capacity(a, teamOf(state, a), state.params);
  const capB = capacity(b, teamOf(state, b), state.params);
  const loadA = cargoTotal(a) * capB;
  const loadB = cargoTotal(b) * capA;
  if (loadA !== loadB) return loadA < loadB ? [a, b] : [b, a];
  return nextInt(state.rng, 2) === 0 ? [a, b] : [b, a];
}

function open(
  state: WorldState,
  log: EventLog,
  aggressor: Creep,
  victim: Creep,
  intent: Encounter["intent"],
  mutual: boolean,
): void {
  const { params, tick } = state;
  // Caught while fleeing, an attack goes straight to the fight (F-4).
  const fight = intent === "attack" && victim.order.type === "flee";
  const demand =
    intent === "extort"
      ? demandFor(freeCapacity(state, aggressor), victim.cargo)
      : null;
  const encounter: Encounter = {
    id: state.nextId++,
    aggressor: aggressor.id,
    victim: victim.id,
    intent,
    stage: fight ? "fight" : "dialogue",
    demand,
    deadlineTick:
      !fight && victim.dominatedBy !== null
        ? tick + ticks(state, params.encounter.reactionSeconds)
        : null,
    reply: null,
    aggressorReply: null,
    nextRoundTick: fight
      ? tick + ticks(state, params.fight.roundSeconds)
      : null,
    rounds: 0,
    x: victim.x,
    y: victim.y,
  };
  state.encounters.push(encounter);
  for (const creep of [aggressor, victim]) {
    creep.engagement = encounter.id;
    halt(creep);
  }
  // Approaching someone ends one's own safe conduct (E-8).
  aggressor.safeConduct = null;
  emit(log, {
    type: "encounter",
    encounter: encounter.id,
    aggressor: creepRef(aggressor),
    victim: creepRef(victim),
    intent,
    demand: demand === null ? null : { ...demand },
    mutual,
    x: encounter.x,
    y: encounter.y,
  });
}
