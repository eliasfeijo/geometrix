import { describe, expect, test } from "vitest";
import {
  actionCommands,
  battleView,
  createMind,
  stepBattle,
  validateCommand,
  type Action,
  type BattleState,
  type Gambit,
  type Reaction,
} from "@geometrix/battle";
import { battleOn, FIELD, member, put } from "./helpers.ts";

const byId = (state: BattleState, id: number) =>
  state.participants.find((p) => p.id === id)!;

/** Field with a wall in the middle column, rows 2 to 4. */
const WALL = [
  ".........",
  ".........",
  ".1..#..2.",
  ".1..#..2.",
  ".1..#..2.",
  ".........",
  ".........",
];

/** Participant `id` decides on the next step with these gambits. */
function give(state: BattleState, id: number, gambits: Gambit[]): void {
  byId(state, id).gambits = gambits;
}

describe("evaluation (spec G-1)", () => {
  test("the first rule that holds and can be done gives the intent", () => {
    const state = battleOn(FIELD, [["square"], ["circle"]]);
    byId(state, 2).controller = "human";
    put(state, 1, 2, 3);
    put(state, 2, 6, 3);
    give(state, 1, [
      // Does not hold: full HP.
      { when: { type: "hpBelow", permille: 250 }, then: { type: "flee" } },
      // Holds, but there is nothing to drop: the next rule is tried.
      { when: { type: "always" }, then: { type: "drop" } },
      {
        when: { type: "always" },
        then: { type: "approach", target: { by: "nearest" } },
      },
      { when: { type: "always" }, then: { type: "flee" } },
    ]);
    stepBattle(state, []);
    expect(byId(state, 1).intent).toMatchObject({
      move: "right",
      attack: false,
    });
  });

  test("with no rule that holds and can be done, it stands still", () => {
    const state = battleOn(FIELD, [["square"], ["circle"]]);
    byId(state, 2).controller = "human";
    byId(state, 1).intent.move = "up";
    byId(state, 1).intent.attack = true;
    give(state, 1, [{ when: { type: "always" }, then: { type: "drop" } }]);
    stepBattle(state, []);
    expect(byId(state, 1).intent).toMatchObject({ move: null, attack: false });
  });

  test("a participant under the human is left alone", () => {
    const state = battleOn(FIELD, [["square"], ["circle"]]);
    byId(state, 1).controller = "human";
    byId(state, 2).controller = "human";
    give(state, 1, [{ when: { type: "always" }, then: { type: "flee" } }]);
    stepBattle(state, [
      { type: "intent", id: 1, move: "right", attack: false },
    ]);
    expect(byId(state, 1).intent.move).toBe("right");
    expect(byId(state, 1).ai.nextDecisionTick).toBe(0);
  });
});

describe("reaction time (plan P12)", () => {
  /** The gaps between the decisions of participant 1, over 250 ticks. */
  function decisionGaps(reaction: Reaction): number[] {
    const state = battleOn(FIELD, [
      [member("circle", { reaction })],
      ["square"],
    ]);
    byId(state, 2).controller = "human";
    give(state, 1, [{ when: { type: "always" }, then: { type: "dodge" } }]);
    const decisions: number[] = [];
    for (let i = 0; i < 250; i++) {
      if (byId(state, 1).ai.nextDecisionTick === state.tick) {
        decisions.push(state.tick);
      }
      stepBattle(state, []);
    }
    return decisions.slice(1).map((t, i) => t - decisions[i]!);
  }

  test.each<[Reaction, number, number]>([
    // 600 ms ± 250 ms at 20 ticks per second: 7 to 17 ticks.
    ["easy", 7, 17],
    // 250 ms ± 100 ms: 3 to 7 ticks.
    ["normal", 3, 7],
    // 100 ms ± 50 ms: 1 to 3 ticks.
    ["hard", 1, 3],
  ])(
    "a %s participant decides every %i to %i ticks (spec D20)",
    (reaction, min, max) => {
      const gaps = decisionGaps(reaction);
      expect(Math.min(...gaps)).toBe(min);
      expect(Math.max(...gaps)).toBe(max);
    },
  );

  test("decides every decisionMs ± jitter, keeping the intent in between", () => {
    const state = battleOn(FIELD, [["circle"], ["square"]]);
    byId(state, 2).controller = "human";
    put(state, 2, 7, 3);
    give(state, 1, [
      {
        when: { type: "always" },
        then: { type: "approach", target: { by: "nearest" } },
      },
    ]);
    const decisions: number[] = [];
    let intent = { ...byId(state, 1).intent };
    for (let i = 0; i < 250; i++) {
      const due = byId(state, 1).ai.nextDecisionTick === state.tick;
      if (due) decisions.push(state.tick);
      const before = { ...byId(state, 1).intent };
      stepBattle(state, []);
      // Between decisions the intent stays what the last one set.
      if (!due) expect(before).toEqual(intent);
      intent = { ...byId(state, 1).intent };
    }
    const gaps = decisions.slice(1).map((t, i) => t - decisions[i]!);
    // 250 ms ± 100 ms at 20 ticks per second: 3 to 7 ticks.
    expect(Math.min(...gaps)).toBe(3);
    expect(Math.max(...gaps)).toBe(7);
    expect(decisions[0]).toBe(0);
  });
});

