import { describe, expect, test } from "vitest";
import { parseArena } from "../src/arena.ts";
import {
  BattleSetupError,
  createBattle,
  setupIssue,
  type BattleSetup,
} from "../src/setup.ts";
import { CELL_COST } from "../src/params.ts";
import { BATTLE_VERSION } from "../src/state.ts";
import { loadTestParams, member, readArenaRows, setupOf } from "./helpers.ts";

const params = loadTestParams();
const aberta = readArenaRows("aberta");

describe("createBattle (spec S-1)", () => {
  const setup = setupOf(aberta, [
    [member("square", { name: "Ana" }), member("circle", { hp: 60 })],
    [member("triangle", { carry: { materia: 5, cristal: 3 } })],
  ]);
  const state = createBattle(setup, params);
  const arena = parseArena(aberta);

  test("starts at tick 0, version 1, with each side on its own stretch", () => {
    expect(state.battleVersion).toBe(BATTLE_VERSION);
    expect(state.tick).toBe(0);
    expect(state.sides).toEqual([
      { id: 0, entry: 0 },
      { id: 1, entry: 1 },
    ]);
    expect(state.ended).toBeNull();
    expect([state.projectiles, state.piles, state.departed]).toEqual([
      [],
      [],
      [],
    ]);
  });

  test("ids follow setup order, side by side", () => {
    expect(state.participants.map((p) => [p.id, p.side, p.dna])).toEqual([
      [1, 0, "square"],
      [2, 0, "circle"],
      [3, 1, "triangle"],
    ]);
    expect(state.nextId).toBe(4);
    expect(state.totals).toEqual(
      [1, 2, 3].map((id) => ({ id, dealt: 0, taken: 0 })),
    );
  });

  test("everyone is on a distinct free cell of the side's stretch, facing inward", () => {
    const cells = state.participants.map((p) => p.cell);
    expect(new Set(cells).size).toBe(3);
    for (const p of state.participants) {
      expect(arena.entries[p.side]!.cells).toContain(p.cell);
      expect(p.facing).toBe(p.side === 0 ? "right" : "left");
    }
  });

  test("with the setup's HP and carry, under the gambits, standing still", () => {
    const [ana, circle, triangle] = state.participants;
    expect(ana!.name).toBe("Ana");
    expect(ana!.hp).toBe(300);
    expect(circle!.hp).toBe(60);
    // Max HP and capacity are the setup's (junction spec D9).
    expect([ana!.maxHp, ana!.capacity]).toEqual([300, 30]);
    expect([circle!.maxHp, circle!.capacity]).toEqual([120, 10]);
    expect(triangle!.carry).toEqual({ materia: 5, cristal: 3 });
    expect(triangle!.carry).not.toBe(setup.sides[1]![0]!.carry);
    for (const p of state.participants) {
      expect(p.controller).toBe("gambits");
      expect(p.intent.move).toBeNull();
      // The first step is ready (D22).
      expect([p.movePoints, p.cooldownTicks, p.exitTicks]).toEqual([
        CELL_COST,
        0,
        0,
      ]);
    }
  });

  test("the spawn cells come from the seed", () => {
    const cellsFor = (seed: number) =>
      createBattle({ ...setup, seed }, params).participants.map((p) => p.cell);
    expect(cellsFor(7)).toEqual(cellsFor(7));
    const seen = new Set(
      Array.from({ length: 200 }, (_, seed) => cellsFor(seed)[0]),
    );
    // Every cell of stretch 1 gets drawn for the first participant.
    expect([...seen].sort((a, b) => a - b)).toEqual(arena.entries[0]!.cells);
  });

  test("up to four sides, each on its stretch", () => {
    const four = createBattle(
      setupOf(aberta, [
        [member("square")],
        [member("square")],
        [member("circle")],
        [member("triangle")],
      ]),
      params,
    );
    expect(four.participants.map((p) => p.facing)).toEqual([
      "right",
      "left",
      "down",
      "up",
    ]);
  });
});

