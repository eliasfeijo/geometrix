// geo sim (plan section 9): runs a bot × bot world headless and writes
// runs/<id>/ with the metrics (CSV + JSON; SQLite arrives with F6), the replay
// and report.md.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  botsFor,
  BALANCED,
  canonicalJson,
  endSummary,
  sampleMetrics,
  SIM_VERSION,
  type EndSummary,
  type MetricsSample,
  type Cell,
  type Difficulty,
  type Params,
  type Resource,
  type StrategistId,
  type WorldState,
} from "@geometrix/sim";
import { strategistChoices } from "./choices.ts";
import { EncounterTracker, type EncounterTally } from "./encounters.ts";
import {
  defaultBattleParams,
  runBots,
  type Concession,
  type LoggedCommand,
} from "./harness.ts";
import { PaceTracker, type PaceFacts } from "./pace.ts";
import { applyShock, shockTick, teamCreeps, type Shock } from "./shock.ts";
import { stateHash } from "./hash.ts";
import { renderReport } from "./report.ts";

/** One metrics sample per world minute (plan section 9). */
export const SAMPLE_EVERY_TICKS = 60;

export type RunMeta = {
  id: string;
  simVersion: number;
  seed: number;
  mapSeed: number;
  /** The ticks run: fewer than asked when the world ended first. */
  ticks: number;
  tickSeconds: number;
  /**
   * The time multiplier (×N) the run's real time is read at: world seconds
   * per real second (M2 R plan P1). It changes nothing in the world.
   */
  multiplier: number;
  /**
   * The recovery scenario's shock (M2 R P12), or null. A shocked run is not
   * replayable: it writes no replay.json.
   */
  shock: Shock | null;
  /** The forced concession (--concede, E-min P12); absent or null for none. */
  concede?: Concession | null;
  /** One per team. */
  strategists: StrategistId[];
  /** One per team (R spec D26); absent in runs from before R F3 (hard). */
  difficulties?: Difficulty[];
  balanced: typeof BALANCED;
  paramsSource: string;
  finalHash: string;
  /** Wall-clock seconds the simulation took. */
  wallSeconds: number;
  commands: number;
  /**
   * The ended world's summary, or null when the run stopped first; absent in
   * runs written before E-min F2.
   */
  end?: EndSummary | null;
  /** Where cores and deposits are, for the report. */
  map: { cores: Cell[]; deposits: (Cell & { id: number; kind: Resource })[] };
};

export type SimResult = {
  meta: RunMeta;
  params: Params;
  samples: MetricsSample[];
  encounters: EncounterTally;
  /** The match's pace against the M2 R spec §7 targets. */
  pace: PaceFacts;
  log: LoggedCommand[];
  state: WorldState;
};

export type SimOptions = {
  id: string;
  seed: number;
  params: Params;
  paramsSource: string;
  ticks: number;
  /** ×N for real time; the params' world.multiplier by default. */
  multiplier?: number;
  /** The recovery scenario (P12); none by default. */
  shock?: Shock | null;
  /** The forced concession (P12); none by default. */
  concede?: Concession | null;
  strategists: StrategistId[];
  /** One per team; hard by default (R spec D26). */
  difficulties?: Difficulty[];
};

/** Runs the world, sampling at tick 0, every minute and at the end. */
export function simulate(
  options: SimOptions,
  clock: () => number = () => performance.now(),
): SimResult {
  const { seed, params, ticks, strategists } = options;
  const difficulties = strategists.map(
    (_, team) => options.difficulties?.[team] ?? "hard",
  );
  const multiplier = options.multiplier ?? params.world.multiplier;
  const samples: MetricsSample[] = [];
  const tracker = new EncounterTracker(strategists.length);
  let pace: PaceTracker | null = null;
  const shock = options.shock ?? null;
  const shockAt = shock === null ? null : shockTick(shock, params, multiplier);
  const started = clock();
  const { state, log } = runBots(
    seed,
    params,
    ticks,
    botsFor(strategists, difficulties),
    (s, events, finished) => {
      // The first call is the new world, before any tick.
      pace ??= new PaceTracker(s, multiplier);
      tracker.record(s, events, finished);
      pace.record(s, events);
      const last = s.tick === ticks || s.result !== null;
      if (s.tick % SAMPLE_EVERY_TICKS === 0 || last) {
        samples.push(sampleMetrics(s));
        tracker.mark(s);
        pace.sample(s);
      }
      // Between this tick and the next, after the tick's metrics.
      if (shock !== null && s.tick === shockAt && s.result === null) {
        const before = teamCreeps(s, shock.team);
        pace.shocked(s, shock, before, applyShock(s, shock).length);
      }
    },
    defaultBattleParams(),
    options.concede ?? null,
  );
  const wallSeconds = (clock() - started) / 1000;
  const encounters = tracker.finish(state);
  encounters.choices = strategistChoices(
    log,
    state.players,
    strategists.length,
    params,
  );
  return {
    meta: {
      id: options.id,
      simVersion: SIM_VERSION,
      seed,
      mapSeed: state.mapSeed,
      ticks: state.tick,
      tickSeconds: params.world.tickSeconds,
      multiplier,
      shock,
      concede: options.concede ?? null,
      strategists,
      difficulties,
      balanced: BALANCED,
      paramsSource: options.paramsSource,
      finalHash: stateHash(state),
      wallSeconds,
      commands: log.length,
      end: endSummary(state),
      map: {
        cores: state.teams.map((t) => ({ ...t.core })),
        deposits: state.deposits.map(({ id, kind, x, y }) => ({
          id,
          kind,
          x,
          y,
        })),
      },
    },
    params,
    samples,
    encounters,
    pace: pace!.finish(
      state,
      samples,
      wallSeconds,
      encounters.teams.map((t) => t.helpJoins),
    ),
    log,
    state,
  };
}

