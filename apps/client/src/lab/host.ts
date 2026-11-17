// The lab's local server (plan section 13, P5, P10): what the worker runs,
// kept free of the worker API so it can be tested with a fake clock. It
// creates the battle, steps it on a clock that accumulates real time (the
// ticks due since the clock started, so it never drifts), applies the inputs
// that arrived during a tick on the next one, sends the view and the events
// of each tick, keeps the log, and hashes the state at the end.

import {
  BattleSetupError,
  battleView,
  createBattle,
  createLog,
  serializeBattle,
  stepLogged,
  type BattleEvent,
  type BattleLog,
  type BattleState,
} from "@geometrix/battle";
import type { FromWorker, Speed, ToWorker } from "./protocol.ts";

/** The worker's timers, or a fake clock in the tests. */
export type Timers = {
  now(): number;
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
};

/** sha256 of a text, as lowercase hex (Web Crypto in the worker). */
export type Hasher = (text: string) => Promise<string>;

/**
 * A late wake steps at most this many ticks; past that, the clock starts over
 * from now instead of rushing (a tab in the background, a debugger pause).
 */
export const MAX_CATCH_UP_TICKS = 40;

/** A battle that never ends stops here when run at once (10 minutes). */
export const MAX_INSTANT_SECONDS = 600;

export async function webSha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export class LabHost {
  private state: BattleState | null = null;
  private log: BattleLog | null = null;
  private pending: { seq: number; command: unknown }[] = [];
  /** The page's number of the current battle. */
  private battle = 0;
  private speed: Speed = 1;
  private paused = false;
  /** Clock origin and the ticks stepped since it (plan P10). */
  private origin = 0;
  private stepped = 0;
  private timer: unknown = null;
  private readonly post: (message: FromWorker) => void;
  private readonly timers: Timers;
  private readonly sha256: Hasher;

  constructor(
    post: (message: FromWorker) => void,
    timers: Timers,
    sha256: Hasher = webSha256,
  ) {
    this.post = post;
    this.timers = timers;
    this.sha256 = sha256;
  }

  handle(message: ToWorker): void {
    switch (message.type) {
      case "start":
        this.start(message);
        return;
      case "input":
        // An ended battle takes nothing (spec F-4), nor does a new one take
        // the previous one's; a paused one keeps the input for the tick
        // after it resumes.
        if (
          this.state !== null &&
          this.state.ended === null &&
          message.battle === this.battle
        ) {
          this.pending.push({ seq: message.seq, command: message.command });
        }
        return;
      case "pause":
        this.paused = true;
        this.stopClock();
        return;
      case "resume":
        this.paused = false;
        this.restartClock();
        return;
      case "speed":
        this.speed = message.speed;
        this.restartClock();
        return;
      case "export":
        void this.export();
        return;
      case "gambits": {
        const who = this.state?.participants.find((p) => p.id === message.id);
        this.post({
          type: "gambits",
          id: message.id,
          gambits: who === undefined ? null : who.gambits,
        });
        return;
      }
    }
  }

  private start(message: Extract<ToWorker, { type: "start" }>): void {
    this.stopClock();
    this.battle = message.battle;
    try {
      this.state = createBattle(message.setup, message.params);
    } catch (error) {
      if (!(error instanceof BattleSetupError)) throw error;
      this.state = null;
      this.post({ type: "error", message: error.reason });
      return;
    }
    this.log = createLog(message.setup, message.params);
    this.pending = [];
    this.speed = message.speed;
    this.paused = false;
    this.post({
      type: "frame",
      battle: this.battle,
      view: battleView(this.state),
      events: [],
      applied: [],
    });
    this.restartClock();
  }

  private msPerTick(): number {
    const tps = this.state!.params.tick.ticksPerSecond;
    return 1000 / (tps * (this.speed === "instant" ? 1 : this.speed));
  }

  private stopClock(): void {
    if (this.timer !== null) this.timers.clear(this.timer);
    this.timer = null;
  }

  /** Starts the clock over from now: on start, resume and a speed change. */
  private restartClock(): void {
    this.stopClock();
    if (this.state === null || this.state.ended !== null || this.paused) return;
    if (this.speed === "instant") {
      this.runToEnd();
      return;
    }
    this.origin = this.timers.now();
    this.stepped = 0;
    this.schedule();
  }

  private schedule(): void {
    const next = this.origin + (this.stepped + 1) * this.msPerTick();
    const wait = Math.max(0, next - this.timers.now());
    this.timer = this.timers.set(() => this.wake(), wait);
  }

  /** Steps the ticks due by now, then waits for the next one. */
  private wake(): void {
    this.timer = null;
    const state = this.state!;
    const due = Math.floor(
      (this.timers.now() - this.origin) / this.msPerTick(),
    );
    let budget = MAX_CATCH_UP_TICKS;
    while (this.stepped < due && budget > 0 && state.ended === null) {
      this.stepOnce();
      budget -= 1;
    }
    if (state.ended !== null) return;
    if (this.stepped < due) {
      this.origin = this.timers.now();
      this.stepped = 0;
    }
    this.schedule();
  }

  private stepOnce(): void {
    const state = this.state!;
    const batch = this.pending;
    this.pending = [];
    const events = stepLogged(
      state,
      this.log!,
      batch.map((b) => b.command),
    );
    this.stepped += 1;
    this.post({
      type: "frame",
      battle: this.battle,
      view: battleView(state),
      events,
      applied: batch.map((b) => b.seq),
    });
    if (state.ended !== null) void this.finish();
  }

  /** Every tick at once (instant): one frame with all the events. */
  private runToEnd(): void {
    const state = this.state!;
    const max = MAX_INSTANT_SECONDS * state.params.tick.ticksPerSecond;
    const events: BattleEvent[] = [];
    const applied = this.pending.map((b) => b.seq);
    let commands = this.pending.map((b) => b.command);
    this.pending = [];
    while (state.ended === null && state.tick < max) {
      events.push(...stepLogged(state, this.log!, commands));
      commands = [];
    }
    this.post({
      type: "frame",
      battle: this.battle,
      view: battleView(state),
      events,
      applied,
    });
    if (state.ended !== null) void this.finish();
  }

  private async finish(): Promise<void> {
    const state = this.state!;
    const json = serializeBattle(state);
    const ticks = state.tick;
    const log = this.log!;
    const hash = await this.sha256(json);
    log.finalHash = hash;
    this.post({ type: "ended", battle: this.battle, hash, ticks });
  }

  /**
   * The log up to now, with the hash of the current state: what
   * `geo battle verify --log` replays and compares (spec R-3).
   */
  private async export(): Promise<void> {
    if (this.state === null || this.log === null) {
      this.post({ type: "error", message: "no battle to export" });
      return;
    }
    const json = serializeBattle(this.state);
    const log: BattleLog = { ...this.log, commands: [...this.log.commands] };
    log.finalHash = await this.sha256(json);
    this.post({ type: "log", log });
  }
}
