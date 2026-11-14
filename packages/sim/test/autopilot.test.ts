import { describe, expect, test } from "vitest";
import { nearestDeposit, type Rule } from "../src/autopilot.ts";
import { step } from "../src/step.ts";
import { updateVision } from "../src/vision.ts";
import type { WorldState } from "../src/world.ts";
import { creepOf, run, textWorld } from "./helpers.ts";

/** Core A, materia at x=2 and x=6, cristal at x=4. */
const ROW = ["A.m.c.m..B"];

const always = { type: "always" } as const;

function withRules(rules: Rule[], rows = ROW) {
  const world = textWorld(rows);
  const creep = creepOf(world, 0, "circle");
  creep.rules = rules;
  return { world, creep };
}

const depositAt = (world: WorldState, x: number) =>
  world.deposits.find((d) => d.x === x && d.y === 0)!;

/** Sets the deposit's amount where the team sees it: its memory follows. */
function setAmount(world: WorldState, x: number, amount: number): void {
  depositAt(world, x).amount = amount;
  updateVision(world);
}

describe("rule evaluation", () => {
  test("the first rule whose condition holds sets the order", () => {
    const { world, creep } = withRules([
      { when: { type: "cargoFull" }, then: { type: "deliver" } },
      { when: always, then: { type: "moveTo", x: 3, y: 0 } },
      { when: always, then: { type: "stop" } },
    ]);
    step(world, []);
    expect(creep.order).toEqual({ type: "moveTo", x: 3, y: 0 });
  });

  test("an impossible action falls through to the next rule", () => {
    const { world, creep } = withRules([
      { when: always, then: { type: "gather", resource: "cristal" } },
      { when: always, then: { type: "moveTo", x: 8, y: 0 } },
    ]);
    setAmount(world, 4, 0);
    step(world, []);
    expect(creep.order).toEqual({ type: "moveTo", x: 8, y: 0 });
  });

  test("with no valid rule the creep keeps its order", () => {
    const { world, creep } = withRules([
      { when: { type: "cargoFull" }, then: { type: "deliver" } },
    ]);
    creep.order = { type: "moveTo", x: 8, y: 0 };
    run(world, 30);
    expect(creep.order).toEqual({ type: "moveTo", x: 8, y: 0 });
    expect(creep.x).toBe(2);
  });

  test("repeating the current action does not restart it", () => {
    const { world, creep } = withRules([
      { when: always, then: { type: "moveTo", x: 8, y: 0 } },
    ]);
    run(world, 18);
    expect(creep.x).toBe(1);
    expect(creep.movePoints).toBe(30_000);
    run(world, 6);
    expect(creep.x).toBe(2);
  });

  test("a dominated creep ignores its rules", () => {
    const { world, creep } = withRules([
      { when: always, then: { type: "deliver" } },
    ]);
    creep.dominatedBy = 7;
    creep.order = { type: "moveTo", x: 3, y: 0 };
    step(world, []);
    expect(creep.order).toEqual({ type: "moveTo", x: 3, y: 0 });
  });

  test("other creeps without rules stay put", () => {
    const { world } = withRules([
      { when: always, then: { type: "moveTo", x: 3, y: 0 } },
    ]);
    run(world, 100);
    const others = world.creeps.filter((c) => c.rules.length === 0);
    expect(others.every((c) => c.order.type === "stop")).toBe(true);
  });
});

