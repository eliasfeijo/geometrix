// Players and domination (spec D-1..D-4; F4 details decided 2026-11-13). A
// player joins one team through a system command the server emits, logged like
// any other. Dominating a creep makes it follow only that player's orders;
// releasing it hands it back to its autopilot rules. Timeouts and disconnects
// are releases emitted by the server (plan section 4), so the sim keeps no
// clock for them.

import { canAfford, cargoTotal, debit } from "./economy.ts";
import type { EventLog } from "./events.ts";
import { dropCargo } from "./spoils.ts";
import { memoryOf } from "./known.ts";
import { isInMap, manhattan, type Cell } from "./map.ts";
import type { Order } from "./orders.ts";
import { buildRoadOrder } from "./roads.ts";
import type { Creep, Reply, WorldState } from "./world.ts";

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
  | ({ type: "explore" } & Cell)
  | ({ type: "buildRoad" } & Cell)
  /** An enemy creep the team sees now (M2 encontro spec E-1, D19). */
  | { type: "approach"; targetId: number; intent: "attack" | "extort" }
  /** A spoil the team remembers. */
  | { type: "pickup"; spoilId: number }
  /** A teammate to follow (R spec D8). */
  | { type: "follow"; targetId: number }
  /**
   * Drop the whole load as spoils (R spec D24); the victim of an extortion
   * may, and it refuses the extortion (DR-3).
   */
  | { type: "drop" };

export type DominationRefusal =
  | "unknownPlayer"
  | "unknownCreep"
  | "alreadyDominating"
  | "dominatedByOther"
  | "cooldown"
  | "tooFar"
  | "stock"
  | "notDominating"
  | "invalidOrder"
  /** In an encounter, a creep takes no order (spec L-3). */
  | "engaged"
  /** Locked in a battle, a creep takes no world order (junction O-5). */
  | "inBattle"
  /** A fleeing creep's order is locked (plan P4). */
  | "fleeing"
  /** A follow on the creep itself or closing a cycle (R spec F-5). */
  | "invalidTarget"
  /** A drop with nothing to drop (R spec DR-2). */
  | "emptyCargo";

/** Why a reply to an encounter is refused (command react). */
export type ReactRefusal =
  TeamCreepRefusal | "notDominating" | "notEngaged" | "invalidReaction";

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

export type TeamCreepRefusal = "unknownPlayer" | "unknownCreep";

/**
 * Checks that the player exists and the creep belongs to the player's team. A
 * creep of another team is refused as if it did not exist, so the refusal
 * tells nothing the team's view does not (fog spec D6).
 */
