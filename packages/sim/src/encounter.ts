// The encounter (M2 encontro spec E, L; plan section 4; junction spec D1, D2),
// stage 4 of the tick, after the orders: an aggressor that reached its target
// declares itself. An attack opens a battle at once; an extortion opens a
// dialogue, where the victim pays or refuses, and refusing opens the battle.
// Then the creeps approaching a participant join its battle (battle.ts).
// Always in id order, so the calls to state.rng come in a fixed order. A
// creep is in one encounter at most; while in it, it neither moves nor
// follows orders (L-3).

import { demandFor, freeCapacity, opening, ticks } from "./approach.ts";
import { ruleReaction } from "./autopilot.ts";
import { findWanderer, openBattle, runJoins } from "./battle.ts";
import { capacity, cargoTotal, teamOf } from "./economy.ts";
import { findCreep } from "./domination.ts";
import { creepRef, emit, type EventLog } from "./events.ts";
import { inCoreZone } from "./hp.ts";
import { manhattan, Terrain } from "./map.ts";
import { halt } from "./orders.ts";
import { nextInt } from "./rng.ts";
import { transfer } from "./spoils.ts";
import type {
  Creep,
  Encounter,
  Reply,
  Stance,
  Wanderer,
  WorldState,
} from "./world.ts";

