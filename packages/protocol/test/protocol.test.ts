import { describe, expect, test } from "vitest";
import { parseClientMessage } from "../src/index.ts";

const message = (command: unknown) =>
  JSON.stringify({ type: "command", ref: 7, command });

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
  ])("rejects %s", (_, raw) => {
    expect(parseClientMessage(raw)).toBeNull();
  });

  test("accepts a resync request", () => {
    const resync = { type: "resync", reason: "seqGap", seq: 12 };
    expect(parseClientMessage(JSON.stringify(resync))).toEqual(resync);
  });
});
