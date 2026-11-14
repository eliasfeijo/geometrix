// The tick loop (plan section 7): one tick every tickSeconds / multiplier of
// real time, scheduled with setTimeout against a fixed baseline so delays do
// not add up. A late loop runs the ticks it owes at once, up to maxCatchUp;
// past that it drops the backlog and keeps going from now (the world slows
// down instead of freezing the process).

export type Timers = {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

export const realTimers: Timers = {
  now: () => performance.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
};

/** What the loop drives; WorldHost implements it. */
export type Ticking = {
  readonly multiplier: number;
  readonly state: { tick: number; params: { world: { tickSeconds: number } } };
  readonly status: "running" | "ended";
  tick(): void;
};

export class TickLoop {
  private readonly world: Ticking;
  private readonly timers: Timers;
  private readonly maxCatchUp: number;
  private readonly beforeTicks: () => void;
  private handle: unknown = null;
  private baseline = 0;
  private baseTick = 0;

  /** `beforeTicks` runs on every wake-up, before the ticks it owes. */
  constructor(
    world: Ticking,
    timers: Timers,
    maxCatchUp: number,
    beforeTicks: () => void = () => {},
  ) {
    this.world = world;
    this.timers = timers;
    this.maxCatchUp = maxCatchUp;
    this.beforeTicks = beforeTicks;
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

  private get tickMs(): number {
    return this.world.state.params.world.tickSeconds * 1000;
  }

  private rebase(): void {
    this.baseline = this.timers.now();
    this.baseTick = this.world.state.tick;
  }

  /** Ticks due by now since the baseline. */
  private due(): number {
    const elapsed = this.timers.now() - this.baseline;
    return (
      this.baseTick +
      Math.floor((elapsed * this.world.multiplier) / this.tickMs)
    );
  }

  private schedule(): void {
    const next = this.world.state.tick + 1 - this.baseTick;
    const at =
      this.baseline + Math.ceil((next * this.tickMs) / this.world.multiplier);
    this.handle = this.timers.setTimeout(
      () => this.wake(),
      Math.max(0, at - this.timers.now()),
    );
  }

  private wake(): void {
    this.beforeTicks();
    const owed = this.due() - this.world.state.tick;
    const run = Math.min(owed, this.maxCatchUp);
    for (let i = 0; i < run && this.world.status === "running"; i++) {
      this.world.tick();
    }
    if (owed > this.maxCatchUp) this.rebase();
    if (this.world.status === "ended") {
      this.handle = null;
      return;
    }
    this.schedule();
  }
}
