// geo net (M1.5 plan section 7, R6): bandwidth and CPU of the view deltas over
// a whole bot × bot world. Every tick, for each team, it builds the view and
// the delta message as the server will (view, diffView, JSON.stringify, and
// the view hash every hashEveryTicks), timing each part; then it applies the
// delta, through JSON, to a client view and checks it against the server's
// (the property of plan section 7). At ×1 a tick is a world second and one
// send, so bytes per delta are bytes per second for a client.

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  applyDelta,
  diffView,
  emptySent,
  viewJson,
  type Delta,
} from "@geometrix/protocol";
import {
  botsFor,
  createWorld,
  view,
  type Params,
  type StrategistId,
  type TeamView,
} from "@geometrix/sim";
import { stepWithBots, type LoggedCommand } from "./harness.ts";
import { stateHash } from "./hash.ts";
import { HOUR, number, table, windowSeconds } from "./report.ts";

/** Spec section 7 targets (provisional guesses). */
export const NET_TARGETS = {
  /** Average per client at ×1 (ADR-0005 ceiling). */
  bytesPerSecond: 2048,
  /** View + diff of both teams per send, median. */
  cpuMicros: 250,
} as const;

export type NetOptions = {
  id: string;
  seed: number;
  params: Params;
  paramsSource: string;
  ticks: number;
  strategists: StrategistId[];
  /** The server's viewHashEveryTicks. */
  hashEveryTicks: number;
};

type Spread = { mean: number; median: number; p95: number; max: number };

export type NetWindow = {
  /** Start, in world seconds. */
  from: number;
  creeps: number;
  bytes: Spread;
  cpuMicros: Spread;
};

export type NetResult = {
  options: Omit<NetOptions, "params"> & { tickSeconds: number };
  /** Length of each of `windows`, in world seconds. */
  windowSeconds: number;
  finalHash: string;
  wallSeconds: number;
  /** Sends measured: one per tick after tick 0. */
  sends: number;
  maxCreeps: number;
  /** Delta message of one team, in bytes. */
  bytes: Spread;
  /** Per send, both teams, without the hash. */
  cpuMicros: Spread;
  /** Same, only over the ticks at the world's largest population. */
  cpuAtMaxCreeps: Spread;
  /** Medians per send, both teams. */
  parts: { view: number; diff: number; stringify: number };
  hash: { count: number; meanMicros: number; amortizedMicros: number };
  /** The full view a welcome carries, at the end. */
  welcomeBytes: number;
  windows: NetWindow[];
  property: {
    checks: number;
    mismatches: number;
    first: { tick: number; team: number } | null;
  };
};

const emptyView = (team: number): TeamView => ({
  tick: 0,
  team,
  teams: [],
  creeps: [],
  deposits: [],
  roads: [],
  roadJobs: [],
  players: [],
});

const sha256 = (text: string) =>
  createHash("sha256").update(text).digest("hex");

function spread(values: ArrayLike<number>): Spread {
  const sorted = Float64Array.from(values).sort();
  if (sorted.length === 0) return { mean: 0, median: 0, p95: 0, max: 0 };
  let sum = 0;
  for (const v of sorted) sum += v;
  const at = (q: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]!;
  return {
    mean: sum / sorted.length,
    median: at(0.5),
    p95: at(0.95),
    max: sorted[sorted.length - 1]!,
  };
}

