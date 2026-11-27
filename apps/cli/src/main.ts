#!/usr/bin/env node
// geo: headless simulation tools (plan section 9).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  DIFFICULTIES,
  parseParams,
  STRATEGISTS,
  type Difficulty,
  type Params,
  type StrategistId,
} from "@geometrix/sim";
import { parseBattleParams } from "@geometrix/battle";
import { BATTLE_FILES, battleSweep, writeBattleSweep } from "./battle.ts";
import { battleVerify, verifyLogFile } from "./battle-verify.ts";
import {
  junctionMatrix,
  MATRIX_FILES,
  writeMatrix,
} from "./junction-matrix.ts";
import { END_KIND_LABELS, endKind, resultText } from "./ending.ts";
import type { Concession } from "./harness.ts";
import { measureNet, NET_FILES, netVerdicts, writeNet } from "./net.ts";
import { renderReport } from "./report.ts";
import { readRun, RUN_FILES, runId, simulate, writeRun } from "./sim.ts";
import {
  parseSeeds,
  parseSet,
  runSweep,
  SweepError,
  withParam,
} from "./sweep.ts";
import { parseShock, ShockError, type Shock } from "./shock.ts";
import { verify } from "./verify.ts";

const DEFAULT_PARAMS = new URL("../../../params/default.json", import.meta.url);
const BATTLE_PARAMS = new URL("../../../params/battle.json", import.meta.url);

const USAGE = `usage: geo <command> [options]

commands:
  sim      runs a bot x bot world and writes runs/<id>/: run.json,
           samples.jsonl, encounters.json, pace.json, metrics.csv,
           replay.json, report.md (with the M2 R §7 pace targets)
           --seed <n>            world seed (default 42)
           --params <file>       params JSON (default params/default.json)
           --days <n> | --hours <n>
                                 world time (default world.durationSeconds)
           --mult <n>            time multiplier the report's real time is
                                 read at (default world.multiplier)
           --shock <t:n@m>       the recovery scenario: team t loses n free
                                 creeps (highest HP first) at real minute m;
                                 the run is not replayable (no replay.json)
           --concede <t@m>       team t's bot concedes at world minute m, a
                                 command in the log (replayable)
           --strategist <a[,b]>  per team: ${STRATEGISTS.join(" | ")}, the
                                 bot's difficulty after a colon
                                 (${DIFFICULTIES.join(" | ")}; default hard), e.g.
                                 balanced:hard,balanced:easy (default
                                 balanced; one name = both teams)
           --out <dir>           runs directory (default runs)
           --id <id>             run id (default <utc time>-s<seed>)
           --max-seconds <n>     fail (exit 1) if simulating takes longer
                                 than n wall-clock seconds (CI budget)
  sweep    runs the world for each value of one parameter and each seed,
           and compares them in runs/<id>/report.md and sweep.csv
           --set <path=v1,v2,...>  e.g. creep.cost.materia=30,40,50
           --seeds <list>        e.g. 1-5 or 1,4,9 (default 1-5)
           --days, --hours, --params, --strategist, --shock, --out, --id
                                 as in sim
           --mult <n>            as in sim (default each variant's
                                 world.multiplier, so world.multiplier=6,8,12
                                 compares the candidates on one world)
           --keep-runs           also write every run's full directory
  report   rewrites report.md of a run from its files
           geo report <run dir>
  verify   determinism check with bots: two runs, a snapshot -> restore run
           and a replay of the command log must reach the same state hash
           and emit the same events
           --seed <n>      world seed (default 42)
           --ticks <n>     ticks to simulate (default 50000)
           --params <file> params JSON (default params/default.json)
           --set <path=v>  one parameter's value, e.g. a short
                           world.durationSeconds for an end at the clock
           --strategist <a[,b]>  as in sim (default balanced)
           --concede <t@m> as in sim
           (refuses --shock: a shocked run does not replay)
  net      view deltas over a bot x bot world, as the server sends them:
           bytes and CPU per delta against the spec targets, and the client
           view rebuilt from the deltas checked in every tick; writes
           runs/<id>/net.md and net.json. Exit 1 if a target fails
           --seed, --params, --days | --hours, --strategist, --out, --id
                                 as in sim
           --hash-every <n>      ticks between view hashes (default 60)
  battle   the battle lab without a page (M2 laboratório):
           geo battle sweep: the preset matchups on every arena and seed,
           all under the gambits; writes runs/<id>/battle.md and battle.csv
             --seeds <list>      default 1-100
             --quick             a slice for CI: seeds 1-10
             --params <file>     default params/battle.json
             --out, --id         as in sim
             --max-seconds <n>   fail (exit 1) if the sweep takes longer
           geo battle verify: two runs, a snapshot -> restore halfway and
           a replay of the log must reach the same hash (a sample of the
           matrix on every arena, and a scripted human with lab commands)
             --seeds <list>      default 1,42,649
             --params <file>     default params/battle.json
             --log <file>        instead, replay a log exported by the lab
                                 and compare with its finalHash
  junction the junction's battles without the bots (M2 junction, C1-2):
           geo junction matrix: on each seed's world and a battle cell in it,
           every aggressor DNA against every victim DNA, the victim empty or
           full, fighting or fleeing, built by the junction's battleSetup and
           auto-resolved; writes runs/<id>/junction.md and junction.csv
             --seeds <list>      default 1-100
             --set <path=v1,...> run the matrix for each value of one sim
                                 parameter, e.g. battle.zone.insetPermille
             --params <file>     default params/default.json
             --battle-params <file>  default params/battle.json
             --out, --id         as in sim`;

