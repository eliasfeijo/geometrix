// One team's stream of view deltas (M1.5 plan section 5). Every send diffs the
// team's view against what the team already received, numbers the delta and
// serializes it once for all the team's sockets. Teams with no socket advance
// too (plan R7), so whoever connects next starts from a right base: the last
// view sent, rebuilt from the sent record (spec S-1).

import { randomUUID } from "node:crypto";
import {
  diffView,
  emptySent,
  sentView,
  type DeltaMessage,
  type Sent,
  type WorldStatus,
} from "@geometrix/protocol";
import { view, type TeamView, type WorldState } from "@geometrix/sim";
import { viewHash } from "./hash.ts";

export type StreamOptions = {
  /** A delta whose tick reaches a multiple of this carries the view hash. */
  hashEveryTicks: number;
};

export class TeamStream {
  /** New in each server process: a seq means nothing across restarts. */
  readonly id: string;
  readonly team: number;
  private readonly sent: Sent = emptySent();
  private readonly options: StreamOptions;
  private seqNow = 0;
  private status: WorldStatus;

  constructor(
    state: WorldState,
    team: number,
    status: WorldStatus,
    options: StreamOptions,
    id: string = randomUUID(),
  ) {
    this.id = id;
    this.team = team;
    this.status = status;
    this.options = options;
    // The base: what a welcome carries before the first delta.
    diffView(this.sent, view(state, team));
  }

  /** Seq of the last view sent; 0 for the base. */
  get seq(): number {
    return this.seqNow;
  }

  /**
   * The delta message from the last view sent to the state now. It carries
   * the view hash when the ticks it covers reach a multiple of
   * hashEveryTicks: every N ticks at ×1, and still once per N ticks when a
   * send covers several (spec S-4).
   */
  advance(state: WorldState, status: WorldStatus): string {
    const { hashEveryTicks } = this.options;
    const before = this.sent.tick;
    const seen = view(state, this.team);
    const delta = diffView(this.sent, seen);
    this.seqNow += 1;
    const message: DeltaMessage = { type: "delta", seq: this.seqNow, delta };
    if (status !== this.status) {
      message.status = status;
      this.status = status;
    }
    if (
      Math.floor(seen.tick / hashEveryTicks) >
      Math.floor(before / hashEveryTicks)
    ) {
      message.hash = viewHash(seen);
    }
    return JSON.stringify(message);
  }

  /** The last view sent, with its seq and status: a welcome's content. */
  lastView(): { seq: number; view: TeamView; status: WorldStatus } {
    return { seq: this.seqNow, view: sentView(this.sent), status: this.status };
  }
}