describe("conditions", () => {
  const ifThenMove = (when: Rule["when"]): Rule[] => [
    { when, then: { type: "moveTo", x: 1, y: 0 } },
  ];

  test.each([
    ["cargoFull", { type: "cargoFull" }, { materia: 9, cristal: 1 }, true],
    ["cargoFull", { type: "cargoFull" }, { materia: 9, cristal: 0 }, false],
    ["cargoEmpty", { type: "cargoEmpty" }, { materia: 0, cristal: 0 }, true],
    ["cargoEmpty", { type: "cargoEmpty" }, { materia: 0, cristal: 1 }, false],
  ] as const)("%s with cargo %o is %s", (_, when, cargo, expected) => {
    const { world, creep } = withRules(ifThenMove(when));
    creep.cargo = { ...cargo };
    step(world, []);
    expect(creep.order.type === "moveTo").toBe(expected);
  });

  test("cargoFull follows the capacity upgrade", () => {
    const { world, creep } = withRules(ifThenMove({ type: "cargoFull" }));
    world.teams[0]!.upgrades.capacity = true;
    creep.cargo.materia = 10;
    step(world, []);
    expect(creep.order.type).toBe("stop");
  });

  test.each([
    [4, true],
    [3, false],
  ])("cristal within radius %i of the core is %s", (radius, expected) => {
    const { world, creep } = withRules(
      ifThenMove({ type: "resourceInRange", resource: "cristal", radius }),
    );
    step(world, []);
    expect(creep.order.type === "moveTo").toBe(expected);
  });

  test("an empty deposit is not in range", () => {
    const { world, creep } = withRules(
      ifThenMove({ type: "resourceInRange", resource: "cristal", radius: 9 }),
    );
    setAmount(world, 4, 0);
    step(world, []);
    expect(creep.order.type).toBe("stop");
  });

  test.each([
    [9, true],
    [10, false],
  ])("stockBelow 10 with %i materia is %s", (stock, expected) => {
    const { world, creep } = withRules(
      ifThenMove({ type: "stockBelow", resource: "materia", amount: 10 }),
    );
    world.teams[0]!.stock.materia = stock;
    step(world, []);
    expect(creep.order.type === "moveTo").toBe(expected);
  });
});

describe("actions", () => {
  test("gather picks the nearest non-empty deposit of the resource", () => {
    const { world, creep } = withRules([
      { when: always, then: { type: "gather", resource: "materia" } },
    ]);
    step(world, []);
    expect(creep.order).toEqual({
      type: "gather",
      depositId: depositAt(world, 2).id,
    });
    creep.order = { type: "stop" };
    setAmount(world, 2, 0);
    step(world, []);
    expect(creep.order).toEqual({
      type: "gather",
      depositId: depositAt(world, 6).id,
    });
  });

  test("gather keeps its deposit on the way when a nearer one fills up", () => {
    const { world, creep } = withRules([
      { when: always, then: { type: "gather", resource: "materia" } },
    ]);
    setAmount(world, 2, 0);
    step(world, []);
    const far = { type: "gather", depositId: depositAt(world, 6).id } as const;
    expect(creep.order).toEqual(far);
    setAmount(world, 2, 5);
    run(world, 30);
    expect(creep.order).toEqual(far);
  });

  test("gather waits at its materia deposit when it runs dry", () => {
    const { world, creep } = withRules([
      { when: always, then: { type: "gather", resource: "materia" } },
      { when: always, then: { type: "deliver" } },
    ]);
    const near = { type: "gather", depositId: depositAt(world, 2).id } as const;
    creep.order = near;
    setAmount(world, 2, 0);
    step(world, []);
    expect(creep.order).toEqual(near);
  });

  test("gather leaves a cristal deposit that runs dry for the next one", () => {
    const { world, creep } = withRules(
      [{ when: always, then: { type: "gather", resource: "cristal" } }],
      ["A.c.c....B"],
    );
    creep.order = { type: "gather", depositId: depositAt(world, 2).id };
    setAmount(world, 2, 0);
    step(world, []);
    expect(creep.order).toEqual({
      type: "gather",
      depositId: depositAt(world, 4).id,
    });
  });

  test("nearestDeposit breaks ties by the lower id", () => {
    const world = textWorld(["m.A.m....B"]);
    expect(nearestDeposit(world.deposits, { x: 2, y: 0 }, "materia")!.x).toBe(
      0,
    );
  });

  test("gather is impossible with a full cargo", () => {
    const { world, creep } = withRules([
      { when: always, then: { type: "gather", resource: "materia" } },
    ]);
    creep.cargo.cristal = 10;
    step(world, []);
    expect(creep.order.type).toBe("stop");
  });

  test.each([
    ["a rock", ["A.#......B"], 2],
    ["outside the map", ROW, 99],
  ])("moveTo onto %s is impossible", (_, rows, x) => {
    const { world, creep } = withRules(
      [{ when: always, then: { type: "moveTo", x, y: 0 } }],
      rows,
    );
    step(world, []);
    expect(creep.order.type).toBe("stop");
  });

  describe("buildRoad", () => {
    const buildTo3: Rule[] = [
      { when: always, then: { type: "buildRoad", x: 3, y: 0 } },
      { when: always, then: { type: "moveTo", x: 8, y: 0 } },
    ];

    test("sets the order with its next segment", () => {
      const { world, creep } = withRules(buildTo3);
      world.teams[0]!.stock.materia = 5;
      step(world, []);
      expect(creep.order).toEqual({
        type: "buildRoad",
        x: 3,
        y: 0,
        segment: 1,
      });
    });

    test("is impossible without materia for a new segment", () => {
      const { world, creep } = withRules(buildTo3);
      world.teams[0]!.stock.materia = 4;
      step(world, []);
      expect(creep.order.type).toBe("moveTo");
    });

    test("is impossible once the target has a road", () => {
      const { world, creep } = withRules(buildTo3);
      world.teams[0]!.stock.materia = 100;
      // 12 ticks to walk into each segment, 120 to build it; then one more tick.
      run(world, 3 * (12 + 120) + 1);
      expect(world.map.road.slice(1, 4)).toEqual([1, 1, 1]);
      expect(creep.order.type).toBe("moveTo");
      expect(world.teams[0]!.stock.materia).toBe(85);
    });

    test("resumes a paid job without stock", () => {
      const { world, creep } = withRules(buildTo3);
      world.teams[0]!.stock.materia = 5;
      run(world, 12 + 60);
      expect(world.teams[0]!.stock.materia).toBe(0);
      expect(world.roadJobs).toHaveLength(1);
      run(world, 61);
      expect(world.map.road[1]).toBe(1);
      expect(creep.order.type).toBe("moveTo");
    });
  });
});

