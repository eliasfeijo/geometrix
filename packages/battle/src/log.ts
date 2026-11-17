// The battle log (spec D18, R-2, R-3; plan section 11): the setup, the params
// and the commands of each tick are enough to rebuild a battle, since the
// gambits run inside stepBattle (plan P13). The lab's worker records one and
// exports it with the hash it computed; `geo battle verify --log` replays it
// and compares. The hash (sha256 of serializeBattle) is computed outside the
// package.

import { parseBattleParams, type BattleParams } from "./params.ts";
import { BattleVersionError } from "./serialize.ts";
import { createBattle, type BattleSetup } from "./setup.ts";
import { BATTLE_VERSION, type BattleState } from "./state.ts";
import type { BattleEvent } from "./events.ts";
import { stepBattle } from "./step.ts";

/** The commands applied on one tick, in arrival order. */
export type LoggedTick = { tick: number; commands: unknown[] };

export type BattleLog = {
  battleVersion: number;
  setup: BattleSetup;
  params: BattleParams;
  /** Ticks stepped; a replay steps as many. */
  ticks: number;
  /** Only the ticks that had commands, in tick order. */
  commands: LoggedTick[];
  /** sha256 of the final serializeBattle, set by whoever ran the battle. */
  finalHash: string | null;
};

export class BattleLogError extends Error {
  constructor(message: string) {
    super(`invalid battle log: ${message}`);
    this.name = "BattleLogError";
  }
}

/** An empty log for a battle about to be created from `setup`. */
export function createLog(setup: BattleSetup, params: BattleParams): BattleLog {
  return {
    battleVersion: BATTLE_VERSION,
    setup,
    params,
    ticks: 0,
    commands: [],
    finalHash: null,
  };
}

/**
 * stepBattle, keeping the commands in the log under the tick they apply on
 * (plan P5): refused ones too, since the replay refuses them the same way. A
 * battle that ended does not step, and nothing is logged.
 */
export function stepLogged(
  state: BattleState,
  log: BattleLog,
  commands: readonly unknown[],
): BattleEvent[] {
  if (state.ended !== null) return [];
  if (commands.length > 0) {
    log.commands.push({ tick: state.tick, commands: [...commands] });
  }
  const events = stepBattle(state, commands);
  log.ticks = state.tick;
  return events;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Checks the shape of an untrusted log (e.g. parsed from a file). */
function checkLog(input: unknown): BattleLog {
  if (!isRecord(input)) throw new BattleLogError("expected an object");
  if (input.battleVersion !== BATTLE_VERSION) {
    throw new BattleVersionError(input.battleVersion);
  }
  parseBattleParams(input.params);
  const { ticks, commands, finalHash } = input;
  if (!Number.isSafeInteger(ticks) || (ticks as number) < 0) {
    throw new BattleLogError("ticks must be a non-negative integer");
  }
  if (finalHash !== null && typeof finalHash !== "string") {
    throw new BattleLogError("finalHash must be a string or null");
  }
  if (!Array.isArray(commands)) {
    throw new BattleLogError("commands must be a list");
  }
  let last = -1;
  for (const entry of commands as unknown[]) {
    if (
      !isRecord(entry) ||
      !Number.isSafeInteger(entry.tick) ||
      !Array.isArray(entry.commands)
    ) {
      throw new BattleLogError("each entry must be { tick, commands: [] }");
    }
    const tick = entry.tick as number;
    if (tick <= last || tick >= (ticks as number)) {
      throw new BattleLogError(
        `command ticks must increase within 0..${(ticks as number) - 1}, got ${tick} after ${last}`,
      );
    }
    last = tick;
  }
  return input as BattleLog;
}

export type ReplayOptions = {
  /** Stop before this tick (default: the log's ticks). */
  until?: number;
  /** Go on from this state (e.g. a restored snapshot) instead of the setup. */
  from?: BattleState;
};

/**
 * Rebuilds the battle of `input` (spec R-2, R-3): creates it from the setup
 * and params, or starts from `from`, and steps up to `until`, with each
 * tick's logged commands. Throws BattleLogError, BattleVersionError,
 * BattleParamsError or BattleSetupError when the log is invalid, and
 * BattleLogError when the battle ends before the log does.
 */
export function replayLog(
  input: unknown,
  options: ReplayOptions = {},
): BattleState {
  const log = checkLog(input);
  const until = options.until ?? log.ticks;
  const state = options.from ?? createBattle(log.setup, log.params);
  if (until > log.ticks || until < state.tick) {
    throw new BattleLogError(
      `cannot replay from tick ${state.tick} to ${until} of ${log.ticks}`,
    );
  }
  let next = log.commands.findIndex((entry) => entry.tick >= state.tick);
  if (next < 0) next = log.commands.length;
  while (state.tick < until) {
    if (state.ended !== null) {
      throw new BattleLogError(
        `the battle ended on tick ${state.ended.tick}, before the log's ${log.ticks} ticks`,
      );
    }
    const entry = log.commands[next];
    let commands: unknown[] = [];
    if (entry !== undefined && entry.tick === state.tick) {
      commands = entry.commands;
      next += 1;
    }
    stepBattle(state, commands);
  }
  return state;
}
