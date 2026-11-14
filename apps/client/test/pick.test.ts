import { collectorRules, roadBuilderRules } from "@geometrix/sim";
import { describe, expect, it } from "vitest";
import { orderText, ruleText } from "../src/format.ts";
import { orderTarget } from "../src/map/creep-layer.tsx";
import { pickAt } from "../src/map/pick.ts";
import { dynamicOf, testWorld } from "./helpers.ts";

const at = (x: number, y: number, scale = 1) => ({ x, y, scale });

describe("pickAt", () => {
  const deposits = [{ id: 9, kind: "materia" as const, amount: 5, x: 3, y: 4 }];
  const cores = [
    { x: 10, y: 10 },
    { x: 20, y: 20 },
  ];

  it("picks the creep under the pointer, before what is on the cell", () => {
    const centers = new Map([
      [1, at(3.5, 4.5)],
      [2, at(6.5, 6.5)],
    ]);
    expect(pickAt({ x: 3.6, y: 4.4 }, centers, deposits, cores, null)).toEqual({
      kind: "creep",
      id: 1,
    });
    expect(
      pickAt({ x: 3.1, y: 4.9 }, new Map(), deposits, cores, null),
    ).toEqual({ kind: "deposit", id: 9 });
    expect(
      pickAt({ x: 21.2, y: 19.9 }, centers, deposits, cores, null),
    ).toEqual({ kind: "core", team: 1 });
    expect(pickAt({ x: 30, y: 30 }, centers, deposits, cores, null)).toBeNull();
  });

  it("cycles through a crowd by id on repeated clicks", () => {
    const centers = new Map([
      [7, at(5.6, 5.5, 0.7)],
      [3, at(5.4, 5.5, 0.7)],
      [5, at(5.5, 5.3, 0.7)],
    ]);
    const click = { x: 5.5, y: 5.5 };
    let selection = pickAt(click, centers, [], [], null);
    const seen = [];
    for (let i = 0; i < 4; i++) {
      seen.push(selection);
      selection = pickAt(click, centers, [], [], selection);
    }
    expect(seen).toEqual([
      { kind: "creep", id: 3 },
      { kind: "creep", id: 5 },
      { kind: "creep", id: 7 },
      { kind: "creep", id: 3 },
    ]);
  });
});

describe("texts and targets", () => {
  it("describes the presets' rules", () => {
    expect(collectorRules("materia").map(ruleText)).toEqual([
      "carga cheia → entregar no Núcleo",
      "sempre → coletar matéria",
      "sempre → entregar no Núcleo",
    ]);
    expect(roadBuilderRules({ x: 4, y: 7 }).map(ruleText)).toContain(
      "sempre → construir estrada até (4, 7)",
    );
  });

  it("describes and locates orders", () => {
    const state = dynamicOf(testWorld());
    const creep = structuredClone(state.creeps[0]!);
    const deposit = state.deposits[0]!;
    expect(orderTarget(creep, state)).toBeNull();
    expect(orderText(creep.order, state.deposits)).toBe("nenhuma");

    creep.order = { type: "gather", depositId: deposit.id };
    expect(orderTarget(creep, state)).toBe(deposit);
    expect(orderText(creep.order, state.deposits)).toBe(
      `coletar ${deposit.kind === "materia" ? "matéria" : "cristal"} em (${deposit.x}, ${deposit.y})`,
    );

    creep.order = { type: "deliver" };
    expect(orderTarget(creep, state)).toEqual(state.teams[creep.team]!.core);

    creep.order = { type: "buildRoad", x: 3, y: 2, segment: -1 };
    expect(orderTarget(creep, state)).toEqual({ x: 3, y: 2 });
    expect(orderText(creep.order, state.deposits)).toBe(
      "construir estrada até (3, 2)",
    );
  });
});
