import {
  collectorRules,
  roadBuilderRules,
  type CreepView,
} from "@geometrix/sim";
import { describe, expect, it } from "vitest";
import { orderText, ruleText } from "../src/format.ts";
import { orderTarget } from "../src/map/creep-layer.tsx";
import type { Marker } from "../src/map/layout.ts";
import { cellmates, pickAt } from "../src/map/pick.ts";
import { viewOf, testWorld } from "./helpers.ts";

const creep = (id: number, x: number, y: number, scale = 1): Marker => ({
  kind: "creep",
  id,
  x,
  y,
  scale,
});

describe("pickAt", () => {
  const deposits = [{ id: 9, kind: "materia" as const, amount: 5, x: 3, y: 4 }];
  const cores = [
    { x: 10, y: 10 },
    { x: 20, y: 20 },
  ];

  it("picks the creep under the pointer, before what is on the cell", () => {
    const markers = [creep(1, 3.5, 4.5), creep(2, 6.5, 6.5)];
    expect(pickAt({ x: 3.6, y: 4.4 }, markers, deposits, cores)).toEqual({
      kind: "creep",
      id: 1,
    });
    expect(pickAt({ x: 3.1, y: 4.9 }, [], deposits, cores)).toEqual({
      kind: "deposit",
      id: 9,
    });
    expect(pickAt({ x: 21.2, y: 19.9 }, markers, deposits, cores)).toEqual({
      kind: "core",
      team: 1,
    });
    expect(pickAt({ x: 30, y: 30 }, markers, deposits, cores)).toBeNull();
  });

  it("tells side-by-side creeps apart by where the click lands", () => {
    const markers = [creep(3, 5.25, 5.5, 0.5), creep(7, 5.75, 5.5, 0.5)];
    expect(pickAt({ x: 5.2, y: 5.5 }, markers, [], [])).toEqual({
      kind: "creep",
      id: 3,
    });
    expect(pickAt({ x: 5.8, y: 5.6 }, markers, [], [])).toEqual({
      kind: "creep",
      id: 7,
    });
  });

  it("returns a stack's creeps to choose from", () => {
    const stack: Marker = {
      kind: "stack",
      ids: [4, 8],
      lead: 4,
      x: 2.5,
      y: 2.5,
      scale: 2,
    };
    expect(pickAt({ x: 3, y: 3 }, [stack], [], [])).toEqual({
      kind: "stack",
      ids: [4, 8],
    });
  });
});

describe("cellmates", () => {
  it("lists the creeps on the same cell, by id", () => {
    const creeps = [
      { id: 9, x: 1, y: 1 },
      { id: 2, x: 1, y: 1 },
      { id: 5, x: 2, y: 1 },
    ];
    expect(cellmates(creeps, 9)).toEqual([2, 9]);
    expect(cellmates(creeps, 5)).toEqual([5]);
    expect(cellmates(creeps, 99)).toEqual([]);
  });
});

describe("texts and targets", () => {
  it("describes the presets' rules", () => {
    expect(collectorRules("materia").map(ruleText)).toEqual([
      "carga cheia → entregar no Núcleo",
      "sempre → coletar matéria",
      "não conhece depósito de matéria → explorar",
      "sempre → entregar no Núcleo",
    ]);
    expect(roadBuilderRules({ x: 4, y: 7 }).map(ruleText)).toContain(
      "sempre → construir estrada até (4, 7)",
    );
  });

  it("describes and locates orders", () => {
    const state = viewOf(testWorld());
    // The team's own creep: whole in its view.
    const c = structuredClone(state.creeps[0]!) as CreepView;
    const deposit = state.deposits[0]!;
    expect(orderTarget(c, state)).toBeNull();
    expect(orderText(c.order, state.deposits)).toBe("nenhuma");

    c.order = { type: "gather", depositId: deposit.id };
    expect(orderTarget(c, state)).toBe(deposit);
    expect(orderText(c.order, state.deposits)).toBe(
      `coletar ${deposit.kind === "materia" ? "matéria" : "cristal"} em (${deposit.x}, ${deposit.y})`,
    );

    c.order = { type: "deliver" };
    expect(orderTarget(c, state)).toEqual(state.teams[c.team]!.core);

    c.order = { type: "buildRoad", x: 3, y: 2, segment: -1 };
    expect(orderTarget(c, state)).toEqual({ x: 3, y: 2 });
    expect(orderText(c.order, state.deposits)).toBe(
      "construir estrada até (3, 2)",
    );
  });
});
