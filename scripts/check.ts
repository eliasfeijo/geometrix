// The check runner (CLAUDE.md, "Commands"). Node runs this file directly.
//
// `node scripts/check.ts` is `npm run check`: the same steps as CI (typecheck,
// lint, format:check and the tests, nothing skipped). The three static steps
// run in parallel and print in order; the tests run only when they pass.
//
// `node scripts/check.ts --fast` is `npm run check:fast`, the loop before each
// task commit: typecheck, lint, format:check, then the tests related to the uncommitted
// changes, with GEO_FAST=1 (the slow protocol worlds are skipped; the full
// check and CI run them).
//
// Either way it exits non-zero on the first failing step and prints the
// seconds of each step.

import { spawn } from "node:child_process";

interface Step {
  name: string;
  command: string;
  env?: Record<string, string>;
}

interface Outcome {
  step: Step;
  code: number;
  seconds: number;
  output: string;
}

const STATIC_STEPS: Step[] = [
  { name: "typecheck", command: "npm run typecheck" },
  { name: "lint", command: "npm run lint" },
  { name: "format:check", command: "npm run format:check" },
];

const TEST_STEP: Step = { name: "tests", command: "npm test" };

const FAST_STEPS: Step[] = [
  { name: "typecheck", command: "npm run typecheck" },
  { name: "lint", command: "npm run lint" },
  { name: "format:check", command: "npm run format:check" },
  {
    name: "tests (changed)",
    command: "npx vitest run --changed",
    env: { GEO_FAST: "1" },
  },
];

function run(step: Step, inherit: boolean): Promise<Outcome> {
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(step.command, {
      shell: true,
      env: { ...process.env, ...step.env },
      stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => (output += chunk));
    child.stderr?.on("data", (chunk: Buffer) => (output += chunk));
    child.on("close", (code) =>
      resolve({
        step,
        code: code ?? 1,
        seconds: (Date.now() - started) / 1000,
        output,
      }),
    );
  });
}

function report(outcome: Outcome): void {
  const verdict = outcome.code === 0 ? "ok" : `FAILED (exit ${outcome.code})`;
  console.log(
    `[check] ${outcome.step.name}: ${verdict} in ${outcome.seconds.toFixed(1)} s`,
  );
}

async function fast(): Promise<number> {
  for (const step of FAST_STEPS) {
    console.log(`[check] ${step.name}…`);
    const outcome = await run(step, true);
    report(outcome);
    if (outcome.code !== 0) return outcome.code;
  }
  return 0;
}

async function full(): Promise<number> {
  console.log(
    `[check] ${STATIC_STEPS.map((s) => s.name).join(" | ")} in parallel…`,
  );
  const outcomes = await Promise.all(STATIC_STEPS.map((s) => run(s, false)));
  for (const outcome of outcomes) {
    console.log(`\n--- ${outcome.step.name} ---`);
    process.stdout.write(outcome.output);
    report(outcome);
  }
  const failed = outcomes.find((o) => o.code !== 0);
  if (failed) return failed.code;

  console.log(`[check] ${TEST_STEP.name}…`);
  const tests = await run(TEST_STEP, true);
  report(tests);
  return tests.code;
}

const started = Date.now();
const code = process.argv.includes("--fast") ? await fast() : await full();
console.log(`[check] total ${((Date.now() - started) / 1000).toFixed(1)} s`);
process.exit(code);
