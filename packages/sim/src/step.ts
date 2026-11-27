// The tick pipeline (plan section 5; M2 encontro plan section 5; junction
// plan section 3). Its fixed order:
//   1. apply the tick's external commands, in seq order, the junction
//      host's battle results included                  (F4; junction P2)
//   2. per creep, by id: dominated keeps its order, free ones
//      evaluate their rules; creeps in an encounter or a battle skip;
//      then the wanderers decide                      (junction F6)
//   3. resolve orders: movement, gathering, delivery, roads,
//      approach; creeps in a battle skip; the wanderers walk
//                                                (F2 / F3; M2 encontro)
//   4. encounters: open (an attack opens a battle), the wanderers'
//      attacks, the extortion dialogue (a refusal opens one), joins
//                                                (M2 encontro §4; junction)
//   5. core production queues, spawning (born event); wanderer births
//                                                         (F3; junction)
//   6. materia and HP regeneration (the wanderers' too); nobody in a
//      battle heals
//                                                    (F3; M2 encontro P1)
//  6b. the end: eliminations and the result          (E-min plan P1)
//   7. vision and team memory; the events' audience  (M1.5 fog, N10;
//      ADR-0007 rule 3)
//   8. stats accumulators and the main events; tick++          (F5)

import { runAutopilot } from "./autopilot.ts";
import { SYSTEM_PLAYER_ID } from "./battle.ts";
import { applyCommand, type CommandInput } from "./commands.ts";
import { findPlayer } from "./domination.ts";
import { checkEnd, recordHighlights } from "./end.ts";
import { runEncounters } from "./encounter.ts";
import { createEventLog, setAudience, type SimEvent } from "./events.ts";
import { regenerate } from "./economy.ts";
import { regenerateHp } from "./hp.ts";
import { resolveOrders } from "./orders.ts";
import { runProduction } from "./production.ts";
import { accumulateStats, recordCommand } from "./stats.ts";
import { updateVision } from "./vision.ts";
import {
  decideWanderers,
  moveWanderers,
  regenerateWanderers,
  runWandererBirths,
} from "./wanderers.ts";
import type { WorldState } from "./world.ts";

/**
 * Advances the world by one tick, mutating `state` in place: copying the whole
 * state every tick would not fit the 3-days-in-10-minutes budget (spec
 * section 7). Callers that need the previous state keep a `serialize` copy.
 * `commands` are the tick's external commands in seq order; each is validated
 * again against the state as it is then, and a refused one is skipped.
 * Returns the tick's events with their audience (ADR-0007, plan P9); they are
 * not part of the state. An ended world is frozen: stepping it throws (E-min
 * plan P8).
 */
export function step(
  state: WorldState,
  commands: readonly CommandInput[],
): SimEvent[] {
  if (state.result !== null) throw new Error("step: the world has ended");
  const log = createEventLog(state.tick);
  for (const { playerId, command } of commands) {
    if (applyCommand(state, command, playerId, log) !== null) continue;
    // The junction host's results belong to no team (plan P2).
    if (playerId === SYSTEM_PLAYER_ID) continue;
    const preset = command.type === "applyPreset" ? command.preset : null;
    recordCommand(
      state,
      findPlayer(state, playerId)!.team,
      command.type,
      preset,
    );
  }
  runAutopilot(state);
  decideWanderers(state);
  resolveOrders(state, log);
  moveWanderers(state);
  runEncounters(state, log);
  runProduction(state, log);
  runWandererBirths(state, log);
  regenerate(state);
  regenerateHp(state);
  regenerateWanderers(state);
  checkEnd(state, log);
  updateVision(state);
  setAudience(state, log.events);
  accumulateStats(state);
  recordHighlights(state, log.events);
  state.tick += 1;
  return log.events;
}
