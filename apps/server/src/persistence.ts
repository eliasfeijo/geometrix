// SQLite persistence (ADR-0004, plan section 7): worlds, players, the command
// log, snapshots and metrics. Each world has a single writer, the process that
// hosts it; better-sqlite3 is synchronous, which fits the tick loop. A tick is
// stored in one transaction: its commands, the tick it reached and, when due,
// a snapshot and metric samples. The chronicle (M2 encontro plan section 8,
// P7) is derived data (ADR-0007 rule 6): one row per event and team of its
// audience, written with the tick, rebuilt from the log on recovery. The
// battles (junction plan section 6, P6): one row per battle with its setup,
// its params and what the junction host keeps besides the battle (the
// record), and one row per battle tick that had commands; the tick's
// transaction writes the battles opened, the battle ticks run since the
// previous commit, the tick each battle reached and the ends.

import type { BattleParams, BattleSetup, LoggedTick } from "@geometrix/battle";
import type { InstanceRecord } from "@geometrix/junction";
import Database from "better-sqlite3";
import {
  eventsFor,
  type Command,
  type Difficulty,
  type MetricsSample,
  type Params,
  type SimEvent,
  type TeamEvent,
} from "@geometrix/sim";
import type { LoggedCommand, WorldStatus } from "@geometrix/protocol";

export type { LoggedCommand };

export type WorldRow = {
  id: number;
  seed: number;
  params: Params;
  /**
   * The params of the world's battles (junction F4); null for a world stored
   * before they were kept, which gets the server's.
   */
  battleParams: BattleParams | null;
  simVersion: number;
  multiplier: number;
  status: WorldStatus;
  /** Ticks stepped so far: the state to recover is at this tick. */
  tick: number;
  createdAt: string;
};

export type PlayerRow = {
  id: number;
  worldId: number;
  team: number;
  name: string;
  bot: boolean;
  /** A bot's difficulty (R spec D26); null for a human. */
  difficulty: Difficulty | null;
};

export type Snapshot = { tick: number; stateJson: string; stateHash: string };

/** A battle as the battles table keeps it. */
export type BattleRow = {
  battleId: number;
  /** The world tick that opened it. */
  openedTick: number;
  /** The world tick whose step applied its end, or null while it runs. */
  endedTick: number | null;
  battleVersion: number;
  setup: BattleSetup;
  params: BattleParams;
  /** Battle ticks stepped as of the last commit. */
  reachedTick: number;
  record: InstanceRecord;
  /** sha256 of serializeBattle at the end. */
  finalHash: string | null;
};

/** What a tick writes about the battles (ADR-0010 rule 5). */
export type BattlesRecord = {
  opened: Omit<
    BattleRow,
    "endedTick" | "reachedTick" | "record" | "finalHash"
  >[];
  /** The battle ticks with commands run since the previous commit. */
  ticks: { battleId: number; tick: LoggedTick }[];
  /** Every battle stepped or opened since then, ended ones included. */
  reached: { battleId: number; reachedTick: number; record: InstanceRecord }[];
  ended: { battleId: number; endedTick: number; finalHash: string }[];
};

