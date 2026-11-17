// The battle tick (plan section 7). The pipeline, in order:
//
//   1. commands of the human and the lab, validated and applied   (F1)
//   2. gambits of the participants whose decision is due           (F3)
//   3. turn to the intent (F1), then attack (F2): attack before walking
//   4. movement: points, carry brake, rng disputes                 (F1)
//   5. projectiles, after the creeps                               (F2)
//   6. damage and death                                            (F2)
//   7. drop and pick up                                            (F2)
//   8. exit ring and inactivity                                    (F2)
//   9. the end, when at most one side is left                      (F2)
//
// The caller passes the commands that arrived during the previous tick, in
// arrival order (plan P5): the lab's worker queues them, the log keeps them
// under the tick they were applied in, and a replay applies them there.

import { applyCommands } from "./commands.ts";
import { createEventLog, type BattleEvent } from "./events.ts";
import { moveParticipants, turnToIntent } from "./movement.ts";
import type { BattleState } from "./state.ts";

/** Advances the battle one tick, in place, and returns what happened. */
export function stepBattle(
  state: BattleState,
  commands: readonly unknown[],
): BattleEvent[] {
  const log = createEventLog(state.tick);
  applyCommands(state, commands);
  turnToIntent(state);
  moveParticipants(state);
  state.tick += 1;
  return log.events;
}
