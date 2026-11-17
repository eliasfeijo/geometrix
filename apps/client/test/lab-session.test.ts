import type { BattleSetup } from "@geometrix/battle";
import { describe, expect, test } from "vitest";
import type { KeyValueStore } from "../src/session.ts";
import { RTT_CHOICES } from "../src/lab/channel.ts";
import {
  BLIND_PER_RTT,
  emptySession,
  gradesByRtt,
  latencyVerdict,
  loadLabSession,
  matchupOf,
  median,
  saveLabSession,
  sessionExport,
  shuffledBag,
  winsByMatchup,
  type BattleRecord,
  type Grade,
} from "../src/lab/session.ts";
import { LAB_PARAMS } from "../src/lab/assets.ts";
import { memoryStorage } from "./helpers.ts";

const fighter = (dna: "square" | "triangle" | "circle") => ({
  name: dna,
  dna,
  hp: 1,
  carry: { materia: 0, cristal: 0 },
  gambits: [],
  reaction: "normal" as const,
});

const setup = {
  rule: "grid",
  arena: [],
  seed: 1,
  sides: [],
} as BattleSetup;

function record(over: Partial<BattleRecord> = {}): BattleRecord {
  return {
    at: "2026-11-17T12:00:00.000Z",
    blind: false,
    rttMs: 0,
    arena: "pedras",
    matchup: "pedras · ■ × ●",
    setup,
    played: { name: "Ária", side: 0, outcome: "won" },
    switched: false,
    winnerSide: 0,
    ticks: 300,
    measured: { samples: 10, medianMs: 80, p95Ms: 100 },
    grade: null,
    hash: null,
    ...over,
  };
}

const blind = (rttMs: number, grade: Grade, medianMs = rttMs + 75) =>
  record({
    blind: true,
    rttMs,
    grade,
    measured: { samples: 20, medianMs, p95Ms: medianMs + 30 },
  });

/** A storage whose every call throws (blocked site data). */
const blocked: KeyValueStore = {
  length: 0,
  key: () => null,
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

describe("the session's storage (plan P14)", () => {
  test("a saved session loads back", () => {
    const storage = memoryStorage();
    const session = {
      records: [record()],
      blind: {
        setup,
        arena: "pedras",
        matchup: "pedras · ■ × ●",
        you: 0,
        bag: [100, 0],
        total: 30,
      },
    };
    saveLabSession(storage, session);
    expect(loadLabSession(storage)).toEqual(session);
  });

  test("missing, broken or blocked storage gives an empty session", () => {
    expect(loadLabSession(memoryStorage())).toEqual(emptySession());
    const broken = memoryStorage();
    broken.setItem("geometrix:lab:session", "{not json");
    expect(loadLabSession(broken)).toEqual(emptySession());
    broken.setItem("geometrix:lab:session", JSON.stringify({ records: 3 }));
    expect(loadLabSession(broken)).toEqual(emptySession());
    expect(loadLabSession(blocked)).toEqual(emptySession());
    expect(() => saveLabSession(blocked, emptySession())).not.toThrow();
  });
});

describe("the matchup label", () => {
  test("the arena and each side's DNAs, with the HP when not full", () => {
    const params = LAB_PARAMS;
    const s: BattleSetup = {
      ...setup,
      sides: [
        [
          { ...fighter("square"), hp: 300 },
          { ...fighter("triangle"), hp: 100 },
        ],
        [{ ...fighter("circle"), hp: 120 }],
      ],
    };
    expect(matchupOf(s, "corredor", params)).toBe("corredor · ■▲50% × ●");
  });
});

describe("the blind bag (spec D17)", () => {
  test("5 of each RTT, in a shuffled order, none repeated past its 5", () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const bag = shuffledBag(RTT_CHOICES, BLIND_PER_RTT, random);
    expect(bag).toHaveLength(30);
    for (const rtt of RTT_CHOICES) {
      expect(bag.filter((r) => r === rtt)).toHaveLength(5);
    }
    // Shuffled: not in the selector's order.
    expect(bag).not.toEqual([...bag].sort((a, b) => a - b));
  });
});

describe("grade × RTT (spec L-5, section 7)", () => {
  test("the median grade and delay per RTT, only of graded blind battles", () => {
    const records = [
      blind(0, 5),
      blind(0, 4),
      blind(0, 5),
      blind(150, 3),
      blind(150, 4),
      record({ rttMs: 150, grade: null }),
      blind(300, 2, 400),
    ];
    const rows = gradesByRtt(records, [0, 150, 300]);
    expect(rows).toEqual([
      { rttMs: 0, grades: [5, 4, 5], median: 5, delayMs: 75 },
      { rttMs: 150, grades: [3, 4], median: 3.5, delayMs: 225 },
      { rttMs: 300, grades: [2], median: 2, delayMs: 400 },
    ]);
    expect(median([])).toBe(null);
  });

  test("the verdict: playable up to the last RTT with a median of 4 or more", () => {
    const rows = gradesByRtt(
      [
        blind(0, 5),
        blind(50, 4),
        blind(100, 4),
        blind(150, 3),
        blind(200, 4),
        blind(300, 2),
      ],
      RTT_CHOICES,
    );
    // 200 has a 4 again, but 150 already fell: the range stops at 100.
    expect(latencyVerdict(rows)).toEqual({ goodUpTo: 100, badFrom: 300 });
    expect(latencyVerdict(gradesByRtt([], RTT_CHOICES))).toEqual({
      goodUpTo: null,
      badFrom: null,
    });
  });
});

describe("wins dominating × the AI (spec section 7)", () => {
  test("the owner's side against the AI's on the same side, same matchup", () => {
    const records = [
      record({ winnerSide: 0 }),
      record({ winnerSide: 1 }),
      record({ winnerSide: 0 }),
      // Watching: the AI on side 0 won once in two.
      record({ played: null, winnerSide: 0 }),
      record({ played: null, winnerSide: 1 }),
      // Switched mid-battle: neither.
      record({ switched: true, winnerSide: 0 }),
      // Another matchup with no battle of the owner: no row.
      record({ matchup: "aberta · ■ × ▲", played: null, winnerSide: 1 }),
    ];
    expect(winsByMatchup(records)).toEqual([
      {
        matchup: "pedras · ■ × ●",
        side: 0,
        owner: { battles: 3, wins: 2 },
        ai: { battles: 2, wins: 1 },
      },
    ]);
  });

  test("the export has the records, the summaries and how many are left", () => {
    const session = {
      records: [blind(0, 5)],
      blind: {
        setup,
        arena: "pedras",
        matchup: "m",
        you: 0,
        bag: [50, 100],
        total: 30,
      },
    };
    const out = sessionExport(session, RTT_CHOICES, "now");
    expect(out.records).toHaveLength(1);
    expect(out.summary.latency).toEqual({ goodUpTo: 0, badFrom: null });
    // The order of the RTTs to come stays hidden.
    expect(out.blind).toEqual({ left: 2, total: 30 });
  });
});
