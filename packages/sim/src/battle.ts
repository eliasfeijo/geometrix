// The battle as the world keeps it (junction spec D1–D8, plan section 3;
// ADR-0010). The fight runs in the junction host, next to the world; the
// world keeps a stub (where, who, the bubble), locks its participants, lets
// attackers join and applies the results the host sends back as system
// commands (battleExit, battleEnd). Always in id order.

import { stockTotal, ticks } from "./approach.ts";
import { capacity, cargoTotal, teamOf } from "./economy.ts";
import { findCreep } from "./domination.ts";
import { creepRef, emit, type CreepRef, type EventLog } from "./events.ts";
import { kill } from "./hp.ts";
import { knownMap } from "./known.ts";
import { isInMap, type Cell } from "./map.ts";
import { nearestTargets } from "./pathfinding.ts";
import { cellModifier } from "./movement.ts";
import { halt } from "./orders.ts";
import { dropSpoil, transfer } from "./spoils.ts";
import {
  isWanderer,
  sideTeam,
  type Battle,
  type BattleSide,
  type BattleWindow,
  type Creep,
  type Fighter,
  type Stance,
  type Stock,
  type Wanderer,
  type WorldState,
} from "./world.ts";

/**
 * The player id of the system commands the junction host sends (plan P2):
 * no real player has it (the server's ids start at 1).
 */
export const SYSTEM_PLAYER_ID = 0;

/**
 * How a battle opened: an attack, an extortion refused (O-1, O-2), or a
 * wanderer's attack (W-2).
 */
export type BattleCause = "attack" | "refused" | "wanderer";

/** What a participant leaves the battle with (plan section 3, P2). */
export type BattleExitCommand = {
  type: "battleExit";
  battleId: number;
  creepId: number;
  /** Death, or an escape by the border (X-1, X-2). */
  outcome: "died" | "escaped";
  /** Whole HP points (D9): 0 for a death. */
  hp: number;
  /** The load it leaves with; a dead creep's stayed in the arena. */
  cargo: Stock;
  /** The world cell it leaves on (the host maps the arena cell, D7). */
  cell: Cell;
  /** The world id of the creep that killed it, if any (the chronicle). */
  by: number | null;
};

/** A participant still in the arena when the battle ends (X-3, X-4). */
export type BattleSurvivor = {
  creepId: number;
  hp: number;
  cargo: Stock;
  cell: Cell;
};

/** A pile left in the arena, on its world cell (D8). */
export type BattlePile = { cell: Cell; cargo: Stock };

/**
 * How a battle ends (D8): a side won; nobody won by inactivity, everyone
 * escaping; or nobody is left in the arena.
 */
export type BattleEndReason = "won" | "idle" | "empty";

export type BattleEndCommand = {
  type: "battleEnd";
  battleId: number;
  winnerSide: number | null;
  reason: BattleEndReason;
  /** Everyone still in the arena, by creep id. */
  survivors: BattleSurvivor[];
  piles: BattlePile[];
};

export type BattleRefusal =
  "notSystem" | "unknownBattle" | "notInBattle" | "invalidResult";

export function findBattle(state: WorldState, id: number): Battle | undefined {
  return state.battles.find((b) => b.id === id);
}

export function findWanderer(
  state: WorldState,
  id: number,
): Wanderer | undefined {
  return state.wanderers.find((w) => w.id === id);
}

/** A team's creep or a wanderer, by id. */
export function findFighter(
  state: WorldState,
  id: number,
): Fighter | undefined {
  return findCreep(state, id) ?? findWanderer(state, id);
}

/** Whole max HP points: the DNA's for a creep, the wanderers' own (D14). */
export function fighterMaxHp(state: WorldState, fighter: Fighter): number {
  return isWanderer(fighter)
    ? state.params.wanderers.hp
    : state.params.hp.dna[fighter.dna].max;
}

/** What it can carry: a wanderer, the circle's base capacity (D14). */
export function fighterCapacity(state: WorldState, fighter: Fighter): number {
  return isWanderer(fighter)
    ? state.params.dna.circle.capacity
    : capacity(fighter, teamOf(state, fighter), state.params);
}

