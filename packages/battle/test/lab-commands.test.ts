import { describe, expect, test } from "vitest";
import { validateCommand } from "../src/commands.ts";
import { copyGambits, type Gambit } from "../src/gambits.ts";
import { nextInt } from "../src/rng.ts";
import { createBattle } from "../src/setup.ts";
import type { BattleState } from "../src/state.ts";
import { stepBattle } from "../src/step.ts";
import {
  battleOn,
  FIELD,
  humans,
  member,
  paramsWith,
  setupOf,
  xyOf,
} from "./helpers.ts";

/** FIELD with a third entry stretch, one cell on the top lap. */
const THREE = [
  ".........",
  "....3....",
  ".1.....2.",
  ".1.....2.",
  ".1.....2.",
  ".........",
  ".........",
];

const byId = (state: BattleState, id: number) =>
  state.participants.find((p) => p.id === id)!;

describe("control (spec D12)", () => {
  test("hands a participant to the human; several may be human at once", () => {
    const state = battleOn(FIELD, [["square", "circle"], ["circle"]]);
    const first = stepBattle(state, [
      { type: "control", id: 1, controller: "human" },
    ]);
    expect(first).toEqual([
      {
        type: "controlChanged",
        participant: { id: 1, side: 0, dna: "square", name: "square" },
        controller: "human",
        tick: 0,
        index: 0,
      },
    ]);
    stepBattle(state, [{ type: "intent", id: 1, move: "up", attack: true }]);
    const second = stepBattle(state, [
      { type: "control", id: 3, controller: "human" },
    ]);
    expect(
      second.map(
        (e) => e.type === "controlChanged" && [e.participant.id, e.controller],
      ),
    ).toEqual([[3, "human"]]);
    // Two players in one world battle each keep theirs (junction D12).
    expect(state.participants.map((p) => p.controller)).toEqual([
      "human",
      "gambits",
      "human",
    ]);
    stepBattle(state, [{ type: "control", id: 1, controller: "gambits" }]);
    // The released one stops, and the gambits decided on this very tick (an
    // empty list: stand still); the next decision is a reaction time away.
    expect(byId(state, 1).intent).toMatchObject({ move: null, attack: false });
    const next = byId(state, 1).ai.nextDecisionTick;
    expect(next).toBeGreaterThanOrEqual(2 + 3);
    expect(next).toBeLessThanOrEqual(2 + 7);
  });

  test("giving it back to the gambits; the same controller is a no-op", () => {
    const state = battleOn(FIELD, [["square"], ["circle"]]);
    stepBattle(state, [{ type: "control", id: 1, controller: "human" }]);
    expect(
      stepBattle(state, [{ type: "control", id: 1, controller: "human" }]),
    ).toEqual([]);
    const events = stepBattle(state, [
      { type: "control", id: 1, controller: "gambits" },
    ]);
    expect(events).toMatchObject([{ controller: "gambits" }]);
    expect(validateCommand(state, { type: "face", id: 1, dir: "up" })).toBe(
      "participant 1 is not under human control",
    );
  });

  test.each<[unknown, string]>([
    [
      { type: "control", id: 9, controller: "human" },
      "no participant 9 in the arena",
    ],
    [
      { type: "control", id: 1, controller: "bot" },
      "controller must be gambits or human",
    ],
  ])("refuses %j", (command, reason) => {
    const state = battleOn(FIELD, [["square"], ["circle"]]);
    expect(validateCommand(state, command)).toBe(reason);
  });
});

describe("setGambits (spec L-7)", () => {
  const all: Gambit[] = [
    {
      when: { type: "always" },
      then: { type: "attack", target: { by: "nearest" } },
    },
    { when: { type: "hpBelow", permille: 250 }, then: { type: "flee" } },
    {
      when: { type: "enemyWithin", cells: 4, dna: "circle" },
      then: { type: "drop" },
    },
    {
      when: { type: "enemyAligned" },
      then: { type: "approach", target: { by: "weakest" } },
    },
    { when: { type: "projectileIncoming" }, then: { type: "dodge" } },
    { when: { type: "carryAbove", permille: 500 }, then: { type: "pickup" } },
    {
      when: { type: "allyHpBelow", permille: 500, cells: 4 },
      then: { type: "protect" },
    },
    {
      when: { type: "always" },
      then: { type: "keepDistance", target: { by: "dna", dna: "square" } },
    },
  ];

  test("takes the whole vocabulary, copied field by field", () => {
    const state = humans(battleOn(FIELD, [["square"], ["circle"]]));
    const sent = all.map((g) => ({
      ...g,
      note: "x",
      when: { ...g.when, extra: 1 },
      then: { ...g.then, extra: 2 },
    }));
    // Any participant, dominated or not: it keeps the list for when it is released.
    stepBattle(state, [{ type: "setGambits", id: 1, gambits: sent }]);
    expect(byId(state, 1).gambits).toEqual(all);
    expect(byId(state, 2).gambits).toEqual([]);
  });

  test("replaces the list whole, never mutating the old one", () => {
    const state = battleOn(FIELD, [["square"], ["circle"]]);
    stepBattle(state, [{ type: "setGambits", id: 1, gambits: all }]);
    const before = byId(state, 1).gambits;
    stepBattle(state, [
      { type: "setGambits", id: 1, gambits: all.slice(0, 2) },
    ]);
    expect(before).toHaveLength(8);
    expect(byId(state, 1).gambits).toHaveLength(2);
  });

  test.each<[unknown, string]>([
    [null, "gambits must be a list"],
    [[...all, all[0]], "at most 8 gambits"],
    [[3], "gambit 0: expected an object"],
    [
      [{ when: { type: "hpBelow", permille: 1001 }, then: { type: "flee" } }],
      "gambit 0: invalid condition",
    ],
    [
      [{ when: { type: "enemyWithin", cells: -1 }, then: { type: "flee" } }],
      "gambit 0: invalid condition",
    ],
    [
      [
        {
          when: { type: "enemyWithin", cells: 3, dna: "hexagon" },
          then: { type: "flee" },
        },
      ],
      "gambit 0: invalid condition",
    ],
    [
      [{ when: { type: "sometimes" }, then: { type: "flee" } }],
      "gambit 0: invalid condition",
    ],
    [
      [
        all[0],
        {
          when: { type: "always" },
          then: { type: "attack", target: { by: "dna", dna: "hexagon" } },
        },
      ],
      "gambit 1: invalid action",
    ],
    [
      [{ when: { type: "always" }, then: { type: "dance" } }],
      "gambit 0: invalid action",
    ],
  ])("refuses %j: %s", (gambits, reason) => {
    expect(copyGambits(gambits, 8)).toBe(reason);
    const state = battleOn(FIELD, [["square"], ["circle"]]);
    expect(validateCommand(state, { type: "setGambits", id: 1, gambits })).toBe(
      reason,
    );
  });
});

