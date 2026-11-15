// External commands (ADR-0002, plan section 4): the only input that goes into
// the command log. validate is the semantic check, shared by the server (ack or
// reject) and by step, which checks again at stage 1 against the state of that
// tick and skips what no longer holds. The structural check (shapes, types)
// lives in the protocol package.

import type { Rule } from "./autopilot.ts";
import {
  dominate,
  dominateRefusal,
  findPlayer,
  giveOrder,
  join,
  joinRefusal,
  orderRefusal,
  react,
  reactRefusal,
  release,
  releaseRefusal,
  type DominationRefusal,
  type ReactRefusal,
  type JoinRefusal,
  type OrderInput,
} from "./domination.ts";
import {
  buyUpgrade,
  UPGRADES,
  upgradeRefusal,
  type UpgradeId,
  type UpgradeRefusal,
} from "./economy.ts";
import type { Cell } from "./map.ts";
import { DNAS, type Dna } from "./params.ts";
import type { PresetId } from "./presets.ts";
import {
  productionRefusal,
  startProduction,
  type ProductionRefusal,
} from "./production.ts";
import {
  applyPreset,
  applyPresetRefusal,
  setRules,
  setRulesRefusal,
  type RulesRefusal,
} from "./rules.ts";
import type { Reply, WorldState } from "./world.ts";

export type Command =
  /** System command the server emits when a player joins (not a client input). */
  | { type: "join"; team: number; bot: boolean }
  | { type: "dominate"; creepId: number }
  /** Also emitted by the server on disconnect or domination timeout (D-4). */
  | { type: "release" }
  | { type: "order"; creepId: number; order: OrderInput }
  | { type: "setRules"; creepId: number; rules: Rule[] }
  /** `target` is required by the roadBuilder preset and ignored by the others. */
  | { type: "applyPreset"; creepId: number; preset: PresetId; target?: Cell }
  | { type: "produce"; dna: Dna; repeat: boolean }
  | { type: "stopRepeat" }
  | { type: "buyUpgrade"; upgrade: UpgradeId }
  /** The dominating player answers its creep's encounter (M2 encontro). */
  | { type: "react"; creepId: number; choice: Reply };

export const COMMAND_TYPES = [
  "join",
  "dominate",
  "release",
  "order",
  "setRules",
  "applyPreset",
  "produce",
  "stopRepeat",
  "buyUpgrade",
  "react",
] as const satisfies readonly Command["type"][];
export type CommandType = Command["type"];

/** A command with the player who sent it, as the log records it. */
export type CommandInput = { playerId: number; command: Command };

export type Refusal =
  | JoinRefusal
  | DominationRefusal
  | ReactRefusal
  | RulesRefusal
  | ProductionRefusal
  | UpgradeRefusal
  | "unknownCommand"
  | "invalidDna"
  | "invalidUpgrade";

/** Why `command` from `playerId` cannot apply to `state`, or null. Pure. */
export function validate(
  state: WorldState,
  command: Command,
  playerId: number,
): Refusal | null {
  switch (command.type) {
    case "join":
      return joinRefusal(state, playerId, command.team, command.bot);
    case "dominate":
      return dominateRefusal(state, playerId, command.creepId);
    case "release":
      return releaseRefusal(state, playerId);
    case "order":
      return orderRefusal(state, playerId, command.creepId, command.order);
    case "react":
      return reactRefusal(state, playerId, command.creepId, command.choice);
    case "setRules":
      return setRulesRefusal(state, playerId, command.creepId, command.rules);
    case "applyPreset":
      return applyPresetRefusal(
        state,
        playerId,
        command.creepId,
        command.preset,
        command.target ?? null,
      );
    case "produce":
    case "stopRepeat":
    case "buyUpgrade":
      return teamCommandRefusal(state, command, playerId);
    default:
      return "unknownCommand";
  }
}

function teamCommandRefusal(
  state: WorldState,
  command: Extract<Command, { type: "produce" | "stopRepeat" | "buyUpgrade" }>,
  playerId: number,
): Refusal | null {
  const player = findPlayer(state, playerId);
  if (player === undefined) return "unknownPlayer";
  const team = state.teams[player.team]!;
  switch (command.type) {
    case "produce":
      if (!DNAS.includes(command.dna)) return "invalidDna";
      return productionRefusal(state, team);
    case "stopRepeat":
      return null;
    case "buyUpgrade":
      if (!UPGRADES.includes(command.upgrade)) return "invalidUpgrade";
      return upgradeRefusal(state, team.id, command.upgrade);
  }
}

/**
 * Validates and applies one command. Returns the refusal, or null once
 * applied; a refused command changes nothing.
 */
export function applyCommand(
  state: WorldState,
  command: Command,
  playerId: number,
): Refusal | null {
  const refusal = validate(state, command, playerId);
  if (refusal !== null) return refusal;
  switch (command.type) {
    case "join":
      join(state, playerId, command.team, command.bot);
      break;
    case "dominate":
      dominate(state, playerId, command.creepId);
      break;
    case "release":
      release(state, playerId);
      break;
    case "order":
      giveOrder(state, command.creepId, command.order);
      break;
    case "react":
      react(state, command.creepId, command.choice);
      break;
    case "setRules":
      setRules(state, command.creepId, command.rules);
      break;
    case "applyPreset":
      applyPreset(
        state,
        command.creepId,
        command.preset,
        command.target ?? null,
      );
      break;
    case "produce":
    case "stopRepeat":
    case "buyUpgrade": {
      const team = state.teams[findPlayer(state, playerId)!.team]!;
      if (command.type === "produce") {
        startProduction(state, team.id, command.dna, command.repeat);
      } else if (command.type === "stopRepeat") {
        team.repeat = null;
      } else {
        buyUpgrade(state, team.id, command.upgrade);
      }
      break;
    }
  }
  return null;
}
