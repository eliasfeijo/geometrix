// The lab's session (spec L-5, D17, section 8; plan section 13, P14): every
// battle that ends goes into the record (the setup, whom the owner
// dominated, the outcome, the RTT, the measured delay and, in the blind
// mode, the grade), kept in localStorage behind try/catch and exported as
// JSON with two summaries: grade × RTT (spec section 7, latency) and wins
// dominating × the AI's in the same matchup (the micro matters).
//
// The blind mode (F5): one setup for the whole session (the owner's), a bag
// with 5 of each RTT in a shuffled order, drawn without repetition by the
// page (Math.random, outside the battle: it is not in the log), the RTT and
// the measured delay hidden until the grade from 1 to 5.

import type { BattleSetup, Outcome } from "@geometrix/battle";
import type { KeyValueStore } from "../session.ts";
import { DNA_GLYPHS } from "./labels.ts";
import type { LatencySummary } from "./latency.ts";
import type { MotionMode } from "./motion.ts";

/** Battles per RTT in a blind session (spec section 8: at least 5). */
export const BLIND_PER_RTT = 5;

export const GRADES = [1, 2, 3, 4, 5] as const;
export type Grade = (typeof GRADES)[number];

/** Whom the owner played from the start of the battle. */
export type Played = {
  name: string;
  side: number;
  /** How the owner's participant left the battle, or "won". */
  outcome: Outcome | "won";
};

export type BattleRecord = {
  /** When it ended (ISO 8601, the page's clock). */
  at: string;
  blind: boolean;
  /** The RTT at the start of the battle. */
  rttMs: number;
  arena: string;
  /** The matchup, for the summary: the arena and each side's DNAs. */
  matchup: string;
  setup: BattleSetup;
  /**
   * Whom the owner dominated from the start, or null if the owner only
   * watched. `switched` when the owner took or let go of a participant
   * during the battle: then it counts neither as the owner's nor the AI's.
   */
  played: Played | null;
  switched: boolean;
  winnerSide: number | null;
  ticks: number;
  measured: LatencySummary;
  /** How the page drew the movement (F7, C11); absent in older records. */
  motion?: MotionMode;
  /** The blind mode's grade ("is it playable?"), null outside it. */
  grade: Grade | null;
  hash: string | null;
};

/** A blind session: the fixed setup and the RTTs still to play. */
export type BlindSession = {
  setup: BattleSetup;
  arena: string;
  matchup: string;
  /** Whom the owner plays: its place in the setup. */
  you: number | null;
  /** RTTs still to play, the next one first. */
  bag: number[];
  total: number;
};

export type LabSession = {
  records: BattleRecord[];
  blind: BlindSession | null;
};

const KEY = "geometrix:lab:session";

/**
 * The matchup of a setup, for the summary: the arena and each side's DNAs,
 * with the starting HP when it is not full (e.g. "pedras · ■ × ●50%").
 */
export function matchupOf(setup: BattleSetup, arena: string): string {
  const side = (members: BattleSetup["sides"][number]) =>
    members
      .map((p) => {
        const hp =
          p.hp < p.maxHp ? `${Math.round((p.hp * 100) / p.maxHp)}%` : "";
        return `${DNA_GLYPHS[p.dna]}${hp}`;
      })
      .join("");
  return `${arena} · ${setup.sides.map(side).join(" × ")}`;
}

/** localStorage, or a store in memory where even reaching it throws. */
export function pageStorage(): KeyValueStore {
  try {
    return window.localStorage;
  } catch {
    const data = new Map<string, string>();
    return {
      get length() {
        return data.size;
      },
      key: (i) => [...data.keys()][i] ?? null,
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    };
  }
}

export function emptySession(): LabSession {
  return { records: [], blind: null };
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The session saved in `storage`, or an empty one (missing, broken, blocked). */
export function loadLabSession(storage: KeyValueStore): LabSession {
  let raw: string | null;
  try {
    raw = storage.getItem(KEY);
  } catch {
    return emptySession();
  }
  if (raw === null) return emptySession();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecordLike(parsed) || !Array.isArray(parsed.records)) {
      return emptySession();
    }
    const blind = isRecordLike(parsed.blind)
      ? (parsed.blind as BlindSession)
      : null;
    return { records: parsed.records as BattleRecord[], blind };
  } catch {
    return emptySession();
  }
}

