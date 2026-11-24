import {
  battleView,
  createBattle,
  parseBattleParams,
  stepBattle,
  type BattleEvent,
} from "@geometrix/battle";
import { describe, expect, test } from "vitest";
import paramsJson from "../../../packages/battle/test/params.json?raw";
import { LAB_ARENAS, LAB_KITS } from "../src/lab/assets.ts";
import { idleWarning } from "../src/lab/arena-view.tsx";
import {
  defaultDraft,
  member,
  setupOf,
  type SetupDraft,
} from "../src/lab/draft.ts";
import {
  EFFECT_MS,
  effectProgress,
  effectsOf,
  liveEffects,
} from "../src/lab/effects.ts";

const params = parseBattleParams(JSON.parse(paramsJson));

/** The events of a 1 × 1 on the rocks (the default one), until it ends. */
function battleEvents(draft: SetupDraft = defaultDraft()): BattleEvent[] {
  const state = createBattle(
    setupOf(draft, LAB_KITS, LAB_ARENAS.pedras),
    params,
  );
  const events: BattleEvent[] = [];
  while (state.ended === null) events.push(...stepBattle(state, []));
  return events;
}

describe("the signals of the attack (spec L-8, plan C6)", () => {
  test("one per attack, blow and miss, at the frame's arrival", () => {
    const events = battleEvents();
    const effects = effectsOf(events, 1000, params);
    const count = (type: string) => events.filter((e) => e.type === type);
    expect(effects.filter((e) => e.kind === "attack")).toHaveLength(
      count("attacked").length,
    );
    expect(effects.filter((e) => e.kind === "hit")).toHaveLength(
      count("hit").length,
    );
    expect(effects.filter((e) => e.kind === "miss")).toHaveLength(
      count("missed").length,
    );
    expect(effects.every((e) => e.at === 1000)).toBe(true);
    // The circle shoots (and keeps out of the square's reach, C12); two
    // squares strike in melee.
    const attacks = effects.filter((e) => e.kind === "attack");
    expect(attacks.length).toBeGreaterThan(0);
    expect(attacks.every((e) => !e.melee)).toBe(true);
    const squares = {
      ...defaultDraft(),
      sides: [[member("square")], [member("square")]],
    };
    const melee = effectsOf(battleEvents(squares), 1000, params).filter(
      (e) => e.kind === "attack",
    );
    expect(melee.length).toBeGreaterThan(0);
    expect(melee.every((e) => e.melee)).toBe(true);
  });

  test("a blow carries the damage it took and where it landed", () => {
    const events = battleEvents();
    const hit = events.find((e) => e.type === "hit")!;
    const [effect] = effectsOf([hit], 0, params);
    expect(effect).toEqual({
      kind: "hit",
      id: hit.target.id,
      cell: hit.cell,
      damage: hit.damage,
      at: 0,
    });
  });

  test("who dies bursts where the blow landed; who flees, at its last cell (C13)", () => {
    const a = { id: 1, side: 0, dna: "square" as const, name: "Ária" };
    const b = { id: 2, side: 1, dna: "circle" as const, name: "Brasa" };
    const last = new Map([
      [1, 40],
      [2, 77],
    ]);
    const effects = effectsOf(
      [
        {
          type: "hit",
          by: b,
          target: a,
          damage: 24,
          hp: 0,
          cell: 41,
          tick: 9,
          index: 0,
        },
        { type: "died", participant: a, by: b, tick: 9, index: 1 },
        {
          type: "escaped",
          participant: b,
          reason: "edge",
          hp: 120,
          carry: { materia: 0, cristal: 0 },
          tick: 9,
          index: 2,
        },
      ],
      500,
      params,
      last,
    );
    expect(effects.filter((e) => e.kind !== "hit")).toEqual([
      {
        kind: "death",
        id: 1,
        side: 0,
        dna: "square",
        name: "Ária",
        cell: 41,
        at: 500,
      },
      {
        kind: "escape",
        id: 2,
        side: 1,
        dna: "circle",
        name: "Brasa",
        reason: "edge",
        cell: 77,
        at: 500,
      },
    ]);
    // With no cell known (no frame before), there is no signal.
    const none = effectsOf(
      [
        {
          type: "escaped",
          participant: b,
          reason: "idle",
          hp: 120,
          carry: { materia: 0, cristal: 0 },
          tick: 9,
          index: 0,
        },
      ],
      500,
      params,
    );
    expect(none).toEqual([]);
  });

  test("a real battle's end signals its fallen", () => {
    const events = battleEvents();
    const deaths = events.filter((e) => e.type === "died");
    expect(deaths.length).toBeGreaterThan(0);
    const fx = effectsOf(events, 0, params).filter((e) => e.kind === "death");
    expect(fx).toHaveLength(deaths.length);
  });

  test("each fades over its time, then leaves", () => {
    const [miss] = effectsOf(
      [
        {
          type: "missed",
          by: { id: 1, side: 0, dna: "circle", name: "x" },
          cell: 5,
          dir: "up",
          tick: 0,
          index: 0,
        },
      ],
      100,
      params,
    );
    expect(effectProgress(miss!, 100)).toBe(0);
    expect(effectProgress(miss!, 100 + EFFECT_MS.miss / 2)).toBe(0.5);
    expect(liveEffects([miss!], 100 + EFFECT_MS.miss - 1)).toHaveLength(1);
    expect(liveEffects([miss!], 100 + EFFECT_MS.miss)).toHaveLength(0);
  });
});

describe("the battle's idle clock on the page (spec D9, L-8)", () => {
  test("warns after 2/3 of the timeout, during the fight only", () => {
    const state = createBattle(
      setupOf(defaultDraft(), LAB_KITS, LAB_ARENAS.pedras),
      params,
    );
    // Nobody does anything: no gambits.
    for (const p of state.participants) p.gambits = [];
    const timeout = params.inactivity.timeoutMs / 50;
    for (let i = 0; i < (timeout * 2) / 3 - 1; i++) stepBattle(state, []);
    expect(idleWarning(battleView(state), params)).toBe(false);
    stepBattle(state, []);
    stepBattle(state, []);
    expect(idleWarning(battleView(state), params)).toBe(true);
  });
});
