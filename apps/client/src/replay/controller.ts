// Drives a replay frame by frame and feeds the game screen's store: a
// synthetic welcome (after loading or a seek) and then a view per frame in
// which the tick moved, as the server's welcome and deltas would leave it. The screen
// calls frame() on every animation frame; tests call it directly.

import {
  PROTOCOL_VERSION,
  toStaticMap,
  type Replay,
} from "@geometrix/protocol";
import { signal } from "@preact/signals";
import { SIM_VERSION, view } from "@geometrix/sim";
import { GameStore } from "../store.ts";
import { stateHash } from "./hash.ts";
import { ReplayPlayer } from "./player.ts";
import {
  dueTicks,
  FRAME_BUDGET_MS,
  RateMeter,
  type Speed,
} from "./playback.ts";

/** A spectator has no player id: no creep is "mine", no command goes out. */
export const SPECTATOR_ID = -1;

export type HashCheck =
  | { status: "waiting" }
  | { status: "computing" }
  | { status: "match" | "mismatch"; hash: string };

export class ReplayController {
  readonly player: ReplayPlayer;
  readonly store: GameStore;
  /** Where the replay came from: a server world id, or 0 for a file. */
  readonly worldId: number;
  readonly playing = signal(false);
  readonly speed = signal<Speed>(60);
  readonly tick = signal(0);
  /** The tick a seek is simulating toward, or null. */
  readonly seeking = signal<number | null>(null);
  /** The hash check, done every time the replay reaches its last tick. */
  readonly hash = signal<HashCheck>({ status: "waiting" });
  /** Ticks per real second while playing. */
  readonly rate = signal<number | null>(null);
  private readonly clock: () => number;
  private readonly meter = new RateMeter();
  private carry = 0;
  private lastFrame: number | null = null;
  /** Bumped by every seek: a hash computed before it is stale. */
  private generation = 0;

  constructor(
    replay: Replay,
    worldId: number,
    clock: () => number = () => performance.now(),
    store = new GameStore(),
  ) {
    this.player = new ReplayPlayer(replay);
    this.worldId = worldId;
    this.clock = clock;
    this.store = store;
    this.publish("welcome", clock());
  }

  get replay(): Replay {
    return this.player.replay;
  }

  /** Whether the file comes from another sim version (the hash may differ). */
  get otherVersion(): boolean {
    return this.replay.simVersion !== SIM_VERSION;
  }

  play(): void {
    if (this.player.ended) this.seekTo(0);
    this.playing.value = true;
    this.meter.reset();
    this.carry = 0;
  }

  pause(): void {
    this.playing.value = false;
    this.rate.value = null;
  }

  setSpeed(speed: Speed): void {
    this.speed.value = speed;
    this.meter.reset();
    this.carry = 0;
  }

  /** Jumps to `tick`: restores a checkpoint and simulates the rest in frames. */
  seekTo(tick: number): void {
    const target = Math.max(0, Math.min(tick, this.replay.ticks));
    this.generation++;
    if (this.hash.value.status !== "waiting") {
      this.hash.value = { status: "waiting" };
    }
    this.player.seek(target);
    this.carry = 0;
    if (this.player.tick === target) {
      this.seeking.value = null;
      this.arrived(this.clock());
    } else {
      this.seeking.value = target;
    }
  }

  /** One animation frame at real time `now` (ms). */
  frame(now: number): void {
    const elapsed = this.lastFrame === null ? 0 : now - this.lastFrame;
    this.lastFrame = now;
    const deadline = now + FRAME_BUDGET_MS;
    const inBudget = () => this.clock() < deadline;
    const target = this.seeking.value;
    if (target !== null) {
      this.player.runTo(target, inBudget);
      this.tick.value = this.player.tick;
      if (this.player.tick >= target) {
        this.seeking.value = null;
        this.arrived(now);
      }
      return;
    }
    if (!this.playing.value) return;
    const due = dueTicks(
      this.speed.value,
      elapsed,
      this.replay.params.world.tickSeconds,
      this.carry,
    );
    const before = this.player.tick;
    const stepped = this.player.runTo(before + due.ticks, inBudget);
    // Slower than the speed asks: drop the rest instead of piling it up.
    this.carry = stepped < due.ticks ? 0 : due.carry;
    this.meter.add(now, stepped);
    this.rate.value = this.meter.rate(now);
    if (stepped > 0) this.publish("state", now);
    this.tick.value = this.player.tick;
    if (this.player.ended) {
      this.playing.value = false;
      this.checkHash();
    }
  }

  private arrived(now: number): void {
    this.tick.value = this.player.tick;
    this.publish("welcome", now);
    if (this.player.ended) this.checkHash();
  }

  private checkHash(): void {
    if (this.hash.value.status !== "waiting") return;
    const generation = this.generation;
    this.hash.value = { status: "computing" };
    void stateHash(this.player.state).then((hash) => {
      if (generation !== this.generation) return;
      this.hash.value = {
        status: hash === this.replay.finalHash ? "match" : "mismatch",
        hash,
      };
    });
  }

  /** Hands the state now to the store, detached from the sim's objects. */
  private publish(kind: "welcome" | "state", now: number): void {
    const state = this.player.state;
    const seen = structuredClone(view(state, 0));
    if (kind === "state") {
      this.store.show(seen, now);
      return;
    }
    this.store.receive(
      {
        type: "welcome",
        protocol: PROTOCOL_VERSION,
        worldId: this.worldId,
        playerId: SPECTATOR_ID,
        team: 0,
        status: "running",
        multiplier: 1,
        params: state.params,
        map: toStaticMap(state),
        cores: state.teams.map((t) => ({ ...t.core })),
        stream: "replay",
        seq: 0,
        view: seen,
      },
      now,
    );
  }
}
