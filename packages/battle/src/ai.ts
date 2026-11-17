// The gambits AI (spec G-1, G-2, D14; plan section 9, P12, P13): stage 2 of
// the tick. Every participant under the gambits whose decision is due reads
// the view of the start of the stage, takes the first rule whose condition
// holds and whose action can be done now, and that rule's commands go
// through the same validation as the human's. With no such rule it stands
// still. Between decisions it keeps its intent; the next decision comes
// `decisionMs` ± `decisionJitterMs` later, drawn by the rng (the reaction
// time, P12). Participants decide in id order, each one's rng calls in a
// fixed order: the rule's, then the reaction.

import { alignedDir } from "./arena.ts";
import { actionCommands } from "./actions.ts";
import {
  applyCommand,
  validateCommand,
  type BattleCommand,
} from "./commands.ts";
import type { BattleEventLog } from "./events.ts";
import type { Condition } from "./gambits.ts";
import {
  carryAbove,
  createMind,
  hpBelow,
  projectileIncoming,
  stepsTo,
  type Mind,
} from "./mind.ts";
import { msToTicks } from "./params.ts";
import { nextRange } from "./rng.ts";
import type { BattleState, Participant } from "./state.ts";
import { battleView, type BattleView } from "./view.ts";

/** Whether `condition` holds for the deciding participant (spec D14). */
export function conditionHolds(mind: Mind, condition: Condition): boolean {
  const { state, self } = mind;
  switch (condition.type) {
    case "always":
      return true;
    case "hpBelow":
      return hpBelow(state, self, condition.permille);
    case "enemyWithin":
      return mind.enemies.some((e) => {
        const steps = stepsTo(mind, e.cell);
        return steps >= 0 && steps <= condition.cells;
      });
    case "enemyAligned":
      return mind.enemies.some(
        (e) =>
          alignedDir(state.arena, self.cell, e.cell, mind.kit.range) !== null,
      );
    case "projectileIncoming":
      return projectileIncoming(mind);
    case "carryAbove":
      return carryAbove(state, self, condition.permille);
    case "allyHpBelow":
      return mind.allies.some((a) => {
        const steps = stepsTo(mind, a.cell);
        return (
          hpBelow(state, a, condition.permille) &&
          steps >= 0 &&
          steps <= condition.cells
        );
      });
  }
}

/** The commands of the first rule that holds and can be done, or standing still. */
function decide(
  state: BattleState,
  view: BattleView,
  participant: Participant,
): BattleCommand[] {
  const mind = createMind(state, view, participant);
  for (const { when, then } of participant.gambits) {
    if (!conditionHolds(mind, when)) continue;
    const commands = actionCommands(mind, then, when);
    if (commands !== null) return commands;
  }
  return [{ type: "intent", id: participant.id, move: null, attack: false }];
}

/** Ticks until the next decision: decisionMs ± decisionJitterMs (plan P12). */
function reactionTicks(state: BattleState): number {
  const { decisionMs, decisionJitterMs } = state.params.ai;
  const base = msToTicks(state.params, decisionMs);
  const jitter = msToTicks(state.params, decisionJitterMs);
  return nextRange(state.rng, base - jitter, base + jitter);
}

/** Stage 2 of the tick. */
export function runGambits(state: BattleState, log: BattleEventLog): void {
  let view: BattleView | null = null;
  for (const participant of state.participants) {
    if (participant.controller !== "gambits") continue;
    if (state.tick < participant.ai.nextDecisionTick) continue;
    view ??= battleView(state);
    for (const command of decide(state, view, participant)) {
      if (validateCommand(state, command, "gambits") === null) {
        applyCommand(state, log, command);
      }
    }
    participant.ai.nextDecisionTick = state.tick + reactionTicks(state);
  }
}
