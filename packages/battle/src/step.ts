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
// During the countdown at the start (spec D21, S-4), stages 1, 2 and the turn
// run, so the human and the AI can aim, and the rest waits: nobody attacks,
// walks, drops or picks up, and the exit count and the idle clock only start
// when it is over. At its end only what is held acts: the direction and the
// attack of the intent, and the bag key held (`intent.bag`; for the AI, its
// last decision). A tap asked and let go meanwhile (the latch, a drop, a
// pickup) is discarded at the end of each countdown tick. Whoever joins
// during the countdown waits for it too; whoever joins later gets no
// countdown of its own.
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
import { countdownTicks } from "./params.ts";
import type { BattleState } from "./state.ts";

/** End of a countdown tick: the taps asked during it are gone (spec S-4). */
function discardTaps(state: BattleState): void {
  for (const { intent } of state.participants) {
    intent.attackLatch = false;
    intent.drop = false;
    intent.pickup = false;
  }
}

/** First tick of the fight after a countdown: the bag key held acts. */
function releaseHeldBag(state: BattleState): void {
  for (const { intent } of state.participants) {
    if (intent.bag === "drop") {
      intent.drop = true;
      intent.pickup = false;
    } else if (intent.bag === "pickup") {
      intent.pickup = true;
      intent.drop = false;
    }
  }
}

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
  const countdown = countdownTicks(state.params);
  const fighting = state.tick >= countdown;
  if (countdown > 0 && state.tick === countdown) releaseHeldBag(state);
  if (fighting) {
    attack(state, log, hits);
    moveParticipants(state);
  }
  moveProjectiles(state, log, hits);
  applyHits(state, log, hits);
  if (fighting) {
    dropAndPickUp(state, log);
    leaveArena(state, log);
  } else {
    discardTaps(state);
  }
  checkEnd(state, log);
  state.tick += 1;
  return log.events;
}