export function teamCreepRefusal(
  state: WorldState,
  playerId: number,
  creepId: number,
): TeamCreepRefusal | null {
  const player = findPlayer(state, playerId);
  if (player === undefined) return "unknownPlayer";
  const creep = findCreep(state, creepId);
  if (creep === undefined) return "unknownCreep";
  return creep.team === player.team ? null : "unknownCreep";
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

/**
 * Only the dominating player orders a creep (D-1). A deposit or spoil the
 * team does not remember, or a creep it does not see, is refused as one that
 * does not exist (fog spec D6, M2 encontro D19).
 */
export function orderRefusal(
  state: WorldState,
  playerId: number,
  creepId: number,
  order: OrderInput,
): DominationRefusal | null {
  const refusal = teamCreepRefusal(state, playerId, creepId);
  if (refusal !== null) return refusal;
  const player = findPlayer(state, playerId)!;
  const creep = findCreep(state, creepId)!;
  if (creep.dominatedBy !== playerId) return "notDominating";
  if (creep.battle !== null) return "inBattle";
  // In an encounter only the victim of an extortion may drop (DR-3).
  if (
    creep.engagement !== null &&
    (order.type !== "drop" || extortionOf(state, creep) === undefined)
  ) {
    return "engaged";
  }
  if (creep.order.type === "flee") return "fleeing";
  switch (order.type) {
    case "drop":
      return cargoTotal(creep) === 0 ? "emptyCargo" : null;
    case "stop":
    case "deliver":
      return null;
    case "approach": {
      if (order.intent !== "attack" && order.intent !== "extort") {
        return "invalidOrder";
      }
      const visible = memoryOf(state, player.team).visible;
      const seen = (cell: { x: number; y: number }) =>
        visible[cell.y * state.map.width + cell.x] === 1;
      // A wanderer in sight can be attacked, never extorted (junction W-4).
      const wanderer = state.wanderers.find((w) => w.id === order.targetId);
      if (wanderer !== undefined) {
        if (!seen(wanderer)) return "unknownCreep";
        return order.intent === "attack" ? null : "invalidOrder";
      }
      const target = findCreep(state, order.targetId);
      if (
        target === undefined ||
        target.team === player.team ||
        !seen(target)
      ) {
        return "unknownCreep";
      }
      return null;
    }
    case "pickup":
      return memoryOf(state, player.team).spoils.some(
        (s) => s.id === order.spoilId,
      )
        ? null
        : "invalidOrder";
    case "follow":
      return followRefusal(state, creep, order.targetId);
    case "gather":
      return memoryOf(state, player.team).deposits.some(
        (d) => d.id === order.depositId,
      )
        ? null
        : "invalidOrder";
    case "moveTo":
    case "explore":
    case "buildRoad":
      return isInMap(state.map, order) ? null : "invalidOrder";
  }
}

/** The extortion whose victim `creep` is, if any. */
function extortionOf(state: WorldState, creep: Creep) {
  return state.encounters.find(
    (e) => e.id === creep.engagement && e.victim === creep.id,
  );
}

/**
 * Sets the creep's order. A drop by the victim of an extortion happens at
 * once (stage 1) and refuses the extortion: the encounters stage opens the
 * battle with the victim empty (R spec DR-3, plan P5).
 */
export function giveOrder(
  state: WorldState,
  creepId: number,
  order: OrderInput,
  log: EventLog,
): void {
  const creep = findCreep(state, creepId)!;
  const extortion =
    order.type === "drop" ? extortionOf(state, creep) : undefined;
  if (extortion !== undefined) {
    dropCargo(state, log, creep);
    extortion.reply = "refuse";
    return;
  }
  creep.order = toOrder(order);
}

function toOrder(input: OrderInput): Order {
  switch (input.type) {
    case "stop":
    case "deliver":
      return { type: input.type };
    case "gather":
      return { type: "gather", depositId: input.depositId };
    case "moveTo":
    case "explore":
      return { type: input.type, x: input.x, y: input.y };
    case "buildRoad":
      return buildRoadOrder(input);
    case "approach":
      return {
        type: "approach",
        targetId: input.targetId,
        intent: input.intent,
      };
    case "pickup":
      return { type: "pickup", spoilId: input.spoilId };
    case "follow":
      return { type: "follow", targetId: input.targetId };
    case "drop":
      return { type: "drop" };
  }
}

/**
 * Why `creep` cannot follow `targetId` (R spec F-5), or null: the target
 * must be a creep of its team (anything else is refused as unknown, so no id
 * of another team is confirmed), not itself, and no chain of follows may
 * lead back to it.
 */
export function followRefusal(
  state: WorldState,
  creep: Creep,
  targetId: number,
): "unknownCreep" | "invalidTarget" | null {
  const target = findCreep(state, targetId);
  if (target === undefined || target.team !== creep.team) {
    return "unknownCreep";
  }
  if (target.id === creep.id || closesFollowCycle(state, creep.id, targetId)) {
    return "invalidTarget";
  }
  return null;
}

/**
 * Whether the chain of follows from `targetId` comes back to `creepId`: by
 * each creep's follow order and every follow rule it has (a rule may match
 * later, so all of them count).
 */
export function closesFollowCycle(
  state: WorldState,
  creepId: number,
  targetId: number,
): boolean {
  const seen = new Set<number>();
  const pending = [targetId];
  while (pending.length > 0) {
    const id = pending.pop()!;
    if (id === creepId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    const creep = findCreep(state, id);
    if (creep === undefined) continue;
    if (creep.order.type === "follow") pending.push(creep.order.targetId);
    for (const rule of creep.rules) {
      if (rule.then.type === "follow") pending.push(rule.then.creepId);
    }
  }
  return false;
}

/**
 * The dominating player answers its creep's extortion (spec C-5, D6;
 * junction D1): the victim pays or refuses.
 */
export function reactRefusal(
  state: WorldState,
  playerId: number,
  creepId: number,
  choice: Reply,
): ReactRefusal | null {
  const refusal = teamCreepRefusal(state, playerId, creepId);
  if (refusal !== null) return refusal;
  const creep = findCreep(state, creepId)!;
  if (creep.dominatedBy !== playerId) return "notDominating";
  const encounter = state.encounters.find((e) => e.id === creep.engagement);
  if (encounter === undefined) return "notEngaged";
  if (encounter.victim !== creep.id) return "invalidReaction";
  return choice === "pay" || choice === "refuse" ? null : "invalidReaction";
}

/** Records the reply; the encounters stage applies it (plan section 6). */
export function react(state: WorldState, creepId: number, choice: Reply): void {
  const creep = findCreep(state, creepId)!;
  state.encounters.find((e) => e.id === creep.engagement)!.reply = choice;
}
