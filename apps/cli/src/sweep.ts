// geo sweep (plan section 9): runs the same bot × bot world for each value of
// one parameter and each seed, and compares the outcomes side by side. Writes
// runs/<id>/ with report.md, sweep.csv (one row per run) and each run's
// run.json; --keep-runs also keeps every run's full directory.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  ACTIVITIES,
  parseParams,
  type MetricsSample,
  type Params,
  type StrategistId,
} from "@geometrix/sim";
import { HOUR, hours, number, table } from "./report.ts";
import {
  metaJson,
  RUN_FILES,
  simulate,
  writeRun,
  type SimResult,
} from "./sim.ts";

export class SweepError extends Error {}

/** `creep.cost.materia=30,40,50` → the path and its values. */
export function parseSet(raw: string): { path: string; values: number[] } {
  const match = /^([A-Za-z]+(?:\.[A-Za-z]+)*)=(\d+(?:,\d+)*)$/.exec(raw);
  if (match === null) {
    throw new SweepError(`--set must look like a.b.c=1,2,3: ${raw}`);
  }
  return { path: match[1]!, values: match[2]!.split(",").map(Number) };
}

/** `1-5` or `1,4,9` (ranges and lists can mix: `1-3,7`). */
export function parseSeeds(raw: string): number[] {
  const seeds: number[] = [];
  for (const part of raw.split(",")) {
    const match = /^(\d+)(?:-(\d+))?$/.exec(part);
    const from = Number(match?.[1]);
    const to = Number(match?.[2] ?? match?.[1]);
    if (match === null || to < from || to >= 2 ** 32) {
      throw new SweepError(`--seeds must look like 1-5 or 1,4,9: ${raw}`);
    }
    for (let seed = from; seed <= to; seed++) seeds.push(seed);
  }
  return seeds;
}

/** `params` with the leaf at `path` set to `value`, validated again. */
export function withParam(params: Params, path: string, value: number): Params {
  const copy = JSON.parse(JSON.stringify(params)) as Record<string, unknown>;
  const keys = path.split(".");
  let node: Record<string, unknown> = copy;
  for (const key of keys.slice(0, -1)) {
    const child = node[key];
    if (typeof child !== "object" || child === null) {
      throw new SweepError(`unknown parameter: ${path}`);
    }
    node = child as Record<string, unknown>;
  }
  const leaf = keys.at(-1)!;
  if (typeof node[leaf] !== "number") {
    throw new SweepError(`unknown parameter: ${path}`);
  }
  node[leaf] = value;
  try {
    return parseParams(copy);
  } catch (error) {
    throw new SweepError(`${path}=${value}: ${(error as Error).message}`);
  }
}

/** One run's outcome, averaged over the teams. */
export type RunSummary = {
  value: number;
  seed: number;
  finalHash: string;
  wallSeconds: number;
  creeps: number;
  /** Hours until the population cap, or null if never reached. */
  capHours: number | null;
  upgradeHours: number | null;
  deliveredMateria: number;
  deliveredCristal: number;
  stockMateria: number;
  stockCristal: number;
  walkingEmptyPercent: number;
  idlePercent: number;
  coreIdlePercent: number;
  tripMinutes: number | null;
  roadCells: number;
  /** Hours until the last cristal deposit ran dry, or null. */
  cristalGoneHours: number | null;
};

const mean = (values: number[]) =>
  values.reduce((a, b) => a + b, 0) / values.length;