describe("join (spec E-1, D11)", () => {
  const newcomer = { ...member("triangle"), name: "Novo" };

  test("puts the newcomer on a free cell of its side's stretch, drawn by the rng", () => {
    const state = battleOn(FIELD, [["square"], ["circle"]]);
    const rng = structuredClone(state.rng);
    const taken = byId(state, 1).cell;
    const free = [2, 3, 4].map((y) => y * 9 + 1).filter((c) => c !== taken);
    const expected = free[nextInt(rng, free.length)]!;
    const events = stepBattle(state, [
      { type: "join", side: 0, participant: { ...newcomer, extra: 1 } },
    ]);
    expect(events).toEqual([
      {
        type: "joined",
        participant: { id: 3, side: 0, dna: "triangle", name: "Novo" },
        cell: expected,
        tick: 0,
        index: 0,
      },
    ]);
    expect(byId(state, 3)).toMatchObject({
      cell: expected,
      facing: "right",
      hp: 200,
      controller: "gambits",
      gambits: [],
    });
    expect(byId(state, 3)).not.toHaveProperty("extra");
    expect(state.totals.map((t) => t.id)).toEqual([1, 2, 3]);
  });

  test("a new side takes the first stretch nobody in the arena uses", () => {
    const state = battleOn(THREE, [["square"], ["circle"]]);
    stepBattle(state, [{ type: "join", side: 2, participant: newcomer }]);
    expect(state.sides).toEqual([
      { id: 0, entry: 0 },
      { id: 1, entry: 1 },
      { id: 2, entry: 2 },
    ]);
    expect(xyOf(state, 3)).toEqual([4, 1]);
    expect(byId(state, 3).facing).toBe("down");
  });

  test("a side with nobody left cannot be joined; its stretch goes to a new side", () => {
    const state = battleOn(THREE, [["square"], ["circle"], ["triangle"]]);
    state.participants = state.participants.filter((p) => p.side !== 1);
    expect(
      validateCommand(state, { type: "join", side: 1, participant: newcomer }),
    ).toBe("side 1 has nobody in the arena");
    stepBattle(state, [{ type: "join", side: 3, participant: newcomer }]);
    expect(state.sides[3]).toEqual({ id: 3, entry: 1 });
    expect(xyOf(state, 4)[0]).toBe(7);
  });

  test.each<[string, number, unknown, string]>([
    [
      "a side out of range",
      4,
      newcomer,
      "side must be an integer in 0..3 (3 is a new side)",
    ],
    [
      "an invalid newcomer",
      0,
      { ...newcomer, hp: 0 },
      "Novo: HP must be an integer in 1..200",
    ],
    [
      "a full stretch",
      2,
      newcomer,
      "side 2: no free cell on its entry stretch",
    ],
  ])("refuses %s", (_, side, participant, reason) => {
    const state = battleOn(THREE, [["square"], ["circle"], ["triangle"]]);
    expect(validateCommand(state, { type: "join", side, participant })).toBe(
      reason,
    );
  });

  test("respects the limits of sides and participants per side", () => {
    const params = paramsWith((p) => {
      p.limits.maxSides = 2;
      p.limits.maxPerSide = 1;
    });
    const state = createBattle(
      setupOf(THREE, [[member("square")], [member("circle")]]),
      params,
    );
    expect(
      validateCommand(state, { type: "join", side: 0, participant: newcomer }),
    ).toBe("side 0: at most 1 participants");
    expect(
      validateCommand(state, { type: "join", side: 2, participant: newcomer }),
    ).toBe("at most 2 sides");
  });

  test("the lab's commands never come from the gambits", () => {
    const state = battleOn(FIELD, [["square"], ["circle"]]);
    for (const command of [
      { type: "join", side: 0, participant: newcomer },
      { type: "control", id: 1, controller: "human" },
      { type: "setGambits", id: 1, gambits: [] },
    ]) {
      expect(validateCommand(state, command, "gambits")).toBe(
        `only the lab can ${command.type}`,
      );
    }
  });
});
