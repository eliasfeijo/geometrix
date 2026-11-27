import { describe, expect, it } from "vitest";
import type { TeamView } from "@geometrix/sim";
import { hostileMarks } from "../src/map/combat-marks.ts";
import { testWorld, viewOf } from "./helpers.ts";

describe("hostileMarks (R spec D25, HS-2)", () => {
  /** Team 0's view with a creep of team 1 and a wanderer in it. */
  function view(): TeamView {
    const state = viewOf(testWorld());
    const own = state.creeps[0]!;
    state.creeps.push({
      id: 900,
      team: 1,
      dna: "circle",
      name: "Rival",
      hp: own.hp,
      engagement: null,
      battle: null,
      x: own.x,
      y: own.y,
      cargo: { materia: 0, cristal: 0 },
      hostile: null,
    });
    return state;
  }

  it("marks every aggressor, with a line only to the team's own creep", () => {
    const state = view();
    const own = state.creeps[0]!;
    const rival = state.creeps.at(-1)!;
    expect(hostileMarks(state)).toEqual([]);

    rival.hostile = { intent: "extort", target: own.id };
    state.wanderers.push({
      id: 901,
      dna: "circle",
      name: "Errante",
      hp: 1000,
      battle: null,
      x: 1,
      y: 1,
      cargo: { materia: 0, cristal: 0 },
      hostile: { intent: "attack", target: null },
    });
    expect(hostileMarks(state)).toEqual([
      { from: 900, intent: "extort", to: own.id },
      { from: 901, intent: "attack", to: null },
    ]);
  });

  it("draws no line to another team's creep, except in a replay", () => {
    const state = view();
    const rival = state.creeps.at(-1)!;
    const own = state.creeps[0]!;
    own.hostile = { intent: "attack", target: rival.id };
    expect(hostileMarks(state)[0]!.to).toBeNull();
    state.team = -1;
    expect(hostileMarks(state)[0]!.to).toBe(rival.id);
  });
});
