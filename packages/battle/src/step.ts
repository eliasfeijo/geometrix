// The battle tick (plan section 7). The pipeline, in order:
//
//   1. commands of the human and the lab, validated and applied
//   2. gambits of the participants whose decision is due
//   3. turn to the intent, then attack: attack before walking (P3)
//   4. movement: points, carry brake, rng disputes
//   5. projectiles, after the creeps
//   6. damage and death
//   7. drop and pick up
//   8. exit ring and inactivity
//   9. the end, when at most one side is left
//
// The caller passes the commands that arrived during the previous tick, in
// arrival order (plan P5): the lab's worker queues them, the log keeps them
// under the tick they were applied in, and a replay applies them there.

import { runGambits } from "./ai.ts";
import { dropAndPickUp } from "./carry.ts";
import { applyHits, attack, moveProjectiles, type Hit } from "./combat.ts";
import { applyCommands } from "./commands.ts";
import { createEventLog, type BattleEvent } from "./events.ts";
import { checkEnd, leaveArena } from "./exits.ts";
import { moveParticipants, turnToIntent } from "./movement.ts";
import type { BattleState } from "./state.ts";

/** Advances the battle one tick, in place, and returns what happened. */
export function stepBattle(
  state: BattleState,
  commands: readonly unknown[],
): BattleEvent[] {
  // A battle that ended takes no commands and does not advance (spec F-4).
  if (state.ended !== null) return [];
  const log = createEventLog(state.tick);
  const hits: Hit[] = [];
  applyCommands(state, log, commands);
  runGambits(state, log);
  turnToIntent(state);
  attack(state, log, hits);
  moveParticipants(state);
  moveProjectiles(state, hits);
  applyHits(state, log, hits);
  dropAndPickUp(state, log);
  leaveArena(state, log);
  checkEnd(state, log);
  state.tick += 1;
  return log.events;
}
