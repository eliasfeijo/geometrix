import { describe, expect, it } from "vitest";
import {
  addFloats,
  FLOAT_MS,
  MERGE_MS,
  stockDeltas,
  type StockFloat,
} from "../src/map/stock-floats.ts";
import { viewOf, testWorld } from "./helpers.ts";

describe("stockDeltas", () => {
  it("tells deliveries and payments of each team", () => {
    const state = testWorld();
    const before = viewOf(state);
    state.teams[0]!.stock.materia += 40;
    state.teams[1]!.stock.cristal -= 10;
    expect(stockDeltas(before, viewOf(state))).toEqual([
      { team: 0, resource: "materia", amount: 40 },
      { team: 1, resource: "cristal", amount: -10 },
    ]);
    expect(stockDeltas(before, before)).toEqual([]);
  });
});

describe("addFloats", () => {
  let id = 0;
  const next = () => ++id;
  const delivery = { team: 0, resource: "materia" as const, amount: 20 };

  it("joins changes close in time of the same team, resource and sign", () => {
    let floats: StockFloat[] = addFloats([], [delivery], 1000, next);
    floats = addFloats(floats, [delivery], 1000 + MERGE_MS - 1, next);
    expect(floats).toHaveLength(1);
    expect(floats[0]!.amount).toBe(40);
    floats = addFloats(
      floats,
      [
        { ...delivery, amount: -150 },
        { ...delivery, team: 1 },
      ],
      1100,
      next,
    );
    expect(floats.map((f) => [f.team, f.amount])).toEqual([
      [0, 40],
      [0, -150],
      [1, 20],
    ]);
  });

  it("starts a new float after the merge window and drops expired ones", () => {
    const first = addFloats([], [delivery], 0, next);
    const later = addFloats(first, [delivery], MERGE_MS, next);
    expect(later).toHaveLength(2);
    expect(addFloats(later, [], FLOAT_MS + MERGE_MS, next)).toEqual([]);
  });
});
