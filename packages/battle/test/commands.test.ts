import { describe, expect, test } from "vitest";
import { applyCommands, validateCommand } from "../src/commands.ts";
import { battleOn, FIELD } from "./helpers.ts";

function battle() {
  const state = battleOn(FIELD, [["square"], ["circle"]]);
  state.participants[0]!.controller = "human";
  return state;
}

describe("validateCommand", () => {
  const state = battle();

  test.each([
    { type: "intent", id: 1, move: "up", attack: true },
    { type: "intent", id: 1, move: null, attack: false },
    { type: "attackOnce", id: 1 },
    { type: "face", id: 1, dir: "left" },
  ])("accepts %j for the dominated participant", (command) => {
    expect(validateCommand(state, command)).toBeNull();
  });

  test.each<[unknown, string]>([
    ["intent", "expected an object"],
    [{ type: "jump", id: 1 }, "unknown command jump"],
    [{ type: "face", id: "1", dir: "up" }, "id must be an integer"],
    [{ type: "face", id: 9, dir: "up" }, "no participant 9 in the arena"],
    [
      { type: "intent", id: 2, move: "up", attack: false },
      "participant 2 is not under human control",
    ],
    [
      { type: "intent", id: 1, move: "north", attack: false },
      "move must be a direction or null",
    ],
    [{ type: "intent", id: 1, move: "up" }, "attack must be a boolean"],
    [{ type: "face", id: 1, dir: null }, "dir must be a direction"],
  ])("refuses %j: %s", (command, reason) => {
    expect(validateCommand(state, command)).toBe(reason);
  });

  test("the gambits issue commands only for their own participants", () => {
    const command = { type: "face", id: 2, dir: "up" };
    expect(validateCommand(state, command, "gambits")).toBeNull();
    expect(validateCommand(state, { ...command, id: 1 }, "gambits")).toBe(
      "participant 1 is not under gambits control",
    );
  });
});

describe("applyCommands", () => {
  test("intent, latch and face change the participant, in arrival order", () => {
    const state = battle();
    applyCommands(state, [
      { type: "intent", id: 1, move: "up", attack: true },
      { type: "attackOnce", id: 1 },
      { type: "face", id: 1, dir: "down" },
      { type: "intent", id: 1, move: "left", attack: true },
    ]);
    const [p] = state.participants;
    expect(p!.intent).toEqual({
      move: "left",
      attack: true,
      attackLatch: true,
      drop: false,
      pickup: false,
    });
    expect(p!.facing).toBe("down");
  });

  test("a refused command has no effect, and the rest still apply", () => {
    const state = battle();
    const before = structuredClone(state.participants[1]);
    applyCommands(state, [
      { type: "intent", id: 2, move: "up", attack: true },
      { type: "face", id: 2, dir: "up" },
      { type: "face", id: 1, dir: "up" },
    ]);
    expect(state.participants[1]).toEqual(before);
    expect(state.participants[0]!.facing).toBe("up");
  });
});