/**
 * Removes a dead fighter from the state (a creep by slice A's rule). Returns
 * whether it is the match's first blood; a wanderer's death never is.
 */
export function removeFighter(state: WorldState, fighter: Fighter): boolean {
  if (!isWanderer(fighter)) return kill(state, fighter);
  state.wanderers = state.wanderers.filter((w) => w.id !== fighter.id);
  return false;
}

/** The battle side `fighter` belongs on: its team's, or the wanderers'. */
export function sideOf(fighter: Fighter): BattleSide {
  return isWanderer(fighter)
    ? { kind: "wanderers" }
    : { kind: "team", team: fighter.team };
}

/**
 * The bubble (D5): `battle.window` cells centered on `cell`, shifted to stay
 * inside the map.
 */
export function windowAround(state: WorldState, cell: Cell): BattleWindow {
  const { width, height } = state.params.battle.window;
  const clamp = (value: number, max: number) =>
    Math.min(Math.max(value, 0), max);
  return {
    x: clamp(cell.x - (width - 1) / 2, state.map.width - width),
    y: clamp(cell.y - (height - 1) / 2, state.map.height - height),
    width,
    height,
  };
}

export function inWindow(window: BattleWindow, cell: Cell): boolean {
  return (
    cell.x >= window.x &&
    cell.x < window.x + window.width &&
    cell.y >= window.y &&
    cell.y < window.y + window.height
  );
}

/** Locks a fighter in a battle (O-5): no order, no path, no dialogue. */
function lock(fighter: Fighter, battle: Battle): void {
  fighter.battle = battle.id;
  if (!isWanderer(fighter)) fighter.engagement = null;
  halt(fighter);
}

/**
 * Opens a battle (O-1, O-2, W-2) between the aggressor (side 0) and the
 * victim (side 1) on the victim's cell, after the declaration (`encounter`,
 * none for a wanderer), and locks both. The aggressor fights; the victim
 * enters as its reaction said.
 */
export function openBattle(
  state: WorldState,
  log: EventLog,
  encounter: number | null,
  cause: BattleCause,
  aggressor: Fighter,
  victim: Fighter,
  victimStance: Stance,
): Battle {
  const cell = { x: victim.x, y: victim.y };
  const battle: Battle = {
    id: state.nextId++,
    window: windowAround(state, cell),
    sides: [sideOf(aggressor), sideOf(victim)],
    participants: [
      { id: aggressor.id, side: 0, stance: "fight" as Stance },
      { id: victim.id, side: 1, stance: victimStance },
    ].sort((a, b) => a.id - b.id),
    openedTick: state.tick,
    entered: 2,
    ...cell,
  };
  state.battles.push(battle);
  lock(aggressor, battle);
  lock(victim, battle);
  emit(log, {
    type: "battleOpened",
    battle: battle.id,
    encounter,
    cause,
    sides: battle.sides.map((side, i) => ({
      team: sideTeam(side),
      creeps: [creepRef(i === 0 ? aggressor : victim)],
    })),
    ...cell,
  });
  return battle;
}

/**
 * The index of `wanted` in the battle: its own, or a new one while there is
 * room for a side (D6), or null.
 */
function sideFor(state: WorldState, battle: Battle, wanted: BattleSide) {
  const own = battle.sides.findIndex(
    (s) => s.kind === wanted.kind && sideTeam(s) === sideTeam(wanted),
  );
  if (own >= 0) return own;
  return battle.sides.length < state.params.battle.maxSides
    ? battle.sides.length
    : null;
}

/**
 * The battle a fighter approaching `target` to attack would join, when it is
 * inside its bubble (J-1, W-2), or undefined. A wanderer only ever attacks.
 * A creep following a teammate joins the teammate's battle the same way, on
 * its side (R spec D8, F-2, F-3).
 */
export function battleToJoin(
  state: WorldState,
  fighter: Fighter,
): Battle | undefined {
  const { order } = fighter;
  if (order.type !== "approach" && order.type !== "follow") return undefined;
  if (!isWanderer(fighter) && fighter.order.type === "approach") {
    if (fighter.order.intent !== "attack") return undefined;
  }
  const target = findFighter(state, order.targetId);
  if (target === undefined || target.battle === null) return undefined;
  const battle = findBattle(state, target.battle)!;
  return inWindow(battle.window, fighter) ? battle : undefined;
}

