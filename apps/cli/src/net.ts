// geo net (M1.5 plan section 7, R6): bandwidth and CPU of the view deltas over
// a whole bot × bot world. Every tick, for each team, it builds the view and
// the delta message as the server will (view, diffView, JSON.stringify, and
// the view hash every hashEveryTicks), timing each part; then it applies the
// delta, through JSON, to a client view and checks it against the server's
// (the property of plan section 7). At ×1 a tick is a world second and one
// send, so bytes per delta are bytes per second for a client. Since M2
// (encontro plan section 8) the delta carries the team's events of the tick,
// filtered as the server does (eventsFor), and that filter is timed too.
// With the junction (F4, spec section 7) it measures a watcher too: each
// battle of the run, replayed from its log, as the frames a battle screen
// gets (battleFrame, as the server builds it, a delta of the battle view):
// one per battle tick in real time, one per world second on the world clock,
// and the battleOpen once; and the full view per frame, for comparison.

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  applyDelta,
  diffBattleView,
  diffView,
  emptyBattleSent,
  emptySent,
  emptyView,
  viewJson,
  type Delta,
} from "@geometrix/protocol";
import {
  botsFor,
  createWorld,
  eventsFor,
  view,
  type Params,
  type StrategistId,
  type TeamEvent,
  type TeamView,
} from "@geometrix/sim";
import {
  battleView,
  createBattle,
  stepBattle,
  type BattleEvent,
} from "@geometrix/battle";
import { createHost, type FinishedBattle } from "@geometrix/junction";
import {
  defaultBattleParams,
  stepWithBots,
  type LoggedCommand,
} from "./harness.ts";
import { stateHash } from "./hash.ts";
import { HOUR, number, table } from "./format.ts";
import { windowSeconds } from "./report.ts";

/** Spec section 7 targets (provisional guesses). */
export const NET_TARGETS = {
  /** Average per client at ×1 (ADR-0005 ceiling). */
  bytesPerSecond: 2048,
  /** View + diff of both teams per send, median. */
  cpuMicros: 250,
  /** A watcher's battle frames in real time (junction spec section 7). */
  frameBytesPerSecond: 16 * 1024,
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
  parts: { view: number; diff: number; events: number; stringify: number };
  /** Events sent, both teams, and the deltas that carried any. */
  events: { sent: number; deltas: number; maxPerDelta: number };
  hash: { count: number; meanMicros: number; amortizedMicros: number };
  /** The full view a welcome carries, at the end. */
  welcomeBytes: number;
  /** The chronicle a welcome carries at the end (team 0's latest 100). */
  chronicleBytes: number;
  windows: NetWindow[];
  /** A battle screen watching each battle of the run (junction F4). */
  watcher: WatcherResult;
  property: {
    checks: number;
    mismatches: number;
    first: { tick: number; team: number } | null;
  };
};

export type WatcherResult = {
  /** Battles of the run measured (ended, and still open at the end). */
  battles: number;
  /** Battle seconds over all of them. */
  seconds: number;
  /** One frame per battle tick (real time), in bytes. */
  realFrame: Spread;
  /** Per battle: its frames' bytes over its seconds, in real time. */
  realPerSecond: Spread;
  /** The same with the full view in every frame instead of its delta. */
  fullPerSecond: Spread;
  /** One frame per world second (the world clock), in bytes. */
  worldFrame: Spread;
  /** The battleOpen a screen gets once. */
  openBytes: Spread;
};

/** The battles' logs as the host left them: ended or still open. */
type MeasuredBattle = Pick<
  FinishedBattle,
  "battleId" | "log" | "members" | "sideOf"
>;

/**
 * Replays each battle's log and sizes the frames a battle screen would get
 * (the server's battleFrame and battleOpen). The roster a frame carries on a
 * join is the battle's last one, with the side of a team (the same size).
 */