export type Output = {
  log(line: string): void;
  error(line: string): void;
  /** Wall clock in ms for timing runs; tests pass a fake one. */
  clock?: () => number;
};

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

type BotOptions = {
  strategists: StrategistId[];
  /** Each team's bot difficulty (R spec D26): hard unless named. */
  difficulties: Difficulty[];
};

/** `--strategist balanced:easy,balanced`: a name per team, or one for all. */
function parseStrategists(raw: string, teams: number): BotOptions {
  const names = raw.split(",");
  const bots = names.map((entry) => {
    const [name, difficulty = "hard", ...rest] = entry.split(":");
    if (!STRATEGISTS.includes(name as StrategistId)) {
      throw new UsageError(`unknown strategist: ${name}`);
    }
    if (
      rest.length > 0 ||
      !DIFFICULTIES.includes(difficulty as Difficulty) ||
      (name === "none" && entry.includes(":"))
    ) {
      throw new UsageError(`bad difficulty in --strategist: ${entry}`);
    }
    return {
      strategist: name as StrategistId,
      difficulty: difficulty as Difficulty,
    };
  });
  if (names.length !== 1 && names.length !== teams) {
    throw new UsageError(`--strategist needs 1 or ${teams} names: ${raw}`);
  }
  const all = names.length === 1 ? new Array(teams).fill(bots[0]) : bots;
  return {
    strategists: all.map((b) => b.strategist),
    difficulties: all.map((b) => b.difficulty),
  };
}

/** How a run's log names its bots: "balanced:hard x balanced:easy". */
const botsTitle = ({ strategists, difficulties }: BotOptions) =>
  strategists
    .map((s, t) => (s === "none" ? s : `${s}:${difficulties[t]}`))
    .join(" x ");

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

/** --mult, or null to read the params' world.multiplier. */
function parseMultiplier(raw: string | undefined): number | null {
  return raw === undefined ? null : parseUint("mult", raw, 1);
}

function parseShockOption(raw: string | undefined): Shock | null {
  return raw === undefined ? null : parseShock(raw, TEAMS);
}