/**
 * Whether a loaded creep on its way to a battle at `cell` delivers first
 * (R spec D10, H-4): its path to its core costs less than its path to the
 * battle, on the team's known map (roads count; the load slows both alike).
 * The core's search is bounded by the battle's cost, so it stays small.
 */
export function deliversFirst(
  state: WorldState,
  creep: Creep,
  cell: Cell,
): boolean {
  const map = knownMap(state, creep.team);
  const index = (c: Cell) => c.y * map.width + c.x;
  const toBattle = nearestTargets(
    map,
    creep,
    new Set([index(cell)]),
    state.params,
    Number.MAX_SAFE_INTEGER,
  );
  if (toBattle === null || toBattle.cost === 0) return false;
  const { core } = teamOf(state, creep);
  return (
    nearestTargets(
      map,
      creep,
      new Set([index(core)]),
      state.params,
      toBattle.cost - 1,
    ) !== null
  );
}

/**
 * The joins (D6, J-1, J-3), after the openings: each free creep with an
 * attack approach on a participant, inside the bubble, joins on its team's
 * side or a new one. While the side is full (`battle.sideCap`) or there is
 * no room for a new side, it waits, its approach intact.
 */
export function runJoins(state: WorldState, log: EventLog): void {
  if (state.battles.length === 0) return;
  const fighters: Fighter[] =
    state.wanderers.length === 0
      ? state.creeps
      : [...state.creeps, ...state.wanderers].sort((a, b) => a.id - b.id);
  for (const fighter of fighters) {
    if (fighter.battle !== null) continue;
    if (!isWanderer(fighter) && fighter.engagement !== null) continue;
    const battle = battleToJoin(state, fighter);
    if (battle === undefined) continue;
    const wanted = sideOf(fighter);
    const side = sideFor(state, battle, wanted);
    if (side === null) continue;
    const members = battle.participants.filter((p) => p.side === side);
    if (members.length >= state.params.battle.sideCap) continue;
    if (side === battle.sides.length) battle.sides.push(wanted);
    battle.participants = [
      ...battle.participants,
      { id: fighter.id, side, stance: "fight" as Stance },
    ].sort((a, b) => a.id - b.id);
    battle.entered += 1;
    // Approaching someone ends one's own safe conduct (E-8).
    if (!isWanderer(fighter)) fighter.safeConduct = null;
    lock(fighter, battle);
    emit(log, {
      type: "battleJoined",
      battle: battle.id,
      creep: creepRef(fighter),
      side,
      x: battle.x,
      y: battle.y,
    });
  }
}

// The result commands (plan P2) ----------------------------------------------

const isCount = (value: number) => Number.isSafeInteger(value) && value >= 0;

/**
 * A world cell a creep can stand on: in the map, and walkable (not rock nor
 * river). Where a creep may come back from a battle (D7, D8).
 */
export function isStandable(state: WorldState, cell: Cell): boolean {
  if (!isInMap(state.map, cell)) return false;
  return (
    cellModifier(state.map, cell.y * state.map.width + cell.x, state.params) > 0
  );
}

function isStock(stock: Stock): boolean {
  return isCount(stock.materia) && isCount(stock.cristal);
}

/** Whole HP in 1..max and a load that fits: what a living creep comes back with. */
function returnIssue(
  state: WorldState,
  fighter: Fighter,
  hp: number,
  cargo: Stock,
  cell: Cell,
): boolean {
  const max = fighterMaxHp(state, fighter);
  if (!Number.isSafeInteger(hp) || hp < 1 || hp > max) return true;
  if (!isStock(cargo)) return true;
  if (stockTotal(cargo) > fighterCapacity(state, fighter)) return true;
  return !isStandable(state, cell);
}

