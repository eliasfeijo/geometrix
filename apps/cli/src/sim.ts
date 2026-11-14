// geo sim (plan section 9): runs a bot × bot world headless and writes
// runs/<id>/ with the metrics (CSV + JSON; SQLite arrives with F6), the replay
// and report.md.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  canonicalJson,
  sampleMetrics,
  SIM_VERSION,
  type MetricsSample,
  type Cell,
  type Params,
  type Resource,
  type WorldState,
} from "@geometrix/sim";
import { botsFor, runBots, type LoggedCommand } from "./harness.ts";
import { stateHash } from "./hash.ts";
import { renderReport } from "./report.ts";
import { BALANCED, type StrategistId } from "./strategist.ts";

/** One metrics sample per world minute (plan section 9). */
export const SAMPLE_EVERY_TICKS = 60;

export type RunMeta = {
  id: string;
  simVersion: number;
  seed: number;
  mapSeed: number;
  ticks: number;
  tickSeconds: number;
  /** One per team. */
  strategists: StrategistId[];
  balanced: typeof BALANCED;
  paramsSource: string;
  finalHash: string;
  /** Wall-clock seconds the simulation took. */
  wallSeconds: number;
  commands: number;
  /** Where cores and deposits are, for the report. */
  map: { cores: Cell[]; deposits: (Cell & { id: number; kind: Resource })[] };
};

export type SimResult = {
  meta: RunMeta;
  params: Params;
  samples: MetricsSample[];
  log: LoggedCommand[];
  state: WorldState;
};

export type SimOptions = {
  id: string;
  seed: number;
  params: Params;
  paramsSource: string;
  ticks: number;
  strategists: StrategistId[];
};

/** Runs the world, sampling at tick 0, every minute and at the end. */
export function simulate(
  options: SimOptions,
  clock: () => number = () => performance.now(),
): SimResult {
  const { seed, params, ticks, strategists } = options;
  const samples: MetricsSample[] = [];
  const started = clock();
  const { state, log } = runBots(
    seed,
    params,
    ticks,
    botsFor(strategists),
    (s) => {
      if (s.tick % SAMPLE_EVERY_TICKS === 0 || s.tick === ticks) {
        samples.push(sampleMetrics(s));
      }
    },
  );
  const wallSeconds = (clock() - started) / 1000;
  return {
    meta: {
      id: options.id,
      simVersion: SIM_VERSION,
      seed,
      mapSeed: state.mapSeed,
      ticks,
      tickSeconds: params.world.tickSeconds,
      strategists,
      balanced: BALANCED,
      paramsSource: options.paramsSource,
      finalHash: stateHash(state),
      wallSeconds,
      commands: log.length,
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
  csv: "metrics.csv",
  replay: "replay.json",
  report: "report.md",
} as const;

/** Writes runs/<id>/; refuses to overwrite an existing run. */
export function writeRun(dir: string, result: SimResult): void {
  mkdirSync(dirname(dir), { recursive: true });
  mkdirSync(dir);
  const { meta, params, samples, log } = result;
  const write = (file: string, text: string) =>
    writeFileSync(join(dir, file), text);
  write(RUN_FILES.meta, metaJson(result));
  write(
    RUN_FILES.samples,
    samples.map((s) => `${canonicalJson(s)}\n`).join(""),
  );
  write(RUN_FILES.csv, metricsCsv(samples, meta.tickSeconds));
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
  write(RUN_FILES.report, renderReport({ meta, params, samples }));
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
};

export function readRun(dir: string): RunData {
  const { params, ...meta } = JSON.parse(
    readFileSync(join(dir, RUN_FILES.meta), "utf8"),
  ) as RunMeta & { params: Params };
  const samples = readFileSync(join(dir, RUN_FILES.samples), "utf8")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as MetricsSample);
  return { meta, params, samples };
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
): string {
  const rows = samples.flatMap((sample) =>
    sample.teams.map((team) => {
      const row: Record<string, string> = {
        tick: String(sample.tick),
        hours: ((sample.tick * tickSeconds) / 3600).toFixed(3),
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
