// SQLite persistence (ADR-0004, plan section 7): worlds, players, the command
// log, snapshots and metrics. Each world has a single writer, the process that
// hosts it; better-sqlite3 is synchronous, which fits the tick loop. A tick is
// stored in one transaction: its commands, the tick it reached and, when due,
// a snapshot and metric samples.

import Database from "better-sqlite3";
import type { Command, MetricsSample, Params } from "@geometrix/sim";
import type { LoggedCommand, WorldStatus } from "@geometrix/protocol";

export type { LoggedCommand };

export type WorldRow = {
  id: number;
  seed: number;
  params: Params;
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
};

export type Snapshot = { tick: number; stateJson: string; stateHash: string };

/** What one tick writes, all or nothing. */
export type TickRecord = {
  worldId: number;
  commands: readonly LoggedCommand[];
  /** Ticks stepped after this one. */
  tick: number;
  snapshot?: Snapshot;
  metrics?: MetricsSample;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS worlds (
  id          INTEGER PRIMARY KEY,
  seed        INTEGER NOT NULL,
  params_json TEXT    NOT NULL,
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
  bot        INTEGER NOT NULL DEFAULT 0
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
`;

type WorldRecord = {
  id: number;
  seed: number;
  params_json: string;
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
};

const toPlayer = (r: PlayerRecord): PlayerRow => ({
  id: r.id,
  worldId: r.world_id,
  team: r.team_id,
  name: r.name,
  bot: r.bot === 1,
});

export class Store {
  private readonly db: Database.Database;

  /** `file` is a path, or ":memory:" for tests. */
  constructor(file: string) {
    this.db = new Database(file);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(SCHEMA);
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
    simVersion: number;
    multiplier: number;
    createdAt: string;
  }): number {
    const result = this.db
      .prepare(
        `INSERT INTO worlds (seed, params_json, sim_version, multiplier, status, created_at)
         VALUES (?, ?, ?, ?, 'running', ?)`,
      )
      .run(
        world.seed,
        JSON.stringify(world.params),
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
  }): number {
    const result = this.db
      .prepare(
        `INSERT INTO players (world_id, team_id, name, token_hash, bot)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        player.worldId,
        player.team,
        player.name,
        player.tokenHash,
        player.bot ? 1 : 0,
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
    });
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