export function battleExitRefusal(
  state: WorldState,
  command: BattleExitCommand,
  playerId: number,
): BattleRefusal | null {
  if (playerId !== SYSTEM_PLAYER_ID) return "notSystem";
  const battle = findBattle(state, command.battleId);
  if (battle === undefined) return "unknownBattle";
  const creep = findFighter(state, command.creepId);
  if (creep === undefined || creep.battle !== battle.id) return "notInBattle";
  if (command.outcome === "died") {
    return isInMap(state.map, command.cell) ? null : "invalidResult";
  }
  if (command.outcome !== "escaped") return "invalidResult";
  return returnIssue(state, creep, command.hp, command.cargo, command.cell)
    ? "invalidResult"
    : null;
}

/**
 * W-7: a fighter leaving `battle` alive pairs up with the others still in
 * it, a wanderer with each team's creep: the wanderer spares that creep for
 * `wanderers.spareSeconds`.
 */
function spareOnLeaving(
  state: WorldState,
  battle: Battle,
  leaving: Fighter,
): void {
  const untilTick =
    state.tick + ticks(state, state.params.wanderers.spareSeconds);
  const spare = (wanderer: Wanderer, creep: number) => {
    wanderer.spared = [
      ...wanderer.spared.filter((s) => s.creep !== creep),
      { creep, untilTick },
    ].sort((a, b) => a.creep - b.creep);
  };
  for (const p of battle.participants) {
    if (p.id === leaving.id) continue;
    const other = findFighter(state, p.id);
    if (other === undefined || isWanderer(other) === isWanderer(leaving)) {
      continue;
    }
    if (isWanderer(leaving)) spare(leaving, other.id);
    else spare(other as Wanderer, leaving.id);
  }
}

/** Back in the world on `cell` with its HP and load, unlocked and stopped. */
function unlock(
  state: WorldState,
  battle: Battle,
  creep: Fighter,
  hp: number,
  cargo: Stock,
  cell: Cell,
): void {
  spareOnLeaving(state, battle, creep);
  creep.hp = hp * 1000;
  creep.cargo = { materia: cargo.materia, cristal: cargo.cristal };
  creep.x = cell.x;
  creep.y = cell.y;
  creep.battle = null;
  halt(creep);
  battle.participants = battle.participants.filter((p) => p.id !== creep.id);
}

/**
 * A participant left the arena (X-1, X-2): dead, it dies in the world (its
 * load stayed in the arena as a pile); escaped by the border, it comes back
 * on its cell and runs home with the flee bonus (D7).
 */
export function applyBattleExit(
  state: WorldState,
  log: EventLog,
  command: BattleExitCommand,
): void {
  const battle = findBattle(state, command.battleId)!;
  const creep = findFighter(state, command.creepId)!;
  const ref = creepRef(creep);
  if (command.outcome === "died") {
    battle.participants = battle.participants.filter((p) => p.id !== creep.id);
    const killer =
      command.by === null ? undefined : findFighter(state, command.by);
    const firstBlood = removeFighter(state, creep);
    emit(log, {
      type: "died",
      creep: ref,
      by: killer === undefined ? null : creepRef(killer),
      battle: battle.id,
      firstBlood,
      ...command.cell,
    });
    return;
  }
  unlock(state, battle, creep, command.hp, command.cargo, command.cell);
  // A wanderer has no home to run to: it roams again.
  if (!isWanderer(creep)) {
    creep.order = {
      type: "flee",
      untilTick: state.tick + ticks(state, state.params.flee.seconds),
    };
  }
  emit(log, {
    type: "battleLeft",
    battle: battle.id,
    creep: ref,
    reason: "edge",
    hp: command.hp,
    cargo: { ...creep.cargo },
    ...command.cell,
  });
}

