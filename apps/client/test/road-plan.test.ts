import { describe, expect, it } from "vitest";
import { parseParams, Terrain, type Cell } from "@geometrix/sim";
import params from "../../../packages/sim/test/params.json" with { type: "json" };
import { roadPlan, roadPlanLabel } from "../src/map/road-plan.ts";
import { knownTerrain } from "../src/map/terrain.ts";

const testParams = parseParams(params);

/**
 * A small world drawn in text: `.` jungle, `r` road, `=` crossing, `~` river,
 * `#` rock, `C` the team's core, `j` a road job already paid.
 */
function world(rows: string[]) {
  const cells = rows.join("").split("");
  const width = rows[0]!.length;
  const terrainOf: Record<string, number> = {
    ".": Terrain.jungle,
    r: Terrain.jungle,
    C: Terrain.jungle,
    j: Terrain.jungle,
    "=": Terrain.crossing,
    "~": Terrain.river,
    "#": Terrain.rock,
  };
  const at = (i: number): Cell => ({ x: i % width, y: Math.floor(i / width) });
  const core = at(cells.indexOf("C"));
  return {
    map: {
      width,
      height: rows.length,
      terrain: cells.map((c) => terrainOf[c]!),
    },
    state: {
      roads: cells.flatMap((c, i) => (c === "r" ? [i] : [])),
      roadJobs: cells.flatMap((c, i) =>
        c === "j" ? [{ id: i, team: 0, remainingSeconds: 10, ...at(i) }] : [],
      ),
      teams: [{ core }] as never,
    },
  };
}

const plan = (rows: string[], target: Cell) => {
  const { map, state } = world(rows);
  return roadPlan(map, state, testParams, 0, target);
};

describe("roadPlan", () => {
  it("pays for each cell without road on the path from the core", () => {
    expect(plan(["Cr...."], { x: 4, y: 0 })).toEqual({
      kind: "plan",
      paid: [2, 3, 4],
      built: [1],
      free: [],
      blockedAt: null,
      cost: { materia: 15, cristal: 0 },
    });
  });

  it("does not pay again for a cell whose job is already paid", () => {
    expect(plan(["Crj.."], { x: 3, y: 0 })).toMatchObject({
      paid: [3],
      free: [2],
      cost: { materia: 5, cristal: 0 },
    });
  });

  it("stops at the first cell that cannot take a road", () => {
    expect(plan(["C.=.."], { x: 4, y: 0 })).toMatchObject({
      paid: [1],
      blockedAt: 2,
      cost: { materia: 5, cristal: 0 },
    });
  });

  it("has nothing to build where the road already is", () => {
    expect(plan(["Crr"], { x: 2, y: 0 })).toMatchObject({
      paid: [],
      free: [],
      blockedAt: null,
    });
  });

  it("plans through what the team knows: a rock never seen is jungle", () => {
    const { map, state } = world(["C#."]);
    // The client's map from the view's known array (store.map).
    const dark = { ...map, terrain: knownTerrain([0, -1, 0]) };
    const through = roadPlan(dark, state, testParams, 0, { x: 2, y: 0 });
    expect(through).toMatchObject({ kind: "plan", paid: [1, 2] });
    const lit = { ...map, terrain: knownTerrain([0, Terrain.rock, 0]) };
    expect(roadPlan(lit, state, testParams, 0, { x: 2, y: 0 })).toEqual({
      kind: "unreachable",
    });
  });

  it("tells a cell with no path", () => {
    expect(plan(["C.#."], { x: 3, y: 0 })).toEqual({ kind: "unreachable" });
    expect(plan(["C.#."], { x: 2, y: 0 })).toEqual({ kind: "unreachable" });
  });
});

describe("roadPlanLabel", () => {
  const stock = { materia: 10, cristal: 0 };
  it("counts the cells and says the cost, short when the stock is", () => {
    expect(roadPlanLabel(plan(["Cr..."], { x: 3, y: 0 }), stock)).toEqual([
      "2 células · 10 matéria",
      false,
    ]);
    expect(roadPlanLabel(plan(["Cr...."], { x: 4, y: 0 }), stock)).toEqual([
      "3 células · 15 matéria",
      true,
    ]);
    expect(roadPlanLabel(plan(["Cj"], { x: 1, y: 0 }), stock)).toEqual([
      "1 célula · já paga",
      false,
    ]);
  });

  it("explains when there is nothing to build", () => {
    expect(roadPlanLabel(plan(["Cr"], { x: 1, y: 0 }), stock)).toEqual([
      "já tem estrada",
      false,
    ]);
    expect(roadPlanLabel(plan(["C=."], { x: 2, y: 0 }), stock)).toEqual([
      "sem estrada aqui",
      false,
    ]);
    expect(roadPlanLabel(plan(["C#"], { x: 1, y: 0 }), stock)).toEqual([
      "sem caminho",
      false,
    ]);
  });

  it("shows no cost over a cell the team never saw (fog spec C-3)", () => {
    const over = plan(["Cr..."], { x: 3, y: 0 });
    expect(roadPlanLabel(over, stock, false)).toEqual([
      "nunca vista · custo desconhecido",
      false,
    ]);
  });
});
