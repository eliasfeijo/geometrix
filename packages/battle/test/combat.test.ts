import { describe, expect, test } from "vitest";
import { applyHits } from "../src/combat.ts";
import { validateCommand } from "../src/commands.ts";
import { createEventLog, type BattleEvent } from "../src/events.ts";
import { CELL_COST } from "../src/params.ts";
import type { BattleState } from "../src/state.ts";
import { battleOn, FIELD, humans, member, put, run, xyOf } from "./helpers.ts";

const at = (x: number, y: number) => y * 9 + x;
const hits = (events: BattleEvent[]) => events.filter((e) => e.type === "hit");
const byId = (state: BattleState, id: number) =>
  state.participants.find((p) => p.id === id)!;
const fire = (id: number) => ({
  type: "intent",
  id,
  move: null,
  attack: true,
});

/** A circle (id 1) at (1, 3) facing right; enemies of `dnas` on side 1. */
function shooter(
  arena: string[] = FIELD,
  dnas: ("square" | "circle")[] = ["square"],
) {
  const state = humans(battleOn(arena, [["circle"], dnas]));
  put(state, 1, 1, 3, "right");
  return state;
}

describe("cooldown (spec A-1)", () => {
  test("holding attack strikes once per cooldown", () => {
    const state = humans(battleOn(FIELD, [["square"], ["square"]]));
    put(state, 1, 3, 3, "right");
    put(state, 2, 4, 3, "left");
    // The square's cooldown is 1 s, 20 ticks: hits on ticks 0, 20 and 40.
    const events = run(state, 41, [fire(1)]);
    expect(hits(events).map((e) => e.tick)).toEqual([0, 20, 40]);
    expect(byId(state, 2).hp).toBe(300 - 3 * 30);
  });

  test("the latch fires the next possible attack once, then stops", () => {
    const state = humans(battleOn(FIELD, [["square"], ["square"]]));
    put(state, 1, 3, 3, "right");
    put(state, 2, 4, 3, "left");
    run(state, 1, [{ type: "attackOnce", id: 1 }]);
    // Armed again during the cooldown: it waits for the cooldown to end.
    const events = run(state, 60, [{ type: "attackOnce", id: 1 }]);
    expect(hits(events).map((e) => e.tick)).toEqual([20]);
  });
});

describe("melee (spec A-2)", () => {
  test("hits the enemy in front, before anyone walks (plan P3)", () => {
    const state = humans(battleOn(FIELD, [["square"], ["circle"]]));
    put(state, 1, 3, 3, "right");
    put(state, 2, 4, 3);
    byId(state, 2).movePoints = CELL_COST - 1;
    const events = run(state, 1, [
      fire(1),
      { type: "intent", id: 2, move: "up", attack: false },
    ]);
    // The circle stepped away in the same tick, and still took the blow.
    expect(xyOf(state, 2)).toEqual([4, 2]);
    expect(events.map((e) => e.type)).toEqual(["attacked", "hit"]);
    expect(events[1]).toMatchObject({ by: { id: 1 }, damage: 30, hp: 90 });
  });

  test("misses an empty cell, an ally, and an enemy off to the side", () => {
    const state = humans(battleOn(FIELD, [["square", "circle"], ["circle"]]));
    put(state, 1, 3, 3, "right");
    put(state, 2, 4, 3);
    put(state, 3, 3, 2);
    const events = run(state, 1, [fire(1)]);
    expect(events.map((e) => e.type)).toEqual(["attacked"]);
    // The miss still spends the cooldown.
    expect(byId(state, 1).cooldownTicks).toBe(20);
  });
});

