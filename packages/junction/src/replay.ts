// The two logs agree (ADR-0010 rule 4, junction plan section 4): a finished
// battle's log, replayed alone, gives the world commands the world log
// applied for it. `geo verify` checks it for every battle of a run.

import { createBattle, stepBattle } from "@geometrix/battle";
import type { Command, WorldState } from "@geometrix/sim";
import type { FinishedBattle } from "./host.ts";
import { tickResults } from "./results.ts";

/**
 * The world commands a finished battle's log replays to. `world` only lends
 * the map and the params (the arena → world cells); any tick of the run will
 * do.
 */
export function replayResults(
  world: WorldState,
  battle: FinishedBattle,
): Command[] {
  const { log } = battle;
  const state = createBattle(log.setup, log.params);
  const commands: Command[] = [];
  let next = 0;
  while (state.tick < log.ticks) {
    const entry = log.commands[next];
    let input: unknown[] = [];
    if (entry !== undefined && entry.tick === state.tick) {
      input = entry.commands;
      next += 1;
    }
    const events = stepBattle(state, input);
    const late = state.ended === null ? [] : battle.late;
    commands.push(...tickResults(world, battle, state, events, late));
  }
  return commands;
}