/** A run id from the wall clock and the seed: 20261113-225900-s42. */
export function runId(seed: number, now: Date = new Date()): string {
  const stamp = now
    .toISOString()
    .replace(/\.\d+Z$/, "")
    .replace(/[-:]/g, "")
    .replace("T", "-");
  return `${stamp}-s${seed}`;
}

export const RUN_FILES = {
  meta: "run.json",
  samples: "samples.jsonl",
  encounters: "encounters.json",
  pace: "pace.json",
  csv: "metrics.csv",
  replay: "replay.json",
  report: "report.md",
} as const;

/** Writes runs/<id>/; refuses to overwrite an existing run. */
export function writeRun(dir: string, result: SimResult): void {
  mkdirSync(dirname(dir), { recursive: true });
  mkdirSync(dir);
  const { meta, params, samples, encounters, pace, log } = result;
  const write = (file: string, text: string) =>
    writeFileSync(join(dir, file), text);
  write(RUN_FILES.meta, metaJson(result));
  write(
    RUN_FILES.samples,
    samples.map((s) => `${canonicalJson(s)}\n`).join(""),
  );
  write(RUN_FILES.encounters, `${JSON.stringify(encounters)}\n`);
  write(RUN_FILES.pace, paceJson(result));
  write(RUN_FILES.csv, metricsCsv(samples, meta.tickSeconds, meta.multiplier));
  // A shocked run's log does not reach its state (P12).
  if (meta.shock === null) {
    write(
      RUN_FILES.replay,
      `${canonicalJson({
        simVersion: meta.simVersion,
        seed: meta.seed,
        params,
        ticks: meta.ticks,
        finalHash: meta.finalHash,
        commands: log,
      })}\n`,
    );
  }
  write(
    RUN_FILES.report,
    renderReport({ meta, params, samples, encounters, pace }),
  );
}

/** pace.json: the run's pace facts. */
export function paceJson({ pace }: Pick<SimResult, "pace">): string {
  return `${JSON.stringify(pace, null, 2)}\n`;
}

/** run.json: the run's meta with its params. */
export function metaJson({ meta, params }: SimResult): string {
  return `${JSON.stringify({ ...meta, params }, null, 2)}\n`;
}

/** What `geo report` needs from a run directory. */
export type RunData = {
  meta: RunMeta;
  params: Params;
  samples: MetricsSample[];
  encounters: EncounterTally;
  /** Null for a run written before the pace targets (M2 R F1). */
  pace: PaceFacts | null;
};

export function readRun(dir: string): RunData {
  const { params, ...meta } = JSON.parse(
    readFileSync(join(dir, RUN_FILES.meta), "utf8"),
  ) as RunMeta & { params: Params };
  // Runs written before the multiplier existed read at ×1.
  meta.multiplier ??= params.world.multiplier ?? 1;
  meta.shock ??= null;
  const samples = readFileSync(join(dir, RUN_FILES.samples), "utf8")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as MetricsSample);
  const encounters = JSON.parse(
    readFileSync(join(dir, RUN_FILES.encounters), "utf8"),
  ) as EncounterTally;
  const paceFile = join(dir, RUN_FILES.pace);
  const pace = existsSync(paceFile)
    ? (JSON.parse(readFileSync(paceFile, "utf8")) as PaceFacts)
    : null;
  return { meta, params, samples, encounters, pace };
}

/** Flattens nested numbers into dotted columns: stock.materia, ... */
function flatten(
  value: unknown,
  prefix: string,
  into: Record<string, string>,
): void {
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, into);
    }
  } else {
    into[prefix] = value === null ? "" : String(value);
  }
}

/** One row per team per sample. */
export function metricsCsv(
  samples: readonly MetricsSample[],
  tickSeconds: number,
  multiplier: number,
): string {
  const rows = samples.flatMap((sample) =>
    sample.teams.map((team) => {
      const row: Record<string, string> = {
        tick: String(sample.tick),
        hours: ((sample.tick * tickSeconds) / 3600).toFixed(3),
        realMinutes: ((sample.tick * tickSeconds) / multiplier / 60).toFixed(2),
        roadCells: String(sample.roadCells),
      };
      flatten(team, "", row);
      return row;
    }),
  );
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0]!);
  return [columns, ...rows.map((row) => columns.map((c) => row[c]!))]
    .map((cells) => `${cells.join(",")}\n`)
    .join("");
}
