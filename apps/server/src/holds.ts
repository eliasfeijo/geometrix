// The holds of a world's battles (M2 R plan section 6, P11), in real time: the
// opening pause when a team in a new battle has a human connected (R spec D6)
// and the humans' pause (D28). Per battle, a small state machine:
//
//   battle opens ──> opening ──(openingMs)──> running
//   running ──P──> pausing ──(countdownMs)──> paused
//   paused ──P, or no human left──> resuming ──(countdownMs)──> running
//
// The battle does not advance while opening, paused or resuming: the junction
// host holds it (setHold). Nothing here is stored, so after a restart a held
// battle goes on with the world clock (OC-6, BP-4). Every change is told to
// the listeners as the battleHold message the teams in the battle get.

import type {
  BattleHoldMessage,
  BattleHoldState,
  RejectReason,
} from "@geometrix/protocol";
import type { SimEvent } from "@geometrix/sim";
import type { Timers } from "./loop.ts";
import type { WorldHost } from "./world-host.ts";

type Hold = {
  battleId: number;
  /** The teams with a side in the battle when the hold began or changed. */
  teams: number[];
  state: BattleHoldState;
  /** The countdown running, or null while paused. */
  timer: { handle: unknown; endsAt: number } | null;
};

export type HoldListener = (
  message: BattleHoldMessage,
  teams: readonly number[],
) => void;

export class Holds {
  private readonly holds = new Map<number, Hold>();
  private readonly listeners: HoldListener[] = [];
  private stopped = false;
  private readonly host: WorldHost;
  private readonly timers: Timers;
  private readonly connected: (playerId: number) => boolean;

  /** `connected` says whether a player has a socket open now. */
  constructor(
    host: WorldHost,
    timers: Timers,
    connected: (playerId: number) => boolean,
  ) {
    this.host = host;
    this.timers = timers;
    this.connected = connected;
    host.onTick((events) => this.ticked(events));
    host.onScreens(() => this.check());
  }

  onChange(listener: HoldListener): void {
    this.listeners.push(listener);
  }

  /** What holds the team's battles now, for a socket that just connected. */
  current(team: number): BattleHoldMessage[] {
    return [...this.holds.values()]
      .filter((hold) => hold.teams.includes(team))
      .map((hold) => this.message(hold));
  }

  /**
   * P on a battle screen (D28): pauses a running battle or resumes a paused
   * one, after the countdown. Only for a player who controls a participant
   * (BP-3).
   */
  request(playerId: number, battleId: number): RejectReason | null {
    if (this.host.status === "ended") return "worldEnded";
    if (this.host.battleTeams(battleId) === null) return "unknownBattle";
    if (!this.host.controls(playerId, battleId)) return "notControlling";
    const hold = this.holds.get(battleId);
    if (hold === undefined) {
      this.countdown(battleId, "pausing", this.countdownMs);
    } else if (hold.state === "paused") {
      this.countdown(battleId, "resuming", this.countdownMs);
    } else {
      return "countingDown";
    }
    return null;
  }

  /** Drops every countdown (server shutdown, or the world ended). */
  stop(): void {
    this.stopped = true;
    for (const hold of this.holds.values()) this.clearTimer(hold);
    this.holds.clear();
  }

  private get countdownMs(): number {
    return this.host.state.params.battle.hold.countdownMs;
  }

  private ticked(events: readonly SimEvent[]): void {
    if (this.stopped) return;
    if (this.host.status === "ended") {
      this.stop();
      return;
    }
    const { openingMs } = this.host.state.params.battle.hold;
    for (const event of events) {
      // Only the opening holds: a join does not (OC-5).
      if (event.type !== "battleOpened" || openingMs === 0) continue;
      const teams = this.host.battleTeams(event.battle);
      if (teams === null || !this.humanConnected(teams)) continue;
      this.countdown(event.battle, "opening", openingMs);
      this.host.setHold(event.battle, true);
    }
    this.check();
  }

  private humanConnected(teams: readonly number[]): boolean {
    return this.host.state.players.some(
      (p) => !p.bot && teams.includes(p.team) && this.connected(p.id),
    );
  }

  /**
   * Forgets the holds of battles that ended, and starts resuming a paused
   * battle no human controls on its screen any more (BP-4).
   */
  private check(): void {
    if (this.stopped) return;
    for (const hold of [...this.holds.values()]) {
      if (this.host.battleTeams(hold.battleId) === null) {
        this.end(hold);
      } else if (
        hold.state === "paused" &&
        !this.host.humanControlled(hold.battleId)
      ) {
        this.countdown(hold.battleId, "resuming", this.countdownMs);
      }
    }
  }

  /** Puts the battle in `state` for `ms`, then moves it on. */
  private countdown(
    battleId: number,
    state: BattleHoldState,
    ms: number,
  ): void {
    const old = this.holds.get(battleId);
    if (old !== undefined) this.clearTimer(old);
    const hold: Hold = {
      battleId,
      teams: this.host.battleTeams(battleId) ?? old?.teams ?? [],
      state,
      timer: {
        handle: this.timers.setTimeout(() => this.elapsed(hold), ms),
        endsAt: this.timers.now() + ms,
      },
    };
    this.holds.set(battleId, hold);
    this.tell(hold);
  }

  private elapsed(hold: Hold): void {
    if (this.stopped || this.holds.get(hold.battleId) !== hold) return;
    hold.timer = null;
    if (this.host.battleTeams(hold.battleId) === null) {
      this.end(hold);
    } else if (hold.state === "pausing") {
      this.host.setHold(hold.battleId, true);
      hold.state = "paused";
      this.tell(hold);
      this.check();
    } else {
      this.host.setHold(hold.battleId, false);
      this.end(hold);
    }
  }

  /** Nothing holds the battle any more. */
  private end(hold: Hold): void {
    this.clearTimer(hold);
    this.holds.delete(hold.battleId);
    const message: BattleHoldMessage = {
      type: "battleHold",
      battleId: hold.battleId,
      state: null,
      remainingMs: null,
    };
    for (const listener of this.listeners) listener(message, hold.teams);
  }

  private clearTimer(hold: Hold): void {
    if (hold.timer !== null) this.timers.clearTimeout(hold.timer.handle);
    hold.timer = null;
  }

  private message(hold: Hold): BattleHoldMessage {
    return {
      type: "battleHold",
      battleId: hold.battleId,
      state: hold.state,
      remainingMs:
        hold.timer === null
          ? null
          : Math.max(0, Math.round(hold.timer.endsAt - this.timers.now())),
    };
  }

  private tell(hold: Hold): void {
    const message = this.message(hold);
    for (const listener of this.listeners) listener(message, hold.teams);
  }
}
