// Client state for one connected world, as signals: what the server sent (the
// part that does not change from the welcome, the two latest views of the team for
// interpolation, rebuilt from the deltas) plus what is local to this client
// (selection, notices).

import { computed, signal } from "@preact/signals";
import type { WelcomeMessage, WorldStatus } from "@geometrix/protocol";
import { applyDelta } from "@geometrix/protocol/stream";
import type {
  ConnectionStatus,
  FatalReason,
  WorldMessage,
} from "./connection.ts";
import {
  isOwnCreep,
  type Cell,
  type CreepView,
  type TeamEvent,
  type TeamView,
} from "@geometrix/sim";
import { viewHash } from "./hash.ts";
import { knownTerrain } from "./map/terrain.ts";
import { NetStats } from "./net-stats.ts";
import type { Selection } from "./map/pick.ts";
import type { Point, Size, View } from "./map/view.ts";

/**
 * What a click on the map does besides selecting: pick a cell for a form
 * (e.g. the roadBuilder target), or give buildRoad orders (road mode).
 */
export type Mode =
  | { type: "select" }
  | { type: "pickCell"; prompt: string; pick(cell: Cell): void }
  | { type: "road" };

/** A view of the team and when it arrived (performance.now(), ms). */
export type Snapshot = { state: TeamView; at: number };

/** What the welcome tells once: it does not change while connected. */
export type WorldInfo = Omit<
  WelcomeMessage,
  "type" | "protocol" | "stream" | "seq" | "view" | "status" | "chronicle"
>;

export type Notice = { id: number; text: string; at: number };

export const NOTICE_MS = 4000;

/**
 * Entries of the chronicle a client keeps (M2 encontro C-4): the server's
 * welcome brings 100; a long session drops the oldest past this.
 */
export const CHRONICLE_KEEP = 300;

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
  /** The team's events, oldest first (M2 encontro C-4, N-1). */
  readonly chronicle = signal<readonly TeamEvent[]>([]);
  private nextNotice = 1;
  /** Pan and zoom; null until the map element has a size. */
  readonly view = signal<View | null>(null);
  readonly mapSize = signal<Size>({ width: 0, height: 0 });
  readonly selection = signal<Selection | null>(null);
  /** The list of a clicked stack, opened at a pixel of the map. */
  readonly stack = signal<{ ids: number[]; at: Point } | null>(null);
  /**
   * The right-click menu over enemies in sight (M2 encontro C-6): their ids,
   * opened at a pixel of the map.
   */
  readonly approach = signal<{ ids: number[]; at: Point } | null>(null);
  /** Creep under the pointer in the stack list, highlighted on the map. */
  readonly hovered = signal<number | null>(null);
  readonly mode = signal<Mode>({ type: "select" });
  /** Cell under the pointer, while it is over the map and not dragging. */
  readonly pointerCell = signal<Cell | null>(null);
  /** The map point under the pointer, likewise: for the cursor (fog F6, E4). */
  readonly pointer = signal<Point | null>(null);
  /** Last order target, drawn briefly as feedback. */
  readonly ping = signal<{ cell: Cell; id: number } | null>(null);

  /**
   * The view's known array: computed only so that `map` changes when the
   * team explores, not on every delta (applyDelta keeps the array otherwise).
   */
  private readonly known = computed(() => this.current.value?.state.known);

  /**
   * The map as the team knows it (fog plan section 9): the terrain of the
   * cells explored, and jungle where never seen, as the sim's paths count it.
   */
  readonly map = computed(() => {
    const info = this.info.value;
    const known = this.known.value;
    if (info === null || known === undefined) return null;
    return { ...info.map, terrain: knownTerrain(known) };
  });

  /** Each team's core by team id, null while the team has not seen it. */
  readonly cores = computed(
    () => this.current.value?.state.teams.map((t) => t.core) ?? [],
  );

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

  /** Network counters (spec D8): the connection's, plus the hash checks. */
  readonly net = new NetStats();
  /** Called when a delta's view hash does not match ours (spec C-3). */
  hashMismatch: (() => void) | null = null;
  /** Bumped by each welcome: a hash check of an older base is moot. */
  private base = 0;

  receive(message: WorldMessage, now: number): void {
    if (message.type === "welcome") {
      this.base++;
      const { type, protocol, stream, seq, view, status, chronicle, ...info } =
        message;
      void [type, protocol, stream, seq];
      this.info.value = info;
      this.status.value = status;
      this.previous.value = null;
      this.current.value = { state: view, at: now };
      this.chronicle.value = chronicle.slice(-CHRONICLE_KEEP);
      return;
    }
    const current = this.current.value;
    if (current === null) return;
    const next = applyDelta(current.state, message.delta);
    this.show(next, now);
    if (message.events !== undefined) this.chronicled(message.events);
    if (message.status !== undefined) this.status.value = message.status;
    if (message.hash !== undefined) void this.checkHash(next, message.hash);
  }

  /** Compares the server's hash with the view this delta left us with. */
  private async checkHash(view: TeamView, expected: string): Promise<void> {
    const base = this.base;
    const hash = await viewHash(view);
    if (base !== this.base) return;
    if (hash === expected) {
      this.net.hashes.ok++;
    } else {
      this.net.hashes.mismatch++;
      this.hashMismatch?.();
    }
  }

  /**
   * Shows the next view, keeping the current one for the interpolation. The
   * deltas come through here; the replay hands its views directly.
   */
  show(view: TeamView, now: number): void {
    this.previous.value = this.current.value;
    this.current.value = { state: view, at: now };
  }

  /** Appends events to the chronicle, keeping the latest CHRONICLE_KEEP. */
  chronicled(events: readonly TeamEvent[]): void {
    if (events.length === 0) return;
    const all = [...this.chronicle.value, ...events];
    this.chronicle.value =
      all.length > CHRONICLE_KEEP ? all.slice(-CHRONICLE_KEEP) : all;
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
    return (
      state?.creeps.find(
        (c): c is CreepView => isOwnCreep(c) && c.dominatedBy === id,
      ) ?? null
    );
  });

  /** Whether some player in the state has no known name yet. */
  missingNames(): boolean {
    const names = this.names.value;
    const players = this.current.value?.state.players ?? [];
    return players.some((p) => !names.has(p.id));
  }
}
