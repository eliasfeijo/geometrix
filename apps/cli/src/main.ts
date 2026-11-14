#!/usr/bin/env node
// geo: headless simulation tools (plan section 9).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { parseParams, type Params } from "@geometrix/sim";
import { renderReport } from "./report.ts";
import { readRun, RUN_FILES, runId, simulate, writeRun } from "./sim.ts";
import { STRATEGISTS, type StrategistId } from "./strategist.ts";
import { parseSeeds, parseSet, runSweep, SweepError } from "./sweep.ts";
import { verify } from "./verify.ts";

const DEFAULT_PARAMS = new URL("../../../params/default.json", import.meta.url);

const USAGE = `usage: geo <command> [options]

commands:
  sim      runs a bot x bot world and writes runs/<id>/: run.json,
           samples.jsonl, metrics.csv, replay.json, report.md
           --seed <n>            world seed (default 42)
           --params <file>       params JSON (default params/default.json)
           --days <n> | --hours <n>
                                 world time (default world.durationSeconds)
           --strategist <a[,b]>  per team: ${STRATEGISTS.join(" | ")}
                                 (default balanced; one name = both teams)
           --out <dir>           runs directory (default runs)
           --id <id>             run id (default <utc time>-s<seed>)
  sweep    runs the world for each value of one parameter and each seed,
           and compares them in runs/<id>/report.md and sweep.csv
           --set <path=v1,v2,...>  e.g. creep.cost.materia=30,40,50
           --seeds <list>        e.g. 1-5 or 1,4,9 (default 1-5)
           --days, --hours, --params, --strategist, --out, --id as in sim
           --keep-runs           also write every run's full directory
  report   rewrites report.md of a run from its files
           geo report <run dir>
  verify   determinism check with bots: two runs, a snapshot -> restore run
           and a replay of the command log must reach the same state hash
           --seed <n>      world seed (default 42)
           --ticks <n>     ticks to simulate (default 50000)
           --params <file> params JSON (default params/default.json)
           --strategist <a[,b]>  as in sim (default balanced)`;

export type Output = { log(line: string): void; error(line: string): void };

class UsageError extends Error {}

function parseUint(name: string, raw: string, min: number): number {
  const value = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < min) {
    throw new UsageError(`--${name} must be an integer >= ${min}: ${raw}`);
  }
  return value;
}

function loadParams(file: string | URL): Params {
  return parseParams(JSON.parse(readFileSync(file, "utf8")));
}

/** A path as typed, or the default params relative to the working directory. */
function paramsSource(file: string | undefined): string {
  return file ?? relative(process.cwd(), fileURLToPath(DEFAULT_PARAMS));
}

function parseSeed(raw: string): number {
  const seed = parseUint("seed", raw, 0);
  if (seed >= 2 ** 32) throw new UsageError(`--seed must be < 2^32: ${seed}`);
  return seed;
}

function parseStrategists(raw: string, teams: number): StrategistId[] {
  const names = raw.split(",");
  for (const name of names) {
    if (!STRATEGISTS.includes(name as StrategistId)) {
      throw new UsageError(`unknown strategist: ${name}`);
    }
  }
  if (names.length === 1) return new Array(teams).fill(names[0]);
  if (names.length !== teams) {
    throw new UsageError(`--strategist needs 1 or ${teams} names: ${raw}`);
  }
  return names as StrategistId[];
}

/** World ticks from --days / --hours, or the params' world duration. */
function parseTicks(
  values: { days?: string; hours?: string },
  params: Params,
): number {
  const { tickSeconds, durationSeconds } = params.world;
  if (values.days !== undefined && values.hours !== undefined) {
    throw new UsageError("use --days or --hours, not both");
  }
  let seconds = durationSeconds;
  if (values.days !== undefined) {
    seconds = parseUint("days", values.days, 1) * 86400;
  } else if (values.hours !== undefined) {
    seconds = parseUint("hours", values.hours, 1) * 3600;
  }
  return Math.floor(seconds / tickSeconds);
}

/** Two teams in M1 (spec D6). */
const TEAMS = 2;