/** --concede team@minute, for a team a bot plays. */
function parseConcede(
  raw: string | undefined,
  { strategists }: BotOptions,
): Concession | null {
  if (raw === undefined) return null;
  const match = /^(\d+)@([1-9]\d*)$/.exec(raw);
  const team = Number(match?.[1]);
  if (match === null || team >= TEAMS) {
    throw new UsageError(`--concede must look like team@minute: ${raw}`);
  }
  if (strategists[team] === "none") {
    throw new UsageError(`--concede needs a bot on team ${team}`);
  }
  return { team, minute: Number(match[2]) };
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
      mult: { type: "string" },
      shock: { type: "string" },
      concede: { type: "string" },
      strategist: { type: "string", default: "balanced" },
      out: { type: "string", default: "runs" },
      id: { type: "string" },
      "max-seconds": { type: "string" },
    },
    strict: true,
  });
  const seed = parseSeed(values.seed);
  const params = loadParams(values.params ?? DEFAULT_PARAMS);
  const ticks = parseTicks(values, params);
  const multiplier = parseMultiplier(values.mult) ?? params.world.multiplier;
  const shock = parseShockOption(values.shock);
  const bots = parseStrategists(values.strategist, TEAMS);
  const concede = parseConcede(values.concede, bots);
  const maxSeconds =
    values["max-seconds"] === undefined
      ? null
      : parseUint("max-seconds", values["max-seconds"], 1);
  const id = values.id ?? runId(seed);
  const dir = join(values.out, id);
  if (existsSync(dir)) throw new UsageError(`run already exists: ${dir}`);

  out.log(
    `geo sim --seed ${seed}: ${ticks} ticks at ×${multiplier}, ${botsTitle(bots)}`,
  );
  const result = simulate(
    {
      id,
      seed,
      params,
      paramsSource: paramsSource(values.params),
      ticks,
      multiplier,
      shock,
      concede,
      ...bots,
    },
    out.clock,
  );
  writeRun(dir, result);
  out.log(
    `  ${result.meta.wallSeconds.toFixed(1)} s, ${result.meta.commands} commands, hash ${result.meta.finalHash}`,
  );
  out.log(`  ${join(dir, RUN_FILES.report)}`);
  if (maxSeconds !== null && result.meta.wallSeconds > maxSeconds) {
    out.error(
      `FAIL: ${result.meta.wallSeconds.toFixed(1)} s is over the ${maxSeconds} s budget`,
    );
    return 1;
  }
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
      mult: { type: "string" },
      shock: { type: "string" },
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
  const bots = parseStrategists(values.strategist, TEAMS);
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
      multiplier: parseMultiplier(values.mult),
      shock: parseShockOption(values.shock),
      ...bots,
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
      shock: { type: "string" },
      set: { type: "string" },
      concede: { type: "string" },
    },
    strict: true,
  });
  if (values.shock !== undefined) {
    throw new UsageError(
      "geo verify refuses --shock: a shocked run is a harness mutation, not replayable (M2 R P12)",
    );
  }
  const seed = parseSeed(values.seed);
  const ticks = parseUint("ticks", values.ticks, 1);
  let params = loadParams(values.params ?? DEFAULT_PARAMS);
  if (values.set !== undefined) {
    const { path, values: settings } = parseSet(values.set);
    if (settings.length !== 1) {
      throw new UsageError(`geo verify --set takes one value: ${values.set}`);
    }
    params = withParam(params, path, settings[0]!);
  }
  const bots = parseStrategists(values.strategist, TEAMS);

  const result = verify(
    seed,
    ticks,
    params,
    bots.strategists,
    bots.difficulties,
    parseConcede(values.concede, bots),
  );
  out.log(`geo verify --seed ${seed} --ticks ${ticks}`);
  for (const run of result.runs) {
    out.log(`  ${run.hash}  ${run.name}`);
    out.log(`  ${run.eventsHash}    events: ${run.events}`);
  }
  const { battles } = result;
  out.log(
    `  battles: ${battles.battles} replayed to the world log's results` +
      (battles.mismatches.length > 0
        ? `, ${battles.mismatches.length} did not: ${battles.mismatches.join(", ")}`
        : ""),
  );
  const { end } = result;
  out.log(
    end === null
      ? "  end: none, the world was still going"
      : `  end: ${END_KIND_LABELS[endKind(end)]}, ${resultText(end)}, tick ${end.result.tick}` +
          (result.sameEnd ? "" : "; the summaries differ"),
  );
  out.log(result.ok ? "OK: deterministic" : "FAIL: hashes differ");
  return result.ok ? 0 : 1;
}

