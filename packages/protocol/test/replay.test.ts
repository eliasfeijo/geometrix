import { describe, expect, test } from "vitest";
import params from "../../sim/test/params.json" with { type: "json" };
import { parseReplay, ReplayError, type Replay } from "../src/index.ts";

function replay(overrides: Partial<Record<keyof Replay, unknown>> = {}) {
  return {
    simVersion: 2,
    seed: 42,
    params,
    ticks: 120,
    finalHash: "ab".repeat(32),
    commands: [
      {
        tick: 0,
        seq: 0,
        playerId: 1,
        command: { type: "join", team: 0, bot: true },
      },
      {
        tick: 0,
        seq: 1,
        playerId: 2,
        command: { type: "join", team: 1, bot: false },
      },
      {
        tick: 61,
        seq: 0,
        playerId: 1,
        command: { type: "produce", dna: "square", repeat: false },
      },
      { tick: 90, seq: 0, playerId: 2, command: { type: "release" } },
    ],
    ...overrides,
  };
}

const command = (tick: number, seq: number) => ({
  tick,
  seq,
  playerId: 1,
  command: { type: "stopRepeat" },
});

describe("parseReplay", () => {
  test("accepts a replay with joins and client commands", () => {
    const parsed = parseReplay(JSON.parse(JSON.stringify(replay())));
    expect(parsed.ticks).toBe(120);
    expect(parsed.commands.map((c) => c.command.type)).toEqual([
      "join",
      "join",
      "produce",
      "release",
    ]);
    expect(parsed.params).toEqual(params);
  });

  test.each([
    ["a missing field", { finalHash: undefined }],
    ["a hash that is not sha256 hex", { finalHash: "xyz" }],
    [
      "an unknown command",
      {
        commands: [
          command(0, 0),
          { ...command(1, 0), command: { type: "fly" } },
        ],
      },
    ],
    ["a command on the last tick", { commands: [command(120, 0)] }],
    ["ticks out of order", { commands: [command(5, 0), command(4, 0)] }],
    ["a repeated seq", { commands: [command(5, 0), command(5, 0)] }],
    ["params out of range", { params: { ...params, world: {} } }],
  ])("refuses %s", (_name, overrides) => {
    expect(() => parseReplay(replay(overrides))).toThrow(ReplayError);
  });

  test("says where the file is wrong", () => {
    expect(() => parseReplay(replay({ seed: -1 }))).toThrow(
      /invalid replay at seed/,
    );
  });

  test("names the sim version of a file it cannot read", () => {
    const old = replay({
      simVersion: 1,
      commands: [
        { tick: 0, seq: 0, playerId: 1, command: { type: "join", team: 0 } },
      ],
    });
    expect(() => parseReplay(old)).toThrow(/sim version 1; this build runs/);
  });
});
