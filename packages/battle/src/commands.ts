// The command vocabulary of the battle (plan section 6, ADR-0002): the human
// who dominates a participant, the lab and, from F3, the gambits all speak it,
// through the same validation. A participant's commands come from whoever
// controls it; the lab's (control, setGambits, join) come with the human's
// stream, never from the gambits.

import { DIRS, type Dir } from "./arena.ts";
import { emit, participantRef, type BattleEventLog } from "./events.ts";
import { copyGambits, type Gambit } from "./gambits.ts";
import {
  freeEntryCells,
  freeStretch,
  participantIssue,
  placeParticipant,
  type ParticipantSetup,
} from "./setup.ts";
import {
  findParticipant,
  type Bag,
  type BattleState,
  type Controller,
  type Participant,
} from "./state.ts";

export type BattleCommand =
  /**
   * Persistent intent (plan P4): walk towards `move` while not null, attack
   * while `attack`; `bag` is the bag key held (absent: none), which acts at
   * the end of the countdown (spec S-4).
   */
  | {
      type: "intent";
      id: number;
      move: Dir | null;
      attack: boolean;
      bag?: Bag | null;
    }
  /** Fires the next possible attack once, even if the key is already up. */
  | { type: "attackOnce"; id: number }
  /** Turns without walking, to aim. */
  | { type: "face"; id: number; dir: Dir }
  /** Leaves the whole carry on the cell, on the next tick (spec D8, C-1). */
  | { type: "drop"; id: number }
  /** Takes from the cell's pile, on the next tick (spec D8, C-2). */
  | { type: "pickup"; id: number }
  /** Who commands a participant (spec D12); `human` releases the previous one. */
  | { type: "control"; id: number; controller: Controller }
  /** Replaces a participant's gambits whole (spec L-7). */
  | { type: "setGambits"; id: number; gambits: Gambit[] }
  /** A participant entering mid-fight, on a side or a new one (spec D11, E-1). */
  | { type: "join"; side: number; participant: ParticipantSetup };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Commands a participant takes from whoever controls it. */
const PARTICIPANT_COMMANDS: readonly string[] = [
  "intent",
  "attackOnce",
  "face",
  "drop",
  "pickup",
];

/** Commands of the lab, which the gambits never issue. */
const LAB_COMMANDS: readonly string[] = ["control", "setGambits", "join"];

const CONTROLLERS: readonly Controller[] = ["gambits", "human"];

const isDir = (value: unknown): value is Dir => DIRS.includes(value as Dir);

const BAGS: readonly Bag[] = ["drop", "pickup"];

/** Why a join cannot happen now (spec E-1), or null. */
function joinIssue(
  state: BattleState,
  command: Record<string, unknown>,
): string | null {
  const { side, participant } = command;
  const { limits } = state.params;
  const next = state.sides.length;
  if (
    !Number.isSafeInteger(side) ||
    (side as number) < 0 ||
    (side as number) > next
  ) {
    return `side must be an integer in 0..${next} (${next} is a new side)`;
  }
  const issue = participantIssue(participant, state.params);
  if (issue !== null) return issue;
  const members = state.participants.filter((p) => p.side === side).length;
  let entry: number;
  if (side === next) {
    const sides = new Set(state.participants.map((p) => p.side)).size;
    if (sides >= limits.maxSides) return `at most ${limits.maxSides} sides`;
    const stretch = freeStretch(state);
    if (stretch === null) return "no entry stretch is free for a new side";
    entry = stretch;
  } else {
    // A side with nobody left lost; whoever comes later is a new side.
    if (members === 0) return `side ${String(side)} has nobody in the arena`;
    if (members >= limits.maxPerSide) {
      return `side ${String(side)}: at most ${limits.maxPerSide} participants`;
    }
    entry = state.sides[side as number]!.entry;
  }
  if (freeEntryCells(state, entry).length === 0) {
    return `side ${String(side)}: no free cell on its entry stretch`;
  }
  return null;
}

/**
 * Why `command` cannot be applied now, or null. A participant only takes
 * orders from whoever controls it: a human's intent that arrives after the
 * domination moved on (latency) is refused, and so is anything for a
 * participant that left the arena, or once the battle is over (plan
 * section 6, spec F-4).
 */
