// The marks of the replay's timeline (E-min D11, plan P10): which events get
// one, of which kind, and which kinds start hidden.

import type { TeamEvent } from "@geometrix/sim";

export type MarkerKind =
  | "battleOpened"
  | "battleEnded"
  | "death"
  | "wandererDeath"
  | "born"
  | "wandererBorn"
  | "teamOut"
  | "worldEnded";

/**
 * The kinds in the order of the toggles; `lane` is the row on the
 * timeline, so marks that fall together (a battle's opening and end, the last
 * team out and the world's end) stay apart.
 */
export const MARKER_KINDS: readonly {
  kind: MarkerKind;
  label: string;
  glyph: string;
  color: string;
  lane: 0 | 1 | 2 | 3;
}[] = [
  {
    kind: "battleOpened",
    label: "Batalhas",
    glyph: "▲",
    color: "#ff6b6b",
    lane: 0,
  },
  {
    kind: "battleEnded",
    label: "Fim de batalha",
    glyph: "▼",
    color: "#ffd166",
    lane: 1,
  },
  { kind: "death", label: "Mortes", glyph: "✕", color: "#f2f4f8", lane: 2 },
  {
    kind: "wandererDeath",
    label: "Andarilhos mortos",
    glyph: "✕",
    color: "#c9a36a",
    lane: 2,
  },
  { kind: "born", label: "Nascimentos", glyph: "●", color: "#7fdba0", lane: 3 },
  {
    kind: "wandererBorn",
    label: "Andarilhos surgidos",
    glyph: "○",
    color: "#c9a36a",
    lane: 3,
  },
  {
    kind: "teamOut",
    label: "Times fora",
    glyph: "◆",
    color: "#c48cff",
    lane: 0,
  },
  // A lane of its own: the end shares its tick with the last team out.
  { kind: "worldEnded", label: "Fim", glyph: "■", color: "#4ea8ff", lane: 1 },
];

/** Past this many marks, births and deaths start hidden (plan section 7). */
export const DENSE_MARKS = 120;

export type Marker = { kind: MarkerKind; event: TeamEvent };

function kindOf(event: TeamEvent): MarkerKind | null {
  switch (event.type) {
    case "battleOpened":
    case "battleEnded":
    case "born":
    case "wandererBorn":
    case "teamOut":
    case "worldEnded":
      return event.type;
    case "died":
      return event.creep.team === null ? "wandererDeath" : "death";
    default:
      return null;
  }
}

export function markersOf(events: readonly TeamEvent[]): Marker[] {
  return events.flatMap((event) => {
    const kind = kindOf(event);
    return kind === null ? [] : [{ kind, event }];
  });
}

/** The kinds hidden when the replay opens, so a long match stays readable. */
export function initialHidden(markers: readonly Marker[]): Set<MarkerKind> {
  const dense: MarkerKind[] = ["born", "death", "wandererDeath"];
  const count = markers.filter((m) => dense.includes(m.kind)).length;
  return new Set(count > DENSE_MARKS ? dense : []);
}
