import { describe, expect, test } from "vitest";
import {
  copyGambits,
  createBattle,
  DEFAULT_PRESETS,
  defaultGambits,
  DNAS,
  PRESET_IDS,
  presetGambits,
  stepBattle,
  type BattleEvent,
  type BattleState,
  type Dna,
} from "@geometrix/battle";
import {
  ARENA_NAMES,
  battleOn,
  FIELD,
  loadTestParams,
  member,
  put,
  readArenaRows,
  run,
  setupOf,
  xyOf,
} from "./helpers.ts";

const byId = (state: BattleState, id: number) =>
  state.participants.find((p) => p.id === id)!;

describe("presets (spec D15, G-3)", () => {
  test("every preset is a valid list within maxRules", () => {
    const { maxRules } = loadTestParams().gambits;
    for (const id of PRESET_IDS) {
      const list = presetGambits(id);
      expect(copyGambits(list, maxRules), id).toEqual(list);
    }
  });

  test("each DNA defaults to the preset of its role", () => {
    expect(DEFAULT_PRESETS).toEqual({
      square: "frontline",
      circle: "marksman",
      triangle: "skirmisher",
    });
    expect(defaultGambits("circle")).toEqual(presetGambits("marksman"));
  });

  test("a preset is a fresh copy every time", () => {
    const a = presetGambits("frontline");
    (a[0]!.when as { permille: number }).permille = 1;
    expect(presetGambits("frontline")[0]!.when).toMatchObject({
      permille: 500,
    });
  });

  test("frontline: covers the wounded ally from the enemy", () => {
    const state = battleOn(FIELD, [
      [
        member("square", { gambits: presetGambits("frontline") }),
        member("circle", { hp: 30 }),
      ],
      ["triangle"],
    ]);
    for (const p of state.participants) {
      if (p.id !== 1) p.controller = "human";
    }
    put(state, 1, 2, 5);
    put(state, 2, 3, 3);
    put(state, 3, 6, 3);
    run(state, 60);
    expect(xyOf(state, 1)).toEqual([4, 3]);
  });

  test("marksman: flees for the edge when its HP is low", () => {
    const state = battleOn(FIELD, [
      [member("circle", { hp: 29, gambits: presetGambits("marksman") })],
      ["square"],
    ]);
    byId(state, 2).controller = "human";
    put(state, 1, 4, 3);
    put(state, 2, 7, 5);
    const events = run(state, 80);
    expect(events.find((e) => e.type === "escaped")).toMatchObject({
      participant: { id: 1 },
      reason: "edge",
    });
  });

  test("skirmisher: backs off from the square's melee and shoots (C12)", () => {
    const state = battleOn(FIELD, [
      [member("triangle", { gambits: presetGambits("skirmisher") })],
      ["square"],
    ]);
    byId(state, 2).controller = "human";
    put(state, 1, 3, 3);
    put(state, 2, 4, 3);
    const events = run(state, 40);
    const [x] = xyOf(state, 1);
    expect(4 - x).toBeGreaterThanOrEqual(3);
    expect(events.some((e) => e.type === "hit")).toBe(true);
    expect(byId(state, 1).hp).toBe(200);
  });

  test("skirmisher: holds its ground next to a shooter", () => {
    const state = battleOn(FIELD, [
      [member("triangle", { gambits: presetGambits("skirmisher") })],
      ["circle"],
    ]);
    byId(state, 2).controller = "human";
    put(state, 1, 3, 3);
    put(state, 2, 4, 3);
    const events = run(state, 10);
    expect(xyOf(state, 1)).toEqual([3, 3]);
    expect(events.some((e) => e.type === "attacked")).toBe(true);
  });

  test("carrier: drops the bag with an enemy near, then runs", () => {
    const state = battleOn(FIELD, [
      [
        member("square", {
          carry: { materia: 30, cristal: 0 },
          gambits: presetGambits("carrier"),
        }),
      ],
      ["circle"],
    ]);
    byId(state, 2).controller = "human";
    put(state, 1, 4, 3);
    put(state, 2, 7, 3);
    const events = run(state, 100);
    const types = events.map((e) => e.type);
    expect(types).toContain("dropped");
    expect(types.indexOf("dropped")).toBeLessThan(types.indexOf("escaped"));
    expect(events.find((e) => e.type === "escaped")).toMatchObject({
      reason: "edge",
      carry: { materia: 0, cristal: 0 },
    });
  });
});

describe("preset battles", () => {
  /** A 1 × 1 of two DNAs on their default presets, to the end. */
  function duel(a: Dna, b: Dna, arena: string, seed: number): BattleEvent[] {
    const state = createBattle(
      setupOf(
        readArenaRows(arena),
        [
          [member(a, { gambits: defaultGambits(a) })],
          [member(b, { gambits: defaultGambits(b) })],
        ],
        seed,
      ),
      loadTestParams(),
    );
    const events: BattleEvent[] = [];
    while (state.ended === null && state.tick < 20 * 600) {
      events.push(...stepBattle(state, []));
    }
    return events;
  }

  test("every pairing ends, with blows struck, on every arena", () => {
    for (const arena of ARENA_NAMES) {
      for (const a of DNAS) {
        for (const b of DNAS) {
          const label = `${a} x ${b} on ${arena}`;
          // A seed may give two kiters who never land a shot before the
          // inactivity runs out; not three seeds in a row.
          const struck = [5, 6, 7].map((seed) => {
            const events = duel(a, b, arena, seed);
            expect(events.at(-1)?.type, label).toBe("ended");
            return events.some((e) => e.type === "hit");
          });
          expect(struck.includes(true), label).toBe(true);
        }
      }
    }
  }, 30_000);
});
