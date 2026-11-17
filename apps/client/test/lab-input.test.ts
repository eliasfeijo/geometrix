import { describe, expect, test } from "vitest";
import { KeyboardInput, type KeyLike } from "../src/lab/input.ts";

const key = (code: string, extra: Partial<KeyLike> = {}): KeyLike => ({
  code,
  shiftKey: false,
  repeat: false,
  ...extra,
});

describe("the keyboard (spec D13, plan P4)", () => {
  test("a held arrow is one intent on press and one on release", () => {
    const input = new KeyboardInput();
    expect(input.down(key("ArrowLeft"), 3).commands).toEqual([
      { type: "intent", id: 3, move: "left", attack: false },
    ]);
    // The key repeats while held: nothing more is sent.
    expect(input.down(key("ArrowLeft", { repeat: true }), 3)).toEqual({
      handled: true,
      commands: [],
    });
    expect(input.up(key("ArrowLeft"), 3).commands).toEqual([
      { type: "intent", id: 3, move: null, attack: false },
    ]);
  });

  test("WASD by position, and the last direction pressed wins", () => {
    const input = new KeyboardInput();
    input.down(key("KeyW"), 1);
    expect(input.down(key("KeyD"), 1).commands).toEqual([
      { type: "intent", id: 1, move: "right", attack: false },
    ]);
    // Releasing the newer one goes back to the one still held.
    expect(input.up(key("KeyD"), 1).commands).toEqual([
      { type: "intent", id: 1, move: "up", attack: false },
    ]);
  });

  test("Shift + a direction only turns", () => {
    const input = new KeyboardInput();
    expect(input.down(key("ArrowUp", { shiftKey: true }), 1).commands).toEqual([
      { type: "face", id: 1, dir: "up" },
    ]);
  });

  test("Space arms the latch and attacks while held", () => {
    const input = new KeyboardInput();
    expect(input.down(key("Space"), 2).commands).toEqual([
      { type: "attackOnce", id: 2 },
      { type: "intent", id: 2, move: null, attack: true },
    ]);
    input.down(key("ArrowDown"), 2);
    expect(input.up(key("Space"), 2).commands).toEqual([
      { type: "intent", id: 2, move: "down", attack: false },
    ]);
  });

  test("Q drops the bag and E picks up", () => {
    const input = new KeyboardInput();
    expect(input.down(key("KeyQ"), 1).commands).toEqual([
      { type: "drop", id: 1 },
    ]);
    expect(input.down(key("KeyE"), 1).commands).toEqual([
      { type: "pickup", id: 1 },
    ]);
  });

  test("Tab moves the domination and 0 releases it", () => {
    const input = new KeyboardInput();
    expect(input.down(key("Tab"), null)).toEqual({
      handled: true,
      commands: [],
      cycle: true,
    });
    expect(input.down(key("Digit0"), 1).release).toBe(true);
  });

  test("without a dominated participant, game keys send nothing", () => {
    const input = new KeyboardInput();
    expect(input.down(key("ArrowUp"), null)).toEqual({
      handled: true,
      commands: [],
    });
    expect(input.down(key("KeyZ"), 1).handled).toBe(false);
  });

  test("what is held goes to the newly dominated participant", () => {
    const input = new KeyboardInput();
    input.down(key("ArrowRight"), 1);
    expect(input.retarget(2)).toEqual([
      { type: "intent", id: 2, move: "right", attack: false },
    ]);
    expect(input.releaseAll(2)).toEqual([
      { type: "intent", id: 2, move: null, attack: false },
    ]);
  });
});
