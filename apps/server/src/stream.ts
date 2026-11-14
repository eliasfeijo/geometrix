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

export class TeamStream {
  /** New in each server process: a seq means nothing across restarts. */
  readonly id: string;
  readonly team: number;
  private readonly sent: Sent = emptySent();
  private seqNow = 0;
  private status: WorldStatus;

  constructor(
    state: WorldState,
    team: number,
    status: WorldStatus,
    id: string = randomUUID(),
  ) {
    this.id = id;
    this.team = team;
    this.status = status;
    // The base: what a welcome carries before the first delta.
    diffView(this.sent, view(state, team));
  }

  /** Seq of the last view sent; 0 for the base. */
  get seq(): number {
    return this.seqNow;
  }

  /** The delta message from the last view sent to the state now. */
  advance(state: WorldState, status: WorldStatus): string {
    const delta = diffView(this.sent, view(state, this.team));
    this.seqNow += 1;
    const message: DeltaMessage = { type: "delta", seq: this.seqNow, delta };
    if (status !== this.status) {
      message.status = status;
      this.status = status;
    }
    return JSON.stringify(message);
  }

  /** The last view sent, with its seq and status: a welcome's content. */
  lastView(): { seq: number; view: TeamView; status: WorldStatus } {
    return { seq: this.seqNow, view: sentView(this.sent), status: this.status };
  }
}