describe("projectiles (spec A-3)", () => {
  test("walk at their speed and hit the first enemy on the line", () => {
    const state = shooter();
    put(state, 2, 6, 3);
    const events = run(state, 10, [{ type: "attackOnce", id: 1 }]);
    // Born on (2, 3); 12 cells per second is 3 600 points per tick, so it
    // reaches (6, 3), four cells on, in the stage 5 of tick 6.
    expect(hits(events)).toMatchObject([
      { tick: 6, by: { id: 1 }, target: { id: 2 }, damage: 24, hp: 276 },
    ]);
    expect(state.projectiles).toEqual([]);
  });

  test("stop at their range", () => {
    const state = shooter();
    // Range 6: the cells (2, 3) to (7, 3). (8, 3) is one too far.
    put(state, 2, 8, 3);
    const events = run(state, 1, [{ type: "attackOnce", id: 1 }]);
    expect(state.projectiles).toMatchObject([{ id: 3, cell: at(2, 3) }]);
    events.push(...run(state, 30));
    expect(hits(events)).toEqual([]);
    expect(state.projectiles).toEqual([]);
  });

  test("vanish when they would step past their range", () => {
    const state = shooter();
    put(state, 2, 8, 1);
    run(state, 1, [{ type: "attackOnce", id: 1 }]);
    const seen: number[] = [];
    for (let i = 0; i < 12; i++) {
      run(state, 1);
      seen.push(state.projectiles[0]?.cell ?? -1);
    }
    // 3 600 points a tick: 3 cells every 5 ticks, the extra points carried
    // over. On (7, 3), its 6th cell, it stays one tick, like on (4, 3), and
    // vanishes when it would enter a 7th.
    expect(seen.map((c) => (c < 0 ? -1 : c % 9))).toEqual([
      3, 3, 4, 5, 5, 6, 6, 7, -1, -1, -1, -1,
    ]);
  });

  test("say where they vanish without a hit (spec L-8)", () => {
    const state = shooter();
    put(state, 2, 8, 1);
    const events = run(state, 12, [{ type: "attackOnce", id: 1 }]);
    // The last cell it was on, (7, 3), and the way it flew.
    expect(events.filter((e) => e.type === "missed")).toEqual([
      {
        type: "missed",
        by: { id: 1, side: 0, dna: "circle", name: "circle" },
        cell: at(7, 3),
        dir: "right",
        tick: 9,
        index: 0,
      },
    ]);
  });

  test("vanish into rock, and are never born on it", () => {
    const rocky = [
      ".........",
      ".........",
      ".1.....2.",
      ".1.#...2.",
      ".1.....2.",
      ".........",
      ".........",
    ];
    const state = shooter(rocky);
    put(state, 2, 5, 3);
    const first = run(state, 20, [{ type: "attackOnce", id: 1 }]);
    expect(byId(state, 2).hp).toBe(300);
    expect(state.projectiles).toEqual([]);
    // Born on (2, 3), it vanishes into the rock of (3, 3).
    expect(first.filter((e) => e.type === "missed")).toMatchObject([
      { cell: at(2, 3), dir: "right" },
    ]);
    put(state, 1, 2, 3, "right");
    const events = run(state, 1, [{ type: "attackOnce", id: 1 }]);
    // Rock in front: no shot, and the miss is on the shooter's cell.
    expect(events.map((e) => e.type)).toEqual(["attacked", "missed"]);
    expect(events[1]).toMatchObject({ cell: at(2, 3), dir: "right" });
    expect(state.projectiles).toEqual([]);
  });

  test("go through allies (no friendly fire)", () => {
    const state = humans(battleOn(FIELD, [["circle", "square"], ["square"]]));
    put(state, 1, 1, 3, "right");
    put(state, 2, 3, 3);
    put(state, 3, 5, 3);
    const events = run(state, 10, [{ type: "attackOnce", id: 1 }]);
    expect(hits(events)).toMatchObject([{ target: { id: 3 } }]);
    expect(byId(state, 2).hp).toBe(300);
  });

  test("miss whoever stepped out of the line", () => {
    const state = shooter(FIELD, ["circle"]);
    put(state, 2, 6, 3);
    // The circle steps up on tick 3; the shot reaches (6, 3) on tick 6.
    const events = run(state, 10, [
      { type: "attackOnce", id: 1 },
      { type: "intent", id: 2, move: "up", attack: false },
    ]);
    run(state, 0);
    expect(hits(events)).toEqual([]);
    expect(xyOf(state, 2)).not.toEqual([6, 3]);
  });

  test("hit whoever walks into the cell they are on", () => {
    const state = shooter(FIELD, ["circle"]);
    put(state, 2, 4, 1);
    run(state, 4, [{ type: "attackOnce", id: 1 }]);
    // After tick 3 the shot is on (4, 3), and leaves it on tick 4.
    expect(state.projectiles).toMatchObject([{ cell: at(4, 3) }]);
    put(state, 2, 4, 2);
    byId(state, 2).movePoints = CELL_COST - 1;
    const events = run(state, 1, [
      { type: "intent", id: 2, move: "down", attack: false },
    ]);
    expect(xyOf(state, 2)).toEqual([4, 3]);
    expect(hits(events)).toMatchObject([{ tick: 4, target: { id: 2 } }]);
  });

  test("outlive their owner, and the hit still names it", () => {
    // The ally (2) keeps side 0 in the battle.
    const state = humans(
      battleOn(FIELD, [
        ["circle", "circle"],
        ["square", "square"],
      ]),
    );
    put(state, 1, 1, 3, "right");
    put(state, 2, 3, 5);
    put(state, 3, 6, 3);
    put(state, 4, 1, 4, "up");
    byId(state, 1).hp = 30;
    const events = run(state, 10, [{ type: "attackOnce", id: 1 }, fire(4)]);
    expect(state.departed.map((d) => d.id)).toEqual([1]);
    expect(hits(events)).toMatchObject([
      { tick: 0, by: { id: 4 }, target: { id: 1 } },
      { tick: 6, by: { id: 1, dna: "circle" }, target: { id: 3 } },
    ]);
    expect(state.totals.find((t) => t.id === 1)).toEqual({
      id: 1,
      dealt: 24,
      taken: 30,
    });
  });
});