export function summarize(result: SimResult, value: number): RunSummary {
  const { meta, params, samples } = result;
  const last = samples.at(-1)!;
  const toHours = (s: MetricsSample | undefined) =>
    s === undefined ? null : (s.tick * meta.tickSeconds) / HOUR;
  const perTeam = (f: (t: MetricsSample["teams"][number]) => number) =>
    mean(last.teams.map(f));
  const creepsOf = (t: MetricsSample["teams"][number]) =>
    t.creeps.square + t.creeps.triangle + t.creeps.circle;
  const firstForAll = (
    when: (t: MetricsSample["teams"][number]) => boolean,
  ) => {
    const hits = last.teams.map((_, i) =>
      toHours(samples.find((s) => when(s.teams[i]!))),
    );
    return hits.some((h) => h === null) ? null : mean(hits as number[]);
  };
  const activity = (t: MetricsSample["teams"][number]) =>
    ACTIVITIES.reduce((sum, a) => sum + t.activitySeconds[a], 0);
  const share = (part: number, whole: number) =>
    whole === 0 ? 0 : (100 * part) / whole;
  const totalSeconds = last.tick * meta.tickSeconds;
  const trips = last.teams.reduce((sum, t) => sum + t.trips, 0);
  const tripSeconds = last.teams.reduce((sum, t) => sum + t.tripSeconds, 0);
  const cristal = last.deposits.filter((d) => d.kind === "cristal");
  const cristalGone = cristal.every((d) => d.amount === 0)
    ? Math.max(...cristal.map((d) => d.emptiedAtTick ?? 0)) * meta.tickSeconds
    : null;
  return {
    value,
    seed: meta.seed,
    finalHash: meta.finalHash,
    wallSeconds: meta.wallSeconds,
    creeps: perTeam(creepsOf),
    capHours: firstForAll(
      (t) =>
        creepsOf(t) + (t.producing === null ? 0 : 1) >= params.population.cap,
    ),
    upgradeHours: firstForAll((t) => t.capacityUpgrade),
    deliveredMateria: perTeam((t) => t.delivered.materia),
    deliveredCristal: perTeam((t) => t.delivered.cristal),
    stockMateria: perTeam((t) => t.stock.materia),
    stockCristal: perTeam((t) => t.stock.cristal),
    walkingEmptyPercent: perTeam((t) =>
      share(t.activitySeconds.walkingEmpty, activity(t)),
    ),
    idlePercent: perTeam((t) => share(t.activitySeconds.idle, activity(t))),
    coreIdlePercent: perTeam((t) => share(t.coreIdleSeconds, totalSeconds)),
    tripMinutes: trips === 0 ? null : tripSeconds / trips / 60,
    roadCells: last.roadCells,
    cristalGoneHours: cristalGone === null ? null : cristalGone / HOUR,
  };
}

const COLUMNS: { key: keyof RunSummary; label: string; digits: number }[] = [
  { key: "creeps", label: "Creeps no fim", digits: 1 },
  { key: "capHours", label: "Teto de população atingido (h)", digits: 1 },
  { key: "upgradeHours", label: "Upgrade comprado (h)", digits: 1 },
  { key: "deliveredMateria", label: "Matéria entregue", digits: 0 },
  { key: "deliveredCristal", label: "Cristal entregue", digits: 0 },
  { key: "stockMateria", label: "Estoque de matéria no fim", digits: 0 },
  { key: "stockCristal", label: "Estoque de cristal no fim", digits: 0 },
  { key: "walkingEmptyPercent", label: "Creeps andando vazios (%)", digits: 0 },
  { key: "idlePercent", label: "Creeps parados (%)", digits: 0 },
  { key: "coreIdlePercent", label: "Núcleo ocioso (%)", digits: 0 },
  { key: "tripMinutes", label: "Tempo médio por viagem (min)", digits: 1 },
  { key: "roadCells", label: "Estradas no mapa (células)", digits: 0 },
  { key: "cristalGoneHours", label: "Cristal esgotado (h)", digits: 1 },
];

/** "mean (min–max)" over the runs that have the value; "—" for none. */
function cell(values: (number | null)[], digits: number): string {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return "—";
  const avg = number(mean(present), digits);
  const lo = number(Math.min(...present), digits);
  const hi = number(Math.max(...present), digits);
  const range = lo === hi ? "" : ` (${lo}–${hi})`;
  const missing =
    present.length < values.length
      ? ` · ${values.length - present.length}× nunca`
      : "";
  return `${avg}${range}${missing}`;
}

export type SweepOptions = {
  id: string;
  params: Params;
  paramsSource: string;
  path: string;
  values: number[];
  seeds: number[];
  ticks: number;
  strategists: StrategistId[];
};

export type SweepResult = { options: SweepOptions; runs: RunSummary[] };

