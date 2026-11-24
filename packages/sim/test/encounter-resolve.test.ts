import { describe, expect, test } from "vitest";
import { dominate, join } from "../src/domination.ts";
import type { SimEvent } from "../src/events.ts";
import { dropSpoil } from "../src/spoils.ts";
import { step } from "../src/step.ts";
import { updateVision } from "../src/vision.ts";
import type { Creep, WorldState } from "../src/world.ts";
import { creepOf, run, textWorld } from "./helpers.ts";

// 30 cells: core A at x=0, core B at x=29; a crossing at x=14..15.
const ROW = ["A.............==.............B"];

type Setup = { world: WorldState; hunter: Creep; prey: Creep };

/**
 * A team 0 circle next to a team 1 square at x=9 / x=10 (or `at`), the
 * circle approaching it with `intent`.
 */
function setup(
  intent: "attack" | "extort",
  edit: (s: Setup) => void = () => {},
  at: [number, number] = [9, 10],
): Setup {
  const world = textWorld(ROW);
  const hunter = creepOf(world, 0, "circle");
  const prey = creepOf(world, 1, "square");
  Object.assign(hunter, { x: at[0], y: 0 });
  Object.assign(prey, { x: at[1], y: 0 });
  const s = { world, hunter, prey };
  edit(s);
  updateVision(world);
  hunter.order = { type: "approach", targetId: prey.id, intent };
  return s;
}

function dominated(world: WorldState, creep: Creep, playerId: number): void {
  join(world, playerId, creep.team, false);
  dominate(world, playerId, creep.id);
}

const tick = (world: WorldState): SimEvent[] => step(world, []);
const types = (events: SimEvent[]) => events.map((e) => e.type);

describe("dialogue (spec E-4..E-8, D6, D8, D9)", () => {
  test("a free victim pays an extortion at once, cristal first", () => {
    const { world, hunter, prey } = setup("extort", ({ hunter, prey }) => {
      hunter.cargo.materia = 4;
      prey.cargo = { materia: 9, cristal: 3 };
    });
    const events = tick(world);
    expect(types(events)).toEqual(["encounter", "reaction", "paid"]);
    expect(events[1]).toMatchObject({ choice: "pay", by: "default" });
    // Circle capacity 10, 4 carried: 6 free, 3 cristal then 3 materia.
    expect(events[2]).toMatchObject({ amount: { materia: 3, cristal: 3 } });
    expect(hunter.cargo).toEqual({ materia: 7, cristal: 3 });
    expect(prey.cargo).toEqual({ materia: 6, cristal: 0 });
    expect(prey.safeConduct).toEqual({ team: 0, untilTick: 600 });
    expect(prey.extortBlocks).toEqual([
      { aggressor: hunter.id, untilTick: 1800 },
    ]);
    expect(world.encounters).toEqual([]);
    expect([hunter.engagement, prey.engagement]).toEqual([null, null]);
    expect([hunter.order, prey.order]).toEqual([
      { type: "stop" },
      { type: "stop" },
    ]);
  });

  test("the safe conduct keeps the extorting team off; the pair stays blocked", () => {
    const { world, hunter, prey } = setup("extort", ({ prey }) => {
      prey.cargo.cristal = 20;
    });
    tick(world);
    hunter.order = { type: "approach", targetId: prey.id, intent: "attack" };
    run(world, 100);
    expect(world.encounters).toEqual([]);
    // Off the safe conduct, the attack opens; the extortion stays blocked.
    prey.safeConduct = null;
    hunter.order = { type: "approach", targetId: prey.id, intent: "extort" };
    tick(world);
    expect(world.encounters).toEqual([]);
    expect(hunter.order).toEqual({ type: "stop" });
  });

  test("a dominated victim waits for its player, then its rules decide", () => {
    const { world, hunter, prey } = setup("extort", ({ world, prey }) => {
      prey.cargo.cristal = 5;
      dominated(world, prey, 9);
    });
    tick(world);
    const [encounter] = world.encounters;
    expect(encounter).toMatchObject({ intent: "extort", deadlineTick: 60 });
    // The window is 60 s: ticks 1 to 59 wait, tick 60 decides.
    run(world, 59);
    expect(world.encounters).toHaveLength(1);
    expect(prey.activity).toBe("talking");
    const events = tick(world);
    expect(events.find((e) => e.type === "reaction")).toMatchObject({
      choice: "pay",
      by: "default",
    });
    expect(hunter.cargo.cristal).toBe(5);
  });

  test("the player's reply is applied at the encounters stage", () => {
    const { world, prey } = setup("extort", ({ world, prey }) => {
      prey.cargo.cristal = 5;
      dominated(world, prey, 9);
    });
    tick(world);
    world.encounters[0]!.reply = "refuse";
    const events = tick(world);
    expect(events.find((e) => e.type === "reaction")).toMatchObject({
      choice: "refuse",
      by: "player",
    });
    // Refusing closes the dialogue and opens the battle (junction O-2).
    expect(world.encounters).toEqual([]);
    expect(world.battles).toHaveLength(1);
    expect(prey.cargo.cristal).toBe(5);
    tick(world);
    expect(prey.activity).toBe("fighting");
  });

  test("HP does not regenerate in an encounter", () => {
    const { world, hunter, prey } = setup(
      "extort",
      ({ world, prey, hunter }) => {
        prey.cargo.cristal = 5;
        dominated(world, prey, 9);
        prey.hp = 1_000;
        hunter.hp = 1_000;
      },
    );
    // The dialogue waits through tick 59, which ends the first minute.
    run(world, 60);
    expect(world.encounters).toHaveLength(1);
    expect([hunter.hp, prey.hp]).toEqual([1_000, 1_000]);
  });
});

describe("the flee order (spec D10, junction D7)", () => {
  test("the flee bonus speeds the run up", () => {
    const FLAT = ["A............................B"];
    const plain = textWorld(FLAT);
    const runner = creepOf(plain, 1, "square");
    Object.assign(runner, { x: 10, y: 0 });
    runner.order = { type: "moveTo", x: 29, y: 0 };
    const fled = textWorld(FLAT);
    const fugitive = creepOf(fled, 1, "square");
    Object.assign(fugitive, { x: 10, y: 0 });
    fugitive.order = { type: "flee", untilTick: 1000 };
    run(plain, 300);
    run(fled, 300);
    // 2 cells/min for 5 min, 1.5× with the bonus.
    expect(runner.x - 10).toBe(10);
    expect(fugitive.x - 10).toBe(15);
  });
});

describe("spoils (spec D11)", () => {
  test("piles on the same cell add up, keeping the first id", () => {
    const world = textWorld(ROW);
    const first = dropSpoil(world, { x: 10, y: 0 }, { materia: 3, cristal: 1 });
    const other = dropSpoil(world, { x: 11, y: 0 }, { materia: 1, cristal: 0 });
    const again = dropSpoil(world, { x: 10, y: 0 }, { materia: 2, cristal: 4 });
    expect(again).toBe(first);
    expect(world.spoils).toEqual([
      { id: first, cargo: { materia: 5, cristal: 5 }, x: 10, y: 0 },
      { id: other, cargo: { materia: 1, cristal: 0 }, x: 11, y: 0 },
    ]);
  });
});