function runNet(args: string[], out: Output): number {
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
      "hash-every": { type: "string", default: "60" },
    },
    strict: true,
  });
  const seed = parseSeed(values.seed);
  const params = loadParams(values.params ?? DEFAULT_PARAMS);
  const ticks = parseTicks(values, params);
  const bots = parseStrategists(values.strategist, TEAMS);
  const hashEveryTicks = parseUint("hash-every", values["hash-every"], 1);
  const id = values.id ?? `${runId(seed)}-net`;
  const dir = join(values.out, id);
  if (existsSync(dir)) throw new UsageError(`run already exists: ${dir}`);

  out.log(`geo net --seed ${seed}: ${ticks} ticks, ${botsTitle(bots)}`);
  const result = measureNet(
    {
      id,
      seed,
      params,
      paramsSource: paramsSource(values.params),
      ticks,
      ...bots,
      hashEveryTicks,
    },
    out.clock,
  );
  writeNet(dir, result);
  const verdicts = netVerdicts(result);
  out.log(
    `  ${result.wallSeconds.toFixed(1)} s, ${result.bytes.mean.toFixed(0)} B/delta, ${(result.cpuMicros.median + result.hash.amortizedMicros).toFixed(1)} µs/send, ${result.property.mismatches} mismatches, hash ${result.finalHash}`,
  );
  out.log(`  ${join(dir, NET_FILES.report)}`);
  const failed = Object.entries(verdicts).filter(([, pass]) => !pass);
  for (const [name] of failed) out.error(`FAIL: ${name}`);
  return failed.length === 0 ? 0 : 1;
}

function battleParamsSource(file: string | undefined): string {
  return file ?? relative(process.cwd(), fileURLToPath(BATTLE_PARAMS));
}

function runBattleSweep(args: string[], out: Output): number {
  const { values } = parseArgs({
    args,
    options: {
      seeds: { type: "string" },
      quick: { type: "boolean", default: false },
      params: { type: "string" },
      out: { type: "string", default: "runs" },
      id: { type: "string" },
      "max-seconds": { type: "string" },
    },
    strict: true,
  });
  const seeds = parseSeeds(values.seeds ?? (values.quick ? "1-10" : "1-100"));
  const params = parseBattleParams(
    JSON.parse(readFileSync(values.params ?? BATTLE_PARAMS, "utf8")),
  );
  const maxSeconds =
    values["max-seconds"] === undefined
      ? null
      : parseUint("max-seconds", values["max-seconds"], 1);
  const id = values.id ?? `${runId(seeds[0]!).replace(/-s\d+$/, "")}-battle`;
  const dir = join(values.out, id);
  if (existsSync(dir)) throw new UsageError(`run already exists: ${dir}`);

  out.log(`geo battle sweep: seeds ${seeds[0]}-${seeds.at(-1)}`);
  const result = battleSweep(
    { id, params, paramsSource: battleParamsSource(values.params), seeds },
    out.clock,
  );
  writeBattleSweep(dir, result);
  const battles = result.cells.reduce((n, c) => n + c.records.length, 0);
  out.log(`  ${battles} battles in ${result.wallSeconds.toFixed(1)} s`);
  out.log(`  ${join(dir, BATTLE_FILES.report)}`);
  if (maxSeconds !== null && result.wallSeconds > maxSeconds) {
    out.error(
      `FAIL: ${result.wallSeconds.toFixed(1)} s is over the ${maxSeconds} s budget`,
    );
    return 1;
  }
  return 0;
}

