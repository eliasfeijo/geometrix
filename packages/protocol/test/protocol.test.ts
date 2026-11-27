import { describe, expect, test } from "vitest";
import { parseClientMessage } from "../src/index.ts";

const message = (command: unknown) =>
  JSON.stringify({ type: "command", ref: 7, command });

const battle = (command: unknown) =>
  JSON.stringify({ type: "battleInput", ref: 4, battleId: 9, command });

describe("parseClientMessage", () => {
  test.each([
    { type: "dominate", creepId: 3 },
    { type: "release" },
    { type: "order", creepId: 3, order: { type: "moveTo", x: 4, y: 5 } },
    { type: "order", creepId: 3, order: { type: "gather", depositId: 2 } },
    {
      type: "setRules",
      creepId: 3,
      rules: [
        { when: { type: "cargoFull" }, then: { type: "deliver" } },
        {
          when: { type: "resourceInRange", resource: "cristal", radius: 9 },
          then: { type: "gather", resource: "cristal" },
        },
      ],
    },
    {
      type: "applyPreset",
      creepId: 3,
      preset: "roadBuilder",
      target: { x: 1, y: 2 },
    },
    { type: "produce", dna: "circle", repeat: true },
    { type: "stopRepeat" },
    { type: "buyUpgrade", upgrade: "capacity" },
  ])("accepts $type", (command) => {
    expect(parseClientMessage(message(command))).toEqual({
      type: "command",
      ref: 7,
      command,
    });
  });

  test.each([
    ["not JSON", "{"],
    ["join, which only the server emits", message({ type: "join", team: 0 })],
    ["an unknown command", message({ type: "explode" })],
    ["a fractional id", message({ type: "dominate", creepId: 1.5 })],
    [
      "an unknown DNA",
      message({ type: "produce", dna: "hexagon", repeat: false }),
    ],
    [
      "a malformed rule",
      message({ type: "setRules", creepId: 1, rules: [{ when: "always" }] }),
    ],
    [
      "a missing ref",
      JSON.stringify({ type: "command", command: { type: "release" } }),
    ],
    [
      "a resync for an unknown reason",
      JSON.stringify({ type: "resync", reason: "bored", seq: 3 }),
    ],
    [
      "a resync without a seq",
      JSON.stringify({ type: "resync", reason: "seqGap" }),
    ],
    [
      "a battle exit, which only the junction host emits",
      message({
        type: "battleExit",
        battleId: 1,
        creepId: 2,
        outcome: "escaped",
        hp: 10,
        cargo: { materia: 0, cristal: 0 },
        cell: { x: 1, y: 1 },
        by: null,
      }),
    ],
    [
      "a battle end, which only the junction host emits",
      message({
        type: "battleEnd",
        battleId: 1,
        winnerSide: 0,
        reason: "won",
        survivors: [],
        piles: [],
      }),
    ],
    [
      "a battle control, which only the host sends",
      battle({ type: "control", id: 1, controller: "human" }),
    ],
    [
      "a battle join, which only the host sends",
      battle({ type: "join", side: 0, participant: {} }),
    ],
    [
      "the lab's setGambits",
      battle({ type: "setGambits", id: 1, gambits: [] }),
    ],
    [
      "an intent with an unknown direction",
      battle({ type: "intent", id: 1, move: "north", attack: false }),
    ],
    [
      "a battle input without a battle",
      JSON.stringify({
        type: "battleInput",
        ref: 1,
        command: { type: "drop", id: 1 },
      }),
    ],
    [
      "a battle screen without a ref",
      JSON.stringify({ type: "battleScreen", battleId: 3 }),
    ],
    [
      "a pause of no battle",
      JSON.stringify({ type: "battlePause", ref: 2, battleId: null }),
    ],
  ])("rejects %s", (_, raw) => {
    expect(parseClientMessage(raw)).toBeNull();
  });

  test.each([
    { type: "intent", id: 2, move: "left", attack: true },
    { type: "intent", id: 2, move: null, attack: false, bag: "pickup" },
    { type: "intent", id: 2, move: null, attack: false, bag: null },
    { type: "attackOnce", id: 2 },
    { type: "face", id: 2, dir: "up" },
    { type: "drop", id: 2 },
    { type: "pickup", id: 2 },
  ])("accepts the battle input $type", (command) => {
    expect(parseClientMessage(battle(command))).toEqual({
      type: "battleInput",
      ref: 4,
      battleId: 9,
      command,
    });
  });

  test.each([9, null])("accepts a battle screen of %s", (battleId) => {
    const screen = { type: "battleScreen", ref: 5, battleId };
    expect(parseClientMessage(JSON.stringify(screen))).toEqual(screen);
  });

  test("accepts a pause of a battle", () => {
    const pause = { type: "battlePause", ref: 6, battleId: 9 };
    expect(parseClientMessage(JSON.stringify(pause))).toEqual(pause);
  });

  test.each([{ type: "follow", targetId: 7 }, { type: "drop" }])(
    "accepts the $type order",
    (order) => {
      const command = { type: "order", creepId: 3, order };
      expect(parseClientMessage(message(command))).toEqual({
        type: "command",
        ref: expect.any(Number),
        command,
      });
    },
  );

  test("accepts a resync request", () => {
    const resync = { type: "resync", reason: "seqGap", seq: 12 };
    expect(parseClientMessage(JSON.stringify(resync))).toEqual(resync);
  });
});
