// In-game text on the map (F9, owner decisions): creep names under the shape,
// in the game font, only where they fit.

import { slotSize } from "./layout.ts";

/** Smallest on-screen slot (pixels) of a creep that still gets its name. */
export const NAME_MIN_PX = 22;
/** On-screen size of a name, in pixels: a share of the slot, within bounds. */
export const NAME_FONT_SHARE = 0.32;
export const NAME_FONT_MIN_PX = 10;
export const NAME_FONT_MAX_PX = 13;

/**
 * The font size (in cells) of the name of a creep drawn side by side with
 * `inCell` creeps (1 = alone) at `viewScale` pixels per cell, or null when
 * its slot is too small on screen. Creeps in a stack get no name.
 */
export function nameFontSize(inCell: number, viewScale: number): number | null {
  const slotPx = viewScale * (inCell > 1 ? slotSize(inCell) : 1);
  if (slotPx < NAME_MIN_PX) return null;
  const px = Math.min(
    NAME_FONT_MAX_PX,
    Math.max(NAME_FONT_MIN_PX, slotPx * NAME_FONT_SHARE),
  );
  return px / viewScale;
}
