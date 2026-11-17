import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { BattleParamsError } from "../src/params.ts";
import {
  BattleVersionError,
  restoreBattle,
  serializeBattle,
} from "../src/serialize.ts";
import { createBattle } from "../src/setup.ts";
import { BATTLE_VERSION, type BattleState } from "../src/state.ts";
import { loadTestParams, member, readArenaRows, setupOf } from "./helpers.ts";

const sha256 = (text: string) =>
  createHash("sha256").update(text).digest("hex");

/** The reference battle: 3 × 3 on the rocks arena, seed 42. */
function reference(): BattleState {
  const side = () => [member("square"), member("triangle"), member("circle")];
  return createBattle(
    setupOf(readArenaRows("pedras"), [side(), side()], 42),
    loadTestParams(),
  );
}

describe("serializeBattle / restoreBattle (spec S-3)", () => {
  const state = reference();

  test("restore(serialize(state)) equals the state", () => {
    expect(restoreBattle(serializeBattle(state))).toEqual(state);
  });

  test("serialization is a fixed point", () => {
    const json = serializeBattle(state);
    expect(serializeBattle(restoreBattle(json))).toBe(json);
  });

  test("the reference battle hashes to a stable value", () => {
    // Locks the arena, the spawn draw, the rng and the serialization
    // together. If this changes on purpose, update it, and bump
    // BATTLE_VERSION once logs are kept (see BATTLE_VERSION).
    expect(sha256(serializeBattle(state))).toMatchInlineSnapshot(
      `"1a7da07962c8cbc89910e58dbe574dcd591e3037251cfa4991ad86be0ccf7e84"`,
    );
  });

  test("refuses state that is not plain JSON", () => {
    const broken = reference() as unknown as Record<string, unknown>;
    broken.piles = new Map();
    expect(() => serializeBattle(broken as unknown as BattleState)).toThrow(
      "state.piles: not plain JSON data (Map)",
    );
    const undef = reference();
    (undef.participants[0] as { ai: unknown }).ai = undefined;
    expect(() => serializeBattle(undef)).toThrow("not plain JSON data");
  });

  test("refuses a snapshot from another battle version", () => {
    const old = JSON.stringify({ ...state, battleVersion: BATTLE_VERSION + 1 });
    expect(() => restoreBattle(old)).toThrow(BattleVersionError);
  });

  test("refuses a snapshot with invalid params", () => {
    const bad = JSON.stringify({ ...state, params: { tick: {} } });
    expect(() => restoreBattle(bad)).toThrow(BattleParamsError);
  });

  test.each(["[]", "null", "3"])("refuses %s", (json) => {
    expect(() => restoreBattle(json)).toThrow("expected an object");
  });
});
