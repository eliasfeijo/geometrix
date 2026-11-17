// The keyboard of the lab (spec D13, L-2; plan section 13, P4): keys become
// the battle's commands for the dominated participant. Arrows or WASD hold
// the intent to walk (the last one pressed wins; on a rock or a creep the
// creep only turns); Shift + a direction only turns; Space held attacks, and
// its tap also arms the latch, so a quick tap still fires; Q drops the bag,
// E picks up; Tab moves the domination to the next participant and 0
// releases it. Keys are read by position (`code`), so WASD works on any
// layout. A new intent goes out only when it changes: with latency, one
// message on press and one on release, never one per cell.

import type { BattleCommand, Dir } from "@geometrix/battle";

export type KeyLike = { code: string; shiftKey: boolean; repeat: boolean };

const MOVE_KEYS: Record<string, Dir> = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};

/** What a key asks of the page. */
export type KeyResult = {
  /** The key belongs to the lab: the page stops its default. */
  handled: boolean;
  commands: BattleCommand[];
  /** Tab: dominate the next participant. */
  cycle?: boolean;
  /** 0: release the domination. */
  release?: boolean;
};

const IGNORED: KeyResult = { handled: false, commands: [] };

export class KeyboardInput {
  /** Direction keys held, the last pressed at the end. */
  private held: Dir[] = [];
  private attack = false;
  /** The last intent sent, to send only changes. */
  private sent: { move: Dir | null; attack: boolean } = {
    move: null,
    attack: false,
  };

  /** A key pressed; `id` is the dominated participant, if any. */
  down(key: KeyLike, id: number | null): KeyResult {
    if (key.code === "Tab") return { handled: true, commands: [], cycle: true };
    if (key.code === "Digit0" || key.code === "Numpad0") {
      return { handled: true, commands: [], release: true };
    }
    const dir = MOVE_KEYS[key.code];
    const known =
      dir !== undefined || ["Space", "KeyQ", "KeyE"].includes(key.code);
    if (!known) return IGNORED;
    if (key.repeat || id === null) return { handled: true, commands: [] };
    const commands: BattleCommand[] = [];
    if (dir !== undefined) {
      if (key.shiftKey) {
        commands.push({ type: "face", id, dir });
      } else {
        this.held = [...this.held.filter((d) => d !== dir), dir];
      }
    } else if (key.code === "Space") {
      this.attack = true;
      commands.push({ type: "attackOnce", id });
    } else if (key.code === "KeyQ") {
      commands.push({ type: "drop", id });
    } else {
      commands.push({ type: "pickup", id });
    }
    return { handled: true, commands: [...commands, ...this.intent(id)] };
  }

  /** A key released. */
  up(key: KeyLike, id: number | null): KeyResult {
    const dir = MOVE_KEYS[key.code];
    if (dir !== undefined) {
      this.held = this.held.filter((d) => d !== dir);
    } else if (key.code === "Space") {
      this.attack = false;
    } else {
      return IGNORED;
    }
    return { handled: true, commands: id === null ? [] : this.intent(id) };
  }

  /** The page lost the keyboard (blur): everything is released. */
  releaseAll(id: number | null): BattleCommand[] {
    this.held = [];
    this.attack = false;
    return id === null ? [] : this.intent(id);
  }

  /**
   * The domination moved to `id`: it starts still (spec D12), so what is
   * still held goes to it again.
   */
  retarget(id: number): BattleCommand[] {
    this.sent = { move: null, attack: false };
    return this.intent(id);
  }

  private intent(id: number): BattleCommand[] {
    const move = this.held.at(-1) ?? null;
    if (move === this.sent.move && this.attack === this.sent.attack) return [];
    this.sent = { move, attack: this.attack };
    return [{ type: "intent", id, move, attack: this.attack }];
  }
}
