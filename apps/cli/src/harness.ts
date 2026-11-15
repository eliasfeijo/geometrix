// Runs a world headless with bot players (plan section 9). Bots go through
// the same path as a human on the server: their commands are validated on
// receipt (ack or reject), the accepted ones get the tick and a seq and go into
// the command log, and step validates them again when it applies them.

import {
  botCommands,
  createWorld,
  step,
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

/**
 * Steps one tick with the bots' accepted commands, appending them to `log`.
 * Returns the tick's events (ADR-0007).
 */
export function stepWithBots(
  state: WorldState,
  bots: readonly Bot[],
  log: LoggedCommand[],
): SimEvent[] {
  const accepted = botCommands(state, bots).filter(
    ({ playerId, command }) => validate(state, command, playerId) === null,
  );
  accepted.forEach(({ playerId, command }, seq) => {
    log.push({ tick: state.tick, seq, playerId, command });
  });
  return step(state, accepted);
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

export type BotRun = { state: WorldState; log: LoggedCommand[] };

/**
 * Creates a world and runs `ticks` ticks with the bots. `onTick` sees the new
 * world (tick 0, no events) and the state after each tick with the tick's
 * events, for metric samples.
 */
export function runBots(
  seed: number,
  params: Params,
  ticks: number,
  bots: readonly Bot[],
  onTick: (state: WorldState, events: readonly SimEvent[]) => void = () => {},
): BotRun {
  const state = createWorld(seed, params);
  const log: LoggedCommand[] = [];
  onTick(state, []);
  for (let i = 0; i < ticks; i++) {
    onTick(state, stepWithBots(state, bots, log));
  }
  return { state, log };
}
