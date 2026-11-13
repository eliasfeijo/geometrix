#!/usr/bin/env node
// geo: headless simulation tools (plan section 9).

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { parseParams, type Params } from "@geometrix/sim";
import { verify } from "./verify.ts";

const DEFAULT_PARAMS = new URL("../../../params/default.json", import.meta.url);

const USAGE = `usage: geo <command> [options]

commands:
  verify   determinism check: two runs and a snapshot -> restore run must
           reach the same state hash
           --seed <n>      world seed (default 42)
           --ticks <n>     ticks to simulate (default 50000)
           --params <file> params JSON (default params/default.json)`;

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

function runVerify(args: string[], out: Output): number {
  const { values } = parseArgs({
    args,
    options: {
      seed: { type: "string", default: "42" },
      ticks: { type: "string", default: "50000" },
      params: { type: "string" },
    },
    strict: true,
  });
  const seed = parseUint("seed", values.seed, 0);
  if (seed >= 2 ** 32) throw new UsageError(`--seed must be < 2^32: ${seed}`);
  const ticks = parseUint("ticks", values.ticks, 1);
  const params = loadParams(values.params ?? DEFAULT_PARAMS);

  const result = verify(seed, ticks, params);
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
      (error as { code?: string }).code?.startsWith("ERR_PARSE_ARGS")
    ) {
      out.error(`${(error as Error).message}\n\n${USAGE}`);
      return 2;
    }
    throw error;
  }
}

if (import.meta.main) process.exitCode = run(process.argv.slice(2));
