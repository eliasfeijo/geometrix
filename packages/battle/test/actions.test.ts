import { describe, expect, test } from "vitest";
import {
  actionCommands,
  alignedDir,
  battleView,
  conditionHolds,
  createBattle,
  createMind,
  meleeReach,
  presetGambits,
  stepBattle,
  towards,
  type Action,
  type BattleState,
  type Condition,
  type Gambit,
} from "@geometrix/battle";
import {
  battleOn,
  FIELD,
  member,
  paramsWith,
  put,
  readArenaRows,
  run,
  setupOf,
  xyOf,
} from "./helpers.ts";

const byId = (state: BattleState, id: number) =>
  state.participants.find((p) => p.id === id)!;

const mindOf = (state: BattleState, id: number) =>
  createMind(state, battleView(state), byId(state, id));

const holds = (state: BattleState, id: number, condition: Condition) =>
  conditionHolds(mindOf(state, id), condition);

const commandsOf = (
  state: BattleState,
  id: number,
  action: Action,
  when: Condition = { type: "always" },
) => actionCommands(mindOf(state, id), action, when);

/** Everyone under the human but `ai`, which gets `gambits`. */
function only(state: BattleState, ai: number, gambits: Gambit[]): BattleState {
  for (const p of state.participants) {
    p.controller = p.id === ai ? "gambits" : "human";
  }
  byId(state, ai).gambits = gambits;
  return state;
}

const always = (then: Action): Gambit => ({ when: { type: "always" }, then });

/** An enemy projectile on `cell`, flying `dir`, owned by participant `owner`. */
function projectile(
  state: BattleState,
  owner: number,
  cell: number,
  dir: "up" | "down" | "left" | "right",
  cellsLeft = 5,
): void {
  const { side } = byId(state, owner);
  state.projectiles.push({
    id: state.nextId++,
    owner,
    side,
    cell,
    dir,
    points: 0,
    cellsLeft,
    damage: 20,
  });
}

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

const cellOf = (x: number, y: number, width = 9) => y * width + x;

describe("conditions (spec D14)", () => {
  test("always", () => {
    const state = battleOn(FIELD, [["square"], ["circle"]]);
    expect(holds(state, 1, { type: "always" })).toBe(true);
  });

  test("HP below X‰ of the maximum", () => {
    const state = battleOn(FIELD, [[member("square", { hp: 75 })], ["circle"]]);
    // 75 of 300 is exactly 250‰: not below it.
    expect(holds(state, 1, { type: "hpBelow", permille: 250 })).toBe(false);
    expect(holds(state, 1, { type: "hpBelow", permille: 251 })).toBe(true);
  });

  test("enemy within N cells, in steps around rock", () => {
    const state = battleOn(WALL, [["square"], ["circle"]]);
    put(state, 1, 3, 3);
    put(state, 2, 5, 3); // across the wall: 6 steps
    expect(holds(state, 1, { type: "enemyWithin", cells: 5 })).toBe(false);
    expect(holds(state, 1, { type: "enemyWithin", cells: 6 })).toBe(true);
  });

  test("enemy of a DNA within N cells: the others do not count", () => {
    const state = battleOn(FIELD, [["triangle"], ["circle", "square"]]);
    put(state, 1, 3, 3);
    put(state, 2, 4, 3); // the circle, next to it
    put(state, 3, 7, 1); // the square, 6 steps away
    const near = (dna: "circle" | "square", cells: number) =>
      holds(state, 1, { type: "enemyWithin", cells, dna });
    expect(near("circle", 1)).toBe(true);
    expect(near("square", 5)).toBe(false);
    expect(near("square", 6)).toBe(true);
  });

  test("enemy aligned within range, with a clear line", () => {
    const state = battleOn(WALL, [["triangle"], ["circle"]]);
    put(state, 1, 2, 3);
    put(state, 2, 6, 3); // in line, 4 cells: but the wall is between
    expect(holds(state, 1, { type: "enemyAligned" })).toBe(false);
    put(state, 2, 6, 1); // off the line
    put(state, 1, 2, 1);
    expect(holds(state, 1, { type: "enemyAligned" })).toBe(true);
    put(state, 1, 1, 1); // 5 cells: past the triangle's range of 4
    expect(holds(state, 1, { type: "enemyAligned" })).toBe(false);
  });

  test("an enemy projectile whose line passes through me", () => {
    const state = battleOn(FIELD, [["square", "circle"], ["triangle"]]);
    put(state, 1, 3, 3);
    put(state, 2, 3, 5);
    put(state, 3, 7, 1);
    projectile(state, 3, cellOf(6, 3), "left", 3);
    expect(holds(state, 1, { type: "projectileIncoming" })).toBe(true);
    // Its range ends before me.
    state.projectiles[0]!.cellsLeft = 2;
    expect(holds(state, 1, { type: "projectileIncoming" })).toBe(false);
    // Flying the other way, or an ally's.
    state.projectiles[0]!.cellsLeft = 5;
    state.projectiles[0]!.dir = "right";
    expect(holds(state, 1, { type: "projectileIncoming" })).toBe(false);
    state.projectiles[0]!.dir = "left";
    state.projectiles[0]!.side = 0;
    expect(holds(state, 1, { type: "projectileIncoming" })).toBe(false);
  });

  test("carry above X‰ of the capacity", () => {
    const state = battleOn(FIELD, [
      [member("triangle", { carry: { materia: 6, cristal: 4 } })],
      ["circle"],
    ]);
    // 10 of 20 is 500‰.
    expect(holds(state, 1, { type: "carryAbove", permille: 500 })).toBe(false);
    expect(holds(state, 1, { type: "carryAbove", permille: 499 })).toBe(true);
  });

  test("an ally with HP below X‰ within N cells, never myself", () => {
    const state = battleOn(FIELD, [
      [member("square", { hp: 100 }), member("circle", { hp: 50 })],
      ["triangle"],
    ]);
    put(state, 1, 2, 3);
    put(state, 2, 5, 3);
    const condition = { type: "allyHpBelow", permille: 500, cells: 3 } as const;
    expect(holds(state, 1, condition)).toBe(true);
    expect(holds(state, 1, { ...condition, cells: 2 })).toBe(false);
    // The circle is at 416‰; the square itself, at 333‰, is not its own ally.
    expect(holds(state, 1, { ...condition, permille: 400 })).toBe(false);
  });
});