/** What one tick writes, all or nothing. */
export type TickRecord = {
  worldId: number;
  commands: readonly LoggedCommand[];
  /** Ticks stepped after this one. */
  tick: number;
  snapshot?: Snapshot;
  metrics?: MetricsSample;
  /** The events step returned, with their audience. */
  events?: readonly SimEvent[];
  battles?: BattlesRecord;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS worlds (
  id          INTEGER PRIMARY KEY,
  seed        INTEGER NOT NULL,
  params_json TEXT    NOT NULL,
  battle_params_json TEXT,
  sim_version INTEGER NOT NULL,
  multiplier  INTEGER NOT NULL,
  status      TEXT    NOT NULL,
  tick        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL
);
CREATE TABLE IF NOT EXISTS players (
  id         INTEGER PRIMARY KEY,
  world_id   INTEGER NOT NULL REFERENCES worlds(id),
  team_id    INTEGER NOT NULL,
  name       TEXT    NOT NULL,
  token_hash TEXT    UNIQUE,
  bot        INTEGER NOT NULL DEFAULT 0,
  difficulty TEXT
);
CREATE TABLE IF NOT EXISTS commands (
  world_id     INTEGER NOT NULL REFERENCES worlds(id),
  tick         INTEGER NOT NULL,
  seq          INTEGER NOT NULL,
  player_id    INTEGER NOT NULL,
  payload_json TEXT    NOT NULL,
  PRIMARY KEY (world_id, tick, seq)
);
CREATE TABLE IF NOT EXISTS snapshots (
  world_id   INTEGER NOT NULL REFERENCES worlds(id),
  tick       INTEGER NOT NULL,
  state_json TEXT    NOT NULL,
  state_hash TEXT    NOT NULL,
  PRIMARY KEY (world_id, tick)
);
CREATE TABLE IF NOT EXISTS metrics (
  world_id    INTEGER NOT NULL REFERENCES worlds(id),
  tick        INTEGER NOT NULL,
  team_id     INTEGER,
  sample_json TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS metrics_world_tick ON metrics (world_id, tick);
CREATE TABLE IF NOT EXISTS chronicle (
  world_id   INTEGER NOT NULL REFERENCES worlds(id),
  team_id    INTEGER NOT NULL,
  tick       INTEGER NOT NULL,
  idx        INTEGER NOT NULL,
  event_json TEXT    NOT NULL,
  PRIMARY KEY (world_id, team_id, tick, idx)
);
CREATE TABLE IF NOT EXISTS battles (
  world_id       INTEGER NOT NULL REFERENCES worlds(id),
  battle_id      INTEGER NOT NULL,
  opened_tick    INTEGER NOT NULL,
  ended_tick     INTEGER,
  battle_version INTEGER NOT NULL,
  setup_json     TEXT    NOT NULL,
  params_json    TEXT    NOT NULL,
  reached_tick   INTEGER NOT NULL DEFAULT 0,
  record_json    TEXT    NOT NULL,
  final_hash     TEXT,
  PRIMARY KEY (world_id, battle_id)
);
CREATE TABLE IF NOT EXISTS battle_ticks (
  world_id      INTEGER NOT NULL REFERENCES worlds(id),
  battle_id     INTEGER NOT NULL,
  tick          INTEGER NOT NULL,
  commands_json TEXT    NOT NULL,
  PRIMARY KEY (world_id, battle_id, tick)
);
`;

type WorldRecord = {
  id: number;
  seed: number;
  params_json: string;
  battle_params_json: string | null;
  sim_version: number;
  multiplier: number;
  status: WorldStatus;
  tick: number;
  created_at: string;
};

const toWorld = (r: WorldRecord): WorldRow => ({
  id: r.id,
  seed: r.seed,
  params: JSON.parse(r.params_json) as Params,
  battleParams:
    r.battle_params_json === null
      ? null
      : (JSON.parse(r.battle_params_json) as BattleParams),
  simVersion: r.sim_version,
  multiplier: r.multiplier,
  status: r.status,
  tick: r.tick,
  createdAt: r.created_at,
});

type PlayerRecord = {
  id: number;
  world_id: number;
  team_id: number;
  name: string;
  bot: number;
  difficulty: Difficulty | null;
};

const toPlayer = (r: PlayerRecord): PlayerRow => ({
  id: r.id,
  worldId: r.world_id,
  team: r.team_id,
  name: r.name,
  bot: r.bot === 1,
  difficulty: r.difficulty,
});

type BattleRecordRow = {
  battle_id: number;
  opened_tick: number;
  ended_tick: number | null;
  battle_version: number;
  setup_json: string;
  params_json: string;
  reached_tick: number;
  record_json: string;
  final_hash: string | null;
};

const toBattle = (r: BattleRecordRow): BattleRow => ({
  battleId: r.battle_id,
  openedTick: r.opened_tick,
  endedTick: r.ended_tick,
  battleVersion: r.battle_version,
  setup: JSON.parse(r.setup_json) as BattleSetup,
  params: JSON.parse(r.params_json) as BattleParams,
  reachedTick: r.reached_tick,
  record: JSON.parse(r.record_json) as InstanceRecord,
  finalHash: r.final_hash,
});

export class Store {
  private readonly db: Database.Database;

  /** `file` is a path, or ":memory:" for tests. */
  constructor(file: string) {
    this.db = new Database(file);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(SCHEMA);
    this.migrate();
  }

  /** Columns added after a table first shipped, for older files. */
  private migrate(): void {
    this.addColumn("worlds", "battle_params_json", "TEXT");
    this.addColumn("players", "difficulty", "TEXT");
  }

  private addColumn(table: string, column: string, type: string): void {
    const columns = this.db.pragma(`table_info(${table})`) as {
      name: string;
    }[];
    if (!columns.some((c) => c.name === column)) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
  }

  close(): void {
    this.db.close();
  }

  /** Runs `fn` in one transaction; an exception rolls everything back. */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  createWorld(world: {
    seed: number;
    params: Params;
    battleParams: BattleParams;
    simVersion: number;
    multiplier: number;
    createdAt: string;
  }): number {
    const result = this.db
      .prepare(
        `INSERT INTO worlds (seed, params_json, battle_params_json, sim_version, multiplier, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'running', ?)`,
      )
      .run(
        world.seed,
        JSON.stringify(world.params),
        JSON.stringify(world.battleParams),
        world.simVersion,
        world.multiplier,
        world.createdAt,
      );
    return Number(result.lastInsertRowid);
  }

  world(id: number): WorldRow | undefined {
    const row = this.db.prepare("SELECT * FROM worlds WHERE id = ?").get(id) as
      WorldRecord | undefined;
    return row && toWorld(row);
  }

  worlds(): WorldRow[] {
    const rows = this.db
      .prepare("SELECT * FROM worlds ORDER BY id")
      .all() as WorldRecord[];
    return rows.map(toWorld);
  }

  setStatus(worldId: number, status: WorldStatus): void {
    this.db
      .prepare("UPDATE worlds SET status = ? WHERE id = ?")
      .run(status, worldId);
  }

  /** A new player; `tokenHash` is null for bots. Returns the player id. */
  addPlayer(player: {
    worldId: number;
    team: number;
    name: string;
    tokenHash: string | null;
    bot: boolean;
    difficulty?: Difficulty;
  }): number {
    const result = this.db
      .prepare(
        `INSERT INTO players (world_id, team_id, name, token_hash, bot, difficulty)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        player.worldId,
        player.team,
        player.name,
        player.tokenHash,
        player.bot ? 1 : 0,
        player.difficulty ?? null,
      );
    return Number(result.lastInsertRowid);
  }

  playerByTokenHash(tokenHash: string): PlayerRow | undefined {
    const row = this.db
      .prepare("SELECT * FROM players WHERE token_hash = ?")
      .get(tokenHash) as PlayerRecord | undefined;
    return row && toPlayer(row);
  }

  players(worldId: number): PlayerRow[] {
    const rows = this.db
      .prepare("SELECT * FROM players WHERE world_id = ? ORDER BY id")
      .all(worldId) as PlayerRecord[];
    return rows.map(toPlayer);
  }

  /** Stores one stepped tick atomically. */
  commitTick(record: TickRecord): void {
    this.transaction(() => {
      const insert = this.db.prepare(
        `INSERT INTO commands (world_id, tick, seq, player_id, payload_json)
         VALUES (?, ?, ?, ?, ?)`,
      );
      for (const c of record.commands) {
        insert.run(
          record.worldId,
          c.tick,
          c.seq,
          c.playerId,
          JSON.stringify(c.command),
        );
      }
      this.db
        .prepare("UPDATE worlds SET tick = ? WHERE id = ?")
        .run(record.tick, record.worldId);
      if (record.snapshot) this.putSnapshot(record.worldId, record.snapshot);
      if (record.metrics) this.putMetrics(record.worldId, record.metrics);
      if (record.events) this.putChronicle(record.worldId, record.events);
      if (record.battles) this.putBattles(record.worldId, record.battles);
    });
  }

  private putBattles(worldId: number, battles: BattlesRecord): void {
    const open = this.db.prepare(
      `INSERT INTO battles (world_id, battle_id, opened_tick, battle_version,
         setup_json, params_json, record_json)
       VALUES (?, ?, ?, ?, ?, ?, '{}')`,
    );
    for (const b of battles.opened) {
      open.run(
        worldId,
        b.battleId,
        b.openedTick,
        b.battleVersion,
        JSON.stringify(b.setup),
        JSON.stringify(b.params),
      );
    }
    const tick = this.db.prepare(
      `INSERT INTO battle_ticks (world_id, battle_id, tick, commands_json)
       VALUES (?, ?, ?, ?)`,
    );
    for (const t of battles.ticks) {
      tick.run(
        worldId,
        t.battleId,
        t.tick.tick,
        JSON.stringify(t.tick.commands),
      );
    }
    const reached = this.db.prepare(
      `UPDATE battles SET reached_tick = ?, record_json = ?
       WHERE world_id = ? AND battle_id = ?`,
    );
    for (const r of battles.reached) {
      reached.run(r.reachedTick, JSON.stringify(r.record), worldId, r.battleId);
    }
    const ended = this.db.prepare(
      `UPDATE battles SET ended_tick = ?, final_hash = ?
       WHERE world_id = ? AND battle_id = ?`,
    );
    for (const e of battles.ended) {
      ended.run(e.endedTick, e.finalHash, worldId, e.battleId);
    }
  }

  /** A stored battle, or undefined. */
  battle(worldId: number, battleId: number): BattleRow | undefined {
    const row = this.db
      .prepare("SELECT * FROM battles WHERE world_id = ? AND battle_id = ?")
      .get(worldId, battleId) as BattleRecordRow | undefined;
    return row && toBattle(row);
  }

  /** A world's battles, by id. */
  battles(worldId: number): BattleRow[] {
    const rows = this.db
      .prepare("SELECT * FROM battles WHERE world_id = ? ORDER BY battle_id")
      .all(worldId) as BattleRecordRow[];
    return rows.map(toBattle);
  }

  /** A battle's ticks with commands, in tick order. */
  battleTicks(worldId: number, battleId: number): LoggedTick[] {
    const rows = this.db
      .prepare(
        `SELECT tick, commands_json FROM battle_ticks
         WHERE world_id = ? AND battle_id = ? ORDER BY tick`,
      )
      .all(worldId, battleId) as { tick: number; commands_json: string }[];
    return rows.map((r) => ({
      tick: r.tick,
      commands: JSON.parse(r.commands_json) as unknown[],
    }));
  }

  /**
   * One row per event and team of its audience, without the audience: the
   * event as that team receives it.
   */
  putChronicle(worldId: number, events: readonly SimEvent[]): void {
    if (events.length === 0) return;
    const insert = this.db.prepare(
      `INSERT INTO chronicle (world_id, team_id, tick, idx, event_json)
       VALUES (?, ?, ?, ?, ?)`,
    );
    const teams = new Set(events.flatMap((e) => e.teams));
    for (const team of [...teams].sort((a, b) => a - b)) {
      for (const event of eventsFor(events, team)) {
        insert.run(
          worldId,
          team,
          event.tick,
          event.index,
          JSON.stringify(event),
        );
      }
    }
  }

  /** Deletes the chronicle of ticks >= `fromTick` (recovery redoes it). */
  deleteChronicleFrom(worldId: number, fromTick: number): void {
    this.db
      .prepare("DELETE FROM chronicle WHERE world_id = ? AND tick >= ?")
      .run(worldId, fromTick);
  }

  /** The team's latest `limit` events, oldest first. */
  recentChronicle(worldId: number, team: number, limit: number): TeamEvent[] {
    const rows = this.db
      .prepare(
        `SELECT event_json FROM chronicle
         WHERE world_id = ? AND team_id = ?
         ORDER BY tick DESC, idx DESC LIMIT ?`,
      )
      .all(worldId, team, limit) as { event_json: string }[];
    return rows.reverse().map((r) => JSON.parse(r.event_json) as TeamEvent);
  }

  /** How many chronicle rows a world has (the table is never pruned, P7). */
  chronicleCount(worldId: number): number {
    const row = this.db
      .prepare("SELECT COUNT(*) AS n FROM chronicle WHERE world_id = ?")
      .get(worldId) as { n: number };
    return row.n;
  }

  /** Bytes of event JSON in a world's chronicle (the soak report). */
  chronicleBytes(worldId: number): number {
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(LENGTH(event_json)), 0) AS n FROM chronicle
         WHERE world_id = ?`,
      )
      .get(worldId) as { n: number };
    return row.n;
  }

  putSnapshot(worldId: number, snapshot: Snapshot): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO snapshots (world_id, tick, state_json, state_hash)
         VALUES (?, ?, ?, ?)`,
      )
      .run(worldId, snapshot.tick, snapshot.stateJson, snapshot.stateHash);
  }

  latestSnapshot(worldId: number): Snapshot | undefined {
    const row = this.db
      .prepare(
        `SELECT tick, state_json, state_hash FROM snapshots
         WHERE world_id = ? ORDER BY tick DESC LIMIT 1`,
      )
      .get(worldId) as
      { tick: number; state_json: string; state_hash: string } | undefined;
    return (
      row && {
        tick: row.tick,
        stateJson: row.state_json,
        stateHash: row.state_hash,
      }
    );
  }

  /** The logged commands of ticks >= `fromTick`, in tick and seq order. */
  commandsFrom(worldId: number, fromTick: number): LoggedCommand[] {
    const rows = this.db
      .prepare(
        `SELECT tick, seq, player_id, payload_json FROM commands
         WHERE world_id = ? AND tick >= ? ORDER BY tick, seq`,
      )
      .all(worldId, fromTick) as {
      tick: number;
      seq: number;
      player_id: number;
      payload_json: string;
    }[];
    return rows.map((r) => ({
      tick: r.tick,
      seq: r.seq,
      playerId: r.player_id,
      command: JSON.parse(r.payload_json) as Command,
    }));
  }

  /**
   * One row per team with the team's sample, and one with team_id NULL for
   * what belongs to the whole world (roads, deposits).
   */
  private putMetrics(worldId: number, sample: MetricsSample): void {
    const insert = this.db.prepare(
      `INSERT INTO metrics (world_id, tick, team_id, sample_json)
       VALUES (?, ?, ?, ?)`,
    );
    for (const team of sample.teams) {
      insert.run(worldId, sample.tick, team.team, JSON.stringify(team));
    }
    insert.run(
      worldId,
      sample.tick,
      null,
      JSON.stringify({
        roadCells: sample.roadCells,
        deposits: sample.deposits,
      }),
    );
  }

  /** Metric rows of a world, oldest first (team null = world-wide). */
  metrics(
    worldId: number,
  ): { tick: number; team: number | null; sample: unknown }[] {
    const rows = this.db
      .prepare(
        `SELECT tick, team_id, sample_json FROM metrics
         WHERE world_id = ? ORDER BY tick, team_id IS NOT NULL, team_id`,
      )
      .all(worldId) as {
      tick: number;
      team_id: number | null;
      sample_json: string;
    }[];
    return rows.map((r) => ({
      tick: r.tick,
      team: r.team_id,
      sample: JSON.parse(r.sample_json),
    }));
  }
}
