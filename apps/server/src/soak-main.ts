#!/usr/bin/env node
// npm run soak (spec section 8 item 3): a compressed soak test of the server.
// See SOAK_USAGE in soak.ts.

import { spawn, type ChildProcess } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseReplay, type WorldSummary } from "@geometrix/protocol";
import { SIM_VERSION } from "@geometrix/sim";
import { stateHash } from "./hash.ts";
import {
  interruptions,
  parseSoakArgs,
  rebuild,
  samplesCsv,
  SOAK_USAGE,
  SoakError,
  summarize,
  type Interruption,
  type SoakOptions,
  type SoakSample,
} from "./soak.ts";

const SAMPLE_MS = 2000;
/** The server can take a while to start on /mnt/c (WSL): poll, do not sleep. */
const STARTUP_TIMEOUT_MS = 120_000;
const ROOT = new URL("../../../", import.meta.url);

let options: SoakOptions;
try {
  options = parseSoakArgs(process.argv.slice(2));
} catch (error) {
  if (!(error instanceof SoakError)) throw error;
  console.error(`${error.message}\n\n${SOAK_USAGE}`);
  process.exit(2);
}

const base = `http://localhost:${options.port}`;
const id = `soak-${stamp(new Date())}-s${options.seed}`;
const outDir = resolve(options.out, id);
const db =
  options.db ?? join(mkdtempSync(join(tmpdir(), "geometrix-soak-")), "soak.db");
mkdirSync(outDir, { recursive: true });
const serverLog = openSync(join(outDir, "server.log"), "a");
const started = Date.now();

type Event = Interruption & {
  /** World tick seen just before the stop. */
  seenTick: number;
  /** World tick right after the restart. */
  recoveredTick: number;
  exitCode: number | null;
  restartSeconds: number;
};

let server: ChildProcess | null = null;
process.on("SIGINT", () => {
  server?.kill("SIGTERM");
  process.exit(130);
});

if (await answers()) fail(`a server already answers on port ${options.port}`);

server = await startServer();
const { id: worldId } = await post<{ id: number }>("/api/worlds", {
  seed: options.seed,
  multiplier: options.multiplier,
  botTeams: [0, 1],
});
const durationTicks = (await world()).durationTicks;
const plan = interruptions(options.seed, options.kills, durationTicks);
log(
  `world #${worldId}: ${durationTicks} ticks at ×${options.multiplier}, ` +
    `db ${db}\nplan: ${plan.map((p) => `${p.kind}@${p.tick}`).join(", ")}`,
);

const samples: SoakSample[] = [];
const events: Event[] = [];
let ended = false;
while (!ended) {
  await sleep(SAMPLE_MS);
  const now = await world();
  samples.push(sampleOf(now.tick));
  ended = now.status === "ended";
  const next = plan[events.length];
  if (!ended && next !== undefined && now.tick >= next.tick) {
    events.push(await interrupt(next, now.tick));
  }
}

const replay = parseReplay(await get(`/api/worlds/${worldId}/replay`));
const rebuilt = stateHash(rebuild(replay));
const hashOk = rebuilt === replay.finalHash;
server.kill("SIGTERM");
await exited(server);

const summary = summarize(samples, options.multiplier);
const recoveredOk = events.every((e) => e.recoveredTick >= e.seenTick);
const ok = hashOk && recoveredOk && events.length === plan.length;
writeFileSync(join(outDir, "samples.csv"), samplesCsv(samples));
writeFileSync(join(outDir, "summary.md"), report());
log(`\n${report()}\n${outDir}`);
process.exit(ok ? 0 : 1);

