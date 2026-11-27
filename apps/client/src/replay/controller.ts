// Drives a replay frame by frame and feeds the game screen's store: a
// synthetic welcome (after loading or a seek) and then a view per frame in
// which the tick moved, as the server's welcome and deltas would leave it. The screen
// calls frame() on every animation frame; tests call it directly.

import { PROTOCOL_VERSION, mapSize, type Replay } from "@geometrix/protocol";
import { signal } from "@preact/signals";
import { fullView, SIM_VERSION } from "@geometrix/sim";
import { GameStore } from "../store.ts";
import { stateHash } from "./hash.ts";
import {
  initialHidden,
  markersOf,
  type Marker,
  type MarkerKind,
} from "./markers.ts";
import { ReplayPlayer } from "./player.ts";
import {
  dueTicks,
  FRAME_BUDGET_MS,
  RateMeter,
  type Speed,
} from "./playback.ts";

/** Real time a frame spends on the opening scan: a loading screen, not play. */
export const SCAN_BUDGET_MS = 40;

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
  /** Where the timeline's thumb is while dragged, else null. */
  readonly thumb = signal<number | null>(null);
  /** The scan pass is running: the marks are not all there yet (P10). */
  readonly scanning = signal(false);
  /** The timeline's marks (D11), growing while the scan goes. */
  readonly markers = signal<readonly Marker[]>([]);
  readonly hidden = signal<ReadonlySet<MarkerKind>>(new Set());
  /** Ticks per real second while playing. */
  readonly rate = signal<number | null>(null);
  private readonly clock: () => number;
  private readonly meter = new RateMeter();
  private carry = 0;
  private lastFrame: number | null = null;
  /** Bumped by every seek: a hash computed before it is stale. */
  private generation = 0;
  /** The tick of the view last handed over: the chronicle reaches it. */
  private published = 0;

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

  /**
   * The scan pass (E-min D11, plan P10): runs to the last tick in chunks,
   * which takes every checkpoint, keeps every event and checks the hash, then
   * goes back to tick 0 with the marks ready.
   */
  startScan(): void {
    if (this.replay.ticks === 0) return;
    this.pause();
    this.scanning.value = true;
  }

  toggle(kind: MarkerKind): void {
    const hidden = new Set(this.hidden.value);
    if (!hidden.delete(kind)) hidden.add(kind);
    this.hidden.value = hidden;
  }

  play(): void {
    if (this.scanning.value) return;
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
    if (this.scanning.value) return;
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
    if (this.scanning.value) {
      this.scan(now);
      return;
    }
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

  /** One frame of the scan pass. */
  private scan(now: number): void {
    const deadline = now + SCAN_BUDGET_MS;
    this.player.runTo(this.replay.ticks, () => this.clock() < deadline);
    const events = this.player.eventsBetween(0, this.player.tick);
    this.markers.value = markersOf(events);
    this.tick.value = this.player.tick;
    if (!this.player.ended) return;
    // The hash of the last tick, before going back.
    this.checkHash();
    this.hidden.value = initialHidden(this.markers.value);
    this.scanning.value = false;
    this.player.seek(0);
    this.tick.value = 0;
    this.arrived(now);
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
    const seen = structuredClone(fullView(state));
    if (kind === "state") {
      this.store.show(seen, now);
      this.store.chronicled(
        this.player.eventsBetween(this.published, state.tick),
      );
      this.published = state.tick;
      return;
    }
    this.published = state.tick;
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
        map: mapSize(state),
        stream: "replay",
        seq: 0,
        view: seen,
        // Every event up to here (fullView); the store keeps the latest.
        chronicle: this.player.eventsBetween(0, state.tick),
      },
      now,
    );
  }
}
