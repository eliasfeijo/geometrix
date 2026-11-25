import {
  parseArena,
  parseBattleParams,
  type BattleView,
  type Dna,
  type ViewParticipant,
} from "@geometrix/battle";
import { describe, expect, test } from "vitest";
import paramsJson from "../../../packages/battle/test/params.json?raw";
import {
  freeAhead,
  Predictor,
  StepGlides,
  stepTicks,
} from "../src/battle/motion.ts";

const params = parseBattleParams(JSON.parse(paramsJson));

/** 9 × 5, a rock at (6, 2). */
const arena = parseArena([
  ".........",
  ".1.....2.",
  ".1....#2.",
  ".1.....2.",
  ".........",
]);
const W = arena.width;
const at = (x: number, y: number) => y * W + x;

function creep(id: number, cell: number, dna: Dna = "triangle") {
  return {
    id,
    side: id - 1,
    name: `c${id}`,
    dna,
    cell,
    facing: "right",
    hp: 100,
    maxHp: 200,
    carry: { materia: 0, cristal: 0 },
    // The triangle's: a full bag is 20 (fullBrakePermille halves the speed).
    capacity: 20,
    controller: "human",
    reaction: "normal",
    cooldownTicks: 0,
    exitTicks: 0,
  } satisfies ViewParticipant;
}

function view(participants: ViewParticipant[], countdownTicks = 0): BattleView {
  return {
    tick: 0,
    countdownTicks,
    idleTicks: 0,
    participants,
    projectiles: [],
    piles: [],
    ended: null,
  };
}

describe("the step time of a creep (C11)", () => {
  test("its DNA's speed, slowed by the carry brake", () => {
    // The triangle walks 4 cells per second: 5 ticks a cell at 20 ticks/s.
    expect(stepTicks(params, creep(1, 0))).toBe(5);
    // A full bag halves the speed (fullBrakePermille 500).
    const full = { ...creep(1, 0), carry: { materia: 20, cristal: 0 } };
    expect(stepTicks(params, full)).toBe(10);
  });
});

describe("the step option (C11)", () => {
  test("glides a whole step, then on from where it is drawn", () => {
    const glides = new StepGlides();
    const stepMs = () => 200;
    glides.frame(W, view([creep(1, at(2, 2))]), 0, stepMs);
    expect(glides.position(1, 0)).toEqual({ x: 2, y: 2 });
    glides.frame(W, view([creep(1, at(3, 2))]), 100, stepMs);
    expect(glides.position(1, 200)).toEqual({ x: 2.5, y: 2 });
    expect(glides.position(1, 300)).toEqual({ x: 3, y: 2 });
    // The next cell before the glide ended: from where it was drawn.
    glides.frame(W, view([creep(1, at(3, 2))]), 150, stepMs);
    glides.frame(W, view([creep(1, at(4, 2))]), 200, stepMs);
    expect(glides.position(1, 200)).toEqual({ x: 2.5, y: 2 });
    expect(glides.position(1, 400)).toEqual({ x: 4, y: 2 });
    expect(glides.until).toBe(400);
  });

  test("whoever enters or jumps is drawn at its cell", () => {
    const glides = new StepGlides();
    glides.frame(W, view([creep(1, at(1, 1))]), 0, () => 200);
    glides.frame(
      W,
      view([creep(1, at(7, 3)), creep(2, at(5, 1))]),
      50,
      () => 200,
    );
    expect(glides.position(1, 50)).toEqual({ x: 7, y: 3 });
    expect(glides.position(2, 50)).toEqual({ x: 5, y: 1 });
  });
});

