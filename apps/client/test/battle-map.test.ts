import type { BattleStubView } from "@geometrix/sim";
import { describe, expect, test } from "vitest";
import { battleSign, BATTLE_SIGN_PX } from "../src/map/combat-marks.ts";
import type { Marker } from "../src/map/layout.ts";
import { pickAt } from "../src/map/pick.ts";
import {
  battleAge,
  participantName,
  watchAction,
} from "../src/panels/battle-inspector.tsx";
import { testWorld, viewOf } from "./helpers.ts";

const stub = (id: number, x: number, y: number): BattleStubView => ({
  id,
  x,
  y,
  window: { x: x - 4, y: y - 2, width: 9, height: 5 },
  sides: [{ kind: "team", team: 0 }, { kind: "wanderers" }],
  participants: [
    { id: 3, side: 0 },
    { id: 40, side: 1 },
  ],
  openedTick: 10,
});

describe("the battle on the map (junction D16)", () => {
  test("the sign stands over the battle's cell, the same size on screen", () => {
    const near = battleSign({ x: 10, y: 20 }, 100);
    expect(near.r).toBe(0.35);
    expect(near.x).toBe(10.5);
    expect(near.y).toBeLessThan(20.5);
    const far = battleSign({ x: 10, y: 20 }, 6);
    expect(far.r * 6).toBeCloseTo(BATTLE_SIGN_PX);
  });

  test("a click on the sign selects the battle, before the creep under it", () => {
    const battle = stub(7, 10, 20);
    const sign = battleSign(battle, 20);
    const markers: Marker[] = [
      { kind: "creep", id: 3, x: sign.x, y: sign.y, scale: 1 },
    ];
    expect(
      pickAt({ x: sign.x, y: sign.y }, markers, [], [], 20, [battle]),
    ).toEqual({ kind: "battle", id: 7 });
    // Away from the sign, the creep is picked as before.
    expect(pickAt({ x: sign.x, y: sign.y }, markers, [], [], 20)).toEqual({
      kind: "creep",
      id: 3,
    });
    expect(
      pickAt({ x: 10.5, y: 20.5 + 3 }, [], [], [], 20, [battle]),
    ).toBeNull();
  });

  test("the inspector names who the team sees, and the battle's age", () => {
    const state = viewOf(testWorld());
    const creep = state.creeps[0]!;
    expect(participantName(state, creep.id)).toContain(creep.name);
    expect(participantName(state, 99_999)).toBe("#99999");
    expect(battleAge(stub(1, 0, 0), 16, 10)).toBe(60);
  });
});

describe("watching a battle (junction D11, N-2)", () => {
  test("a team with a side watches; the dominated creep's battle is a return", () => {
    const battle = stub(7, 10, 20);
    expect(watchAction(battle, 0, null)).toBe("watch");
    expect(watchAction(battle, 0, 3)).toBe("watch");
    expect(watchAction(battle, 0, 7)).toBe("return");
    // Another team's battle is not this team's to watch (spectators: P).
    expect(watchAction(battle, 1, null)).toBeNull();
  });
});
