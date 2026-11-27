import { describe, expect, it } from "vitest";
import {
  collectorRules,
  findPath,
  presetRules,
  type CreepView,
  type Terrain,
} from "@geometrix/sim";
import { builderPlan, builderText } from "../src/map/road-plan.ts";
import { testWorld, viewOf } from "./helpers.ts";

/** An open jungle map and one deposit, five cells east of the core. */
function setup() {
  const world = testWorld();
  const state = viewOf(world);
  const { params } = world;
  const { width, height } = world.map;
  const map = {
    width,
    height,
    terrain: new Array<number>(width * height).fill(0 as Terrain),
  };
  const core = state.teams[0]!.core!;
  const x = core.x < width / 2 ? core.x + 5 : core.x - 5;
  const deposit = {
    id: 1,
    kind: "materia" as const,
    amount: 10,
    x,
    y: core.y,
  };
  state.deposits = [deposit];
  state.roads = [];
  state.roadJobs = [];
  const creep = state.creeps[0] as CreepView;
  creep.rules = presetRules("roadBuilder", creep.dna);
  creep.order = { type: "stop" };
  creep.dominatedBy = null;
  return { state, params, map, core, deposit, creep };
}

describe("builderPlan (R spec D13, RB-3)", () => {
  it("costs the road to the deposit against what is paid", () => {
    const { state, params, map, core, deposit, creep } = setup();
    const road = new Array<number>(map.width * map.height).fill(0);
    const path = findPath(
      { ...map, terrain: map.terrain as Terrain[], road },
      core,
      deposit,
      params,
    )!;
    state.roads = [path[0]!];
    const builder = builderPlan(map, state, params, creep)!;
    expect(builder).toMatchObject({
      kind: "target",
      target: { x: deposit.x, y: deposit.y },
    });
    const { materia } = params.road.cost;
    expect(builderText(builder)).toBe(
      `Estrada até a jazida: ${materia} de ${5 * materia} matéria pagos`,
    );
  });

  it("says why there is no target", () => {
    const { state, params, map, creep } = setup();
    state.deposits = [];
    expect(builderText(builderPlan(map, state, params, creep)!)).toBe(
      "nenhuma jazida conhecida sem estrada",
    );
  });

  it("is nothing for another creep, or a dominated builder", () => {
    const { state, params, map, creep } = setup();
    creep.dominatedBy = 1;
    expect(builderPlan(map, state, params, creep)).toBeNull();
    creep.dominatedBy = null;
    creep.rules = collectorRules("materia");
    expect(builderPlan(map, state, params, creep)).toBeNull();
  });
});
