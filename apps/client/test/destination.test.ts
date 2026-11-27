import { describe, expect, it } from "vitest";
import {
  CELL_COST,
  movePointsPerTick,
  type CreepView,
  type Terrain,
} from "@geometrix/sim";
import { etaOf, etaText, routeOf, viewMap } from "../src/map/destination.ts";
import { testWorld, viewOf } from "./helpers.ts";

/** An open jungle map and the first creep of team 0 at (2, 2). */
function setup() {
  const world = testWorld();
  const state = viewOf(world);
  const { params } = world;
  const { width, height } = world.map;
  const map = viewMap(
    {
      width,
      height,
      terrain: new Array<Terrain>(width * height).fill(0 as Terrain),
    },
    [],
  );
  const creep = state.creeps[0] as CreepView;
  creep.x = 2;
  creep.y = 2;
  creep.cargo = { materia: 0, cristal: 0 };
  return { state, params, map, creep };
}

describe("routeOf (R spec D19)", () => {
  it("goes to the order's destination", () => {
    const { state, params, map, creep } = setup();
    expect(routeOf(creep, state, params, map)).toBeNull();
    creep.order = { type: "moveTo", x: 6, y: 2 };
    const route = routeOf(creep, state, params, map)!;
    expect(route.cell).toEqual({ x: 6, y: 2 });
    expect(route.path.length).toBe(4);
    creep.order = { type: "deliver" };
    expect(routeOf(creep, state, params, map)!.cell).toEqual(
      state.teams[0]!.core,
    );
  });

  it("stops a follow short of its target", () => {
    const { state, params, map, creep } = setup();
    const other = state.creeps[1]!;
    other.x = 2 + params.autopilot.followCells + 3;
    other.y = 2;
    creep.order = { type: "follow", targetId: other.id };
    const route = routeOf(creep, state, params, map)!;
    expect(route.cell).toEqual({ x: other.x, y: 2 });
    expect(route.path.length).toBe(3);
  });
});

describe("etaOf (R spec D20)", () => {
  it("adds up the ticks of each cell of the path, in real seconds", () => {
    const { state, params, map, creep } = setup();
    creep.order = { type: "moveTo", x: 12, y: 2 };
    const gain = movePointsPerTick(creep, map, 2 * map.width + 3, params);
    const world = Math.ceil((10 * CELL_COST) / gain) * params.world.tickSeconds;
    expect(etaOf(creep, state, params, map, 8)).toEqual({
      kind: "arrive",
      seconds: Math.round(world / 8),
    });
  });

  it("says when a gatherer fills up, and nothing at a drained deposit", () => {
    const { state, params, map, creep } = setup();
    const deposit = state.deposits.find((d) => d.kind === "materia")!;
    creep.x = deposit.x;
    creep.y = deposit.y;
    creep.order = { type: "gather", depositId: deposit.id };
    const free = params.dna[creep.dna].capacity;
    const { units, everySeconds } = params.gather.materia;
    expect(etaOf(creep, state, params, map, 1)).toEqual({
      kind: "fill",
      seconds: Math.ceil(free / units) * everySeconds,
    });
    deposit.amount = 0;
    expect(etaOf(creep, state, params, map, 1)).toBeNull();
  });

  it("gives the segment's remaining time while building", () => {
    const { state, params, map, creep } = setup();
    creep.order = { type: "buildRoad", x: 8, y: 2, segment: 2 * map.width + 2 };
    state.roadJobs.push({
      id: 1,
      team: 0,
      x: 2,
      y: 2,
      remainingSeconds: 80,
    });
    expect(etaOf(creep, state, params, map, 8)).toEqual({
      kind: "segment",
      seconds: 10,
    });
  });

  it("reads as a sentence", () => {
    expect(etaText({ kind: "arrive", seconds: 40 })).toBe("chega em ~40 s");
    expect(etaText({ kind: "fill", seconds: 70 })).toBe("cheio em ~1 min 10 s");
    expect(etaText({ kind: "segment", seconds: 120 })).toBe("trecho em ~2 min");
  });
});