export function validateCommand(
  state: BattleState,
  command: unknown,
  issuer: Controller = "human",
): string | null {
  if (!isRecord(command)) return "expected an object";
  if (state.ended !== null) return "the battle is over";
  const { type, id } = command;
  const lab = LAB_COMMANDS.includes(type as string);
  if (!lab && !PARTICIPANT_COMMANDS.includes(type as string)) {
    return `unknown command ${String(type)}`;
  }
  if (lab && issuer !== "human") return `only the lab can ${String(type)}`;
  if (type === "join") return joinIssue(state, command);
  if (!Number.isSafeInteger(id)) return "id must be an integer";
  const participant = findParticipant(state, id as number);
  if (participant === undefined) {
    return `no participant ${String(id)} in the arena`;
  }
  switch (type) {
    case "control":
      return CONTROLLERS.includes(command.controller as Controller)
        ? null
        : "controller must be gambits or human";
    case "setGambits": {
      const gambits = copyGambits(
        command.gambits,
        state.params.gambits.maxRules,
      );
      return typeof gambits === "string" ? gambits : null;
    }
  }
  if (participant.controller !== issuer) {
    return `participant ${participant.id} is not under ${issuer} control`;
  }
  if (type === "intent") {
    if (command.move !== null && !isDir(command.move)) {
      return "move must be a direction or null";
    }
    if (typeof command.attack !== "boolean") return "attack must be a boolean";
    const { bag } = command;
    if (bag !== undefined && bag !== null && !BAGS.includes(bag as Bag)) {
      return "bag must be drop, pickup or null";
    }
  }
  if (type === "face" && !isDir(command.dir)) return "dir must be a direction";
  return null;
}

/**
 * Hands a participant to `controller`. It starts from a still intent (the
 * last one was someone else's), and the gambits decide on this very tick.
 */
function setController(
  state: BattleState,
  log: BattleEventLog,
  participant: Participant,
  controller: Controller,
): void {
  participant.controller = controller;
  participant.intent = {
    move: null,
    attack: false,
    attackLatch: false,
    drop: false,
    pickup: false,
    bag: null,
  };
  participant.ai = { nextDecisionTick: state.tick, target: null };
  emit(log, {
    type: "controlChanged",
    participant: participantRef(participant),
    controller,
  });
}

/** Applies a valid command (validateCommand returned null). */
export function applyCommand(
  state: BattleState,
  log: BattleEventLog,
  command: BattleCommand,
): void {
  if (command.type === "join") {
    if (command.side === state.sides.length) {
      state.sides.push({ id: command.side, entry: freeStretch(state)! });
    }
    const participant = placeParticipant(
      state,
      command.side,
      command.participant,
    )!;
    emit(log, {
      type: "joined",
      participant: participantRef(participant),
      cell: participant.cell,
    });
    return;
  }
  const participant = findParticipant(state, command.id)!;
  switch (command.type) {
    case "intent":
      participant.intent.move = command.move;
      participant.intent.attack = command.attack;
      participant.intent.bag = command.bag ?? null;
      return;
    case "attackOnce":
      participant.intent.attackLatch = true;
      return;
    case "face":
      participant.facing = command.dir;
      return;
    // The bag acts once, on stage 7; the last of the two in a tick wins.
    case "drop":
      participant.intent.drop = true;
      participant.intent.pickup = false;
      return;
    case "pickup":
      participant.intent.pickup = true;
      participant.intent.drop = false;
      return;
    case "control":
      if (participant.controller === command.controller) return;
      // Each participant on its own: several humans may play one battle
      // (junction D12, one creep per player). The lab's one domination at a
      // time (lab spec D12) is its page's: it releases the one before.
      setController(state, log, participant, command.controller);
      return;
    case "setGambits":
      participant.gambits = copyGambits(
        command.gambits,
        state.params.gambits.maxRules,
      ) as Gambit[];
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
  log: BattleEventLog,
  commands: readonly unknown[],
): void {
  for (const command of commands) {
    if (validateCommand(state, command) === null) {
      applyCommand(state, log, command as BattleCommand);
    }
  }
}