export function measureWatcher(
  battles: readonly MeasuredBattle[],
  ticksPerWorldTick: number,
): WatcherResult {
  const realFrames: number[] = [];
  const realPerSecond: number[] = [];
  const fullPerSecond: number[] = [];
  const worldFrames: number[] = [];
  const opens: number[] = [];
  let seconds = 0;
  for (const battle of battles) {
    const { log } = battle;
    const state = createBattle(log.setup, log.params);
    const roster = {
      members: battle.members,
      sides: battle.sideOf.map(() => ({ kind: "team", team: 0 })),
    };
    opens.push(
      Buffer.byteLength(
        JSON.stringify({
          type: "battleOpen",
          battleId: battle.battleId,
          arena: state.arena,
          params: log.params,
          roster,
          view: battleView(state),
        }),
      ),
    );
    const realSent = emptyBattleSent();
    const worldSent = emptyBattleSent();
    diffBattleView(realSent, battleView(state));
    diffBattleView(worldSent, battleView(state));
    const frame = (body: object, events: BattleEvent[]) =>
      Buffer.byteLength(
        JSON.stringify({
          type: "battleFrame",
          battleId: battle.battleId,
          ...body,
          events,
          ...(events.some((e) => e.type === "joined") ? { roster } : {}),
        }),
      );
    let next = 0;
    let bytes = 0;
    let full = 0;
    let second: BattleEvent[] = [];
    while (state.tick < log.ticks) {
      const entry = log.commands[next];
      let input: unknown[] = [];
      if (entry !== undefined && entry.tick === state.tick) {
        input = entry.commands;
        next += 1;
      }
      const events = stepBattle(state, input);
      const view = battleView(state);
      const real = frame({ delta: diffBattleView(realSent, view) }, events);
      realFrames.push(real);
      bytes += real;
      full += frame({ view }, events);
      second.push(...events);
      if (state.tick % ticksPerWorldTick === 0 || state.ended !== null) {
        worldFrames.push(
          frame({ delta: diffBattleView(worldSent, view) }, second),
        );
        second = [];
      }
    }
    const battleSeconds = log.ticks / log.params.tick.ticksPerSecond;
    seconds += battleSeconds;
    if (battleSeconds > 0) {
      realPerSecond.push(bytes / battleSeconds);
      fullPerSecond.push(full / battleSeconds);
    }
  }
  return {
    battles: battles.length,
    seconds,
    realFrame: spread(realFrames),
    realPerSecond: spread(realPerSecond),
    fullPerSecond: spread(fullPerSecond),
    worldFrame: spread(worldFrames),
    openBytes: spread(opens),
  };
}

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
  const host = createHost(defaultBattleParams());
  const teams = state.teams.map((t) => t.id);
  const sent = teams.map(() => emptySent());
  const cells = state.map.width * state.map.height;
  const client = teams.map((team) => emptyView(team, cells));
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
  const eventTimes = new Float64Array(ticks);
  const chronicle: TeamEvent[] = [];
  const events = { sent: 0, deltas: 0, maxPerDelta: 0 };
  const stringifyTimes = new Float64Array(ticks);
  const battles: MeasuredBattle[] = [];
  let hashMicros = 0;
  let hashes = 0;
  const property: NetResult["property"] = {
    checks: 0,
    mismatches: 0,
    first: null,
  };

  for (let i = 0; i < ticks; i++) {
    const done = stepWithBots(state, host, bots, log);
    const tickEvents = done.events;
    battles.push(...done.finished);
    const hashed = state.tick % hashEveryTicks === 0;
    const messages: string[] = [];
    const views: TeamView[] = [];
    let viewT = 0;
    let diffT = 0;
    let eventsT = 0;
    let stringifyT = 0;
    for (const team of teams) {
      const t0 = clock();
      const seen = view(state, team);
      const t1 = clock();
      const delta = diffView(sent[team]!, seen);
      const t2 = clock();
      const seenEvents = eventsFor(tickEvents, team);
      const t2e = clock();
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
        ...(seenEvents.length === 0 ? {} : { events: seenEvents }),
      });
      const t4 = clock();
      viewT += t1 - t0;
      diffT += t2 - t1;
      eventsT += t2e - t2;
      stringifyT += t4 - t3;
      if (seenEvents.length > 0) {
        events.sent += seenEvents.length;
        events.deltas++;
        events.maxPerDelta = Math.max(events.maxPerDelta, seenEvents.length);
        if (team === 0) chronicle.push(...seenEvents);
      }
      bytes[i * teams.length + team] = Buffer.byteLength(message);
      messages.push(message);
      views.push(seen);
    }
    viewTimes[i] = viewT * 1000;
    diffTimes[i] = diffT * 1000;
    eventTimes[i] = eventsT * 1000;
    stringifyTimes[i] = stringifyT * 1000;
    cpu[i] = (viewT + diffT + eventsT + stringifyT) * 1000;
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
      events: spread(eventTimes).median,
      stringify: spread(stringifyTimes).median,
    },
    events,
    hash: {
      count: hashes,
      meanMicros: hashes === 0 ? 0 : hashMicros / hashes,
      amortizedMicros: ticks === 0 ? 0 : hashMicros / ticks,
    },
    welcomeBytes: Buffer.byteLength(viewJson(view(state, 0))),
    chronicleBytes: Buffer.byteLength(JSON.stringify(chronicle.slice(-100))),
    windows,
    watcher: measureWatcher(
      [...battles, ...host.instances].sort((a, b) => a.battleId - b.battleId),
      host.battleParams.tick.ticksPerSecond * params.world.tickSeconds,
    ),
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
    frames: result.watcher.realPerSecond.max <= NET_TARGETS.frameBytesPerSecond,
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
          "Frames de batalha por espectador, tempo real",
          `≤ ${number(NET_TARGETS.frameBytesPerSecond)} B/s na pior batalha`,
          result.watcher.battles === 0
            ? "nenhuma batalha"
            : `${number(result.watcher.realPerSecond.max)} B/s (média das batalhas ${number(result.watcher.realPerSecond.mean)} B/s)`,
          ok(verdicts.frames),
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
    `- Partes do envio (medianas, 2 times): visão ${micros(result.parts.view)}, diff ${micros(result.parts.diff)}, eventos do time ${micros(result.parts.events)}, \`JSON.stringify\` ${micros(result.parts.stringify)}.`,
    `- Eventos enviados (2 times): ${number(result.events.sent)}, em ${number(result.events.deltas)} deltas (no máximo ${number(result.events.maxPerDelta)} num delta).`,
    `- Hash da visão (\`viewJson\` + SHA-256): ${micros(result.hash.meanMicros)} por hash, ${number(result.hash.count)} hashes; ${micros(result.hash.amortizedMicros)} por envio, amortizado.`,
    `- Visão completa de um \`welcome\` no fim do mundo: ${number(result.welcomeBytes)} bytes; a crônica dele (as últimas 100 entradas do time 0): ${number(result.chronicleBytes)} bytes.`,
    `- Tempo real da execução, com a verificação do cliente: ${number(result.wallSeconds, 1)} s.`,
    "",
    "## Um espectador de batalha",
    "",
    `Cada uma das ${number(result.watcher.battles)} batalhas da corrida (${number(result.watcher.seconds)} s de batalha), refeita do seu log, como os frames que uma tela de batalha recebe, cada um o delta da visão da batalha desde o anterior: um por tick de batalha em tempo real (20 por segundo), um por segundo de mundo no relógio do mundo (a ×1, um por segundo; a ×N, N por segundo). O \`battleOpen\` vai uma vez, ao abrir a tela, com a visão inteira.`,
    "",
    table(
      ["Medida", "Média", "Mediana", "p95", "Máximo"],
      [
        [
          "Frame em tempo real (bytes)",
          number(result.watcher.realFrame.mean),
          number(result.watcher.realFrame.median),
          number(result.watcher.realFrame.p95),
          number(result.watcher.realFrame.max),
        ],
        [
          "Tempo real, por batalha (B/s)",
          number(result.watcher.realPerSecond.mean),
          number(result.watcher.realPerSecond.median),
          number(result.watcher.realPerSecond.p95),
          number(result.watcher.realPerSecond.max),
        ],
        [
          "Idem, com a visão inteira em cada frame (B/s)",
          number(result.watcher.fullPerSecond.mean),
          number(result.watcher.fullPerSecond.median),
          number(result.watcher.fullPerSecond.p95),
          number(result.watcher.fullPerSecond.max),
        ],
        [
          "Frame no relógio do mundo (bytes)",
          number(result.watcher.worldFrame.mean),
          number(result.watcher.worldFrame.median),
          number(result.watcher.worldFrame.p95),
          number(result.watcher.worldFrame.max),
        ],
        [
          "`battleOpen` (bytes)",
          number(result.watcher.openBytes.mean),
          number(result.watcher.openBytes.median),
          number(result.watcher.openBytes.p95),
          number(result.watcher.openBytes.max),
        ],
      ],
    ),
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