export function battleEndRefusal(
  state: WorldState,
  command: BattleEndCommand,
  playerId: number,
): BattleRefusal | null {
  if (playerId !== SYSTEM_PLAYER_ID) return "notSystem";
  const battle = findBattle(state, command.battleId);
  if (battle === undefined) return "unknownBattle";
  const { winnerSide, reason, survivors, piles } = command;
  // The survivors are exactly the participants left, by id.
  const ids = survivors.map((s) => s.creepId);
  const left = battle.participants.map((p) => p.id);
  if (ids.length !== left.length || ids.some((id, i) => id !== left[i])) {
    return "invalidResult";
  }
  switch (reason) {
    case "won":
      if (
        winnerSide === null ||
        battle.participants.some((p) => p.side !== winnerSide) ||
        survivors.length === 0
      ) {
        return "invalidResult";
      }
      break;
    case "idle":
      if (winnerSide !== null) return "invalidResult";
      break;
    case "empty":
      if (winnerSide !== null || survivors.length > 0) return "invalidResult";
      break;
    default:
      return "invalidResult";
  }
  for (const s of survivors) {
    const creep = findFighter(state, s.creepId)!;
    if (returnIssue(state, creep, s.hp, s.cargo, s.cell)) {
      return "invalidResult";
    }
  }
  for (const pile of piles) {
    if (!isStock(pile.cargo) || !isStandable(state, pile.cell)) {
      return "invalidResult";
    }
  }
  return null;
}

/**
 * The battle is over (X-3, X-4, D8): the survivors come back on their cells.
 * With a winner they collect the piles up to their free capacity, cristal
 * first, in creep id order; the rest becomes spoils on each pile's cell, as
 * every pile does without a winner. By inactivity each survivor leaves as an
 * escape without the flee bonus. The stub leaves the state.
 */
export function applyBattleEnd(
  state: WorldState,
  log: EventLog,
  command: BattleEndCommand,
): void {
  const battle = findBattle(state, command.battleId)!;
  const survivors: Fighter[] = [];
  for (const s of command.survivors) {
    const creep = findFighter(state, s.creepId)!;
    unlock(state, battle, creep, s.hp, s.cargo, s.cell);
    survivors.push(creep);
  }
  const piles = command.piles.map((p) => ({
    cell: p.cell,
    cargo: { materia: p.cargo.materia, cristal: p.cargo.cristal },
  }));
  const loot: { creep: CreepRef; taken: Stock }[] = [];
  if (command.reason === "won") {
    for (const creep of survivors) {
      const taken = collect(state, creep, piles);
      if (stockTotal(taken) > 0) loot.push({ creep: creepRef(creep), taken });
    }
  }
  const spoils: number[] = [];
  const spoiled = { materia: 0, cristal: 0 };
  for (const pile of piles) {
    if (stockTotal(pile.cargo) === 0) continue;
    spoiled.materia += pile.cargo.materia;
    spoiled.cristal += pile.cargo.cristal;
    const id = dropSpoil(state, pile.cell, pile.cargo);
    if (!spoils.includes(id)) spoils.push(id);
  }
  if (command.reason === "idle") {
    for (const creep of survivors) {
      emit(log, {
        type: "battleLeft",
        battle: battle.id,
        creep: creepRef(creep),
        reason: "idle",
        hp: Math.floor(creep.hp / 1000),
        cargo: { ...creep.cargo },
        x: creep.x,
        y: creep.y,
      });
    }
  }
  const winner =
    command.winnerSide === null ? null : battle.sides[command.winnerSide]!;
  emit(log, {
    type: "battleEnded",
    battle: battle.id,
    reason: command.reason,
    winner:
      winner === null
        ? null
        : { side: command.winnerSide!, team: sideTeam(winner) },
    sideTeams: battle.sides.map(sideTeam),
    survivors: survivors.map(creepRef),
    loot,
    spoils,
    entered: battle.entered,
    spoiled,
    x: battle.x,
    y: battle.y,
  });
  state.battles = state.battles.filter((b) => b.id !== battle.id);
}

/**
 * What a winner takes from the piles (D8, M2 encontro D11): up to its free
 * capacity, all the cristal first, then the materia, pile by pile.
 */
function collect(
  state: WorldState,
  creep: Fighter,
  piles: { cargo: Stock }[],
): Stock {
  const taken = { materia: 0, cristal: 0 };
  const room = () => fighterCapacity(state, creep) - cargoTotal(creep);
  for (const resource of ["cristal", "materia"] as const) {
    for (const pile of piles) {
      const amount = Math.min(pile.cargo[resource], room());
      if (amount <= 0) continue;
      const moved = { materia: 0, cristal: 0, [resource]: amount };
      transfer(pile.cargo, creep.cargo, moved);
      taken[resource] += amount;
    }
  }
  return taken;
}
