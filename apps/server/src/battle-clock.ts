// The battle clock (junction plan section 7, T-2, D13): one real-time battle
// tick every 50 ms for the battles on the real pace, scheduled with
// setTimeout against a fixed baseline like the TickLoop, so delays do not add
// up. It does not drive the world: the world-paced battles step with the
// world's ticks. A late clock runs the ticks it owes at once, up to
// maxCatchUp; past that it drops the backlog and goes on from now (the
// battle slows down instead of rushing after a stall).

import type { Timers } from "./loop.ts";

/** What the clock drives; WorldHost implements it. */
export type RealtimeTicking = {
  readonly status: "running" | "ended";
  realtimeTick(): void;
};

export class BattleClock {
  private readonly world: RealtimeTicking;
  private readonly timers: Timers;
  private readonly tickMs: number;
  private readonly maxCatchUp: number;
  private handle: unknown = null;
  private baseline = 0;
  /** Ticks run since the baseline. */
  private ran = 0;

  constructor(
    world: RealtimeTicking,
    timers: Timers,
    tickMs: number,
    maxCatchUp: number,
  ) {
    this.world = world;
    this.timers = timers;
    this.tickMs = tickMs;
    this.maxCatchUp = maxCatchUp;
  }

  get running(): boolean {
    return this.handle !== null;
  }

  start(): void {
    if (this.running || this.world.status === "ended") return;
    this.rebase();
    this.schedule();
  }

  stop(): void {
    if (this.handle !== null) this.timers.clearTimeout(this.handle);
    this.handle = null;
  }

  private rebase(): void {
    this.baseline = this.timers.now();
    this.ran = 0;
  }

  private schedule(): void {
    const at = this.baseline + (this.ran + 1) * this.tickMs;
    this.handle = this.timers.setTimeout(
      () => this.wake(),
      Math.max(0, at - this.timers.now()),
    );
  }

  private wake(): void {
    const due = Math.floor((this.timers.now() - this.baseline) / this.tickMs);
    const owed = due - this.ran;
    const run = Math.min(owed, this.maxCatchUp);
    for (let i = 0; i < run && this.world.status === "running"; i++) {
      this.world.realtimeTick();
    }
    this.ran += run;
    if (owed > this.maxCatchUp) this.rebase();
    if (this.world.status === "ended") {
      this.handle = null;
      return;
    }
    this.schedule();
  }
}
