// The encounter (M2 encontro spec E, F, L; plan section 4), stage 4 of the
// tick, after the orders: an aggressor that reached its target opens an
// encounter; the dialogue is decided; the fight rounds are rolled; the ended
// encounters close. Always in id order, so the calls to state.rng come in a
// fixed order. A creep is in one encounter at most; while in it, it neither
// moves nor follows orders (L-3).

import {
  demandFor,
  freeCapacity,
  opening,
  stockTotal,
  ticks,
} from "./approach.ts";
import { ruleReaction } from "./autopilot.ts";
import { capacity, cargoTotal, teamOf } from "./economy.ts";
import { findCreep } from "./domination.ts";
import { creepRef, emit, type EventLog } from "./events.ts";
import { inCoreZone, kill } from "./hp.ts";
import { manhattan, Terrain } from "./map.ts";
import { speedHere } from "./movement.ts";
import { halt } from "./orders.ts";
import { nextInt, nextRange } from "./rng.ts";
import { dropSpoil, transfer } from "./spoils.ts";
import {
  maxHp,
  type Creep,
  type Encounter,
  type Reply,
  type Stock,
  type WorldState,
} from "./world.ts";

/** Stage 4 of the tick (plan section 5). */
export function runEncounters(state: WorldState, log: EventLog): void {
  expireProtections(state);
  openEncounters(state, log);
  if (state.encounters.length === 0) return;
  const closed = new Set<number>();
  for (const encounter of state.encounters) {
    if (encounter.stage === "dialogue") {
      decideDialogue(state, log, encounter, closed);
    }
  }
  for (const encounter of state.encounters) {
    if (
      !closed.has(encounter.id) &&
      encounter.stage === "fight" &&
      encounter.nextRoundTick !== null &&
      encounter.nextRoundTick <= state.tick
    ) {
      fightRound(state, log, encounter, closed);
    }
  }
  if (closed.size > 0) {
    state.encounters = state.encounters.filter((e) => !closed.has(e.id));
  }
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

/** Where a reaction is decided (plan section 6). */
export type ReactionContext = "extorted" | "attacked" | "round";

type Decision = { choice: Reply; by: "rule" | "player" | "default" };

/**
 * The creep's reaction by its rules, or the defaults when none applies
 * (spec D13): pay an extortion, try to flee an attack, keep fighting a round.
 * Fighting an extortion is refusing it.
 */
function decide(
  state: WorldState,
  creep: Creep,
  context: ReactionContext,
  encounter: Encounter,
): Decision {
  const rule = ruleReaction(state, creep, context, encounter);
  if (rule !== null) {
    const choice = rule === "fight" && context === "extorted" ? "refuse" : rule;
    return { choice, by: "rule" };
  }
  const choice =
    context === "extorted" ? "pay" : context === "attacked" ? "flee" : "fight";
  return { choice, by: "default" };
}

const participants = (state: WorldState, encounter: Encounter) => ({
  aggressor: findCreep(state, encounter.aggressor)!,
  victim: findCreep(state, encounter.victim)!,
});

/**
 * Step 2 (spec E-4..E-7, D6): a free victim reacts now, by its rules; a
 * dominated one by its player's reply, or by its rules once the window is
 * over. Until then both wait.
 */
function decideDialogue(
  state: WorldState,
  log: EventLog,
  encounter: Encounter,
  closed: Set<number>,
): void {
  const { aggressor, victim } = participants(state, encounter);
  const context = encounter.intent === "extort" ? "extorted" : "attacked";
  let decision: Decision;
  if (victim.dominatedBy !== null && encounter.reply !== null) {
    decision = { choice: encounter.reply, by: "player" };
  } else if (
    victim.dominatedBy === null ||
    encounter.deadlineTick === null ||
    state.tick >= encounter.deadlineTick
  ) {
    decision = decide(state, victim, context, encounter);
  } else {
    return;
  }
  encounter.reply = null;
  emit(log, {
    type: "reaction",
    encounter: encounter.id,
    creep: creepRef(victim),
    choice: decision.choice,
    by: decision.by,
    x: encounter.x,
    y: encounter.y,
  });
  switch (decision.choice) {
    case "pay":
      pay(state, log, encounter, aggressor, victim);
      close(state, encounter, closed);
      break;
    case "refuse":
    case "fight":
      startFight(state, encounter);
      break;
    case "flee":
      if (attemptFlee(state, log, encounter, victim, aggressor)) {
        close(state, encounter, closed);
      } else {
        startFight(state, encounter);
      }
      break;
  }
}

/**
 * Pays the demand (E-6): from the victim to the aggressor, as much as they
 * still hold and fit. The victim gets a safe conduct against the
 * aggressor's team, and the pair is blocked (D9).
 */
function pay(
  state: WorldState,
  log: EventLog,
  encounter: Encounter,
  aggressor: Creep,
  victim: Creep,
): void {
  const { params, tick } = state;
  const demand = encounter.demand ?? { materia: 0, cristal: 0 };
  const held = {
    materia: Math.min(demand.materia, victim.cargo.materia),
    cristal: Math.min(demand.cristal, victim.cargo.cristal),
  };
  const amount = demandFor(freeCapacity(state, aggressor), held);
  transfer(victim.cargo, aggressor.cargo, amount);
  victim.safeConduct = {
    team: aggressor.team,
    untilTick: tick + ticks(state, params.safeConduct.seconds),
  };
  victim.extortBlocks = [
    ...victim.extortBlocks.filter((b) => b.aggressor !== aggressor.id),
    {
      aggressor: aggressor.id,
      untilTick: tick + ticks(state, params.safeConduct.blockSeconds),
    },
  ];
  emit(log, {
    type: "paid",
    encounter: encounter.id,
    from: creepRef(victim),
    to: creepRef(aggressor),
    amount,
    x: encounter.x,
    y: encounter.y,
  });
}

function startFight(state: WorldState, encounter: Encounter): void {
  encounter.stage = "fight";
  encounter.deadlineTick = null;
  encounter.nextRoundTick =
    state.tick + ticks(state, state.params.fight.roundSeconds);
}

/**
 * Step 3, a round (spec L-1, D7): the aggressor and then the victim may try
 * to flee; if nobody escapes, the rng picks who hits, each with a chance
 * proportional to its HP share times its DNA's weight. A hit takes a share
 * of the maximum HP of the one hit.
 */
function fightRound(
  state: WorldState,
  log: EventLog,
  encounter: Encounter,
  closed: Set<number>,
): void {
  const { aggressor, victim } = participants(state, encounter);
  const sides: [Creep, Creep, "aggressorReply" | "reply"][] = [
    [aggressor, victim, "aggressorReply"],
    [victim, aggressor, "reply"],
  ];
  for (const [fugitive, opponent, field] of sides) {
    const reply = encounter[field];
    encounter[field] = null;
    const decision: Decision =
      fugitive.dominatedBy !== null && reply === "flee"
        ? { choice: "flee", by: "player" }
        : decide(state, fugitive, "round", encounter);
    if (decision.choice !== "flee") continue;
    emit(log, {
      type: "reaction",
      encounter: encounter.id,
      creep: creepRef(fugitive),
      choice: "flee",
      by: decision.by,
      x: encounter.x,
      y: encounter.y,
    });
    if (attemptFlee(state, log, encounter, fugitive, opponent)) {
      close(state, encounter, closed);
      return;
    }
  }
  const { params } = state;
  const weight = (c: Creep) =>
    Math.max(
      1,
      Math.floor(
        (c.hp * params.hp.dna[c.dna].fightWeightPermille) /
          maxHp(params, c.dna),
      ),
    );
  const wA = weight(aggressor);
  const wV = weight(victim);
  const [hitter, hit] =
    nextInt(state.rng, wA + wV) < wA
      ? [aggressor, victim]
      : [victim, aggressor];
  // maxHp is max × 1000, so its per-mille share is max × hitPermille.
  hit.hp = Math.max(
    0,
    hit.hp - params.hp.dna[hit.dna].max * params.fight.hitPermille,
  );
  encounter.rounds += 1;
  if (hit.hp > 0) {
    encounter.nextRoundTick =
      state.tick + ticks(state, params.fight.roundSeconds);
    return;
  }
  die(state, log, encounter, hitter, hit);
  close(state, encounter, closed);
}

/**
 * The loser dies (L-2, D11): the winner takes its cargo up to the free
 * capacity, cristal first, and the rest is a spoil on the loser's cell.
 */
function die(
  state: WorldState,
  log: EventLog,
  encounter: Encounter,
  winner: Creep,
  loser: Creep,
): void {
  const winnerRef = creepRef(winner);
  const loserRef = creepRef(loser);
  emit(log, {
    type: "fightEnded",
    encounter: encounter.id,
    winner: winnerRef,
    loser: loserRef,
    rounds: encounter.rounds,
    x: encounter.x,
    y: encounter.y,
  });
  const taken = demandFor(freeCapacity(state, winner), loser.cargo);
  transfer(loser.cargo, winner.cargo, taken);
  const rest = { ...loser.cargo };
  const cell = { x: loser.x, y: loser.y };
  const spoil = stockTotal(rest) > 0 ? dropSpoil(state, cell, rest) : null;
  kill(state, loser);
  emit(log, { type: "died", creep: loserRef, by: winnerRef, ...cell });
  if (stockTotal(taken) > 0 || spoil !== null) {
    emit(log, {
      type: "looted",
      by: winnerRef,
      from: loserRef,
      taken,
      spoil,
      ...cell,
    });
  }
}

/**
 * A try to flee (spec F-1..F-3, D10): it escapes with a chance of its speed
 * over the sum of both speeds, where each stands. Escaping, it drops a
 * share of each resource, drawn by the rng (materia, then cristal), as a
 * spoil on its cell, and runs to its core with the bonus.
 */
function attemptFlee(
  state: WorldState,
  log: EventLog,
  encounter: Encounter,
  fugitive: Creep,
  opponent: Creep,
): boolean {
  const { map, params, rng } = state;
  const own = speedHere(fugitive, map, params);
  const other = speedHere(opponent, map, params);
  const escaped = nextInt(rng, own + other) < own;
  let dropped: Stock | null = null;
  let spoil: number | null = null;
  if (escaped) {
    const share = (amount: number) =>
      Math.floor(
        (amount * nextRange(rng, params.flee.dropMinPermille, 1000)) / 1000,
      );
    const materia = share(fugitive.cargo.materia);
    const cristal = share(fugitive.cargo.cristal);
    dropped = { materia, cristal };
    fugitive.cargo.materia -= materia;
    fugitive.cargo.cristal -= cristal;
    if (stockTotal(dropped) > 0) {
      spoil = dropSpoil(state, fugitive, dropped);
    }
  }
  emit(log, {
    type: "fleeAttempt",
    encounter: encounter.id,
    creep: creepRef(fugitive),
    escaped,
    dropped,
    spoil,
    x: fugitive.x,
    y: fugitive.y,
  });
  if (escaped) {
    halt(fugitive);
    fugitive.engagement = null;
    fugitive.order = {
      type: "flee",
      untilTick: state.tick + ticks(state, params.flee.seconds),
    };
  }
  return escaped;
}

/**
 * Step 4: the encounter is over. The living participants are free again,
 * stopped (the autopilot decides on the next tick), save the one fleeing.
 */
function close(
  state: WorldState,
  encounter: Encounter,
  closed: Set<number>,
): void {
  closed.add(encounter.id);
  for (const id of [encounter.aggressor, encounter.victim]) {
    const creep = findCreep(state, id);
    if (creep === undefined) continue;
    creep.engagement = null;
    if (creep.order.type !== "flee") halt(creep);
  }
}
