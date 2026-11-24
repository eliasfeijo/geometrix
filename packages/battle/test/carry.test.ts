import { describe, expect, test } from "vitest";
import { moveGain } from "../src/movement.ts";
import type { BattleState } from "../src/state.ts";
import { battleOn, FIELD, humans, member, put, run } from "./helpers.ts";

/** A square with `materia` + `cristal` at (3, 3), against a far circle. */
function carrier(materia: number, cristal: number): BattleState {
  const state = humans(
    battleOn(FIELD, [
      [member("square", { carry: { materia, cristal } })],
      ["circle"],
    ]),
  );
  put(state, 1, 3, 3);
  put(state, 2, 6, 5);
  return state;
}

const square = (state: BattleState) => state.participants[0]!;
const HERE = 3 * 9 + 3;

describe("drop the bag (spec C-1, D8)", () => {
  test("moves the whole carry to a pile on the cell and lifts the brake", () => {
    const state = carrier(20, 10);
    const braked = moveGain(state, square(state));
    const events = run(state, 1, [{ type: "drop", id: 1 }]);
    expect(square(state).carry).toEqual({ materia: 0, cristal: 0 });
    expect(state.piles).toEqual([
      { id: 3, cell: HERE, materia: 20, cristal: 10 },
    ]);
    expect(moveGain(state, square(state))).toBe(2 * braked);
    expect(events).toEqual([
      {
        type: "dropped",
        participant: { id: 1, side: 0, dna: "square", name: "square" },
        carry: { materia: 20, cristal: 10 },
        cell: HERE,
        tick: 0,
        index: 0,
      },
    ]);
  });

  test("adds to the pile already on the cell", () => {
    const state = carrier(5, 1);
    state.piles.push({ id: 9, cell: HERE, materia: 2, cristal: 3 });
    run(state, 1, [{ type: "drop", id: 1 }]);
    expect(state.piles).toEqual([
      { id: 9, cell: HERE, materia: 7, cristal: 4 },
    ]);
  });

  test("an empty bag drops nothing, with no event", () => {
    const state = carrier(0, 0);
    expect(run(state, 1, [{ type: "drop", id: 1 }])).toEqual([]);
    expect(state.piles).toEqual([]);
  });

  test("acts once: a later pickup is not undone", () => {
    const state = carrier(4, 0);
    run(state, 1, [{ type: "drop", id: 1 }]);
    run(state, 1, [{ type: "pickup", id: 1 }]);
    run(state, 3);
    expect(square(state).carry).toEqual({ materia: 4, cristal: 0 });
    expect(state.piles).toEqual([]);
  });
});

describe("pick up (spec C-2, D8)", () => {
  test("takes cristal first, up to the free capacity", () => {
    const state = carrier(10, 0);
    state.piles.push({ id: 9, cell: HERE, materia: 30, cristal: 12 });
    const events = run(state, 1, [{ type: "pickup", id: 1 }]);
    // Capacity 30, 10 taken: 12 cristal, then 8 materia.
    expect(square(state).carry).toEqual({ materia: 18, cristal: 12 });
    expect(state.piles).toEqual([
      { id: 9, cell: HERE, materia: 22, cristal: 0 },
    ]);
    expect(events.map((e) => e.type === "picked" && e.carry)).toEqual([
      { materia: 8, cristal: 12 },
    ]);
  });

  test("the capacity is the setup's, not the DNA's (junction spec D9)", () => {
    // A square with the world's capacity upgrade (30 + 50%).
    const state = humans(
      battleOn(FIELD, [[member("square", { capacity: 45 })], ["circle"]]),
    );
    put(state, 1, 3, 3);
    put(state, 2, 6, 5);
    state.piles.push({ id: 9, cell: HERE, materia: 50, cristal: 0 });
    run(state, 1, [{ type: "pickup", id: 1 }]);
    expect(square(state).carry).toEqual({ materia: 45, cristal: 0 });
    // The brake follows the same capacity: 45 of 45 is the full brake.
    const full = moveGain(state, square(state));
    run(state, 1, [{ type: "drop", id: 1 }]);
    expect(moveGain(state, square(state))).toBe(2 * full);
  });

  test("an emptied pile leaves the state", () => {
    const state = carrier(0, 0);
    state.piles.push({ id: 9, cell: HERE, materia: 3, cristal: 2 });
    run(state, 1, [{ type: "pickup", id: 1 }]);
    expect(square(state).carry).toEqual({ materia: 3, cristal: 2 });
    expect(state.piles).toEqual([]);
  });

  test("a full bag or a cell without a pile: nothing, with no event", () => {
    const full = carrier(30, 0);
    full.piles.push({ id: 9, cell: HERE, materia: 3, cristal: 2 });
    expect(run(full, 1, [{ type: "pickup", id: 1 }])).toEqual([]);
    expect(full.piles).toHaveLength(1);
    const bare = carrier(0, 0);
    bare.piles.push({ id: 9, cell: HERE + 1, materia: 3, cristal: 2 });
    expect(run(bare, 1, [{ type: "pickup", id: 1 }])).toEqual([]);
  });

  test("a pile does not block its cell: walk onto it and pick up", () => {
    const state = carrier(0, 0);
    state.piles.push({ id: 9, cell: HERE + 1, materia: 1, cristal: 0 });
    // Standing, the first step is ready (D22): one tick walks one cell.
    run(state, 1, [{ type: "intent", id: 1, move: "right", attack: false }]);
    run(state, 1, [
      { type: "intent", id: 1, move: null, attack: false },
      { type: "pickup", id: 1 },
    ]);
    expect(square(state).cell).toBe(HERE + 1);
    expect(square(state).carry).toEqual({ materia: 1, cristal: 0 });
  });

  test("the last of drop and pickup in a tick wins", () => {
    const state = carrier(4, 0);
    run(state, 1, [
      { type: "drop", id: 1 },
      { type: "pickup", id: 1 },
    ]);
    expect(square(state).carry).toEqual({ materia: 4, cristal: 0 });
    run(state, 1, [
      { type: "pickup", id: 1 },
      { type: "drop", id: 1 },
    ]);
    expect(square(state).carry).toEqual({ materia: 0, cristal: 0 });
  });
});