function runBattleVerify(args: string[], out: Output): number {
  const { values } = parseArgs({
    args,
    options: {
      seeds: { type: "string", default: "1,42,649" },
      params: { type: "string" },
      log: { type: "string" },
    },
    strict: true,
  });
  if (values.log !== undefined) {
    const result = verifyLogFile(readFileSync(values.log, "utf8"));
    out.log(`geo battle verify --log ${values.log}: ${result.ticks} ticks`);
    out.log(`  ${result.actual}  replay`);
    out.log(`  ${result.expected ?? "(none)"}  finalHash`);
    if (!result.ok) {
      out.error("FAIL: the replay does not reach the log's finalHash");
      return 1;
    }
    out.log("OK: the log reaches its hash");
    return 0;
  }
  const seeds = parseSeeds(values.seeds);
  const params = parseBattleParams(
    JSON.parse(readFileSync(values.params ?? BATTLE_PARAMS, "utf8")),
  );
  const result = battleVerify(params, seeds);
  out.log(`geo battle verify --seeds ${values.seeds}`);
  for (const c of result.cases) {
    out.log(
      `  seed ${c.seed} ${c.name}: ${c.ticks} ticks ${c.ok ? "ok" : "DIFFER"}`,
    );
    if (!c.ok) {
      for (const r of c.runs) out.log(`    ${r.hash}  ${r.name}`);
    }
  }
  out.log(result.ok ? "OK: deterministic" : "FAIL: hashes differ");
  return result.ok ? 0 : 1;
}

function runBattle(args: string[], out: Output): number {
  const [sub, ...rest] = args;
  switch (sub) {
    case "sweep":
      return runBattleSweep(rest, out);
    case "verify":
      return runBattleVerify(rest, out);
    default:
      throw new UsageError(`unknown battle command: ${String(sub)}`);
  }
}

function runJunctionMatrix(args: string[], out: Output): number {
  const { values } = parseArgs({
    args,
    options: {
      seeds: { type: "string", default: "1-100" },
      set: { type: "string" },
      params: { type: "string" },
      "battle-params": { type: "string" },
      out: { type: "string", default: "runs" },
      id: { type: "string" },
    },
    strict: true,
  });
  const seeds = parseSeeds(values.seeds);
  const set = values.set === undefined ? null : parseSet(values.set);
  const params = loadParams(values.params ?? DEFAULT_PARAMS);
  const battleFile = values["battle-params"];
  const battleParams = parseBattleParams(
    JSON.parse(readFileSync(battleFile ?? BATTLE_PARAMS, "utf8")),
  );
  const id = values.id ?? `${runId(seeds[0]!).replace(/-s\d+$/, "")}-junction`;
  const dir = join(values.out, id);
  if (existsSync(dir)) throw new UsageError(`run already exists: ${dir}`);

  out.log(
    `geo junction matrix: seeds ${seeds[0]}-${seeds.at(-1)}` +
      (set === null ? "" : `, ${set.path}=${set.values.join(",")}`),
  );
  const result = junctionMatrix(
    {
      id,
      params,
      paramsSource: paramsSource(values.params),
      battleParams,
      battleParamsSource: battleParamsSource(battleFile),
      seeds,
      set,
    },
    out.clock,
    (line) => out.log(line),
  );
  writeMatrix(dir, result);
  const battles = result.runs.reduce(
    (n, run) => n + [...run.records.values()].reduce((m, r) => m + r.length, 0),
    0,
  );
  out.log(`  ${battles} battles in ${result.wallSeconds.toFixed(1)} s`);
  out.log(`  ${join(dir, MATRIX_FILES.report)}`);
  return 0;
}

function runJunction(args: string[], out: Output): number {
  const [sub, ...rest] = args;
  switch (sub) {
    case "matrix":
      return runJunctionMatrix(rest, out);
    default:
      throw new UsageError(`unknown junction command: ${String(sub)}`);
  }
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
      case "net":
        return runNet(args, out);
      case "battle":
        return runBattle(args, out);
      case "junction":
        return runJunction(args, out);
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
      error instanceof ShockError ||
      (error as { code?: string }).code?.startsWith("ERR_PARSE_ARGS")
    ) {
      out.error(`${(error as Error).message}\n\n${USAGE}`);
      return 2;
    }
    throw error;
  }
}

if (import.meta.main) process.exitCode = run(process.argv.slice(2));
