// The command vocabulary of the battle (plan section 6, ADR-0002): the human
// who dominates a participant, the lab and, from F3, the gambits all speak it,
// through the same validation. F1 has the human's movement and aim commands;
// drop, pickup, control, setGambits and join come with F2.

import { DIRS, type Dir } from "./arena.ts";
import { findParticipant, type BattleState, type Controller } from "./state.ts";

export type BattleCommand =
  /** Persistent intent (plan P4): walk towards `move` while not null, attack while `attack`. */
  | { type: "intent"; id: number; move: Dir | null; attack: boolean }
  /** Fires the next possible attack once, even if the key is already up. */
  | { type: "attackOnce"; id: number }
  /** Turns without walking, to aim. */
  | { type: "face"; id: number; dir: Dir };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isDir = (value: unknown): value is Dir => DIRS.includes(value as Dir);

/**
 * Why `command` cannot be applied now, or null. A participant only takes
 * orders from whoever controls it: a human's intent that arrives after the
 * domination moved on (latency) is refused, and so is anything for a
 * participant that left the arena (plan section 6).
 */
export function validateCommand(
  state: BattleState,
  command: unknown,
  issuer: Controller = "human",
): string | null {
  if (!isRecord(command)) return "expected an object";
  const { type, id } = command;
  if (type !== "intent" && type !== "attackOnce" && type !== "face") {
    return `unknown command ${String(type)}`;
  }
  if (!Number.isSafeInteger(id)) return "id must be an integer";
  const participant = findParticipant(state, id as number);
  if (participant === undefined) {
    return `no participant ${String(id)} in the arena`;
  }
  if (participant.controller !== issuer) {
    return `participant ${participant.id} is not under ${issuer} control`;
  }
  if (type === "intent") {
    if (command.move !== null && !isDir(command.move)) {
      return "move must be a direction or null";
    }
    if (typeof command.attack !== "boolean") return "attack must be a boolean";
  }
  if (type === "face" && !isDir(command.dir)) return "dir must be a direction";
  return null;
}

/** Applies a valid command (validateCommand returned null). */
export function applyCommand(state: BattleState, command: BattleCommand): void {
  const participant = findParticipant(state, command.id)!;
  switch (command.type) {
    case "intent":
      participant.intent.move = command.move;
      participant.intent.attack = command.attack;
      return;
    case "attackOnce":
      participant.intent.attackLatch = true;
      return;
    case "face":
      participant.facing = command.dir;
      return;
  }
}

/**
 * Stage 1 of the tick: the commands of the human and the lab, in arrival
 * order. An invalid one is dropped, with no effect and no event (plan
 * section 6).
 */
export function applyCommands(
  state: BattleState,
  commands: readonly unknown[],
): void {
  for (const command of commands) {
    if (validateCommand(state, command) === null) {
      applyCommand(state, command as BattleCommand);
    }
  }
}
