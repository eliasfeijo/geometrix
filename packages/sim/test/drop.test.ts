import { describe, expect, test } from "vitest";
import { validate, type Command } from "../src/commands.ts";
import { dominate, join } from "../src/domination.ts";
import { step } from "../src/step.ts";
import { updateVision } from "../src/vision.ts";
import type { Creep } from "../src/world.ts";
import { textWorld } from "./helpers.ts";

// 30 × 7, the cores in opposite corners (R spec D24, DR-1..DR-3).
const MAP = [
  "A.............................",
  "..............................",
  "..............................",
  "..............................",
  "..............................",
  "..............................",
  ".............................B",
];

const PLAYER = 1;

function world() {
  const w = textWorld(MAP);
  const mine = w.creeps.find((c) => c.team === 0 && c.dna === "triangle")!;
  const theirs = w.creeps.find((c) => c.team === 1 && c.dna === "square")!;
  Object.assign(mine, { x: 10, y: 3, cargo: { materia: 6, cristal: 2 } });
  Object.assign(theirs, { x: 11, y: 3 });
  updateVision(w);
  join(w, PLAYER, 0, false);
  return { w, mine, theirs };
}

const drop = (creep: Creep): Command => ({
  type: "order",
  creepId: creep.id,
  order: { type: "drop" },
});

describe("the drop order (DR-1, DR-2)", () => {
  test("turns the whole load into spoils on the creep's cell, and stops", () => {
    const { w, mine } = world();
    dominate(w, PLAYER, mine.id);
    const events = step(w, [{ playerId: PLAYER, command: drop(mine) }]);
    expect(mine.cargo).toEqual({ materia: 0, cristal: 0 });
    expect(mine.order).toEqual({ type: "stop" });
    expect(w.spoils).toEqual([
      expect.objectContaining({
        x: 10,
        y: 3,
        cargo: { materia: 6, cristal: 2 },
      }),
    ]);
    const dropped = events.find((e) => e.type === "dropped");
    expect(dropped).toMatchObject({
      creep: { id: mine.id },
      spoil: w.spoils[0]!.id,
      cargo: { materia: 6, cristal: 2 },
      x: 10,
      y: 3,
    });
  });

  test("is refused with an empty load or in a battle", () => {
    const { w, mine, theirs } = world();
    dominate(w, PLAYER, mine.id);
    mine.cargo = { materia: 0, cristal: 0 };
    expect(validate(w, drop(mine), PLAYER)).toBe("emptyCargo");
    mine.cargo = { materia: 1, cristal: 0 };
    theirs.order = { type: "approach", targetId: mine.id, intent: "attack" };
    step(w, []);
    expect(mine.battle).not.toBeNull();
    expect(validate(w, drop(mine), PLAYER)).toBe("inBattle");
  });
});

describe("the drop action", () => {
  test("drops when loaded; empty, the next rule decides", () => {
    const { w, mine } = world();
    mine.rules = [
      { when: { type: "always" }, then: { type: "drop" } },
      { when: { type: "always" }, then: { type: "moveTo", x: 0, y: 0 } },
    ];
    const events = step(w, []);
    expect(events.some((e) => e.type === "dropped")).toBe(true);
    expect(mine.cargo).toEqual({ materia: 0, cristal: 0 });
    step(w, []);
    expect(mine.order).toEqual({ type: "moveTo", x: 0, y: 0 });
  });
});

describe("dropping during an extortion is a refusal (DR-3)", () => {
  test("the victim drops at once and the battle opens with it empty", () => {
    const { w, mine, theirs } = world();
    dominate(w, PLAYER, mine.id);
    theirs.order = { type: "approach", targetId: mine.id, intent: "extort" };
    step(w, []);
    expect(mine.engagement).not.toBeNull();
    // Another order is still refused while engaged.
    expect(
      validate(
        w,
        { type: "order", creepId: mine.id, order: { type: "stop" } },
        PLAYER,
      ),
    ).toBe("engaged");
    const events = step(w, [{ playerId: PLAYER, command: drop(mine) }]);
    const types = events.map((e) => e.type);
    expect(types).toEqual(
      expect.arrayContaining(["dropped", "reaction", "battleOpened"]),
    );
    expect(types.indexOf("dropped")).toBeLessThan(types.indexOf("reaction"));
    expect(events.find((e) => e.type === "reaction")).toMatchObject({
      choice: "refuse",
      by: "player",
    });
    expect(mine.cargo).toEqual({ materia: 0, cristal: 0 });
    expect(mine.battle).not.toBeNull();
    expect(w.spoils).toEqual([
      expect.objectContaining({
        x: 10,
        y: 3,
        cargo: { materia: 6, cristal: 2 },
      }),
    ]);
  });

  test("the aggressor of an extortion cannot drop", () => {
    const { w, mine, theirs } = world();
    dominate(w, PLAYER, mine.id);
    theirs.cargo = { materia: 5, cristal: 0 };
    mine.cargo = { materia: 1, cristal: 0 };
    mine.order = { type: "approach", targetId: theirs.id, intent: "extort" };
    theirs.dominatedBy = 99;
    step(w, []);
    expect(mine.engagement).not.toBeNull();
    expect(validate(w, drop(mine), PLAYER)).toBe("engaged");
  });
});