describe("actions (spec D14)", () => {
  test("attack: goes until aligned, around rock, then fires and hits", () => {
    const state = only(battleOn(WALL, [["triangle"], ["square"]]), 1, [
      always({ type: "attack", target: { by: "nearest" } }),
    ]);
    put(state, 1, 2, 3);
    put(state, 2, 6, 3);
    const events = run(state, 120);
    // The only clear lines to the square go around the wall.
    expect(events.some((e) => e.type === "hit" && e.by.id === 1)).toBe(true);
    expect(xyOf(state, 1)[0]).toBeGreaterThan(4);
  });

  test("attack: never stops on the exit ring to fire", () => {
    const state = only(battleOn(FIELD, [["triangle"], ["square"]]), 1, [
      always({ type: "attack", target: { by: "nearest" } }),
    ]);
    // Aligned from the ring already: it steps in before firing.
    put(state, 1, 0, 3);
    put(state, 2, 3, 3);
    const events = run(state, 80);
    expect(events.some((e) => e.type === "escaped")).toBe(false);
    expect(events.some((e) => e.type === "hit" && e.by.id === 1)).toBe(true);
    expect(xyOf(state, 1)[0]).toBeGreaterThan(0);
  });

  test("attack, melee: goes next to the target and strikes", () => {
    const state = only(battleOn(FIELD, [["square"], ["circle"]]), 1, [
      always({ type: "attack", target: { by: "nearest" } }),
    ]);
    put(state, 1, 2, 3);
    put(state, 2, 6, 5);
    const events = run(state, 80);
    const [x, y] = xyOf(state, 1);
    expect(Math.abs(x - 6) + Math.abs(y - 5)).toBe(1);
    expect(events.filter((e) => e.type === "hit").length).toBeGreaterThan(0);
  });

  test("approach: next to the target, facing it, standing", () => {
    const state = only(battleOn(FIELD, [["circle"], ["square"]]), 1, [
      always({ type: "approach", target: { by: "nearest" } }),
    ]);
    put(state, 1, 2, 2);
    put(state, 2, 6, 4);
    run(state, 60);
    const [x, y] = xyOf(state, 1);
    expect(Math.abs(x - 6) + Math.abs(y - 4)).toBe(1);
    const me = byId(state, 1);
    expect(me.intent).toMatchObject({ move: null, attack: false });
    const facing = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const [dx, dy] = facing[me.facing];
    expect([x + dx!, y + dy!]).toEqual([6, 4]);
  });

  test("keepDistance: backs off to range − 1..range and fires from there", () => {
    const rows = [
      "...............",
      "...............",
      ".1...........2.",
      ".1...........2.",
      ".1...........2.",
      "...............",
      "...............",
    ];
    const state = only(battleOn(rows, [["circle"], ["square"]]), 1, [
      always({ type: "keepDistance", target: { by: "nearest" } }),
    ]);
    put(state, 1, 7, 3);
    put(state, 2, 8, 3);
    const events = run(state, 80);
    const [x, y] = xyOf(state, 1);
    const [tx, ty] = xyOf(state, 2);
    const aligned = x === tx || y === ty;
    const distance = Math.abs(x - tx) + Math.abs(y - ty);
    expect(aligned).toBe(true);
    expect(distance).toBeGreaterThanOrEqual(5);
    expect(distance).toBeLessThanOrEqual(6);
    expect(events.some((e) => e.type === "hit" && e.by.id === 1)).toBe(true);
  });

  test("dodge: steps off the line, and the projectile misses", () => {
    const state = only(battleOn(FIELD, [["circle"], ["triangle"]]), 1, [
      { when: { type: "projectileIncoming" }, then: { type: "dodge" } },
    ]);
    put(state, 1, 3, 3);
    put(state, 2, 7, 5);
    projectile(state, 2, cellOf(6, 3), "left");
    const [first] = commandsOf(state, 1, { type: "dodge" })!;
    expect(["up", "down"]).toContain((first as { move: string }).move);
    const events = run(state, 20);
    expect(events.some((e) => e.type === "hit")).toBe(false);
    expect(xyOf(state, 1)[1]).not.toBe(3);
  });

  test("dodge is impossible with nothing coming or nowhere off the line", () => {
    const rows = [
      "#########",
      "#########",
      ".1.....2.",
      "#########",
      "#########",
    ];
    const state = battleOn(rows, [["circle"], ["triangle"]]);
    put(state, 1, 3, 2);
    put(state, 2, 7, 2);
    expect(commandsOf(state, 1, { type: "dodge" })).toBeNull();
    projectile(state, 2, cellOf(6, 2), "left");
    expect(commandsOf(state, 1, { type: "dodge" })).toBeNull();
  });

  test("protect: stands between the wounded ally and its enemy, and strikes", () => {
    const state = only(
      battleOn(FIELD, [["square", member("circle", { hp: 30 })], ["triangle"]]),
      1,
      [
        {
          when: { type: "allyHpBelow", permille: 500, cells: 8 },
          then: { type: "protect" },
        },
      ],
    );
    put(state, 1, 2, 5);
    put(state, 2, 3, 3);
    put(state, 3, 5, 3);
    const events = run(state, 60);
    // The cell between: next to the ally, on the enemy's side.
    expect(xyOf(state, 1)).toEqual([4, 3]);
    expect(byId(state, 1).facing).toBe("right");
    expect(
      events.some((e) => e.type === "attacked" && e.participant.id === 1),
    ).toBe(true);
  });

  test("protect is impossible with no ally", () => {
    const state = battleOn(FIELD, [["square"], ["triangle"]]);
    expect(commandsOf(state, 1, { type: "protect" })).toBeNull();
  });

  test("flee: to the nearest exit cell, and out by the edge", () => {
    const state = only(battleOn(FIELD, [["square"], ["circle"]]), 1, [
      always({ type: "flee" }),
    ]);
    put(state, 1, 2, 2);
    put(state, 2, 6, 4);
    const events = run(state, 80);
    expect(
      events.find((e) => e.type === "escaped" && e.participant.id === 1),
    ).toMatchObject({ reason: "edge" });
    // Two steps (about 14 ticks at 3 cells per second), then two seconds
    // (40 ticks) on the ring.
    const escaped = events.find((e) => e.type === "escaped")!;
    expect(escaped.tick).toBeLessThan(14 + 40 + 5);
  });

  test("drop: leaves the bag; impossible with an empty one", () => {
    const state = only(
      battleOn(FIELD, [
        [member("square", { carry: { materia: 30, cristal: 0 } })],
        ["circle"],
      ]),
      1,
      [always({ type: "drop" })],
    );
    stepBattle(state, []);
    expect(byId(state, 1).carry).toEqual({ materia: 0, cristal: 0 });
    expect(state.piles).toHaveLength(1);
    expect(commandsOf(state, 1, { type: "drop" })).toBeNull();
  });

  test("pickup: goes to the nearest pile and takes it; impossible when full", () => {
    const state = only(battleOn(FIELD, [["triangle"], ["circle"]]), 1, [
      always({ type: "pickup" }),
    ]);
    put(state, 1, 2, 3);
    put(state, 2, 7, 5);
    state.piles.push({
      id: state.nextId++,
      cell: cellOf(5, 3),
      materia: 6,
      cristal: 2,
    });
    const events = run(state, 60);
    expect(events.filter((e) => e.type === "picked")).toHaveLength(1);
    expect(byId(state, 1).carry).toEqual({ materia: 6, cristal: 2 });
    expect(commandsOf(state, 1, { type: "pickup" })).toBeNull();
    byId(state, 1).carry = { materia: 20, cristal: 0 };
    state.piles.push({ id: state.nextId++, cell: 0, materia: 1, cristal: 0 });
    expect(commandsOf(state, 1, { type: "pickup" })).toBeNull();
  });
});

