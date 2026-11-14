import { describe, expect, test } from "vitest";
import { capacity } from "../src/economy.ts";
import { DNAS } from "../src/params.ts";
import type { WorldState } from "../src/world.ts";
import { creepOf, loadDefaultParams, run, textWorld } from "./helpers.ts";

const params = loadDefaultParams();

/** Core A next to a materia deposit; core B far away. */
const NEXT_TO_MATERIA = ["Am.......B"];

function depositAt(world: WorldState, x: number, y = 0) {
  return world.deposits.find((d) => d.x === x && d.y === y)!;
}

describe("capacity", () => {
  test.each([
    ["square", 30, 45],
    ["triangle", 20, 30],
    ["circle", 10, 15],
  ] as const)(
    "%s carries %i, %i with the capacity upgrade",
    (dna, base, upgraded) => {
      const world = textWorld(NEXT_TO_MATERIA);
      const team = world.teams[0]!;
      const creep = creepOf(world, 0, dna);
      expect(capacity(creep, team, params)).toBe(base);
      team.upgrades.capacity = true;
      expect(capacity(creep, team, params)).toBe(upgraded);
    },
  );
});

describe("gather", () => {
  test("walks to the deposit, then takes 1 unit per tick until full", () => {
    const world = textWorld(NEXT_TO_MATERIA);
    const creep = creepOf(world, 0, "square");
    const deposit = depositAt(world, 1);
    creep.order = { type: "gather", depositId: deposit.id };
    // 30 ticks to enter the cell; the arrival tick is spent moving.
    run(world, 30);
    expect(creep.x).toBe(1);
    expect(creep.cargo.materia).toBe(0);
    run(world, 29);
    expect(creep.cargo.materia).toBe(29);
    expect(creep.order.type).toBe("gather");
    run(world, 1);
    expect(creep.cargo).toEqual({ materia: 30, cristal: 0 });
    expect(creep.order).toEqual({ type: "stop" });
    expect(deposit.amount).toBe(470);
  });

  test.each(DNAS)("a %s stops at its capacity", (dna) => {
    const world = textWorld(NEXT_TO_MATERIA);
    const creep = creepOf(world, 0, dna);
    Object.assign(creep, { x: 1 });
    creep.order = { type: "gather", depositId: depositAt(world, 1).id };
    run(world, 100);
    expect(creep.cargo.materia).toBe(params.dna[dna].capacity);
  });

  test("the capacity upgrade raises the limit", () => {
    const world = textWorld(NEXT_TO_MATERIA);
    world.teams[0]!.upgrades.capacity = true;
    const creep = creepOf(world, 0, "square");
    Object.assign(creep, { x: 1 });
    creep.order = { type: "gather", depositId: depositAt(world, 1).id };
    run(world, 100);
    expect(creep.cargo.materia).toBe(45);
  });

  test("capacity counts both resources together", () => {
    const world = textWorld(NEXT_TO_MATERIA);
    const creep = creepOf(world, 0, "square");
    Object.assign(creep, { x: 1, cargo: { materia: 0, cristal: 25 } });
    creep.order = { type: "gather", depositId: depositAt(world, 1).id };
    run(world, 100);
    expect(creep.cargo).toEqual({ materia: 5, cristal: 25 });
  });

  test("a cristal deposit fills the cristal cargo", () => {
    const world = textWorld(["Ac.......B"]);
    const creep = creepOf(world, 0, "circle");
    Object.assign(creep, { x: 1 });
    creep.order = { type: "gather", depositId: depositAt(world, 1).id };
    run(world, 100);
    expect(creep.cargo).toEqual({ materia: 0, cristal: 10 });
  });

  test("stops when the deposit runs out", () => {
    const world = textWorld(["Ac.......B"]);
    const deposit = depositAt(world, 1);
    deposit.amount = 3;
    const creep = creepOf(world, 0, "square");
    Object.assign(creep, { x: 1 });
    creep.order = { type: "gather", depositId: deposit.id };
    run(world, 3);
    expect(creep.cargo.cristal).toBe(3);
    expect(deposit.amount).toBe(0);
    expect(creep.order).toEqual({ type: "stop" });
  });

  test("creeps on the same deposit each gather, the lower id first", () => {
    const world = textWorld(NEXT_TO_MATERIA);
    const deposit = depositAt(world, 1);
    deposit.amount = 3;
    const [first, second] = world.creeps.filter((c) => c.team === 0);
    for (const creep of [first!, second!]) {
      Object.assign(creep, { x: 1 });
      creep.order = { type: "gather", depositId: deposit.id };
    }
    run(world, 1);
    expect([first!.cargo.materia, second!.cargo.materia]).toEqual([1, 1]);
    run(world, 1);
    expect([first!.cargo.materia, second!.cargo.materia]).toEqual([2, 1]);
    expect(second!.order).toEqual({ type: "stop" });
  });

  test("a full creep stops without walking", () => {
    const world = textWorld(NEXT_TO_MATERIA);
    const creep = creepOf(world, 0, "circle");
    creep.cargo.cristal = 10;
    creep.order = { type: "gather", depositId: depositAt(world, 1).id };
    run(world, 1);
    expect(creep.order).toEqual({ type: "stop" });
    expect(creep.movePoints).toBe(0);
  });

  test.each([
    ["an unknown deposit", 9999],
    ["an empty deposit", 0],
  ])("%s turns into stop", (_, id) => {
    const world = textWorld(NEXT_TO_MATERIA);
    const deposit = depositAt(world, 1);
    deposit.amount = 0;
    const creep = creepOf(world, 0, "circle");
    creep.order = { type: "gather", depositId: id || deposit.id };
    run(world, 1);
    expect(creep.order).toEqual({ type: "stop" });
  });

  test("an unreachable deposit turns into stop", () => {
    const world = textWorld(["A#m......B"]);
    const creep = creepOf(world, 0, "circle");
    creep.order = { type: "gather", depositId: depositAt(world, 2).id };
    run(world, 1);
    expect(creep.order).toEqual({ type: "stop" });
    expect(creep.x).toBe(0);
  });
});
