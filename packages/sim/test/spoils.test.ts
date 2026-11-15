import { describe, expect, test } from "vitest";
import { dropSpoil } from "../src/spoils.ts";
import { step } from "../src/step.ts";
import { updateVision } from "../src/vision.ts";
import type { SimEvent } from "../src/events.ts";
import type { WorldState } from "../src/world.ts";
import { creepOf, run, textWorld } from "./helpers.ts";

const ROW = ["A............................B"];

function world(): WorldState {
  const w = textWorld(ROW);
  for (const creep of w.creeps) {
    if (creep.team === 0) Object.assign(creep, { x: 4, y: 0 });
  }
  updateVision(w);
  return w;
}

/** Steps `ticks` times and returns every event. */
function events(w: WorldState, ticks: number): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) all.push(...step(w, []));
  return all;
}

describe("picking up spoils (spec S-1, D11)", () => {
  test("walks to a remembered spoil and takes what fits, cristal first", () => {
    const w = world();
    const circle = creepOf(w, 0, "circle");
    const id = dropSpoil(w, { x: 7, y: 0 }, { materia: 8, cristal: 4 });
    updateVision(w);
    expect(w.memory[0]!.spoils.map((s) => s.id)).toEqual([id]);
    circle.order = { type: "pickup", spoilId: id };
    const seen = events(w, 60);
    // Circle capacity 10: 4 cristal, then 6 materia.
    expect(circle.cargo).toEqual({ materia: 6, cristal: 4 });
    expect(circle.order).toEqual({ type: "stop" });
    expect(w.spoils).toEqual([
      { id, cargo: { materia: 2, cristal: 0 }, x: 7, y: 0 },
    ]);
    expect(w.memory[0]!.spoils[0]!.cargo).toEqual({ materia: 2, cristal: 0 });
    expect(seen.filter((e) => e.type === "pickedUp")).toEqual([
      expect.objectContaining({
        creep: expect.objectContaining({ id: circle.id }),
        spoil: id,
        taken: { materia: 6, cristal: 4 },
        x: 7,
        y: 0,
      }),
    ]);
    // A second creep empties the pile: it leaves the state and the memory.
    const square = creepOf(w, 0, "square");
    square.order = { type: "pickup", spoilId: id };
    events(w, 120);
    expect(square.cargo).toEqual({ materia: 2, cristal: 0 });
    expect(w.spoils).toEqual([]);
    expect(w.memory[0]!.spoils).toEqual([]);
  });

  test("a pile gone meanwhile is found out there, and forgotten", () => {
    const w = world();
    const square = creepOf(w, 0, "square");
    const id = dropSpoil(w, { x: 7, y: 0 }, { materia: 3, cristal: 0 });
    updateVision(w);
    // Team 0 still remembers it when it goes, unseen, away.
    w.spoils = [];
    square.order = { type: "pickup", spoilId: id };
    step(w, []);
    // Square sight 3 from x=4 sees x=7: the memory forgets at once.
    expect(w.memory[0]!.spoils).toEqual([]);
    step(w, []);
    expect(square.order).toEqual({ type: "stop" });
    expect(square.cargo).toEqual({ materia: 0, cristal: 0 });
  });

  test("the pickup action goes for the spoil it reaches first and keeps it", () => {
    const w = world();
    const circle = creepOf(w, 0, "circle");
    circle.rules = [{ when: { type: "always" }, then: { type: "pickup" } }];
    // Nothing known: the action is impossible, the order stays.
    step(w, []);
    expect(circle.order).toEqual({ type: "stop" });
    const near = dropSpoil(w, { x: 6, y: 0 }, { materia: 1, cristal: 0 });
    const far = dropSpoil(w, { x: 9, y: 0 }, { materia: 1, cristal: 0 });
    updateVision(w);
    step(w, []);
    expect(circle.order).toEqual({ type: "pickup", spoilId: near });
    // 12 ticks per cell: the near one by tick 25, then the far one.
    run(w, 30);
    expect(circle.cargo.materia).toBe(1);
    expect(w.spoils.map((s) => s.id)).toEqual([far]);
    expect(circle.order).toEqual({ type: "pickup", spoilId: far });
    run(w, 60);
    expect(circle.cargo.materia).toBe(2);
    expect(w.spoils).toEqual([]);
  });

  test("a full creep does not pick up", () => {
    const w = world();
    const circle = creepOf(w, 0, "circle");
    circle.cargo.materia = 10;
    circle.rules = [{ when: { type: "always" }, then: { type: "pickup" } }];
    dropSpoil(w, { x: 6, y: 0 }, { materia: 1, cristal: 0 });
    updateVision(w);
    step(w, []);
    expect(circle.order).toEqual({ type: "stop" });
  });
});