describe("invalid setups (spec S-2)", () => {
  const tiny = [
    ".......",
    ".......",
    ".1...2.",
    ".1...2.",
    ".......",
    ".......",
  ];
  const valid = setupOf(tiny, [[member("square")], [member("circle")]]);
  const cases: [string, BattleSetup, string][] = [
    [
      "one side",
      { ...valid, sides: [[member("square")]] },
      "at least two sides",
    ],
    [
      "more sides than stretches",
      {
        ...valid,
        sides: [[member("square")], [member("square")], [member("square")]],
      },
      "side 2 has no entry stretch",
    ],
    [
      "more sides than the limit",
      setupOf(
        aberta,
        Array.from({ length: 5 }, () => [member("square")]),
      ),
      "at most 4 sides",
    ],
    [
      "an empty side",
      { ...valid, sides: [[member("square")], []] },
      "side 1 has no participants",
    ],
    [
      "more than the limit per side",
      setupOf(aberta, [
        Array.from({ length: 6 }, () => member("circle")),
        [member("square")],
      ]),
      "side 0: at most 5 participants",
    ],
    [
      "more participants than entry cells",
      {
        ...valid,
        sides: [
          [member("square"), member("square"), member("square")],
          [member("circle")],
        ],
      },
      "side 0: 3 participants for 2 entry cells",
    ],
    [
      "HP 0",
      setupOf(tiny, [[member("square", { hp: 0 })], [member("circle")]]),
      "HP must be an integer in 1..300",
    ],
    [
      "HP above the maximum",
      setupOf(tiny, [[member("square")], [member("circle", { hp: 121 })]]),
      "1..120",
    ],
    [
      "carry above the capacity",
      setupOf(tiny, [
        [member("circle", { carry: { materia: 6, cristal: 5 } })],
        [member("square")],
      ]),
      "carry above the capacity of 10",
    ],
    [
      "max HP 0",
      setupOf(tiny, [[member("square", { maxHp: 0 })], [member("circle")]]),
      "max HP must be a positive integer",
    ],
    [
      "max HP not an integer",
      setupOf(tiny, [[member("square", { maxHp: 2.5 })], [member("circle")]]),
      "max HP must be a positive integer",
    ],
    [
      "capacity 0",
      setupOf(tiny, [[member("square", { capacity: 0 })], [member("circle")]]),
      "capacity must be a positive integer",
    ],
    [
      "carry above a capacity the setup lowered",
      setupOf(tiny, [
        [member("square", { capacity: 4, carry: { materia: 5, cristal: 0 } })],
        [member("circle")],
      ]),
      "carry above the capacity of 4",
    ],
    [
      "negative carry",
      setupOf(tiny, [
        [member("circle", { carry: { materia: -1, cristal: 0 } })],
        [member("square")],
      ]),
      "non-negative integer",
    ],
    [
      "unknown DNA",
      setupOf(tiny, [[member("hexagon" as "square")], [member("square")]]),
      "unknown DNA hexagon",
    ],
    [
      "unknown reaction",
      setupOf(tiny, [
        [member("square", { reaction: "instant" as "hard" })],
        [member("square")],
      ]),
      "reaction must be easy, normal, hard",
    ],
    [
      "no name",
      setupOf(tiny, [[member("square", { name: "" })], [member("square")]]),
      "name must be",
    ],
    [
      "a bad arena",
      { ...valid, arena: [".....", "..1..", "....."] },
      "at least 5 × 5",
    ],
    [
      "an arena with no stretches",
      { ...valid, arena: Array(5).fill(".....") },
      "needs the spawn zones 1 and 2",
    ],
    ["a bad seed", { ...valid, seed: -1 }, "seed must be"],
    [
      "an unknown rule",
      { ...valid, rule: "free" as "grid" },
      "unknown rule free",
    ],
  ];

  test("the valid base is accepted", () => {
    expect(setupIssue(valid, params)).toBeNull();
  });

  test.each(cases)("refuses %s, with the reason", (_, setup, reason) => {
    expect(setupIssue(setup, params)).toContain(reason);
    expect(() => createBattle(setup, params)).toThrow(BattleSetupError);
    expect(() => createBattle(setup, params)).toThrow(reason);
  });
});
