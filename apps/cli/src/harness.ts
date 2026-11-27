// Runs a world headless with bot players (plan section 9). Bots go through
// the same path as a human on the server: their commands are validated on
// receipt (ack or reject), the accepted ones get the tick and a seq and go into
// the command log, and step validates them again when it applies them. The
// world steps through the junction host (ADR-0010): its battles' results go
// into the log after the bots' commands, as the system player's.

import { readFileSync } from "node:fs";
import { parseBattleParams, type BattleParams } from "@geometrix/battle";
import {
  createHost,
  stepJunction,
  type FinishedBattle,
  type JunctionHost,
  type JunctionStep,
} from "@geometrix/junction";
import {
  botCommands,
  createWorld,
  validate,
  type Bot,
  type Command,
  type CommandInput,
  type Params,
  type SimEvent,
  type WorldState,
} from "@geometrix/sim";

/** An accepted command, as the log keeps it (ADR-0004). */
export type LoggedCommand = {
  tick: number;
  seq: number;
  playerId: number;
  command: Command;
};

const BATTLE_PARAMS = new URL("../../../params/battle.json", import.meta.url);

/** params/battle.json, the battles' params of every bot run. */
export function defaultBattleParams(): BattleParams {
  return parseBattleParams(JSON.parse(readFileSync(BATTLE_PARAMS, "utf8")));
}

/** A concession forced into a run (--concede, E-min plan P12). */
export type Concession = { team: number; minute: number };

/** The tick of its world minute. */
export const concessionTick = (c: Concession, params: Params) =>
  Math.floor((c.minute * 60) / params.world.tickSeconds);

/**
 * The forced concession on its tick: a real `concede` from the team's bot
 * player, validated and logged like any of its commands.
 */
function forced(
  state: WorldState,
  bots: readonly Bot[],
  concede: Concession | null,
): CommandInput[] {
  if (
    concede === null ||
    state.tick !== concessionTick(concede, state.params)
  ) {
    return [];
  }
  return bots
    .filter((bot) => bot.team === concede.team)
    .map(({ playerId }) => ({ playerId, command: { type: "concede" } }));
}

/**
 * Steps one tick through the host with the bots' accepted commands, appending
 * them and then the battles' results to `log`. Returns the tick's events
 * (ADR-0007), the results and the battles that ended.
 */
export function stepWithBots(
  state: WorldState,
  host: JunctionHost,
  bots: readonly Bot[],
  log: LoggedCommand[],
  concede: Concession | null = null,
): JunctionStep {
  const tick = state.tick;
  const accepted = [
    ...botCommands(state, bots),
    ...forced(state, bots, concede),
  ].filter(
    ({ playerId, command }) => validate(state, command, playerId) === null,
  );
  const done = stepJunction(state, host, accepted);
  [...accepted, ...done.results].forEach(({ playerId, command }, seq) => {
    log.push({ tick, seq, playerId, command });
  });
  return done;
}

/** Groups a log by tick for replay: commands of `tick` in seq order. */
export function logCursor(log: readonly LoggedCommand[]) {
  let at = 0;
  return (tick: number): CommandInput[] => {
    const commands: CommandInput[] = [];
    while (at < log.length && log[at]!.tick < tick) at++;
    while (at < log.length && log[at]!.tick === tick) {
      const { playerId, command } = log[at++]!;
      commands.push({ playerId, command });
    }
    return commands;
  };
}

export type BotRun = {
  state: WorldState;
  host: JunctionHost;
  log: LoggedCommand[];
};

/**
 * Creates a world and its host and runs `ticks` ticks with the bots, or up to
 * the world's end (E-min D13). `onTick`
 * sees the new world (tick 0, no events) and the state after each tick with
 * the tick's events and the battles that ended, for metric samples.
 */
export function runBots(
  seed: number,
  params: Params,
  ticks: number,
  bots: readonly Bot[],
  onTick: (
    state: WorldState,
    events: readonly SimEvent[],
    finished: readonly FinishedBattle[],
  ) => void = () => {},
  battleParams: BattleParams = defaultBattleParams(),
  concede: Concession | null = null,
): BotRun {
  const state = createWorld(seed, params);
  const host = createHost(battleParams);
  const log: LoggedCommand[] = [];
  onTick(state, [], []);
  for (let i = 0; i < ticks && state.result === null; i++) {
    const done = stepWithBots(state, host, bots, log, concede);
    onTick(state, done.events, done.finished);
  }
  return { state, host, log };
}