/** Saves the session; with storage blocked or full, it lasts until reload. */
export function saveLabSession(
  storage: KeyValueStore,
  session: LabSession,
): void {
  try {
    storage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Kept in memory: the export still has it.
  }
}

/**
 * The blind mode's bag (spec D17, F5): `perRtt` of each RTT, shuffled by
 * Fisher–Yates with `random` (Math.random on the page).
 */
export function shuffledBag(
  rtts: readonly number[],
  perRtt: number,
  random: () => number,
): number[] {
  const bag = rtts.flatMap((rtt) => Array.from({ length: perRtt }, () => rtt));
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [bag[i], bag[j]] = [bag[j]!, bag[i]!];
  }
  return bag;
}

/** The median of a list (the mean of the two middle values when even). */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export type GradeRow = {
  rttMs: number;
  grades: Grade[];
  median: number | null;
  /** The median, over these battles, of each battle's measured median. */
  delayMs: number | null;
};

/** Grade × RTT of the blind battles that got a grade (spec L-5). */
export function gradesByRtt(
  records: readonly BattleRecord[],
  rtts: readonly number[],
): GradeRow[] {
  return rtts.map((rttMs) => {
    const graded = records.filter(
      (r) => r.blind && r.grade !== null && r.rttMs === rttMs,
    );
    const delays = graded
      .map((r) => r.measured.medianMs)
      .filter((ms) => Number.isFinite(ms));
    return {
      rttMs,
      grades: graded.map((r) => r.grade!),
      median: median(graded.map((r) => r.grade!)),
      delayMs: median(delays),
    };
  });
}

/**
 * The latency criterion (spec section 7): the largest RTT up to which every
 * RTT with grades has a median of 4 or more, and the smallest whose median
 * falls below 3. Null when no RTT qualifies.
 */
export function latencyVerdict(rows: readonly GradeRow[]): {
  goodUpTo: number | null;
  badFrom: number | null;
} {
  let goodUpTo: number | null = null;
  for (const row of rows) {
    if (row.median === null) continue;
    if (row.median < 4) break;
    goodUpTo = row.rttMs;
  }
  const bad = rows.find((r) => r.median !== null && r.median < 3);
  return { goodUpTo, badFrom: bad?.rttMs ?? null };
}

export type Tally = { battles: number; wins: number };

export type MatchupRow = {
  matchup: string;
  side: number;
  /** The owner dominating `side` from start to end. */
  owner: Tally;
  /** The AI on `side`, with the owner only watching. */
  ai: Tally;
};

/**
 * Wins dominating × the AI (spec section 7, "the micro matters"): per
 * matchup and side the owner played, the owner's wins against the AI's in
 * the battles of the same matchup the owner only watched.
 */
export function winsByMatchup(records: readonly BattleRecord[]): MatchupRow[] {
  const rows: MatchupRow[] = [];
  const rowOf = (matchup: string, side: number): MatchupRow => {
    let row = rows.find((r) => r.matchup === matchup && r.side === side);
    if (row === undefined) {
      row = {
        matchup,
        side,
        owner: { battles: 0, wins: 0 },
        ai: { battles: 0, wins: 0 },
      };
      rows.push(row);
    }
    return row;
  };
  for (const r of records) {
    if (r.switched || r.played === null) continue;
    const tally = rowOf(r.matchup, r.played.side).owner;
    tally.battles += 1;
    if (r.winnerSide === r.played.side) tally.wins += 1;
  }
  for (const r of records) {
    if (r.switched || r.played !== null) continue;
    for (const row of rows) {
      if (row.matchup !== r.matchup) continue;
      row.ai.battles += 1;
      if (r.winnerSide === row.side) row.ai.wins += 1;
    }
  }
  return rows;
}

/** What the export downloads: the records and both summaries. */
export function sessionExport(
  session: LabSession,
  rtts: readonly number[],
  exportedAt: string,
) {
  const grades = gradesByRtt(session.records, rtts);
  return {
    exportedAt,
    records: session.records,
    summary: {
      gradesByRtt: grades,
      latency: latencyVerdict(grades),
      winsByMatchup: winsByMatchup(session.records),
    },
    blind:
      session.blind === null
        ? null
        : { left: session.blind.bag.length, total: session.blind.total },
  };
}