describe("a gather-deliver loop", () => {
  test("keeps filling the team stock", () => {
    const { world, creep } = withRules([
      { when: { type: "cargoFull" }, then: { type: "deliver" } },
      { when: always, then: { type: "gather", resource: "materia" } },
    ]);
    // Circle: 24 ticks out, 10 gathering, 30 back loaded (2 cells at 15 each).
    run(world, 3600);
    expect(world.teams[0]!.stock.materia).toBeGreaterThan(400);
    expect(creep.cargo.materia).toBeLessThanOrEqual(10);
  });
});

describe("by what the team knows (fog spec A-1, A-2)", () => {
  // Core A sees 8 cells: cristal at x = 5 is known, at x = 14 it is not.
  const FAR = ["A....c........c....B"];

  test("a deposit the team never saw is not gathered nor in range", () => {
    const { world, creep } = withRules(
      [
        {
          when: { type: "resourceInRange", resource: "cristal", radius: 20 },
          then: { type: "gather", resource: "cristal" },
        },
        { when: always, then: { type: "stop" } },
      ],
      FAR,
    );
    setAmount(world, 5, 0);
    expect(world.memory[0]!.deposits.map((d) => d.x)).toEqual([5]);
    step(world, []);
    expect(creep.order).toEqual({ type: "stop" });
  });

  test("a remembered amount holds until the creep sees the deposit again", () => {
    const { world, creep } = withRules(
      [
        { when: always, then: { type: "gather", resource: "cristal" } },
        { when: always, then: { type: "deliver" } },
      ],
      FAR,
    );
    const far = depositAt(world, 14);
    // Seen full once; it ran dry since, out of sight.
    world.memory[0]!.deposits.push({ ...far });
    far.amount = 0;
    setAmount(world, 5, 0);
    step(world, []);
    expect(creep.order).toEqual({ type: "gather", depositId: far.id });
    // A circle sees 6 cells: from x = 8 it sees the deposit empty and turns.
    run(world, 12 * 8);
    expect(creep.x).toBe(8);
    expect(world.memory[0]!.deposits[1]!.amount).toBe(0);
    expect(creep.order).toEqual({ type: "deliver" });
  });
});
