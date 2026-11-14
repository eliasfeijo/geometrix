import { describe, expect, test } from "vitest";
import { TickLoop, type Ticking } from "../src/loop.ts";
import { FakeTimers } from "./helpers.ts";

function world(multiplier: number, endAt = Infinity) {
  const w: Ticking & { status: "running" | "ended" } = {
    multiplier,
    state: { tick: 0, params: { world: { tickSeconds: 1 } } },
    status: "running",
    tick() {
      w.state.tick += 1;
      if (w.state.tick >= endAt) w.status = "ended";
    },
  };
  return w;
}

describe("TickLoop", () => {
  test.each([
    [1, 10_000, 10],
    [36, 1_000, 36],
    [36, 10_000, 360],
    [7, 1_000, 7],
  ])("x%i runs one tick per tickSeconds / multiplier", (m, ms, ticks) => {
    const timers = new FakeTimers();
    const w = world(m);
    new TickLoop(w, timers, 100).start();
    timers.advance(ms);
    expect(w.state.tick).toBe(ticks);
  });

  test("a late wake-up runs the ticks it owes, without drift", () => {
    const timers = new FakeTimers();
    const w = world(1);
    new TickLoop(w, timers, 100).start();
    timers.stall(4_500);
    timers.advance(500);
    expect(w.state.tick).toBe(5);
    timers.advance(5_000);
    expect(w.state.tick).toBe(10);
  });

  test("past maxCatchUp it drops the backlog and goes on from now", () => {
    const timers = new FakeTimers();
    const w = world(1);
    new TickLoop(w, timers, 100).start();
    timers.stall(1_000_000);
    timers.advance(0);
    timers.advance(1);
    expect(w.state.tick).toBe(100);
    timers.advance(3_000);
    expect(w.state.tick).toBe(103);
  });

  test("stops when the world ends, and stop() cancels the next tick", () => {
    const timers = new FakeTimers();
    const ending = world(1, 3);
    const loop = new TickLoop(ending, timers, 100);
    loop.start();
    timers.advance(10_000);
    expect(ending.state.tick).toBe(3);
    expect(loop.running).toBe(false);

    const w = world(1);
    const other = new TickLoop(w, timers, 100);
    other.start();
    timers.advance(2_000);
    other.stop();
    timers.advance(5_000);
    expect(w.state.tick).toBe(2);
  });

  test("runs beforeTicks on every wake-up", () => {
    const timers = new FakeTimers();
    let wakes = 0;
    new TickLoop(world(1), timers, 100, () => wakes++).start();
    timers.advance(3_000);
    expect(wakes).toBe(3);
  });
});
