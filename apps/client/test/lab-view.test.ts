import {
  battleView,
  createBattle,
  defaultGambits,
  parseBattleParams,
  presetGambits,
  setupIssue,
  stepBattle,
  type BattleEvent,
} from "@geometrix/battle";
import { describe, expect, test } from "vitest";
import paramsJson from "../../../packages/battle/test/params.json?raw";
import { LAB_ARENAS, LAB_PARAMS } from "../src/lab/assets.ts";
import { countdownSeconds } from "../src/lab/arena-view.tsx";
import {
  defaultDraft,
  idOfPlace,
  member,
  namesUsed,
  participantOf,
  setupOf,
  youOf,
} from "../src/lab/draft.ts";
import { eventLines, eventText } from "../src/lab/events-list.tsx";
import { actionOf, conditionOf, moved } from "../src/lab/gambits-editor.tsx";
import { labName } from "../src/lab/labels.ts";

const params = parseBattleParams(JSON.parse(paramsJson));

describe("the lab's assets", () => {
  test("the params and the three arenas of params/ load and parse", () => {
    expect(LAB_PARAMS.tick.ticksPerSecond).toBe(20);
    for (const rows of Object.values(LAB_ARENAS)) {
      expect([rows[0]!.length, rows.length]).toEqual([45, 29]);
    }
  });
});

describe("the setup draft (spec L-1)", () => {
  test("the default draft is a valid 1 × 1 on every arena", () => {
    for (const arena of Object.values(LAB_ARENAS)) {
      expect(setupIssue(setupOf(defaultDraft(), params, arena), params)).toBe(
        null,
      );
    }
  });

  test("HP in per mille, load up to the capacity, the preset's list, the reaction", () => {
    const draft = {
      ...member("circle"),
      hpPermille: 250,
      materia: 99,
      preset: "carrier" as const,
      reaction: "hard" as const,
    };
    expect(participantOf(draft, params, 3)).toEqual({
      name: "Duna",
      dna: "circle",
      hp: 30,
      carry: { materia: 10, cristal: 0 },
      gambits: presetGambits("carrier"),
      reaction: "hard",
    });
  });

  test("names follow the setup order, and reinforcements take the next", () => {
    const draft = {
      ...defaultDraft(),
      sides: [[member("square"), member("square")], [member("circle")]],
    };
    const setup = setupOf(draft, params, LAB_ARENAS.aberta);
    expect(setup.sides.flat().map((p) => p.name)).toEqual([
      "Ária",
      "Brasa",
      "Cobre",
    ]);
    expect(namesUsed(draft)).toBe(3);
    expect(labName(20)).toBe("Ária 2");
  });

  test("the owner dominates by default the first participant, by its id", () => {
    const draft = {
      ...defaultDraft(),
      sides: [[member("square"), member("triangle")], [member("circle")]],
      you: 2,
    };
    const state = createBattle(
      setupOf(draft, params, LAB_ARENAS.pedras),
      params,
    );
    const id = idOfPlace(youOf(draft)!);
    expect(state.participants.find((p) => p.id === id)!.name).toBe("Cobre");
    expect(youOf(defaultDraft())).toBe(0);
    // Just watching, or a place taken out of the setup: back to the first.
    expect(youOf({ ...draft, you: null })).toBe(null);
    expect(youOf({ ...draft, you: 7 })).toBe(0);
  });

  test("a new member takes its DNA's default preset", () => {
    expect(member("triangle").preset).toBe("skirmisher");
    expect(participantOf(member("square"), params, 0).gambits).toEqual(
      defaultGambits("square"),
    );
  });
});

describe("the start countdown on the arena (spec D21)", () => {
  test("its seconds go 3, 2, 1 and then it is gone", () => {
    const lab = parseBattleParams({
      ...JSON.parse(paramsJson),
      start: { countdownMs: 3000 },
    });
    const state = createBattle(
      setupOf(defaultDraft(), lab, LAB_ARENAS.pedras),
      lab,
    );
    const seconds: number[] = [];
    for (let tick = 0; tick <= 61; tick++) {
      seconds.push(countdownSeconds(battleView(state), 20));
      stepBattle(state, []);
    }
    expect(seconds.slice(0, 2)).toEqual([3, 3]);
    expect(seconds[20]).toBe(2);
    expect(seconds[40]).toBe(1);
    expect(seconds[59]).toBe(1);
    expect(seconds.slice(60)).toEqual([0, 0]);
  });
});

describe("the events list (spec D19)", () => {
  test("a real battle's events read as lines, newest first, without the attacks", () => {
    const state = createBattle(
      setupOf(defaultDraft(), params, LAB_ARENAS.aberta),
      params,
    );
    const events: BattleEvent[] = [];
    while (state.ended === null) events.push(...stepBattle(state, []));
    const lines = eventLines(events, 20);
    expect(lines.length).toBe(
      events.filter((e) => e.type !== "attacked").length,
    );
    expect(lines[0]!.text).toMatch(/^fim: /);
    expect(lines.some((l) => /acerta .*: −\d+ \(\d+\)$/.test(l.text))).toBe(
      true,
    );
    expect(battleView(state).ended).not.toBeNull();
  });

  test("each kind of event says who, with the side and the shape", () => {
    const ref = { id: 1, side: 1, dna: "circle" as const, name: "Brasa" };
    const base = { tick: 0, index: 0 };
    expect(
      eventText({
        ...base,
        type: "escaped",
        participant: ref,
        reason: "idle",
        hp: 1,
        carry: { materia: 0, cristal: 0 },
      }),
    ).toBe("Brasa (B ●) foge por inatividade");
    expect(
      eventText({
        ...base,
        type: "controlChanged",
        participant: ref,
        controller: "human",
      }),
    ).toBe("você domina Brasa (B ●)");
    expect(
      eventText({
        ...base,
        type: "ended",
        winnerSide: null,
        results: [],
        piles: [],
      }),
    ).toBe("fim: ninguém vence");
  });
});

describe("the gambits editor (spec L-7)", () => {
  test("a condition or action of a new type starts from the presets' numbers", () => {
    expect(conditionOf("hpBelow")).toEqual({ type: "hpBelow", permille: 250 });
    expect(conditionOf("allyHpBelow")).toEqual({
      type: "allyHpBelow",
      permille: 500,
      cells: 4,
    });
    expect(actionOf("dodge")).toEqual({ type: "dodge" });
    // Switching between actions with a target keeps the target.
    expect(
      actionOf("approach", { type: "attack", target: { by: "weakest" } }),
    ).toEqual({ type: "approach", target: { by: "weakest" } });
  });

  test("reorders a rule up or down, and stays put at the ends", () => {
    expect(moved([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(moved([1, 2, 3], 2, -1)).toEqual([1, 3, 2]);
    expect(moved([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
  });
});