function runSim(args: string[], out: Output): number {
  const { values } = parseArgs({
    args,
    options: {
      seed: { type: "string", default: "42" },
      params: { type: "string" },
      days: { type: "string" },
      hours: { type: "string" },
      strategist: { type: "string", default: "balanced" },
      out: { type: "string", default: "runs" },
      id: { type: "string" },
    },
    strict: true,
  });
  const seed = parseSeed(values.seed);
  const params = loadParams(values.params ?? DEFAULT_PARAMS);
  const ticks = parseTicks(values, params);
  const strategists = parseStrategists(values.strategist, TEAMS);
  const id = values.id ?? runId(seed);
  const dir = join(values.out, id);
  if (existsSync(dir)) throw new UsageError(`run already exists: ${dir}`);

  out.log(`geo sim --seed ${seed}: ${ticks} ticks, ${strategists.join(" x ")}`);
  const result = simulate({
    id,
    seed,
    params,
    paramsSource: paramsSource(values.params),
    ticks,
    strategists,
  });
  writeRun(dir, result);
  out.log(
    `  ${result.meta.wallSeconds.toFixed(1)} s, ${result.meta.commands} commands, hash ${result.meta.finalHash}`,
  );
  out.log(`  ${join(dir, RUN_FILES.report)}`);
  return 0;
}

function runSweepCommand(args: string[], out: Output): number {
  const { values } = parseArgs({
    args,
    options: {
      set: { type: "string" },
      seeds: { type: "string", default: "1-5" },
      params: { type: "string" },
      days: { type: "string" },
      hours: { type: "string" },
      strategist: { type: "string", default: "balanced" },
      out: { type: "string", default: "runs" },
      id: { type: "string" },
      "keep-runs": { type: "boolean", default: false },
    },
    strict: true,
  });
  if (values.set === undefined) throw new UsageError("geo sweep needs --set");
  const { path, values: settings } = parseSet(values.set);
  const seeds = parseSeeds(values.seeds);
  const params = loadParams(values.params ?? DEFAULT_PARAMS);
  const ticks = parseTicks(values, params);
  const strategists = parseStrategists(values.strategist, TEAMS);
  const id =
    values.id ?? `${runId(seeds[0]!).replace(/-s\d+$/, "")}-sweep-${path}`;
  const dir = join(values.out, id);
  if (existsSync(dir)) throw new UsageError(`run already exists: ${dir}`);

  out.log(
    `geo sweep ${path}=${settings.join(",")} seeds ${seeds.join(",")}: ${settings.length * seeds.length} runs of ${ticks} ticks`,
  );
  runSweep(
    dir,
    {
      id,
      params,
      paramsSource: paramsSource(values.params),
      path,
      values: settings,
      seeds,
      ticks,
      strategists,
    },
    values["keep-runs"],
    (line) => out.log(line),
  );
  out.log(`  ${join(dir, RUN_FILES.report)}`);
  return 0;
}

function runReport(args: string[], out: Output): number {
  const { positionals } = parseArgs({ args, allowPositionals: true });
  if (positionals.length !== 1) {
    throw new UsageError("geo report takes one run directory");
  }
  const dir = positionals[0]!;
  writeFileSync(join(dir, RUN_FILES.report), renderReport(readRun(dir)));
  out.log(join(dir, RUN_FILES.report));
  return 0;
}

function runVerify(args: string[], out: Output): number {
  const { values } = parseArgs({
    args,
    options: {
      seed: { type: "string", default: "42" },
      ticks: { type: "string", default: "50000" },
      params: { type: "string" },
      strategist: { type: "string", default: "balanced" },
    },
    strict: true,
  });
  const seed = parseSeed(values.seed);
  const ticks = parseUint("ticks", values.ticks, 1);
  const params = loadParams(values.params ?? DEFAULT_PARAMS);
  const strategists = parseStrategists(values.strategist, TEAMS);

  const result = verify(seed, ticks, params, strategists);
  out.log(`geo verify --seed ${seed} --ticks ${ticks}`);
  for (const run of result.runs) out.log(`  ${run.hash}  ${run.name}`);
  out.log(result.ok ? "OK: deterministic" : "FAIL: hashes differ");
  return result.ok ? 0 : 1;
}

/** Runs the CLI and returns the exit code: 0 ok, 1 check failed, 2 usage. */
export function run(argv: string[], out: Output = console): number {
  const [command, ...args] = argv;
  try {
    switch (command) {
      case "sim":
        return runSim(args, out);
      case "sweep":
        return runSweepCommand(args, out);
      case "report":
        return runReport(args, out);
      case "verify":
        return runVerify(args, out);
      case undefined:
      case "help":
      case "--help":
        out.log(USAGE);
        return command === undefined ? 2 : 0;
      default:
        throw new UsageError(`unknown command: ${command}`);
    }
  } catch (error) {
    if (
      error instanceof UsageError ||
      error instanceof SweepError ||
      (error as { code?: string }).code?.startsWith("ERR_PARSE_ARGS")
    ) {
      out.error(`${(error as Error).message}\n\n${USAGE}`);
      return 2;
    }
    throw error;
  }
}

if (import.meta.main) process.exitCode = run(process.argv.slice(2));
