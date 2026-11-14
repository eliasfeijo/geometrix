// Players and domination (spec D-1..D-4; F4 details decided 2026-11-13). A
// player joins one team through a system command the server emits, logged like
// any other. Dominating a creep makes it follow only that player's orders;
// releasing it hands it back to its autopilot rules. Timeouts and disconnects
// are releases emitted by the server (plan section 4), so the sim keeps no
// clock for them.

import { canAfford, debit, findDeposit } from "./economy.ts";
import { isInMap, manhattan, type Cell } from "./map.ts";
import type { Order } from "./orders.ts";
import { buildRoadOrder } from "./roads.ts";
import type { Creep, WorldState } from "./world.ts";

/** Player ids come from the server; players are kept ordered by id. */
export type Player = {
  id: number;
  team: number;
  /** A harness or server bot (spec section 5, F6 details): not a human. */
  bot: boolean;
  /** Tick of the last accepted dominate, for the cooldown; null before any. */
  lastDominateTick: number | null;
};

/** What a dominating player can order (plan section 4). */
export type OrderInput =
  | { type: "stop" }
  | { type: "deliver" }
  | { type: "gather"; depositId: number }
  | ({ type: "moveTo" } & Cell)
  | ({ type: "buildRoad" } & Cell);

export type DominationRefusal =
  | "unknownPlayer"
  | "unknownCreep"
  | "notYourTeam"
  | "alreadyDominating"
  | "dominatedByOther"
  | "cooldown"
  | "tooFar"
  | "stock"
  | "notDominating"
  | "invalidOrder";

export function findPlayer(state: WorldState, id: number): Player | undefined {
  return state.players.find((p) => p.id === id);
}

export function findCreep(state: WorldState, id: number): Creep | undefined {
  return state.creeps.find((c) => c.id === id);
}

/** The creep the player dominates, if any (at most one, D-2). */
export function dominatedCreep(
  state: WorldState,
  playerId: number,
): Creep | undefined {
  return state.creeps.find((c) => c.dominatedBy === playerId);
}

export type JoinRefusal = "alreadyJoined" | "unknownTeam" | "teamFull";

/**
 * Why the player cannot join `team`, or null. A team takes at most
 * teams.maxHumans humans (spec D6); bots do not count.
 */
export function joinRefusal(
  state: WorldState,
  playerId: number,
  team: number,
  bot: boolean,
): JoinRefusal | null {
  if (findPlayer(state, playerId) !== undefined) return "alreadyJoined";
  if (state.teams[team] === undefined) return "unknownTeam";
  const humans = state.players.filter((p) => p.team === team && !p.bot);
  if (!bot && humans.length >= state.params.teams.maxHumans) return "teamFull";
  return null;
}

export function join(
  state: WorldState,
  playerId: number,
  team: number,
  bot: boolean,
): void {
  const player: Player = { id: playerId, team, bot, lastDominateTick: null };
  const at = state.players.findIndex((p) => p.id > playerId);
  state.players.splice(at < 0 ? state.players.length : at, 0, player);
}

export type TeamCreepRefusal = "unknownPlayer" | "unknownCreep" | "notYourTeam";

/** Checks that the player exists and the creep belongs to the player's team. */
export function teamCreepRefusal(
  state: WorldState,
  playerId: number,
  creepId: number,
): TeamCreepRefusal | null {
  const player = findPlayer(state, playerId);
  if (player === undefined) return "unknownPlayer";
  const creep = findCreep(state, creepId);
  if (creep === undefined) return "unknownCreep";
  return creep.team === player.team ? null : "notYourTeam";
}

export function dominateRefusal(
  state: WorldState,
  playerId: number,
  creepId: number,
): DominationRefusal | null {
  const refusal = teamCreepRefusal(state, playerId, creepId);
  if (refusal !== null) return refusal;
  const player = findPlayer(state, playerId)!;
  const creep = findCreep(state, creepId)!;
  if (creep.dominatedBy === playerId) return "alreadyDominating";
  if (creep.dominatedBy !== null) return "dominatedByOther";
  const { domination, world } = state.params;
  if (
    player.lastDominateTick !== null &&
    (state.tick - player.lastDominateTick) * world.tickSeconds <
      domination.cooldownSeconds
  ) {
    return "cooldown";
  }
  const team = state.teams[player.team]!;
  if (
    domination.maxDistanceCells > 0 &&
    manhattan(team.core, creep) > domination.maxDistanceCells
  ) {
    return "tooFar";
  }
  if (!canAfford(team.stock, domination.cost)) return "stock";
  return null;
}

/**
 * Dominates the creep, releasing the one the player held before (D-2). The
 * creep keeps its current order until the player gives another.
 */
export function dominate(
  state: WorldState,
  playerId: number,
  creepId: number,
): void {
  const player = findPlayer(state, playerId)!;
  const previous = dominatedCreep(state, playerId);
  if (previous !== undefined) previous.dominatedBy = null;
  debit(state.teams[player.team]!.stock, state.params.domination.cost);
  findCreep(state, creepId)!.dominatedBy = playerId;
  player.lastDominateTick = state.tick;
}

export function releaseRefusal(
  state: WorldState,
  playerId: number,
): DominationRefusal | null {
  if (findPlayer(state, playerId) === undefined) return "unknownPlayer";
  if (dominatedCreep(state, playerId) === undefined) return "notDominating";
  return null;
}

/** Frees the player's creep; its rules take over from stage 2 on (D-4). */
export function release(state: WorldState, playerId: number): void {
  dominatedCreep(state, playerId)!.dominatedBy = null;
}

/** Only the dominating player orders a creep (D-1). */
export function orderRefusal(
  state: WorldState,
  playerId: number,
  creepId: number,
  order: OrderInput,
): DominationRefusal | null {
  if (findPlayer(state, playerId) === undefined) return "unknownPlayer";
  const creep = findCreep(state, creepId);
  if (creep === undefined) return "unknownCreep";
  if (creep.dominatedBy !== playerId) return "notDominating";
  switch (order.type) {
    case "stop":
    case "deliver":
      return null;
    case "gather":
      return findDeposit(state, order.depositId) === undefined
        ? "invalidOrder"
        : null;
    case "moveTo":
    case "buildRoad":
      return isInMap(state.map, order) ? null : "invalidOrder";
  }
}

export function giveOrder(
  state: WorldState,
  creepId: number,
  order: OrderInput,
): void {
  findCreep(state, creepId)!.order = toOrder(order);
}

function toOrder(input: OrderInput): Order {
  switch (input.type) {
    case "stop":
    case "deliver":
      return { type: input.type };
    case "gather":
      return { type: "gather", depositId: input.depositId };
    case "moveTo":
      return { type: "moveTo", x: input.x, y: input.y };
    case "buildRoad":
      return buildRoadOrder(input);
  }
}