export function measureNet(
  options: NetOptions,
  clock: () => number = () => performance.now(),
): NetResult {
  const { params, ticks, hashEveryTicks } = options;
  const started = clock();
  const state = createWorld(options.seed, params);
  const bots = botsFor(options.strategists);
  const log: LoggedCommand[] = [];
  const teams = state.teams.map((t) => t.id);
  const sent = teams.map(() => emptySent());
  const client = teams.map(emptyView);
  const seq = teams.map(() => 0);
  // The base the server starts from: what the first welcome carries.
  for (const team of teams) {
    const seen = view(state, team);
    diffView(sent[team]!, seen);
    client[team] = JSON.parse(JSON.stringify(seen)) as TeamView;
  }

  const bytes = new Float64Array(ticks * teams.length);
  const cpu = new Float64Array(ticks);
  const creepsAt = new Uint16Array(ticks);
  const tickAt = new Uint32Array(ticks);
  const viewTimes = new Float64Array(ticks);
  const diffTimes = new Float64Array(ticks);
  const stringifyTimes = new Float64Array(ticks);
  let hashMicros = 0;
  let hashes = 0;
  const property: NetResult["property"] = {
    checks: 0,
    mismatches: 0,
    first: null,
  };

  for (let i = 0; i < ticks; i++) {
    stepWithBots(state, bots, log);
    const hashed = state.tick % hashEveryTicks === 0;
    const messages: string[] = [];
    const views: TeamView[] = [];
    let viewT = 0;
    let diffT = 0;
    let stringifyT = 0;
    for (const team of teams) {
      const t0 = clock();
      const seen = view(state, team);
      const t1 = clock();
      const delta = diffView(sent[team]!, seen);
      const t2 = clock();
      seq[team]! += 1;
      let hash: string | undefined;
      if (hashed) {
        const h0 = clock();
        hash = sha256(viewJson(seen));
        hashMicros += (clock() - h0) * 1000;
        hashes++;
      }
      const t3 = clock();
      const message = JSON.stringify({
        type: "delta",
        seq: seq[team],
        delta,
        ...(hash === undefined ? {} : { hash }),
      });
      const t4 = clock();
      viewT += t1 - t0;
      diffT += t2 - t1;
      stringifyT += t4 - t3;
      bytes[i * teams.length + team] = Buffer.byteLength(message);
      messages.push(message);
      views.push(seen);
    }
    viewTimes[i] = viewT * 1000;
    diffTimes[i] = diffT * 1000;
    stringifyTimes[i] = stringifyT * 1000;
    cpu[i] = (viewT + diffT + stringifyT) * 1000;
    creepsAt[i] = state.creeps.length;
    tickAt[i] = state.tick;

    // The client side, outside the timings.
    for (const team of teams) {
      const { delta } = JSON.parse(messages[team]!) as { delta: Delta };
      client[team] = applyDelta(client[team]!, delta);
      const seen = views[team]!;
      property.checks++;
      const same =
        JSON.stringify(client[team]) === JSON.stringify(seen) &&
        (!hashed || viewJson(client[team]!) === viewJson(seen));
      if (!same) {
        property.mismatches++;
        property.first ??= { tick: state.tick, team };
        client[team] = JSON.parse(JSON.stringify(seen)) as TeamView;
      }
    }
  }

  const maxCreeps = creepsAt.reduce((a, b) => Math.max(a, b), 0);
  const window = windowSeconds(ticks * params.world.tickSeconds);
  const windows: NetWindow[] = [];
  for (let from = 0; from < ticks * params.world.tickSeconds; from += window) {
    const inWindow: number[] = [];
    for (let i = 0; i < ticks; i++) {
      const seconds = tickAt[i]! * params.world.tickSeconds;
      if (seconds > from && seconds <= from + window) inWindow.push(i);
    }
    if (inWindow.length === 0) continue;
    windows.push({
      from,
      creeps: creepsAt[inWindow.at(-1)!]!,
      bytes: spread(
        inWindow.flatMap((i) =>
          teams.map((team) => bytes[i * teams.length + team]!),
        ),
      ),
      cpuMicros: spread(inWindow.map((i) => cpu[i]!)),
    });
  }
  return {
    options: {
      id: options.id,
      seed: options.seed,
      paramsSource: options.paramsSource,
      ticks,
      strategists: options.strategists,
      hashEveryTicks,
      tickSeconds: params.world.tickSeconds,
    },
    windowSeconds: window,
    finalHash: stateHash(state),
    wallSeconds: (clock() - started) / 1000,
    sends: ticks,
    maxCreeps,
    bytes: spread(bytes),
    cpuMicros: spread(cpu),
    cpuAtMaxCreeps: spread(
      Array.from(cpu).filter((_, i) => creepsAt[i] === maxCreeps),
    ),
    parts: {
      view: spread(viewTimes).median,
      diff: spread(diffTimes).median,
      stringify: spread(stringifyTimes).median,
    },
    hash: {
      count: hashes,
      meanMicros: hashes === 0 ? 0 : hashMicros / hashes,
      amortizedMicros: ticks === 0 ? 0 : hashMicros / ticks,
    },
    welcomeBytes: Buffer.byteLength(viewJson(view(state, 0))),
    windows,
    property,
  };
}

/** The criteria of spec section 7 this run answers, with their verdicts. */
export function netVerdicts(result: NetResult) {
  const cpu = result.cpuMicros.median + result.hash.amortizedMicros;
  return {
    bandwidth: result.bytes.mean <= NET_TARGETS.bytesPerSecond,
    cpu: cpu <= NET_TARGETS.cpuMicros,
    property: result.property.mismatches === 0,
  };
}

const micros = (value: number) => `${number(value, 1)} µs`;
const ok = (pass: boolean) => (pass ? "✓" : "✗");

