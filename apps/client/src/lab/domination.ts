// Who the owner dominates on the lab's page (spec L-2, plan C7): the page's
// side of the `control` command, so the domination ends with the battle and
// the session record only counts real switches.

import type { BattleView } from "@geometrix/battle";

/**
 * Whether the page still dominates `id` after a frame with `view`: not once
 * the creep left the arena, and not once the battle ended (the winner stays
 * in the view, and instant would stay off).
 */
export function keepsDomination(view: BattleView, id: number): boolean {
  return view.ended === null && view.participants.some((p) => p.id === id);
}

/**
 * Whether taking `id` changes who the owner plays (and takes the battle out
 * of both counts of the record): dominating the creep already dominated
 * does nothing.
 */
export function isSwitch(dominated: number | null, id: number): boolean {
  return dominated !== id;
}