describe("the predict option (C11)", () => {
  test("free cells ahead stop at rock, at a creep and at the edge", () => {
    const v = view([creep(1, at(2, 2)), creep(2, at(2, 0))]);
    expect(freeAhead(arena, v, 1, at(2, 2), "right")).toBe(3);
    expect(freeAhead(arena, v, 1, at(2, 2), "up")).toBe(1);
    expect(freeAhead(arena, v, 1, at(2, 2), "down")).toBe(2);
    expect(freeAhead(arena, v, 1, at(2, 2), "left")).toBe(2);
  });

  test("glides while held from the key on, at the step time, up to what is free", () => {
    const p = new Predictor();
    const v = view([creep(1, at(2, 2))]);
    p.hold("right", 0, W, at(2, 2));
    const framed = { x: 2, y: 2 };
    // It starts at once, without waiting for a frame.
    expect(p.position(arena, v, 1, 100, 200, framed)).toEqual({ x: 2.5, y: 2 });
    expect(p.position(arena, v, 1, 400, 200, framed)).toEqual({ x: 4, y: 2 });
    // The rock at (6, 2): it stops at (5, 2).
    expect(p.position(arena, v, 1, 2000, 200, framed)).toEqual({ x: 5, y: 2 });
  });

  test("released, it waits for the frames, then glides to them (F7)", () => {
    const p = new Predictor();
    const v = view([creep(1, at(2, 2))]);
    p.hold("right", 0, W, at(2, 2));
    p.position(arena, v, 1, 300, 200, { x: 2, y: 2 });
    // Drawn at 3.5; the frames, a round trip late, still at 3.
    p.hold(null, 300, W, at(3, 2), 250);
    expect(p.position(arena, v, 1, 400, 200, { x: 3, y: 2 })).toEqual({
      x: 3.5,
      y: 2,
    });
    // They get to 4 (the battle had entered it): it glides on to them.
    expect(p.position(arena, v, 1, 450, 200, { x: 4, y: 2 })).toEqual({
      x: 3.5,
      y: 2,
    });
    expect(p.position(arena, v, 1, 550, 200, { x: 4, y: 2 })).toEqual({
      x: 3.75,
      y: 2,
    });
    expect(p.position(arena, v, 1, 650, 200, { x: 4, y: 2 })).toBeUndefined();
    expect(p.active).toBe(false);
  });

  test("released and the frames never get there: back after the round trip", () => {
    const p = new Predictor();
    const v = view([creep(1, at(2, 2))]);
    p.hold("right", 0, W, at(2, 2));
    p.position(arena, v, 1, 300, 200, { x: 2, y: 2 });
    p.hold(null, 300, W, at(2, 2), 250);
    const framed = { x: 2, y: 2 };
    expect(p.position(arena, v, 1, 500, 200, framed)).toEqual({ x: 3.5, y: 2 });
    expect(p.position(arena, v, 1, 550, 200, framed)).toEqual({ x: 3.5, y: 2 });
    expect(p.position(arena, v, 1, 650, 200, framed)).toEqual({
      x: 2.75,
      y: 2,
    });
  });

  test("the countdown holds the run until its end", () => {
    const p = new Predictor();
    p.hold("right", 0, W, at(2, 2));
    p.frame(W, view([creep(1, at(2, 2))], 10), 1, 300, 200, 2);
    const v = view([creep(1, at(2, 2))]);
    expect(p.position(arena, v, 1, 300, 200, { x: 2, y: 2 })).toEqual({
      x: 2,
      y: 2,
    });
  });

  test("a frame off its way, or too far behind, starts the run again", () => {
    const p = new Predictor();
    p.hold("right", 0, W, at(2, 2));
    // The frames have it elsewhere (it was still going up, latency).
    p.frame(W, view([creep(1, at(2, 1))]), 1, 100, 200, 2);
    const v = view([creep(1, at(2, 1))]);
    expect(p.position(arena, v, 1, 100, 200, { x: 2, y: 1 })).toEqual({
      x: 2,
      y: 1,
    });
    // On its way but blocked for long: pulled back to the frames' cell.
    const q = new Predictor();
    q.hold("right", 0, W, at(1, 3));
    q.frame(W, view([creep(1, at(1, 3))]), 1, 1000, 200, 2);
    const w = view([creep(1, at(1, 3))]);
    expect(q.position(arena, w, 1, 1000, 200, { x: 1, y: 3 })).toEqual({
      x: 1,
      y: 3,
    });
  });

  test("never ahead of the battle, and at most a step behind the frames", () => {
    // The battle entered (2, 3) at once: a frame at 100 ms does not push the
    // glide past it.
    const p = new Predictor();
    p.hold("right", 0, W, at(1, 3));
    p.frame(W, view([creep(1, at(2, 3))]), 1, 100, 200, 2);
    const v = view([creep(1, at(2, 3))]);
    expect(p.position(arena, v, 1, 100, 200, { x: 2, y: 3 })).toEqual({
      x: 1.5,
      y: 3,
    });
    // Frames two cells further than the glide: it catches up to one behind.
    p.frame(W, view([creep(1, at(4, 3))]), 1, 200, 200, 2);
    const w = view([creep(1, at(4, 3))]);
    expect(p.position(arena, w, 1, 200, 200, { x: 4, y: 3 })).toEqual({
      x: 3,
      y: 3,
    });
  });
});