function report(): string {
  const mb = (v: number | null) => (v === null ? "n/a" : `${v.toFixed(1)} MB`);
  const pct = (v: number | null) =>
    v === null ? "n/a" : `${Math.round(v * 100)}%`;
  const minutes = ((Date.now() - started) / 60_000).toFixed(1);
  return [
    `# Soak ${id}`,
    "",
    `- **Result:** ${ok ? "OK" : "FAILED"}`,
    `- World #${worldId}, seed ${options.seed}, ×${options.multiplier}, ` +
      `${durationTicks} ticks, sim version ${SIM_VERSION}; ${minutes} min real`,
    `- Replay rebuilt in Node: ${hashOk ? "same hash" : "DIFFERENT hash"} ` +
      `(server ${replay.finalHash.slice(0, 16)}…, Node ${rebuilt.slice(0, 16)}…), ` +
      `${replay.commands.length} logged commands`,
    `- Interruptions (${events.length}/${plan.length}):`,
    ...events.map(
      (e) =>
        `  - ${e.kind === "kill" ? "kill -9" : "SIGTERM"} at tick ${e.seenTick} ` +
        `(exit ${e.exitCode}), back at tick ${e.recoveredTick} ` +
        `in ${e.restartSeconds.toFixed(1)} s`,
    ),
    `- Memory: max ${mb(summary.maxRssMb)}; per process (first → last): ` +
      summary.rssByProcess
        .map((p) => `${mb(p.firstMb)} → ${mb(p.lastMb)}`)
        .join(", "),
    `- SQLite at the end: ${mb(summary.finalDbMb)}`,
    `- Loop speed (share of ×${options.multiplier}): ` +
      `median ${pct(summary.medianSpeedShare)}, slowest ${pct(summary.minSpeedShare)}`,
    "",
    "Check it in the browser too: " +
      `\`GEO_DB=${db} GEO_PORT=${options.port} npm run server\`, then open ` +
      `${base}/?replay=${worldId}.`,
    "",
  ].join("\n");
}

async function interrupt(step: Interruption, seenTick: number): Promise<Event> {
  const stopped = Date.now();
  const old = server!;
  old.kill(step.kind === "kill" ? "SIGKILL" : "SIGTERM");
  const exitCode = await exited(old);
  server = await startServer();
  const recoveredTick = (await world()).tick;
  const event = {
    ...step,
    seenTick,
    recoveredTick,
    exitCode,
    restartSeconds: (Date.now() - stopped) / 1000,
  };
  log(
    `${step.kind} at tick ${seenTick}: back at ${recoveredTick} ` +
      `in ${event.restartSeconds.toFixed(1)} s`,
  );
  return event;
}

function sampleOf(tick: number): SoakSample {
  const seconds = (Date.now() - started) / 1000;
  const pid = server!.pid!;
  const previous = samples[samples.length - 1];
  return {
    seconds,
    pid,
    tick,
    rssMb: rssMb(pid),
    dbMb: (size(db) + size(`${db}-wal`)) / 2 ** 20,
    ticksPerSecond:
      previous !== undefined && previous.pid === pid
        ? (tick - previous.tick) / (seconds - previous.seconds)
        : null,
  };
}

async function startServer(): Promise<ChildProcess> {
  const child = spawn(process.execPath, ["apps/server/src/main.ts"], {
    cwd: ROOT,
    env: { ...process.env, GEO_PORT: String(options.port), GEO_DB: db },
    stdio: ["ignore", serverLog, serverLog],
  });
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) fail("the server exited while starting");
    if (await answers()) return child;
    await sleep(250);
  }
  fail(`the server did not answer on port ${options.port}`);
}

function exited(child: ChildProcess): Promise<number | null> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve(child.exitCode);
  }
  return new Promise((done) => child.once("exit", (code) => done(code)));
}

async function world(): Promise<WorldSummary> {
  const list = (await get("/api/worlds")) as WorldSummary[];
  const found = list.find((w) => w.id === worldId);
  if (found === undefined) fail(`world #${worldId} is not listed`);
  return found;
}

async function answers(): Promise<boolean> {
  try {
    return (await fetch(`${base}/api/worlds`)).ok;
  } catch {
    return false;
  }
}

async function get(path: string): Promise<unknown> {
  const res = await fetch(base + path);
  if (!res.ok) fail(`GET ${path}: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) fail(`POST ${path}: ${res.status}`);
  return (await res.json()) as T;
}

function rssMb(pid: number): number | null {
  try {
    const status = readFileSync(`/proc/${pid}/status`, "utf8");
    const kb = /VmRSS:\s+(\d+)/.exec(status)?.[1];
    return kb === undefined ? null : Number(kb) / 1024;
  } catch {
    return null;
  }
}

function size(file: string): number {
  return existsSync(file) ? statSync(file).size : 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

function stamp(now: Date): string {
  return now
    .toISOString()
    .replace(/\.\d+Z$/, "")
    .replace(/[-:]/g, "")
    .replace("T", "-");
}

function log(text: string): void {
  console.log(text);
}

function fail(message: string): never {
  server?.kill("SIGTERM");
  console.error(`soak: ${message}`);
  process.exit(1);
}