describe("damage and death (spec A-4, A-5)", () => {
  test("a blow resets the battle's idle clock and the exit count of the target", () => {
    const state = humans(battleOn(FIELD, [["square"], ["square"]]));
    put(state, 1, 3, 3, "right");
    put(state, 2, 4, 3, "left");
    state.idleTicks = 100;
    for (const p of state.participants) p.exitTicks = 10;
    // Stage 6 alone: stage 8 of the same tick counts the clock up again.
    applyHits(state, createEventLog(0), [{ by: 1, target: 2, damage: 30 }]);
    expect(state.idleTicks).toBe(0);
    expect(byId(state, 1)).toMatchObject({ exitTicks: 10 });
    expect(byId(state, 2)).toMatchObject({ exitTicks: 0 });
  });

  test("at 0 HP the creep leaves in the same tick, its carry left in a pile", () => {
    const state = humans(
      battleOn(FIELD, [
        ["square"],
        [member("circle", { hp: 20, carry: { materia: 4, cristal: 1 } })],
      ]),
    );
    put(state, 1, 3, 3, "right");
    put(state, 2, 4, 3);
    const events = run(state, 1, [fire(1)]);
    expect(state.participants.map((p) => p.id)).toEqual([1]);
    expect(state.piles).toEqual([
      { id: 3, cell: at(4, 3), materia: 4, cristal: 1 },
    ]);
    expect(state.departed).toEqual([
      {
        id: 2,
        side: 1,
        name: "circle",
        dna: "circle",
        outcome: "died",
        hp: 0,
        maxHp: 120,
        carry: { materia: 0, cristal: 0 },
        tick: 0,
      },
    ]);
    // The blow counts what it took: 20 of the 30.
    expect(events.slice(1, 3)).toEqual([
      {
        type: "hit",
        by: { id: 1, side: 0, dna: "square", name: "square" },
        target: { id: 2, side: 1, dna: "circle", name: "circle" },
        damage: 20,
        hp: 0,
        cell: at(4, 3),
        tick: 0,
        index: 1,
      },
      {
        type: "died",
        participant: { id: 2, side: 1, dna: "circle", name: "circle" },
        by: { id: 1, side: 0, dna: "square", name: "square" },
        tick: 0,
        index: 2,
      },
    ]);
    expect(state.totals).toEqual([
      { id: 1, dealt: 20, taken: 0 },
      { id: 2, dealt: 0, taken: 20 },
    ]);
  });

  test("blows in one tick are simultaneous: both squares fall, whatever the ids", () => {
    const state = humans(
      battleOn(FIELD, [
        [member("square", { hp: 30 })],
        [member("square", { hp: 30 })],
      ]),
    );
    put(state, 1, 3, 3, "right");
    put(state, 2, 4, 3, "left");
    const events = run(state, 1, [fire(1), fire(2)]);
    expect(events.map((e) => e.type)).toEqual([
      "attacked",
      "attacked",
      "hit",
      "hit",
      "died",
      "died",
      "ended",
    ]);
    expect(state.participants).toEqual([]);
    expect(state.departed.map((d) => d.outcome)).toEqual(["died", "died"]);
    expect(state.ended).toEqual({ tick: 0, winnerSide: null });
  });

  test("a blow on someone already down is lost", () => {
    const state = humans(
      battleOn(FIELD, [["square", "square"], [member("circle", { hp: 10 })]]),
    );
    put(state, 1, 3, 3, "right");
    put(state, 2, 4, 2, "down");
    put(state, 3, 4, 3);
    const events = run(state, 1, [fire(1), fire(2)]);
    expect(hits(events)).toMatchObject([{ by: { id: 1 }, damage: 10 }]);
    expect(state.totals.map((t) => t.dealt)).toEqual([10, 0, 0]);
  });

  test("the dead take no more commands", () => {
    const state = humans(
      battleOn(FIELD, [["square"], [member("circle", { hp: 1 }), "circle"]]),
    );
    put(state, 1, 3, 3, "right");
    put(state, 2, 4, 3);
    run(state, 1, [fire(1)]);
    expect(validateCommand(state, fire(2))).toBe(
      "no participant 2 in the arena",
    );
    expect(state.participants.map((p) => p.id)).toEqual([1, 3]);
  });
});
