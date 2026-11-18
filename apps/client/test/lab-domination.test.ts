import {
  battleView,
  createBattle,
  parseBattleParams,
  stepBattle,
} from "@geometrix/battle";
import { describe, expect, test } from "vitest";
import paramsJson from "../../../packages/battle/test/params.json?raw";
import { LAB_ARENAS } from "../src/lab/assets.ts";
import { isSwitch, keepsDomination } from "../src/lab/domination.ts";
import { defaultDraft, setupOf } from "../src/lab/draft.ts";

const params = parseBattleParams(JSON.parse(paramsJson));

describe("the domination on the page (plan C7)", () => {
  test("it ends with the battle, even for the winner still in the arena", () => {
    const state = createBattle(
      setupOf(defaultDraft(), params, LAB_ARENAS.pedras),
      params,
    );
    const ids = state.participants.map((p) => p.id);
    expect(ids.every((id) => keepsDomination(battleView(state), id))).toBe(
      true,
    );
    while (state.ended === null) stepBattle(state, []);
    const view = battleView(state);
    const winner = view.participants[0];
    if (winner !== undefined) {
      // Still drawn in the arena, but nobody to dominate any more.
      expect(keepsDomination(view, winner.id)).toBe(false);
    }
    expect(ids.some((id) => keepsDomination(view, id))).toBe(false);
  });

  test("it ends when the creep leaves the arena", () => {
    const state = createBattle(
      setupOf(defaultDraft(), params, LAB_ARENAS.pedras),
      params,
    );
    const view = battleView(state);
    const gone = { ...view, participants: view.participants.slice(1) };
    expect(keepsDomination(gone, view.participants[0]!.id)).toBe(false);
    expect(keepsDomination(gone, view.participants[1]!.id)).toBe(true);
  });

  test("taking the creep already taken is no switch", () => {
    expect(isSwitch(3, 3)).toBe(false);
    expect(isSwitch(3, 4)).toBe(true);
    expect(isSwitch(null, 3)).toBe(true);
  });
});