/** Stage 4 of the tick (plan section 5; junction plan section 3). */
export function runEncounters(state: WorldState, log: EventLog): void {
  expireProtections(state);
  openEncounters(state, log);
  openWandererAttacks(state, log);
  if (state.encounters.length > 0) {
    const closed = new Set<number>();
    for (const encounter of state.encounters) {
      decideDialogue(state, log, encounter, closed);
    }
    if (closed.size > 0) {
      state.encounters = state.encounters.filter((e) => !closed.has(e.id));
    }
  }
  runJoins(state, log);
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
    const wanderer = findWanderer(state, a.order.targetId);
    if (wanderer !== undefined) {
      attackWanderer(state, log, a, wanderer);
      continue;
    }
    const target = findCreep(state, a.order.targetId);
    if (target === undefined || target.team === a.team) continue;
    if (manhattan(a, target) > radius) continue;
    // A participant is joined (runJoins), never extorted (J-2): the
    // extortion is impossible, like one with nothing to demand.
    if (target.battle !== null) {
      if (a.order.intent === "extort") halt(a);
      continue;
    }
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
    // Locked by an opening earlier in this step: the joins take it.
    if (a.battle !== null || b.battle !== null) continue;
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

/**
 * A team's creep reached a wanderer (W-4): an attack opens the battle at
 * once, the wanderer fighting; an extortion is impossible and ends (J-2). A
 * wanderer in a battle is joined instead (runJoins).
 */
function attackWanderer(
  state: WorldState,
  log: EventLog,
  creep: Creep,
  wanderer: Wanderer,
): void {
  if (creep.order.type !== "approach") return;
  if (creep.order.intent === "extort") {
    halt(creep);
    return;
  }
  if (wanderer.battle !== null) return;
  if (manhattan(creep, wanderer) > state.params.encounter.radius) return;
  const id = state.nextId++;
  creep.safeConduct = null;
  emit(log, {
    type: "encounter",
    encounter: id,
    aggressor: creepRef(creep),
    victim: creepRef(wanderer),
    intent: "attack",
    demand: null,
    mutual: false,
    x: wanderer.x,
    y: wanderer.y,
  });
  openBattle(state, log, id, "attack", creep, wanderer, "fight");
}

/**
 * The wanderers' attacks (W-2), after the teams' openings: a free wanderer
 * within the encounter radius of its free target opens a battle at once,
 * with no declaration (D14: no dialogue); the victim enters as its rules
 * react to an attack. A target in a battle is joined instead (runJoins), one
 * in an extortion is waited for.
 */
function openWandererAttacks(state: WorldState, log: EventLog): void {
  const { radius } = state.params.encounter;
  for (const wanderer of state.wanderers) {
    const { order } = wanderer;
    if (wanderer.battle !== null || order.type !== "approach") continue;
    const victim = findCreep(state, order.targetId);
    if (victim === undefined || victim.battle !== null) continue;
    if (victim.engagement !== null) continue;
    if (manhattan(wanderer, victim) > radius) continue;
    const stance = decide(state, victim, "attacked").stance;
    openBattle(state, log, null, "wanderer", wanderer, victim, stance);
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
  intent: "attack" | "extort",
  mutual: boolean,
): void {
  const { params, tick } = state;
  const demand =
    intent === "extort"
      ? demandFor(freeCapacity(state, aggressor), victim.cargo)
      : null;
  const id = state.nextId++;
  // Approaching someone ends one's own safe conduct (E-8).
  aggressor.safeConduct = null;
  emit(log, {
    type: "encounter",
    encounter: id,
    aggressor: creepRef(aggressor),
    victim: creepRef(victim),
    intent,
    demand: demand === null ? null : { ...demand },
    mutual,
    x: victim.x,
    y: victim.y,
  });
  if (demand === null) {
    // An attack has no dialogue (D1): the declaration opens the battle.
    const stance = decide(state, victim, "attacked").stance;
    openBattle(state, log, id, "attack", aggressor, victim, stance);
    return;
  }
  const encounter: Encounter = {
    id,
    aggressor: aggressor.id,
    victim: victim.id,
    intent: "extort",
    demand,
    deadlineTick:
      victim.dominatedBy !== null
        ? tick + ticks(state, params.encounter.reactionSeconds)
        : null,
    reply: null,
    x: victim.x,
    y: victim.y,
  };
  state.encounters.push(encounter);
  for (const creep of [aggressor, victim]) {
    creep.engagement = encounter.id;
    halt(creep);
  }
}

/** Where a reaction is decided (plan section 6). */
export type ReactionContext = "extorted" | "attacked";

type Decision = {
  choice: Reply;
  by: "rule" | "player" | "default";
  /** How the victim enters the battle when it does (D2). */
  stance: Stance;
};

/**
 * The creep's reaction by its rules, or the defaults when none applies
 * (spec D13; junction D2): pay an extortion, fight an attack. A fight or a
 * flee rule refuses an extortion; fleeing enters the battle as a carrier.
 */
function decide(
  state: WorldState,
  creep: Creep,
  context: ReactionContext,
  encounter: Encounter | null = null,
): Decision {
  const rule = ruleReaction(state, creep, context, encounter);
  if (rule === "pay") return { choice: "pay", by: "rule", stance: "fight" };
  if (rule !== null) return { choice: "refuse", by: "rule", stance: rule };
  return context === "extorted"
    ? { choice: "pay", by: "default", stance: "fight" }
    : { choice: "refuse", by: "default", stance: "fight" };
}

/**
 * Step 2 (spec E-4..E-7, D6; junction O-2): a free victim reacts now, by its
 * rules; a dominated one by its player's reply, or by its rules once the
 * window is over. Until then both wait. Paying closes the encounter;
 * refusing closes it and opens the battle.
 */
function decideDialogue(
  state: WorldState,
  log: EventLog,
  encounter: Encounter,
  closed: Set<number>,
): void {
  const aggressor = findCreep(state, encounter.aggressor)!;
  const victim = findCreep(state, encounter.victim)!;
  let decision: Decision;
  if (victim.dominatedBy !== null && encounter.reply !== null) {
    decision = { choice: encounter.reply, by: "player", stance: "fight" };
  } else if (
    victim.dominatedBy === null ||
    encounter.deadlineTick === null ||
    state.tick >= encounter.deadlineTick
  ) {
    decision = decide(state, victim, "extorted", encounter);
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
  close(state, encounter, closed);
  if (decision.choice === "pay") {
    pay(state, log, encounter, aggressor, victim);
  } else {
    openBattle(
      state,
      log,
      encounter.id,
      "refused",
      aggressor,
      victim,
      decision.stance,
    );
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
  const { demand } = encounter;
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

/**
 * Step 3: the dialogue is over. Both creeps are free again, stopped (the
 * autopilot decides on the next tick), unless a battle locks them next.
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
    halt(creep);
  }
}
