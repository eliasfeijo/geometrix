// Client state for one connected world, as signals: what the server sent (the
// static part from the welcome, the two latest dynamic states for
// interpolation) plus what is local to this client (selection, notices).

import { computed, signal } from "@preact/signals";
import type {
  DynamicState,
  WelcomeMessage,
  WorldStatus,
} from "@geometrix/protocol";
import type {
  ConnectionStatus,
  FatalReason,
  WorldMessage,
} from "./connection.ts";
import type { Cell } from "@geometrix/sim";
import type { Selection } from "./map/pick.ts";
import type { Size, View } from "./map/view.ts";

/**
 * What a click on the map does besides selecting: pick a cell for a form
 * (e.g. the roadBuilder target), or give buildRoad orders (road mode).
 */
export type Mode =
  | { type: "select" }
  | { type: "pickCell"; prompt: string; pick(cell: Cell): void }
  | { type: "road" };

/** A dynamic state and when it arrived (performance.now(), ms). */
export type Snapshot = { state: DynamicState; at: number };

/** What the welcome tells once: it does not change while connected. */
export type WorldInfo = Omit<WelcomeMessage, "type" | "state" | "status">;

export type Notice = { id: number; text: string; at: number };

export const NOTICE_MS = 4000;

export class GameStore {
  readonly info = signal<WorldInfo | null>(null);
  /** The state before `current`, or null right after a welcome. */
  readonly previous = signal<Snapshot | null>(null);
  readonly current = signal<Snapshot | null>(null);
  readonly status = signal<WorldStatus>("running");
  readonly connection = signal<ConnectionStatus>("connecting");
  readonly fatal = signal<FatalReason | null>(null);
  /** Player names by id, from GET /api/worlds (the state has none). */
  readonly names = signal<ReadonlyMap<number, string>>(new Map());
  readonly notices = signal<Notice[]>([]);
  private nextNotice = 1;
  /** Pan and zoom; null until the map element has a size. */
  readonly view = signal<View | null>(null);
  readonly mapSize = signal<Size>({ width: 0, height: 0 });
  readonly selection = signal<Selection | null>(null);
  readonly mode = signal<Mode>({ type: "select" });

  /** This player, once the join is in the state (the tick after joining). */
  readonly me = computed(() => {
    const info = this.info.value;
    const state = this.current.value?.state;
    if (info === null || state === undefined) return null;
    return state.players.find((p) => p.id === info.playerId) ?? null;
  });

  /** Whether commands can go out: joined, connected and the world running. */
  readonly canAct = computed(
    () =>
      this.me.value !== null &&
      this.connection.value === "open" &&
      this.status.value === "running",
  );

  receive(message: WorldMessage, now: number): void {
    if (message.type === "welcome") {
      const { state, status, ...rest } = message;
      const info: WorldInfo & { type?: string } = { ...rest };
      delete info.type;
      this.info.value = info;
      this.status.value = status;
      this.previous.value = null;
      this.current.value = { state, at: now };
      return;
    }
    const current = this.current.value;
    // A state older than the one shown (e.g. sent before a reconnect) is late.
    if (current !== null && message.state.tick < current.state.tick) return;
    this.previous.value = current;
    this.current.value = { state: message.state, at: now };
    this.status.value = message.status;
  }

  notify(text: string, now: number): void {
    const fresh = this.notices.value.filter((n) => now - n.at < NOTICE_MS);
    this.notices.value = [...fresh, { id: this.nextNotice++, text, at: now }];
  }

  dismiss(id: number): void {
    this.notices.value = this.notices.value.filter((n) => n.id !== id);
  }

  /** The creep this player dominates (at most one, D-2). */
  readonly myCreep = computed(() => {
    const id = this.info.value?.playerId;
    const state = this.current.value?.state;
    return state?.creeps.find((c) => c.dominatedBy === id) ?? null;
  });

  /** Whether some player in the state has no known name yet. */
  missingNames(): boolean {
    const names = this.names.value;
    const players = this.current.value?.state.players ?? [];
    return players.some((p) => !names.has(p.id));
  }
}
