// The tick pipeline (plan section 5). Its fixed order:
//   1. apply the tick's external commands, in seq order       (F4)
//   2. per creep, by id: dominated keeps its order, free ones
//      evaluate their rules                                    (F4)
//   3. resolve orders: movement, gathering, delivery, roads    (F2 / F3)
//   4. core production queues, spawning                        (F3)
//   5. materia regeneration                                    (F3)
//   6. stats accumulators; tick++                              (F5 / now)

import { runAutopilot } from "./autopilot.ts";
import { applyCommand, type CommandInput } from "./commands.ts";
import { regenerate } from "./economy.ts";
import { resolveOrders } from "./orders.ts";
import { runProduction } from "./production.ts";
import type { WorldState } from "./world.ts";

/**
 * Advances the world by one tick, mutating `state` in place: copying the whole
 * state every tick would not fit the 3-days-in-10-minutes budget (spec
 * section 7). Callers that need the previous state keep a `serialize` copy.
 * `commands` are the tick's external commands in seq order; each is validated
 * again against the state as it is then, and a refused one is skipped.
 */
export function step(
  state: WorldState,
  commands: readonly CommandInput[],
): void {
  for (const { playerId, command } of commands) {
    applyCommand(state, command, playerId);
  }
  runAutopilot(state);
  resolveOrders(state);
  runProduction(state);
  regenerate(state);
  state.tick += 1;
}
