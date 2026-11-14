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
import { viewJson } from "@geometrix/protocol/stream";
import { SIM_VERSION, view } from "@geometrix/sim";
import { stateHash } from "./hash.ts";
import { SoakClient } from "./soak-client.ts";
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
const clients = await startClients();
// Each client drops its own connection every dropEverySeconds, staggered:
// short drops that the stream buffer should resume (spec S-5).
const dropTimers = clients.map((client, i) => {
  const every = options.dropEverySeconds * 1000;
  const offset = Math.floor((every * (i + 1)) / (clients.length + 1));
  let interval: NodeJS.Timeout | undefined;
  const first = setTimeout(() => {
    client.drop();
    interval = setInterval(() => client.drop(), every);
  }, offset);
  return () => {
    clearTimeout(first);
    clearInterval(interval);
  };
});

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

for (const stop of dropTimers) stop();
const replay = parseReplay(await get(`/api/worlds/${worldId}/replay`));
const final = rebuild(replay);
const rebuilt = stateHash(final);
const hashOk = rebuilt === replay.finalHash;
// The last send carries the last tick; give the clients a moment to get it.
const deadline = Date.now() + 15_000;
while (
  clients.some((c) => c.view?.tick !== replay.ticks) &&
  Date.now() < deadline
) {
  await sleep(100);
}
const finals = clients.map((client) => ({
  report: client.stop(),
  tick: client.view?.tick ?? null,
  same:
    client.view !== null &&
    viewJson(client.view) === viewJson(view(final, client.report.team)),
}));
server.kill("SIGTERM");
await exited(server);

const summary = summarize(samples, options.multiplier);
const recoveredOk = events.every((e) => e.recoveredTick >= e.seenTick);
const clientsOk = finals.every(
  (f) =>
    f.same && f.report.hashes.mismatch === 0 && f.report.errors.length === 0,
);
const ok = hashOk && recoveredOk && events.length === plan.length && clientsOk;
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
    ...clientSections(),
    "Check it in the browser too: " +
      `\`GEO_DB=${db} GEO_PORT=${options.port} npm run server\`, then open ` +
      `${base}/?replay=${worldId}.`,
    "",
  ].join("\n");
}

function clientSections(): string[] {
  if (finals.length === 0) return [];
  const kb = (bytes: number) => `${(bytes / 1024).toFixed(2)} KB`;
  const lines = [
    `## Clients (${finals.length})`,
    "",
    `Headless WebSocket clients, ${options.clients} per team, each dropping its ` +
      `own connection every ${options.dropEverySeconds} s (staggered). Bytes per ` +
      `real second at ×${options.multiplier}: each send covers several ticks.`,
    "",
    "| Client | Team | Final view | Bytes/s, mean | Bytes/s, peak | Deltas | Drops | Resumed | Welcomes (join · reconnect · resync) | Resyncs (seq · hash) | Hashes ok · mismatched |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const { report: r, same, tick } of finals) {
    lines.push(
      `| ${r.name} | ${r.team} | ${same ? "same as the server" : `DIFFERENT (tick ${tick})`} | ` +
        `${kb(r.meanBytesPerSecond)} | ${kb(r.peakBytesPerSecond)} | ${r.deltas} | ${r.drops} | ${r.resumes} | ` +
        `${r.welcomes.join} · ${r.welcomes.reconnect} · ${r.welcomes.resync} | ` +
        `${r.resyncs.seqGap} · ${r.resyncs.hashMismatch} | ${r.hashes.ok} · ${r.hashes.mismatch} |`,
    );
  }
  const errors = finals.flatMap((f) =>
    f.report.errors.map((e) => `- ${f.report.name}: ${e}`),
  );
  return [...lines, "", ...errors, ...(errors.length > 0 ? [""] : [])];
}

async function startClients(): Promise<SoakClient[]> {
  const started: SoakClient[] = [];
  for (const team of [0, 1]) {
    for (let i = 0; i < options.clients; i++) {
      const name = `soak-${team}-${i}`;
      const { token } = await post<{ token: string }>(
        `/api/worlds/${worldId}/join`,
        { name, team },
      );
      started.push(
        new SoakClient({
          base: base.replace("http", "ws"),
          token,
          name,
          team,
        }),
      );
    }
  }
  return started;
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