describe("targets (plan section 9)", () => {
  test("the nearest is the nearest in steps around rock", () => {
    const state = battleOn(WALL, [
      [member("square", { gambits: [] })],
      ["circle", "triangle"],
    ]);
    byId(state, 2).controller = "human";
    byId(state, 3).controller = "human";
    put(state, 1, 3, 3);
    put(state, 2, 5, 3); // 2 cells away, 6 steps around the wall
    put(state, 3, 3, 6); // 3 cells and 3 steps away
    give(state, 1, [
      {
        when: { type: "always" },
        then: { type: "approach", target: { by: "nearest" } },
      },
    ]);
    stepBattle(state, []);
    expect(byId(state, 1).ai.target).toBe(3);
    expect(byId(state, 1).intent.move).toBe("down");
  });

  test("the weakest is the smallest share of HP, not the least HP", () => {
    const state = battleOn(FIELD, [
      ["triangle"],
      [member("square", { hp: 150 }), member("circle", { hp: 72 })],
    ]);
    give(state, 1, [
      {
        when: { type: "always" },
        then: { type: "attack", target: { by: "weakest" } },
      },
    ]);
    byId(state, 2).controller = "human";
    byId(state, 3).controller = "human";
    stepBattle(state, []);
    // 150 of 300 is 500‰; 72 of 120 is 600‰.
    expect(byId(state, 1).ai.target).toBe(2);
  });

  test("by DNA: the nearest of the DNA; none of it, and the rule passes", () => {
    const state = battleOn(FIELD, [["triangle"], ["square", "circle"]]);
    byId(state, 2).controller = "human";
    byId(state, 3).controller = "human";
    put(state, 1, 3, 3);
    put(state, 2, 4, 3);
    put(state, 3, 7, 5);
    give(state, 1, [
      {
        when: { type: "always" },
        then: { type: "approach", target: { by: "dna", dna: "triangle" } },
      },
      {
        when: { type: "always" },
        then: { type: "approach", target: { by: "dna", dna: "circle" } },
      },
    ]);
    stepBattle(state, []);
    expect(byId(state, 1).ai.target).toBe(3);
  });

  /** A square between two circles two steps away, above and below. */
  function tie(seed: number): BattleState {
    const state = battleOn(FIELD, [["square"], ["circle", "circle"]], seed);
    byId(state, 2).controller = "human";
    byId(state, 3).controller = "human";
    put(state, 1, 4, 3);
    put(state, 2, 4, 1);
    put(state, 3, 4, 5);
    give(state, 1, [
      {
        when: { type: "always" },
        then: { type: "approach", target: { by: "nearest" } },
      },
    ]);
    return state;
  }

  test("a tie keeps the previous target", () => {
    for (const previous of [2, 3]) {
      const state = tie(7);
      byId(state, 1).ai.target = previous;
      stepBattle(state, []);
      expect(byId(state, 1).ai.target).toBe(previous);
    }
  });

  test("a tie with no previous target is drawn by the rng, never by id", () => {
    const chosen = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      const state = tie(seed);
      stepBattle(state, []);
      chosen.add(byId(state, 1).ai.target!);
    }
    expect([...chosen].sort()).toEqual([2, 3]);
  });
});

describe("the view", () => {
  test("is a copy: stepping does not change a view already taken", () => {
    const state = battleOn(FIELD, [["square"], ["circle"]]);
    const view = battleView(state);
    const before = JSON.stringify(view);
    for (const p of state.participants) p.controller = "human";
    stepBattle(state, [{ type: "intent", id: 1, move: "right", attack: true }]);
    for (let i = 0; i < 20; i++) stepBattle(state, []);
    expect(JSON.stringify(view)).toBe(before);
    expect(Object.keys(view.participants[0]!).sort()).toEqual([
      "carry",
      "cell",
      "controller",
      "cooldownTicks",
      "dna",
      "exitTicks",
      "facing",
      "hp",
      "id",
      "idleTicks",
      "name",
      "reaction",
      "side",
    ]);
  });
});

describe("the AI speaks the human's commands (spec G-2)", () => {
  const actions: Action[] = [
    { type: "attack", target: { by: "nearest" } },
    { type: "approach", target: { by: "weakest" } },
    { type: "keepDistance", target: { by: "dna", dna: "square" } },
    { type: "flee" },
    { type: "drop" },
    { type: "pickup" },
  ];

  test("every command of an action passes the gambits' validation", () => {
    const state = battleOn(FIELD, [
      [member("circle", { carry: { materia: 4, cristal: 0 } })],
      ["square"],
    ]);
    state.piles.push({ id: 99, cell: 3 * 9 + 4, materia: 2, cristal: 0 });
    const participant = byId(state, 1);
    for (const action of actions) {
      const mind = createMind(state, battleView(state), participant);
      const commands = actionCommands(mind, action, { type: "always" });
      expect(commands, action.type).not.toBeNull();
      for (const command of commands!) {
        expect(validateCommand(state, command, "gambits")).toBeNull();
      }
    }
  });
});