export function renderNet(result: NetResult): string {
  const { options } = result;
  const verdicts = netVerdicts(result);
  const cpuWithHash = result.cpuMicros.median + result.hash.amortizedMicros;
  const { property } = result;
  const worldSeconds = options.ticks * options.tickSeconds;
  const lines = [
    `# geo net — ${options.id}`,
    "",
    `Seed ${options.seed} · ${number(options.ticks)} ticks (${number(
      worldSeconds / HOUR,
      1,
    )} h de mundo) · ${options.strategists.join(" × ")} · parâmetros ${options.paramsSource} · hash da visão a cada ${options.hashEveryTicks} ticks`,
    "",
    "Um envio por tick, como no servidor a ×1: visão e delta de cada time, serializados. Bytes por delta = bytes por segundo de um cliente a ×1. CPU de um envio = os 2 times; o hash da visão entra amortizado.",
    "",
    "## Critérios (spec §7)",
    "",
    table(
      ["Critério", "Alvo", "Medido", ""],
      [
        [
          "Banda por cliente, ×1",
          `≤ ${number(NET_TARGETS.bytesPerSecond)} B/s em média`,
          `${number(result.bytes.mean)} B/s (pico ${number(result.bytes.max)} B)`,
          ok(verdicts.bandwidth),
        ],
        [
          "CPU de visão + diff, 2 times",
          `≤ ${number(NET_TARGETS.cpuMicros)} µs por envio, mediana`,
          `${micros(cpuWithHash)} (${micros(result.cpuMicros.median)} + hash ${micros(result.hash.amortizedMicros)})`,
          ok(verdicts.cpu),
        ],
        [
          "Correção do diff",
          "visão do cliente = visão do servidor, em todo tick",
          `${number(property.mismatches)} divergências em ${number(property.checks)} verificações${
            property.first === null
              ? ""
              : ` (1ª no tick ${property.first.tick}, time ${property.first.team})`
          }`,
          ok(verdicts.property),
        ],
      ],
    ),
    "",
    `Hash final do mundo: \`${result.finalHash}\``,
    "",
    "## Medições",
    "",
    table(
      ["Medida", "Média", "Mediana", "p95", "Máximo"],
      [
        [
          "Bytes por delta (um time)",
          number(result.bytes.mean),
          number(result.bytes.median),
          number(result.bytes.p95),
          number(result.bytes.max),
        ],
        [
          "CPU por envio, 2 times, sem hash (µs)",
          number(result.cpuMicros.mean, 1),
          number(result.cpuMicros.median, 1),
          number(result.cpuMicros.p95, 1),
          number(result.cpuMicros.max, 1),
        ],
        [
          `Idem, com ${number(result.maxCreeps)} creeps (população máxima)`,
          number(result.cpuAtMaxCreeps.mean, 1),
          number(result.cpuAtMaxCreeps.median, 1),
          number(result.cpuAtMaxCreeps.p95, 1),
          number(result.cpuAtMaxCreeps.max, 1),
        ],
      ],
    ),
    "",
    `- Partes do envio (medianas, 2 times): visão ${micros(result.parts.view)}, diff ${micros(result.parts.diff)}, \`JSON.stringify\` ${micros(result.parts.stringify)}.`,
    `- Hash da visão (\`viewJson\` + SHA-256): ${micros(result.hash.meanMicros)} por hash, ${number(result.hash.count)} hashes; ${micros(result.hash.amortizedMicros)} por envio, amortizado.`,
    `- Visão completa de um \`welcome\` no fim do mundo: ${number(result.welcomeBytes)} bytes.`,
    `- Tempo real da execução, com a verificação do cliente: ${number(result.wallSeconds, 1)} s.`,
    "",
    "## Ao longo do mundo",
    "",
    table(
      [
        "Janela",
        "Creeps no fim",
        "Bytes/delta, média",
        "Bytes/delta, máx.",
        "CPU, mediana (µs)",
        "CPU, p95 (µs)",
      ],
      result.windows.map((w) => [
        `${number(w.from / HOUR)}–${number(
          Math.min(w.from + result.windowSeconds, worldSeconds) / HOUR,
        )} h`,
        number(w.creeps),
        number(w.bytes.mean),
        number(w.bytes.max),
        number(w.cpuMicros.median, 1),
        number(w.cpuMicros.p95, 1),
      ]),
    ),
    "",
  ];
  return lines.join("\n");
}

export const NET_FILES = { report: "net.md", json: "net.json" } as const;

/** Writes runs/<id>/net.md and net.json; refuses an existing directory. */
export function writeNet(dir: string, result: NetResult): void {
  mkdirSync(dirname(dir), { recursive: true });
  mkdirSync(dir);
  writeFileSync(join(dir, NET_FILES.report), renderNet(result));
  writeFileSync(
    join(dir, NET_FILES.json),
    `${JSON.stringify(result, null, 2)}\n`,
  );
}
