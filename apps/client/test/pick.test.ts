import { collectorRules, roadBuilderRules } from "@geometrix/sim";
import { describe, expect, it } from "vitest";
import { orderText, ruleText } from "../src/format.ts";
import type { Marker } from "../src/map/layout.ts";
import { actorLine } from "../src/panels/actor-list.tsx";
import {
  actorsAt,
  cellmates,
  creepsUnder,
  type Scene,
  type Selection,
} from "../src/map/pick.ts";
import { viewOf, testWorld } from "./helpers.ts";

const creep = (id: number, x: number, y: number, scale = 1): Marker => ({
  kind: "creep",
  id,
  x,
  y,
  scale,
});

describe("actorsAt (R spec D23)", () => {
  const deposits = [{ id: 9, kind: "materia" as const, amount: 5, x: 3, y: 4 }];
  const cores = [
    { x: 10, y: 10 },
    { x: 20, y: 20 },
  ];
  const at = (x: number, y: number, scene: Partial<Scene>, scale = 100) =>
    actorsAt({ x, y }, { markers: [], deposits, cores, ...scene }, scale);

  it("gives one actor alone, whatever it is", () => {
    const markers = [creep(1, 6.5, 6.5)];
    expect(at(6.6, 6.4, { markers })).toEqual([{ kind: "creep", id: 1 }]);
    expect(at(3.1, 4.9, {})).toEqual([{ kind: "deposit", id: 9 }]);
    expect(at(21.2, 19.9, {})).toEqual([{ kind: "core", team: 1 }]);
    expect(at(30, 30, {})).toEqual([]);
  });

  it("lists a creep on a deposit with the deposit under it", () => {
    const markers = [creep(1, 3.5, 4.5)];
    expect(at(3.5, 4.5, { markers })).toEqual([
      { kind: "creep", id: 1 },
      { kind: "deposit", id: 9 },
    ]);
  });

  it("lists wanderers and spoils too", () => {
    const wanderers = [{ id: 50, x: 3, y: 4 }];
    const spoils = [{ id: 70, x: 3, y: 4, cargo: { materia: 1, cristal: 0 } }];
    expect(at(3.5, 4.5, { wanderers, spoils })).toEqual([
      { kind: "wanderer", id: 50 },
      { kind: "spoil", id: 70 },
      { kind: "deposit", id: 9 },
    ]);
    expect(at(30.5, 30.5, { wanderers: [{ id: 50, x: 30, y: 30 }] })).toEqual([
      { kind: "wanderer", id: 50 },
    ]);
  });

  it("keeps the team of a core when the other core is unknown", () => {
    const fog = [null, { x: 20, y: 20 }];
    expect(at(20.5, 20.5, { cores: fog })).toEqual([{ kind: "core", team: 1 }]);
    expect(at(10.5, 10.5, { cores: fog })).toEqual([]);
  });

  it("lists side-by-side creeps within reach, even on a clear click", () => {
    const markers = [creep(3, 5.25, 5.5, 0.5), creep(7, 5.75, 5.5, 0.5)];
    // 100 px per cell: the reach is 0.25 of a cell, only one is hit.
    expect(at(5.25, 5.5, { markers, deposits: [] })).toEqual([
      { kind: "creep", id: 3 },
    ]);
    // 30 px per cell: both are in reach, also right on the first.
    expect(at(5.25, 5.5, { markers, deposits: [] }, 30)).toEqual([
      { kind: "creep", id: 3 },
      { kind: "creep", id: 7 },
    ]);
  });

  it("flattens a stack, with what else is in reach when zoomed out", () => {
    const stack: Marker = {
      kind: "stack",
      ids: [4, 8],
      lead: 4,
      x: 3.5,
      y: 4.5,
      scale: 2,
    };
    expect(at(4, 4.5, { markers: [stack] }, 10)).toEqual([
      { kind: "creep", id: 4 },
      { kind: "creep", id: 8 },
      { kind: "deposit", id: 9 },
    ]);
  });
});

describe("creepsUnder (right click, fog F6 E3)", () => {
  it("takes the creep clearly under the pointer, else all of them", () => {
    const markers = [creep(3, 5.25, 5.5, 0.5), creep(7, 5.75, 5.5, 0.5)];
    expect(creepsUnder({ x: 5.25, y: 5.5 }, markers, 30)).toEqual([3]);
    expect(creepsUnder({ x: 5.5, y: 5.5 }, markers, 30)).toEqual([3, 7]);
    expect(creepsUnder({ x: 9, y: 9 }, markers, 30)).toEqual([]);
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
    expect(roadBuilderRules().map(ruleText)).toContain(
      "sempre → construir estrada até a jazida mais perto sem estrada",
    );
  });

  it("describes orders", () => {
    const state = viewOf(testWorld());
    const deposit = state.deposits[0]!;
    expect(orderText({ type: "stop" }, state.deposits)).toBe("nenhuma");
    expect(
      orderText({ type: "gather", depositId: deposit.id }, state.deposits),
    ).toBe(
      `coletar ${deposit.kind === "materia" ? "matéria" : "cristal"} em (${deposit.x}, ${deposit.y})`,
    );
    expect(
      orderText({ type: "buildRoad", x: 3, y: 2, segment: -1 }, state.deposits),
    ).toBe("construir estrada até (3, 2)");
  });
});

describe("the list's lines (D23)", () => {
  it("reads each kind of actor", () => {
    const world = testWorld();
    const state = viewOf(world);
    const viewer = { playerId: 1, team: 0 };
    const width = world.map.width;
    const line = (actor: Selection) =>
      actorLine(actor, state, world.params, viewer, width);
    const own = state.creeps[0]!;
    expect(line({ kind: "creep", id: own.id })?.reading).toMatch(
      /HP \d+ · carga 0\//,
    );
    expect(line({ kind: "core", team: 0 })?.reading).toMatch(/^estoque /);
    const deposit = state.deposits[0]!;
    expect(line({ kind: "deposit", id: deposit.id })?.reading).toMatch(
      /^restam /,
    );
    expect(line({ kind: "wanderer", id: 999 })).toBeNull();
  });
});
