// The keyboard of the lab (spec D13, L-2; plan section 13, P4): keys become
// the battle's commands for the dominated participant. Arrows or WASD hold
// the intent to walk (the last one pressed wins; on a rock or a creep the
// creep only turns); Shift + a direction only turns; Space held attacks, and
// its tap also arms the latch, so a quick tap still fires; Q drops the bag,
// E picks up, and while held they ride on the intent as its `bag`, which is
// what counts at the end of the countdown (spec S-4: a Q pressed and let go
// during it is discarded); Tab moves the domination to the next participant and 0
// releases it; R restarts the battle and P or Esc pauses it (F5). Keys are
// read by position (`code`), so WASD works on any layout; with Ctrl, Alt or
// Meta they belong to the browser (Ctrl + R still reloads). A new intent goes out only when it changes: with latency, one
// message on press and one on release, never one per cell.

import type { Bag, BattleCommand, Dir } from "@geometrix/battle";

export type KeyLike = {
  code: string;
  shiftKey: boolean;
  repeat: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
};

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
  /** R: restart the battle with the same setup. */
  restart?: boolean;
  /** P or Esc: pause, or resume. */
  pause?: boolean;
};

const withModifier = (key: KeyLike) =>
  key.ctrlKey === true || key.altKey === true || key.metaKey === true;

const IGNORED: KeyResult = { handled: false, commands: [] };

const BAG_KEYS: Record<string, Bag> = { KeyQ: "drop", KeyE: "pickup" };

type Sent = { move: Dir | null; attack: boolean; bag: Bag | null };

export class KeyboardInput {
  /** Direction keys held, the last pressed at the end. */
  private held: Dir[] = [];
  private attack = false;
  /** Bag keys held (Q, E), the last pressed at the end. */
  private bags: Bag[] = [];
  /** The last intent sent, to send only changes. */
  private sent: Sent = { move: null, attack: false, bag: null };

  /** A key pressed; `id` is the dominated participant, if any. */
  down(key: KeyLike, id: number | null): KeyResult {
    if (withModifier(key)) return IGNORED;
    if (key.code === "KeyR") {
      return key.repeat
        ? { handled: true, commands: [] }
        : { handled: true, commands: [], restart: true };
    }
    if (key.code === "KeyP" || key.code === "Escape") {
      return key.repeat
        ? { handled: true, commands: [] }
        : { handled: true, commands: [], pause: true };
    }
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
    } else {
      const bag = BAG_KEYS[key.code]!;
      this.bags = [...this.bags.filter((b) => b !== bag), bag];
      commands.push({ type: bag, id });
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
    } else if (BAG_KEYS[key.code] !== undefined) {
      this.bags = this.bags.filter((b) => b !== BAG_KEYS[key.code]);
    } else {
      return IGNORED;
    }
    return { handled: true, commands: id === null ? [] : this.intent(id) };
  }

  /** The page lost the keyboard (blur): everything is released. */
  releaseAll(id: number | null): BattleCommand[] {
    this.held = [];
    this.attack = false;
    this.bags = [];
    return id === null ? [] : this.intent(id);
  }

  /**
   * The domination moved to `id`: it starts still (spec D12), so what is
   * still held goes to it again.
   */
  retarget(id: number): BattleCommand[] {
    this.sent = { move: null, attack: false, bag: null };
    return this.intent(id);
  }

  /** The intent, if it changed; `bag` only while a bag key is held. */
  private intent(id: number): BattleCommand[] {
    const move = this.held.at(-1) ?? null;
    const bag = this.bags.at(-1) ?? null;
    const { sent } = this;
    if (move === sent.move && this.attack === sent.attack && bag === sent.bag) {
      return [];
    }
    this.sent = { move, attack: this.attack, bag };
    const intent = { type: "intent" as const, id, move, attack: this.attack };
    return [bag === null ? intent : { ...intent, bag }];
  }
}
