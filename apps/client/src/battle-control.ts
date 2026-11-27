// What drives the world client's battle screen (junction spec D11, N-1, N-2;
// plan section 8): opening a battle's screen (by itself, from the map's
// battle sign, or to go back to it), the opening and the frames the server
// sends while it shows, going back to the map, showing it again after a
// reconnect, and the keyboard's commands for the dominated participant.

import type { BattleInputCommand } from "@geometrix/protocol";
import {
  autoOpen,
  framedScreen,
  openedScreen,
  type Lock,
} from "./battle-session.ts";
import type { BattleMessage, CommandResult } from "./connection.ts";
import { REJECT_TEXTS } from "./format.ts";
import type { GameStore } from "./store.ts";

/** The part of the connection the battle screen uses; tests pass a fake. */
export type BattleLink = {
  battleScreen(battleId: number | null): Promise<CommandResult>;
  battleInput(
    battleId: number,
    command: BattleInputCommand,
  ): Promise<CommandResult>;
  battlePause(battleId: number): Promise<CommandResult>;
};

/** How much of a new round trip goes into the average (per mille). */
const RTT_WEIGHT_PERMILLE = 200;

export class BattleControl {
  /** The last (creep, battle) the auto-open saw (battle-session.ts). */
  private lock: Lock | null = null;
  /**
   * The battle inputs' round trip, smoothed (ms): how far the predict motion
   * option lets the dominated creep run ahead (D19). 0 until one comes back.
   */
  rttMs = 0;

  private readonly store: GameStore;
  private readonly link: BattleLink;
  private readonly now: () => number;

  constructor(store: GameStore, link: BattleLink, now: () => number) {
    this.store = store;
    this.link = link;
    this.now = now;
  }

  /**
   * Shows `battleId`'s screen in place of the map: the server answers with
   * its opening, then its frames. A refusal goes back to the map, with why.
   */
  open(battleId: number): void {
    const { store } = this;
    // The world froze: its battles stopped and have no screen (E-min D6).
    if (store.result.value !== null) {
      store.notify(REJECT_TEXTS.worldEnded, this.now());
      return;
    }
    if (store.shownBattle.value === battleId) return;
    store.shownBattle.value = battleId;
    store.battleScreen.value = null;
    this.ask(battleId);
  }

  /**
   * Back to the map (D11): the server stops the frames, and the dominated
   * creep goes back to its gambits on the world clock (D13).
   */
  close(): void {
    const { store } = this;
    if (store.shownBattle.value === null) return;
    store.shownBattle.value = null;
    store.battleScreen.value = null;
    void this.link.battleScreen(null);
  }

  /**
   * N-1: called with each view; opens the battle of the dominated creep when
   * it enters one, or when the player dominates a creep already in one.
   */
  follow(mine: { id: number; battle: number | null } | null): void {
    if (this.store.result.value !== null) return;
    const { lock, open } = autoOpen(this.lock, mine);
    this.lock = lock;
    if (open !== null) this.open(open);
  }

  /** The world ended: the battle screens close and the holds go (D6). */
  worldEnded(): void {
    this.close();
    this.store.holds.value = new Map();
  }

  /**
   * The socket came back: the server forgot the screen with the old socket,
   * so a battle still going on is asked for again.
   */
  reconnected(): void {
    const id = this.store.shownBattle.value;
    if (id === null || this.store.battleScreen.value?.ended != null) return;
    this.ask(id);
  }

  /**
   * A battle's hold, of any of the team's battles, or the opening or a frame
   * of the battle shown.
   */
  receive(message: BattleMessage, now: number): void {
    const { store } = this;
    if (message.type === "battleHold") {
      const holds = new Map(store.holds.value);
      if (message.state === null) holds.delete(message.battleId);
      else {
        holds.set(message.battleId, {
          state: message.state,
          endsAt:
            message.remainingMs === null ? null : now + message.remainingMs,
        });
      }
      store.holds.value = holds;
      return;
    }
    if (message.battleId !== store.shownBattle.value) return;
    if (message.type === "battleOpen") {
      store.battleScreen.value = openedScreen(message, now);
      return;
    }
    const screen = store.battleScreen.value;
    if (screen === null || screen.battleId !== message.battleId) return;
    store.battleScreen.value = framedScreen(screen, message, now);
  }

  /**
   * The socket dropped: a hold that ends while it is down sends nothing, and
   * the server tells a new socket the ones still on.
   */
  dropped(): void {
    this.store.holds.value = new Map();
  }

  /** P (D28): pauses the battle shown, or resumes it, after a countdown. */
  pause(): void {
    const id = this.store.shownBattle.value;
    if (id === null) return;
    void this.link.battlePause(id).then((result) => {
      if (result.ok || result.reason === "disconnected") return;
      this.store.notify(REJECT_TEXTS[result.reason], this.now());
    });
  }

  /**
   * A command of the keyboard for the participant this player dominates.
   * The server drops it while the battle is still on the world clock (F4
   * interpretation 2); a refusal is not worth a notice.
   */
  input(command: BattleInputCommand): void {
    const id = this.store.shownBattle.value;
    if (id === null) return;
    const sent = this.now();
    void this.link.battleInput(id, command).then((result) => {
      if (!result.ok) return;
      const rtt = this.now() - sent;
      this.rttMs =
        this.rttMs === 0
          ? rtt
          : this.rttMs + ((rtt - this.rttMs) * RTT_WEIGHT_PERMILLE) / 1000;
    });
  }

  private ask(battleId: number): void {
    void this.link.battleScreen(battleId).then((result) => {
      const { store } = this;
      if (result.ok || store.shownBattle.value !== battleId) return;
      // A dropped socket asks again when it comes back.
      if (result.reason === "disconnected") return;
      // The battle is over and its end already on the screen: it stays.
      if (store.battleScreen.value?.ended != null) return;
      store.notify(REJECT_TEXTS[result.reason], this.now());
      store.shownBattle.value = null;
      store.battleScreen.value = null;
    });
  }
}
