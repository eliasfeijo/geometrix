import { describe, expect, test } from "vitest";
import { validateCommand } from "../src/commands.ts";
import type { BattleEvent } from "../src/events.ts";
import type { BattleState } from "../src/state.ts";
import { stepBattle } from "../src/step.ts";
import { battleOn, FIELD, humans, member, put, run } from "./helpers.ts";

/** FIELD with a third entry stretch on the top lap. */
const THREE = [
  ".........",
  "....3....",
  ".1.....2.",
  ".1.....2.",
  ".1.....2.",
  ".........",
  ".........",
];

const byId = (state: BattleState, id: number) =>
  state.participants.find((p) => p.id === id)!;
const ofType = <T extends BattleEvent["type"]>(
  events: BattleEvent[],
  type: T,
) =>
  events.filter((e): e is Extract<BattleEvent, { type: T }> => e.type === type);

/** 2 s on the exit at 20 ticks per second; 15 s of inactivity. */
const DWELL = 40;
const TIMEOUT = 300;

describe("escape by the edge (spec F-1, D7)", () => {
  /** A carrying circle (1) on the ring at (0, 3); a square (2) inside. */
  function onTheRing(): BattleState {
    const state = humans(
      battleOn(FIELD, [
        [member("circle", { hp: 100, carry: { materia: 3, cristal: 2 } })],
        ["square"],
      ]),
    );
    put(state, 1, 0, 3);
    put(state, 2, 4, 5);
    return state;
  }

  test("after the dwell time on an exit cell, leaves with its HP and carry", () => {
    const state = onTheRing();
    expect(run(state, DWELL - 1)).toEqual([]);
    const events = run(state, 1);
    expect(events[0]).toEqual({
      type: "escaped",
      participant: { id: 1, side: 0, dna: "circle", name: "circle" },
      reason: "edge",
      hp: 100,
      carry: { materia: 3, cristal: 2 },
      tick: DWELL - 1,
      index: 0,
    });
    expect(state.departed).toEqual([
      {
        id: 1,
        side: 0,
        name: "circle",
        dna: "circle",
        outcome: "escapedEdge",
        hp: 100,
        carry: { materia: 3, cristal: 2 },
        tick: DWELL - 1,
      },
    ]);
  });

  test("a blow zeroes the count", () => {
    const state = onTheRing();
    put(state, 2, 1, 3, "left");
    run(state, 20);
    expect(byId(state, 1).exitTicks).toBe(20);
    const events = run(state, DWELL + 20, [{ type: "attackOnce", id: 2 }]);
    // Hit on tick 20; the count starts over and runs out on tick 59.
    expect(ofType(events, "escaped")).toMatchObject([
      { tick: 20 + DWELL - 1, reason: "edge", hp: 70 },
    ]);
  });

  test("stepping off the ring zeroes the count", () => {
    const state = onTheRing();
    run(state, 30);
    put(state, 1, 1, 3);
    run(state, 1);
    expect(byId(state, 1).exitTicks).toBe(0);
    put(state, 1, 0, 3);
    expect(ofType(run(state, DWELL - 1), "escaped")).toEqual([]);
    expect(ofType(run(state, 1), "escaped")).toHaveLength(1);
  });

  test("when edge and inactivity run out together, it is the edge", () => {
    const state = onTheRing();
    byId(state, 1).exitTicks = DWELL - 1;
    byId(state, 1).idleTicks = TIMEOUT - 1;
    expect(run(state, 1)[0]).toMatchObject({ type: "escaped", reason: "edge" });
  });
});

