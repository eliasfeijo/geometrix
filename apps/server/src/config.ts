// Server configuration (plan section 7). These are operating values, not game
// balance: they stay out of the sim params. Durations are real milliseconds.

export type ServerConfig = {
  port: number;
  /** SQLite file, or ":memory:". */
  dbFile: string;
  /** Params for new worlds. */
  paramsFile: string;
  /** Built client served over HTTP (apps/client/dist); skipped if missing. */
  staticDir: string;
  /** World ticks between snapshots (plan: 300, 5 world minutes). */
  snapshotEveryTicks: number;
  /** World ticks between metric samples, as in geo sim. */
  metricsEveryTicks: number;
  /** Ticks a late loop may run at once before it drops the backlog. */
  maxCatchUpTicks: number;
  /** Most frequent state broadcast: 200 ms = 5 per second (plan P3). */
  broadcastIntervalMs: number;
  /**
   * A delta carries the hash of the team's view when its tick reaches a
   * multiple of this (M1.5 spec section 6: 60, a world minute).
   */
  viewHashEveryTicks: number;
  /** Real time a team stream keeps its deltas for resuming (M1.5 spec S-5). */
  deltaBufferMs: number;
  /** Domination released after this long without input (spec, F6). */
  dominationTimeoutMs: number;
  /** A disconnected player keeps their domination this long (spec, F6). */
  reconnectGraceMs: number;
};

export const DEFAULT_CONFIG: ServerConfig = {
  port: 8080,
  dbFile: "data/geometrix.db",
  paramsFile: "params/default.json",
  staticDir: "apps/client/dist",
  snapshotEveryTicks: 300,
  metricsEveryTicks: 60,
  maxCatchUpTicks: 100,
  broadcastIntervalMs: 200,
  viewHashEveryTicks: 60,
  deltaBufferMs: 30 * 1000,
  dominationTimeoutMs: 5 * 60 * 1000,
  reconnectGraceMs: 15 * 1000,
};

/** DEFAULT_CONFIG with the GEO_* environment overrides. */
export function loadConfig(env: NodeJS.ProcessEnv): ServerConfig {
  const int = (name: string, fallback: number) => {
    const raw = env[name];
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${name} must be a non-negative integer: ${raw}`);
    }
    return value;
  };
  return {
    port: int("GEO_PORT", DEFAULT_CONFIG.port),
    dbFile: env.GEO_DB ?? DEFAULT_CONFIG.dbFile,
    paramsFile: env.GEO_PARAMS ?? DEFAULT_CONFIG.paramsFile,
    staticDir: env.GEO_STATIC ?? DEFAULT_CONFIG.staticDir,
    snapshotEveryTicks: DEFAULT_CONFIG.snapshotEveryTicks,
    metricsEveryTicks: DEFAULT_CONFIG.metricsEveryTicks,
    maxCatchUpTicks: DEFAULT_CONFIG.maxCatchUpTicks,
    broadcastIntervalMs: DEFAULT_CONFIG.broadcastIntervalMs,
    viewHashEveryTicks: DEFAULT_CONFIG.viewHashEveryTicks,
    deltaBufferMs: DEFAULT_CONFIG.deltaBufferMs,
    dominationTimeoutMs: DEFAULT_CONFIG.dominationTimeoutMs,
    reconnectGraceMs: DEFAULT_CONFIG.reconnectGraceMs,
  };
}
