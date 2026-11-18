// The countdown at the start of a battle (spec D21, S-4): everyone stands
// still and may only turn, the human and the AI; the rest waits for its end.
// The test params have no countdown, so these tests turn it on.

import { describe, expect, test } from "vitest";
import { createBattle } from "../src/setup.ts";
import type { BattleState } from "../src/state.ts";
import { stepBattle } from "../src/step.ts";
import { battleView } from "../src/view.ts";
import { presetGambits } from "../src/presets.ts";
import {
  FIELD,
  humans,
  member,
  paramsWith,
  put,
  run,
  setupOf,
  xyOf,
} from "./helpers.ts";

/** 1 s of countdown: 20 ticks. */
const COUNTDOWN = 20;
const params = paramsWith((p) => {
  p.start.countdownMs = 1000;
});

function battle(
  sides = [[member("square")], [member("circle")]],
  seed = 42,
): BattleState {
  return createBattle(setupOf(FIELD, sides, seed), params);
}

describe("the start countdown (spec D21, S-4)", () => {
  test("the human only turns: walking and attacking wait for the end", () => {
    const state = humans(battle());
    const start = xyOf(state, 1);
    const events = run(state, COUNTDOWN, [
      { type: "intent", id: 1, move: "up", attack: true },
      { type: "face", id: 2, dir: "down" },
    ]);
    expect(events).toEqual([]);
    expect(xyOf(state, 1)).toEqual(start);
    // The intent turned the creep; the face command turned the other one.
    expect(state.participants[0]!.facing).toBe("up");
    expect(state.participants[1]!.facing).toBe("down");
    // The held intent acts on the first tick of the fight.
    const first = stepBattle(state, []);
    expect(first.map((e) => e.type)).toEqual(["attacked"]);
    run(state, 10);
    expect(xyOf(state, 1)).not.toEqual(start);
  });

  test("it ends with the first step ready (D22)", () => {
    const state = humans(battle());
    const [x, y] = xyOf(state, 1);
    run(state, COUNTDOWN, [
      { type: "intent", id: 1, move: "up", attack: false },
    ]);
    expect(state.participants[0]!.movePoints).toBe(6000);
    stepBattle(state, []);
    expect(xyOf(state, 1)).toEqual([x, y - 1]);
  });

  test("the AI decides and turns, but stands still", () => {
    const state = battle([
      [member("triangle", { gambits: presetGambits("skirmisher") })],
      [member("circle", { gambits: presetGambits("marksman") })],
    ]);
    const cells = state.participants.map((p) => p.cell);
    const events = run(state, COUNTDOWN);
    expect(events).toEqual([]);
    expect(state.participants.map((p) => p.cell)).toEqual(cells);
    expect(state.projectiles).toEqual([]);
    // They mean to fight: on the first ticks after it, they walk or shoot.
    const after = run(state, 20);
    const moved = state.participants.some((p, i) => p.cell !== cells[i]);
    expect(moved || after.some((e) => e.type === "attacked")).toBe(true);
  });

  test("the idle clock and the exit count start at the end", () => {
    const state = humans(battle());
    // A creep put on the exit ring does not escape during the countdown.
    put(state, 1, 0, 3);
    run(state, COUNTDOWN);
    expect(state.idleTicks).toBe(0);
    expect(state.participants.map((p) => p.exitTicks)).toEqual([0, 0]);
    stepBattle(state, []);
    expect(state.idleTicks).toBe(1);
    expect(state.participants.map((p) => p.exitTicks)).toEqual([1, 0]);
  });

  test("an idle battle ends one timeout after the countdown, not before", () => {
    const state = humans(battle());
    const timeout = 15000 / 50;
    const events = run(state, COUNTDOWN + timeout - 1);
    expect(events.some((e) => e.type === "escaped")).toBe(false);
    const last = stepBattle(state, []);
    expect(last.filter((e) => e.type === "escaped")).toHaveLength(2);
  });

  test("a drop asked during the countdown acts on the first tick of the fight", () => {
    const state = humans(
      battle([
        [member("square", { carry: { materia: 12, cristal: 0 } })],
        [member("circle")],
      ]),
    );
    expect(run(state, COUNTDOWN, [{ type: "drop", id: 1 }])).toEqual([]);
    expect(state.piles).toEqual([]);
    expect(stepBattle(state, []).map((e) => e.type)).toEqual(["dropped"]);
  });

  test("who joins during the countdown waits; who joins later gets none", () => {
    const early = humans(battle());
    const joined = run(early, 5, [
      { type: "join", side: 0, participant: member("triangle") },
    ]);
    expect(joined.map((e) => e.type)).toEqual(["joined"]);
    early.participants[2]!.controller = "human";
    stepBattle(early, [
      { type: "intent", id: 3, move: "right", attack: false },
    ]);
    const cell = early.participants[2]!.cell;
    run(early, COUNTDOWN - 6);
    expect(early.participants[2]!.cell).toBe(cell);

    const late = humans(battle());
    run(late, COUNTDOWN);
    stepBattle(late, [
      { type: "join", side: 0, participant: member("triangle") },
    ]);
    late.participants[2]!.controller = "human";
    const from = late.participants[2]!.cell;
    run(late, 10, [{ type: "intent", id: 3, move: "right", attack: false }]);
    expect(late.participants[2]!.cell).not.toBe(from);
  });

  test("the view counts the ticks left down to 0", () => {
    const state = humans(battle());
    expect(battleView(state).countdownTicks).toBe(COUNTDOWN);
    run(state, 5);
    expect(battleView(state).countdownTicks).toBe(COUNTDOWN - 5);
    run(state, COUNTDOWN);
    expect(battleView(state).countdownTicks).toBe(0);
  });

  test("with no countdown the fight starts on the first tick", () => {
    const state = humans(
      createBattle(
        setupOf(FIELD, [[member("square")], [member("circle")]]),
        paramsWith(() => {}),
      ),
    );
    expect(battleView(state).countdownTicks).toBe(0);
    const events = stepBattle(state, [
      { type: "intent", id: 1, move: null, attack: true },
    ]);
    expect(events.map((e) => e.type)).toEqual(["attacked"]);
  });
});
