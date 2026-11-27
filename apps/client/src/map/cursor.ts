// The cursor over the map shows what a click there does (fog F6, E4, owner
// decision): the order a right click gives the dominated creep (gather,
// deliver, move), road mode (red when the stock is short), select over
// something selectable, and the crosshair while picking a cell. With a
// dominated creep the order wins, except over a creep: there, select; over
// an enemy in sight, approach (M2 encontro plan section 9: the right click
// opens the attack / extort menu).

import type { OrderInput } from "@geometrix/sim";
import { COLORS } from "./colors.ts";

export type CursorKind =
  | "default"
  | "select"
  | "pick"
  | "road"
  | "roadShort"
  | "gather"
  | "deliver"
  | "move"
  | "approach"
  | "pickup";

export type CursorInput = {
  mode: "select" | "pickCell" | "pickAlly" | "road";
  /**
   * What a left click there picks: a creep (or a list of them), an enemy
   * creep in sight among them, else.
   */
  pick: "creep" | "enemy" | "other" | null;
  /** The right click's order for the dominated creep; null without one. */
  order: OrderInput["type"] | null;
  /** In road mode, whether the stock is short for the road there. */
  roadShort: boolean;
};

export function cursorKind(input: CursorInput): CursorKind {
  if (input.mode === "pickCell" || input.mode === "pickAlly") return "pick";
  if (input.mode === "road") return input.roadShort ? "roadShort" : "road";
  if (input.pick === "enemy") {
    return input.order === null ? "select" : "approach";
  }
  if (input.pick === "creep") return "select";
  switch (input.order) {
    case "gather":
      return "gather";
    case "deliver":
      return "deliver";
    case "moveTo":
      return "move";
    case "pickup":
      return "pickup";
    default:
      return input.pick === null ? "default" : "select";
  }
}

/** An arrow with a badge at the lower right: the icon of the action. */
function badged(badge: string, color: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">` +
    `<path d="M2 2v17l4.5-4.2 3 6.7 2.6-1.2-3-6.6H15z" fill="#fff" ` +
    `stroke="#1b1b24" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<circle cx="23" cy="23" r="8.5" fill="${color}" stroke="#1b1b24" ` +
    `stroke-width="1.5"/>${badge}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 2 2`;
}

const INK = `stroke="#1b1b24" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"`;

/** The badges: geometric, like the rest of the map. */
const BADGES = {
  // A down arrow into a tray: take from the deposit.
  gather: `<path d="M23 17.5v7M20 21.5l3 3 3-3M18.5 27.5h9" ${INK}/>`,
  // An arrow into a square: unload at the core.
  deliver: `<path d="M19.5 19.5h7v7h-7z M17 23h5M20.5 21.5l1.5 1.5-1.5 1.5" ${INK}/>`,
  // A chevron: go there.
  move: `<path d="M20 19l5 4-5 4" ${INK}/>`,
  // Two strokes crossing: go after that creep.
  approach: `<path d="M19 19l8 8M27 19l-8 8" ${INK}/>`,
  // A small diamond: the spoil.
  pickup: `<path d="M23 18.5l4.5 4.5-4.5 4.5-4.5-4.5z" ${INK}/>`,
  // Three road segments in a row.
  road: `<path d="M17.5 23h11" stroke="#1b1b24" stroke-width="4" stroke-dasharray="3 1"/>`,
};

/** The CSS `cursor` of each kind; the native ones where they say it. */
export const CURSORS: Record<CursorKind, string> = {
  default: "default",
  select: "pointer",
  pick: "crosshair",
  road: `${badged(BADGES.road, COLORS.road)}, crosshair`,
  roadShort: `${badged(BADGES.road, COLORS.paid)}, not-allowed`,
  gather: `${badged(BADGES.gather, COLORS.materia)}, pointer`,
  deliver: `${badged(BADGES.deliver, "#ffffff")}, pointer`,
  move: `${badged(BADGES.move, "#ffffff")}, pointer`,
  approach: `${badged(BADGES.approach, COLORS.fight)}, pointer`,
  pickup: `${badged(BADGES.pickup, COLORS.selection)}, pointer`,
};
