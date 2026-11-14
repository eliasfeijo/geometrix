// Replay in the browser (plan section 8, F8 details): the sim runs here, from
// createWorld(seed, params) and the logged commands of each tick, exactly as
// the server and the harness ran it. A checkpoint (the serialized state) is
// kept every world hour; going back restores the nearest one at or before the
// target and simulates again from there.

import type { Replay } from "@geometrix/protocol";
import {
  createWorld,
  restore,
  serialize,
  step,
  type CommandInput,
  type WorldState,
} from "@geometrix/sim";

/** World seconds between two checkpoints. */
export const CHECKPOINT_SECONDS = 3600;

export class ReplayPlayer {
  readonly replay: Replay;
  /** Ticks between two checkpoints (one world hour by default). */
  readonly checkpointEvery: number;
  private current: WorldState;
  private readonly byTick = new Map<number, CommandInput[]>();
  /** Serialized states by tick, at multiples of checkpointEvery. */
  private readonly checkpoints = new Map<number, string>();
  /** The latest checkpoint taken; all the earlier ones exist too. */
  private lastCheckpoint = 0;

  /** `checkpointSeconds` is a world hour; tests use less. */
  constructor(replay: Replay, checkpointSeconds = CHECKPOINT_SECONDS) {
    this.replay = replay;
    this.checkpointEvery = Math.max(
      1,
      Math.floor(checkpointSeconds / replay.params.world.tickSeconds),
    );
    for (const { tick, playerId, command } of replay.commands) {
      const list = this.byTick.get(tick);
      if (list === undefined) this.byTick.set(tick, [{ playerId, command }]);
      else list.push({ playerId, command });
    }
    this.current = createWorld(replay.seed, replay.params);
    this.checkpoints.set(0, serialize(this.current));
  }

  /** The state now. Seeking may replace the object: read it each time. */
  get state(): WorldState {
    return this.current;
  }

  get tick(): number {
    return this.current.tick;
  }

  get ended(): boolean {
    return this.current.tick >= this.replay.ticks;
  }

  /** Ticks of the checkpoints kept so far. */
  get checkpointTicks(): number[] {
    return [...this.checkpoints.keys()];
  }

  /**
   * Steps toward `target` (clamped to the replay) while `more()` says so,
   * checked before each tick. Returns how many ticks it stepped.
   */
  runTo(target: number, more: () => boolean = () => true): number {
    const end = Math.min(target, this.replay.ticks);
    let stepped = 0;
    while (this.current.tick < end && more()) {
      step(this.current, this.byTick.get(this.current.tick) ?? []);
      stepped++;
      const tick = this.current.tick;
      if (tick % this.checkpointEvery === 0 && tick > this.lastCheckpoint) {
        this.checkpoints.set(tick, serialize(this.current));
        this.lastCheckpoint = tick;
      }
    }
    return stepped;
  }

  /**
   * Gets as close to `target` as the checkpoints allow without simulating:
   * back to the nearest checkpoint at or before it when the target is behind,
   * or ahead to one when it is closer than the state now. Returns whether
   * the state was replaced. runTo(target) does the rest.
   */
  seek(target: number): boolean {
    const clamped = Math.max(0, Math.min(target, this.replay.ticks));
    const nearest = Math.min(
      clamped - (clamped % this.checkpointEvery),
      this.lastCheckpoint,
    );
    const behind = clamped < this.current.tick;
    if (!behind && nearest <= this.current.tick) return false;
    this.current = restore(this.checkpoints.get(nearest)!);
    return true;
  }
}