/** Two lanes around a wall: the top one passes under the square's cell. */
const LANES = [
  ".............",
  ".............",
  ".1.#######.2.",
  ".1.........2.",
  ".............",
];

describe("the melee berth (checkpoint C12)", () => {
  test("the reach: cells within the berth of a melee enemy, around rock", () => {
    const state = battleOn(LANES, [["circle"], ["square", "triangle"]]);
    put(state, 1, 1, 3);
    put(state, 2, 6, 0);
    put(state, 3, 11, 3); // a shooter has no reach
    const reach = meleeReach(mindOf(state, 1));
    expect(reach.has(cellOf(6, 1, 13))).toBe(true); // 1 step
    expect(reach.has(cellOf(9, 0, 13))).toBe(true); // 3 steps
    expect(reach.has(cellOf(10, 0, 13))).toBe(false); // 4 steps
    expect(reach.has(cellOf(6, 0, 13))).toBe(false); // the square itself
    expect(reach.has(cellOf(10, 3, 13))).toBe(false);
  });

  test("a ranged way goes around the reach when it can", () => {
    const state = battleOn(LANES, [["circle"], ["square"]]);
    put(state, 1, 2, 1);
    put(state, 2, 6, 0);
    const goal = [cellOf(11, 1, 13)];
    const mind = mindOf(state, 1);
    // The top lane is shorter, but passes next to the square.
    expect(towards(mind, goal)).toBe("right");
    expect(towards(mind, goal, meleeReach(mind))).toBe("down");
  });

  test("with every way through the reach, it goes as before", () => {
    const state = battleOn(LANES, [["circle"], ["square", "square"]]);
    put(state, 1, 2, 1);
    put(state, 2, 6, 0);
    put(state, 3, 6, 4); // the bottom lane is in a reach too
    const mind = mindOf(state, 1);
    expect(towards(mind, [cellOf(11, 1, 13)], meleeReach(mind))).toBe("right");
  });

  test("a berth of 0 turns it off", () => {
    const params = paramsWith((p) => {
      p.gambits.meleeBerthSteps = 0;
    });
    const state = createBattle(
      setupOf(LANES, [[member("circle")], [member("square")]]),
      params,
    );
    put(state, 2, 6, 0);
    expect(meleeReach(mindOf(state, 1)).size).toBe(0);
  });

  test("the circle does not walk into a square waiting at a corner", () => {
    // The owner's bait on the rocks: a square standing next to rock, hitting
    // only what comes next to it. The marksman comes from its zone.
    const rows = readArenaRows("pedras");
    for (const [x, y] of [
      [21, 10],
      [20, 14],
      [21, 18],
    ] as const) {
      for (const seed of [1, 2, 3]) {
        const state = createBattle(
          setupOf(
            rows,
            [
              [member("square")],
              [member("circle", { gambits: presetGambits("marksman") })],
            ],
            seed,
          ),
          paramsWith(() => {}),
        );
        const square = byId(state, 1);
        square.controller = "human";
        put(state, 1, x, y);
        let blows = 0;
        while (state.ended === null && state.tick < 1200) {
          const circle = byId(state, 2);
          const dir = alignedDir(state.arena, square.cell, circle.cell, 1);
          const commands =
            dir === null
              ? [{ type: "intent", id: 1, move: null, attack: false }]
              : [
                  { type: "face", id: 1, dir },
                  { type: "intent", id: 1, move: null, attack: true },
                ];
          for (const e of stepBattle(state, commands)) {
            if (e.type === "hit" && e.by.id === 1) blows += 1;
          }
        }
        expect({ x, y, seed, blows }).toEqual({ x, y, seed, blows: 0 });
        expect(state.ended?.winnerSide).toBe(1);
      }
    }
  }, 30_000);
});
