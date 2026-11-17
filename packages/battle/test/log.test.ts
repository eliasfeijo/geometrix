import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  BattleLogError,
  createLog,
  replayLog,
  stepLogged,
  type BattleLog,
} from "../src/log.ts";
import { BattleParamsError } from "../src/params.ts";
import {
  BattleVersionError,
  restoreBattle,
  serializeBattle,
} from "../src/serialize.ts";
import {
  BattleSetupError,
  createBattle,
  type BattleSetup,
} from "../src/setup.ts";
import type { BattleState } from "../src/state.ts";
import {
  FIELD,
  loadTestParams,
  member,
  plan,
  readArenaRows,
  setupOf,
} from "./helpers.ts";

const sha256 = (text: string) =>
  createHash("sha256").update(text).digest("hex");
const hash = (state: BattleState) => sha256(serializeBattle(state));

/** A wounded 2 × 2 (ids 1 to 4), leaving a free cell on each stretch. */
function skirmish(seed: number, rows: string[]): BattleSetup {
  return setupOf(
    rows,
    [
      [
        member("square", { hp: 90, carry: { materia: 10, cristal: 5 } }),
        member("circle", { hp: 48 }),
      ],
      [
        member("triangle", { hp: 60 }),
        member("circle", { hp: 48, carry: { materia: 0, cristal: 4 } }),
      ],
    ],
    seed,
  );
}

/**
 * Plays a skirmish the way the lab will, through stepLogged, up to
 * `maxTicks` or the end: the human dominates one participant at a time,
 * switching every 3 s, and sends the commands of `plan` for all of them
 * (those for the participants it does not hold are refused, live and in the
 * replay). A join on tick 30 brings a reinforcement to side 1.
 */
function record(
  seed: number,
  rows: string[] = FIELD,
  maxTicks = 2400,
): { log: BattleLog; state: BattleState } {
  const log = createLog(skirmish(seed, rows), loadTestParams());
  const state = createBattle(log.setup, log.params);
  const commands = plan(seed, maxTicks, 5);
  for (let tick = 0; tick < maxTicks; tick += 60) {
    const id = ((tick / 60) % 4) + 1;
    commands[tick]!.unshift({ type: "control", id, controller: "human" });
  }
  commands[30]!.push({ type: "join", side: 1, participant: member("circle") });
  for (let tick = 0; tick < maxTicks && state.ended === null; tick++) {
    stepLogged(state, log, commands[tick]!);
  }
  log.finalHash = hash(state);
  return { log, state };
}

describe("replayLog (spec R-2)", () => {
  const cases = [
    ...[1, 2, 3, 4, 5].map((seed) => ({ seed, rows: FIELD })),
    // Full HP on the rocks arena: the battle may outlast the 2 400 ticks.
    ...[42, 649].map((seed) => ({ seed, rows: readArenaRows("pedras") })),
  ];

  test.each(cases)(
    "seed $seed: the replay gives the recorded hash, twice",
    ({ seed, rows }) => {
      const { log, state } = record(seed, rows);
      expect(log.ticks).toBe(state.tick);
      expect(log.commands.every((e) => e.commands.length > 0)).toBe(true);
      expect(hash(replayLog(log))).toBe(log.finalHash);
      expect(hash(replayLog(log))).toBe(log.finalHash);
    },
  );

  test.each(cases)(
    "seed $seed: a snapshot → restore in the middle continues identically",
    ({ seed, rows }) => {
      const { log } = record(seed, rows);
      const half = Math.floor(log.ticks / 2);
      const middle = replayLog(log, { until: half });
      expect(middle.tick).toBe(half);
      const restored = restoreBattle(serializeBattle(middle));
      expect(hash(replayLog(log, { from: restored }))).toBe(log.finalHash);
    },
  );

  test("the log survives JSON, and other commands give another hash", () => {
    const { log } = record(7);
    const parsed: unknown = JSON.parse(JSON.stringify(log));
    expect(hash(replayLog(parsed))).toBe(log.finalHash);
    expect(record(8).log.finalHash).not.toBe(log.finalHash);
  });

  test("the battles were real: they had blows and ended", () => {
    const states = Array.from({ length: 10 }, (_, i) => record(i + 1).state);
    expect(states.every((s) => s.ended !== null)).toBe(true);
    // The reinforcement of tick 30 entered.
    expect(states.every((s) => s.totals.length === 5)).toBe(true);
    const blows = states.filter((s) => s.totals.some((t) => t.dealt > 0));
    expect(blows.length).toBeGreaterThan(2);
  });

  test("an ended battle logs nothing more", () => {
    const { log, state } = record(3);
    const before = JSON.stringify(log);
    expect(stepLogged(state, log, [{ type: "attackOnce", id: 1 }])).toEqual([]);
    expect(JSON.stringify(log)).toBe(before);
  });
});

describe("replayLog refuses an invalid log", () => {
  const { log } = record(1);
  const edit = (changes: Partial<Record<keyof BattleLog, unknown>>) => ({
    ...log,
    ...changes,
  });

  test.each<[string, unknown, new (...args: never[]) => Error, string]>([
    ["not an object", [], BattleLogError, "expected an object"],
    [
      "another version",
      edit({ battleVersion: 99 }),
      BattleVersionError,
      "version 99",
    ],
    ["bad params", edit({ params: {} }), BattleParamsError, "params"],
    [
      "a bad setup",
      edit({ setup: { ...log.setup, sides: [] } }),
      BattleSetupError,
      "needs at least two sides",
    ],
    ["negative ticks", edit({ ticks: -1 }), BattleLogError, "ticks"],
    ["a bad hash", edit({ finalHash: 3 }), BattleLogError, "finalHash"],
    ["commands not a list", edit({ commands: {} }), BattleLogError, "list"],
    [
      "a bad entry",
      edit({ commands: [{ tick: 0 }] }),
      BattleLogError,
      "{ tick, commands: [] }",
    ],
    [
      "ticks out of order",
      edit({
        commands: [
          { tick: 5, commands: [1] },
          { tick: 5, commands: [2] },
        ],
      }),
      BattleLogError,
      "must increase",
    ],
    [
      "a command past the end",
      edit({ commands: [{ tick: log.ticks, commands: [1] }] }),
      BattleLogError,
      "must increase",
    ],
    [
      "more ticks than the battle lasts",
      edit({ ticks: log.ticks + 10 }),
      BattleLogError,
      "the battle ended on tick",
    ],
  ])("%s", (_, input, type, message) => {
    expect(() => replayLog(input)).toThrow(type);
    expect(() => replayLog(input)).toThrow(message);
  });

  test("a range it cannot replay", () => {
    expect(() => replayLog(log, { until: log.ticks + 1 })).toThrow(
      "cannot replay",
    );
    const late = replayLog(log, { until: 10 });
    expect(() => replayLog(log, { from: late, until: 5 })).toThrow(
      "cannot replay from tick 10 to 5",
    );
  });
});