/** Runs every value × seed; `onRun` sees each finished run. */
export function sweep(
  options: SweepOptions,
  onRun: (result: SimResult, summary: RunSummary) => void = () => {},
): SweepResult {
  const variants = options.values.map((value) => ({
    value,
    params: withParam(options.params, options.path, value),
  }));
  const runs: RunSummary[] = [];
  for (const { value, params } of variants) {
    for (const seed of options.seeds) {
      const result = simulate({
        id: runName(options.path, value, seed),
        seed,
        params,
        paramsSource: `${options.paramsSource} com ${options.path}=${value}`,
        ticks: options.ticks,
        strategists: options.strategists,
      });
      const summary = summarize(result, value);
      runs.push(summary);
      onRun(result, summary);
    }
  }
  return { options, runs };
}

export const runName = (path: string, value: number, seed: number) =>
  `${path}=${value}-s${seed}`;

export function renderSweepReport({ options, runs }: SweepResult): string {
  const { path, values, seeds, ticks } = options;
  const wall = runs.reduce((sum, r) => sum + r.wallSeconds, 0);
  const tickSeconds = options.params.world.tickSeconds;
  const lines = [
    `# Varredura — ${options.id}`,
    "",
    table(
      ["", ""],
      [
        ["Parâmetro", `\`${path}\` = ${values.join(", ")}`],
        ["Seeds", seeds.join(", ")],
        ["Duração de cada mundo", hours(ticks * tickSeconds)],
        [
          "Estrategistas",
          options.strategists.map((s, t) => `time ${t}: ${s}`).join(" · "),
        ],
        ["Parâmetros base", `\`${options.paramsSource}\``],
        ["Runs", `${runs.length} em ${number(wall, 1)} s`],
      ],
    ),
    "",
    "## Comparação",
    "",
    "Média das seeds e dos dois times; entre parênteses, o mínimo e o máximo entre as seeds. " +
      '"N× nunca": em N seeds isso não aconteceu.',
    "",
    table(
      ["Métrica", ...values.map((v) => `${path}=${v}`)],
      COLUMNS.map(({ key, label, digits }) => [
        label,
        ...values.map((value) =>
          cell(
            runs
              .filter((r) => r.value === value)
              .map((r) => r[key] as number | null),
            digits,
          ),
        ),
      ]),
    ),
    "",
    "## Runs",
    "",
    table(
      ["Valor", "Seed", "Tempo (s)", "Hash final"],
      runs.map((r) => [
        String(r.value),
        String(r.seed),
        number(r.wallSeconds, 1),
        `\`${r.finalHash.slice(0, 16)}\``,
      ]),
    ),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

const csvValue = (value: string | number | null) =>
  value === null
    ? ""
    : typeof value === "number" && !Number.isInteger(value)
      ? value.toFixed(3)
      : String(value);

export function sweepCsv(runs: readonly RunSummary[]): string {
  const columns = Object.keys(runs[0] ?? {}) as (keyof RunSummary)[];
  return [
    columns.join(","),
    ...runs.map((r) => columns.map((c) => csvValue(r[c])).join(",")),
  ]
    .map((line) => `${line}\n`)
    .join("");
}

/**
 * Runs the sweep and writes it to `dir`: report.md, sweep.csv and, per run,
 * <path>=<value>-s<seed>/run.json (the full run with keepRuns).
 */
export function runSweep(
  dir: string,
  options: SweepOptions,
  keepRuns: boolean,
  progress: (line: string) => void = () => {},
): SweepResult {
  // Refuse bad values before creating anything.
  for (const value of options.values) {
    withParam(options.params, options.path, value);
  }
  mkdirSync(dirname(dir), { recursive: true });
  mkdirSync(dir);
  const result = sweep(options, (run, summary) => {
    const runDir = join(dir, run.meta.id);
    if (keepRuns) {
      writeRun(runDir, run);
    } else {
      mkdirSync(runDir);
      writeFileSync(join(runDir, RUN_FILES.meta), metaJson(run));
    }
    progress(
      `  ${run.meta.id}: ${summary.wallSeconds.toFixed(1)} s, ${summary.finalHash.slice(0, 16)}`,
    );
  });
  writeFileSync(join(dir, "sweep.csv"), sweepCsv(result.runs));
  writeFileSync(join(dir, RUN_FILES.report), renderSweepReport(result));
  return result;
}