describe("inactivity (spec F-2, D9)", () => {
  test("whoever neither deals nor takes damage for the timeout flees on the spot", () => {
    const state = humans(battleOn(FIELD, [["square"], ["circle"]]));
    put(state, 1, 3, 3);
    put(state, 2, 5, 4);
    expect(run(state, TIMEOUT - 1)).toEqual([]);
    const events = run(state, 1);
    expect(events.map((e) => e.type)).toEqual(["escaped", "escaped", "ended"]);
    expect(events[0]).toMatchObject({ reason: "idle", tick: TIMEOUT - 1 });
    expect(state.departed.map((d) => d.outcome)).toEqual([
      "escapedIdle",
      "escapedIdle",
    ]);
    expect(state.ended).toEqual({ tick: TIMEOUT - 1, winnerSide: null });
  });

  test("dealing or taking damage zeroes the clock of both", () => {
    const state = humans(battleOn(FIELD, [["square", "circle"], ["square"]]));
    put(state, 1, 3, 3, "right");
    put(state, 2, 1, 5);
    put(state, 3, 4, 3);
    run(state, 100);
    const events = run(state, TIMEOUT, [{ type: "attackOnce", id: 1 }]);
    // The bystander (2) runs out first; the two squares, a timeout after the
    // blow of tick 100.
    expect(
      ofType(events, "escaped").map((e) => [e.tick, e.participant.id]),
    ).toEqual([
      [TIMEOUT - 1, 2],
      [100 + TIMEOUT - 1, 1],
      [100 + TIMEOUT - 1, 3],
    ]);
  });

  test("the clock starts at the entry", () => {
    const state = humans(battleOn(FIELD, [["square"], ["circle"]]));
    expect(state.participants.map((p) => p.idleTicks)).toEqual([0, 0]);
  });
});

describe("the end (spec F-3, F-4)", () => {
  /** Three sides: square (1), circle (2) with a bag, triangle (3). */
  function threeSides(): BattleState {
    const state = humans(
      battleOn(THREE, [
        ["square"],
        [member("circle", { carry: { materia: 1, cristal: 4 } })],
        ["triangle"],
      ]),
    );
    put(state, 1, 3, 3, "right");
    put(state, 2, 4, 3);
    put(state, 3, 8, 3);
    byId(state, 2).hp = 30;
    byId(state, 3).exitTicks = DWELL - 2;
    return state;
  }

  test("with three sides, it goes on until one is left; that side wins", () => {
    const state = threeSides();
    // Tick 0: the square kills the circle; two sides are left.
    const first = run(state, 1, [{ type: "attackOnce", id: 1 }]);
    expect(first.map((e) => e.type)).toEqual(["attacked", "hit", "died"]);
    expect(state.ended).toBeNull();
    // Tick 1: the triangle escapes by the edge; the square wins.
    const second = run(state, 1);
    expect(second.map((e) => e.type)).toEqual(["escaped", "ended"]);
    expect(state.ended).toEqual({ tick: 1, winnerSide: 0 });
    expect(second[1]).toEqual({
      type: "ended",
      winnerSide: 0,
      results: [
        {
          participant: { id: 1, side: 0, dna: "square", name: "square" },
          outcome: "won",
          hp: 300,
          carry: { materia: 0, cristal: 0 },
          dealt: 30,
          taken: 0,
        },
        {
          participant: { id: 2, side: 1, dna: "circle", name: "circle" },
          outcome: "died",
          hp: 0,
          carry: { materia: 0, cristal: 0 },
          dealt: 0,
          taken: 30,
        },
        {
          participant: { id: 3, side: 2, dna: "triangle", name: "triangle" },
          outcome: "escapedEdge",
          hp: 200,
          carry: { materia: 0, cristal: 0 },
          dealt: 0,
          taken: 0,
        },
      ],
      piles: [{ id: 4, cell: 3 * 9 + 4, materia: 1, cristal: 4 }],
      tick: 1,
      index: 1,
    });
  });

  test("an ended battle takes no commands and does not advance", () => {
    const state = threeSides();
    run(state, 2, [{ type: "attackOnce", id: 1 }]);
    const json = JSON.stringify(state);
    expect(validateCommand(state, { type: "attackOnce", id: 1 })).toBe(
      "the battle is over",
    );
    expect(stepBattle(state, [{ type: "attackOnce", id: 1 }])).toEqual([]);
    expect(JSON.stringify(state)).toBe(json);
  });
});
