// The messages between the lab's page and its worker (M2 laboratório, plan
// section 13). The worker is the local authoritative server (ADR-0008 rule
// 9): it runs the battle and sends what happened. The human's battle
// commands and the frames cross the simulated network (channel.ts); the
// lab's own controls (start, pause, speed, export) and its tooling (the
// gambits of a participant) go straight, since they are not part of a game.

import type {
  BattleCommand,
  BattleEvent,
  BattleLog,
  BattleParams,
  BattleSetup,
  BattleView,
  Gambit,
} from "@geometrix/battle";

/** ×1, ×4, or every tick at once (only with the AI; plan section 13). */
export type Speed = 1 | 4 | "instant";

export type ToWorker =
  | { type: "start"; setup: BattleSetup; params: BattleParams; speed: Speed }
  /** A battle command, numbered by the page to measure its delay (L-4). */
  | { type: "input"; seq: number; command: BattleCommand }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "speed"; speed: Speed }
  /** The log so far, with the hash of the current state (spec R-3). */
  | { type: "export" }
  /** The gambits of a participant, for the editor (spec L-7). */
  | { type: "gambits"; id: number };

/** What crosses the channel back to the page. */
export type Frame = {
  type: "frame";
  view: BattleView;
  /** The events of the ticks since the last frame (one tick, or all at once). */
  events: BattleEvent[];
  /** The `seq` of the inputs applied on this tick. */
  applied: number[];
};

export type Ended = {
  type: "ended";
  /** sha256 of serializeBattle at the end, as `geo battle verify` computes it. */
  hash: string;
  ticks: number;
};

export type FromWorker =
  | Frame
  | Ended
  | { type: "log"; log: BattleLog }
  | { type: "gambits"; id: number; gambits: Gambit[] | null }
  | { type: "error"; message: string };

/** The messages that travel over the simulated network (spec L-3). */
export function crossesChannel(message: FromWorker): message is Frame | Ended {
  return message.type === "frame" || message.type === "ended";
}
