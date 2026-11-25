// geo sweep (plan section 9): runs the same bot × bot world for each value of
// one parameter and each seed, and compares the outcomes side by side. Writes
// runs/<id>/ with report.md, sweep.csv (one row per run) and each run's
// run.json; --keep-runs also keeps every run's full directory.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  ACTIVITIES,
  DNAS,
  parseParams,
  type MetricsSample,
  type Params,
  type StrategistId,
} from "@geometrix/sim";
import {
  FATES,
  LOADS,
  type EncounterTally,
  type Fate,
  type Role,
} from "./encounters.ts";
import { HOUR, hours, number, realTime, table } from "./format.ts";
import {
  seedTargets,
  TARGETS,
  type PaceFacts,
  type TargetRow,
} from "./pace.ts";
import type { Shock } from "./shock.ts";
import {
  metaJson,
  paceJson,
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
  /** The ×N the run's real time is read at (M2 R plan P1). */
  multiplier: number;
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
  /**
   * Minutes until the first delivery of each resource for the slowest team
   * (fog spec §7, match start), or null if some team never delivered it.
   */
  firstMateriaMinutes: number | null;
  firstCristalMinutes: number | null;
  /** Between the teams: the largest gap in first materia and in materia delivered. */
  firstMateriaGapMinutes: number | null;
  deliveredMateriaGap: number;
  /** Hours until a team first saw an enemy core, mean of the teams. */
  enemyCoreSeenHours: number | null;
  exploredPercent: number;
  /** Encounters (M2 encontro spec §7), means of the teams unless noted. */
  encountersPerHour: number;
  /** Shares of all encounters, by outcome; null with no encounter. */
  paidPercent: number | null;
  battlePercent: number | null;
  /** Battles opened per team per hour (junction spec §7). */
  battlesPerHour: number;
  /** Creeps in a battle, openers and joins, per battle; null with none. */
  participantsPerBattle: number | null;
  /** Mean world seconds from the opening to the end; null with none ended. */
  battleWorldSeconds: number | null;
  /**
   * How the participants came out, of those whose battle ended: the
   * aggressors' side winning, the victims' dying or escaping.
   */
  aggressorWinPercent: number | null;
  victimDeathPercent: number | null;
  victimEscapePercent: number | null;
  /** Wanderers born, and battles they opened or joined (junction §7). */
  wanderersBorn: number;
  wandererBattles: number;
  /** Encounters in the victim's own core zone, of all (D21). */
  campingPercent: number | null;
  deaths: number;
  /** Units that changed hands by extortion and loot, and were picked up. */
  changedHands: number;
  /** Units left in spoils on the map, all teams. */
  spoilsLeft: number;
  /** Between the teams at the end. */
  creepsGap: number;
  /** Cristal in stock at the end, of the cristal delivered (fog F6: 68%). */
  cristalStockPercent: number | null;
  hpPercent: number | null;
  /** Per team, in team order. */
  firstMateriaMinutesByTeam: (number | null)[];
  deliveredMateriaByTeam: number[];
  encountersByTeam: number[];
  deathsByTeam: number[];
  /**
   * The pace (M2 R spec §7) in real minutes at the run's ×N: the crossing,
   * each team's first extra creep and TARGETS.exploredPermille of the map
   * seen, the first wanderer (null: never), and the share of the match after
   * it with one alive (%).
   */
  crossingRealMinutes: number | null;
  firstCreepRealMinutesByTeam: (number | null)[];
  exploredRealMinutesByTeam: (number | null)[];
  firstWandererRealMinutes: number | null;
  wandererAlivePercent: number | null;
  battlesByTeam: number[];
  tickMicros: number;
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
  const tickMinutes = (tick: number | null) =>
    tick === null ? null : (tick * meta.tickSeconds) / 60;
  const firstMateria = last.teams.map((t) =>
    tickMinutes(t.firstDeliveryTick.materia),
  );
  const firstCristal = last.teams.map((t) =>
    tickMinutes(t.firstDeliveryTick.cristal),
  );
  /** The largest value, or null if any is null. */
  const slowest = (values: (number | null)[]) =>
    values.some((v) => v === null) ? null : Math.max(...(values as number[]));
  const spread = (values: number[]) =>
    Math.max(...values) - Math.min(...values);
  const coreSeen = last.teams.map((t) => t.enemyCoreSeenTick);
  const delivered = last.teams.map((t) => t.delivered.materia);
  const tally = result.encounters.teams;
  const sumOf = (values: number[]) => values.reduce((a, b) => a + b, 0);
  const asAggressor = tally.map(
    (t) => t.asAggressor.attack + t.asAggressor.extort,
  );
  const encounters = sumOf(asAggressor);
  const outcome = (
    ...keys: (keyof (typeof tally)[number]["outcomesAsVictim"])[]
  ) =>
    encounters === 0
      ? null
      : share(
          sumOf(tally.flatMap((t) => keys.map((k) => t.outcomesAsVictim[k]))),
          encounters,
        );
  const deathsByTeam = tally.map(
    (t) => t.deaths.square + t.deaths.triangle + t.deaths.circle,
  );
  const units = (x: { materia: number; cristal: number }) =>
    x.materia + x.cristal;
  const hpMax = sumOf(last.teams.map((t) => t.hpMax));
  const cristalDelivered = sumOf(last.teams.map((t) => t.delivered.cristal));
  return {
    value,
    seed: meta.seed,
    multiplier: meta.multiplier,
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
    firstMateriaMinutes: slowest(firstMateria),
    firstCristalMinutes: slowest(firstCristal),
    firstMateriaGapMinutes:
      slowest(firstMateria) === null ? null : spread(firstMateria as number[]),
    deliveredMateriaGap: spread(delivered),
    enemyCoreSeenHours: coreSeen.some((t) => t === null)
      ? null
      : mean(coreSeen.map((t) => (t! * meta.tickSeconds) / HOUR)),
    exploredPercent: perTeam((t) =>
      share(t.exploredCells, params.map.width * params.map.height),
    ),
    encountersPerHour: encounters / last.teams.length / (totalSeconds / HOUR),
    paidPercent: outcome("paid"),
    battlePercent: outcome("battle"),
    battlesPerHour:
      result.encounters.battlesOpened /
      last.teams.length /
      (totalSeconds / HOUR),
    ...battleFacts(result.encounters),
    campingPercent:
      encounters === 0
        ? null
        : share(sumOf(tally.map((t) => t.victimInOwnCoreZone)), encounters),
    deaths: mean(deathsByTeam),
    changedHands: mean(
      tally.map(
        (t) =>
          units(t.extortionReceived) + units(t.lootTaken) + units(t.pickedUp),
      ),
    ),
    spoilsLeft: units(result.encounters.spoils.leftCargo),
    creepsGap: spread(last.teams.map(creepsOf)),
    cristalStockPercent:
      cristalDelivered === 0
        ? null
        : share(
            sumOf(last.teams.map((t) => t.stock.cristal)),
            cristalDelivered,
          ),
    hpPercent:
      hpMax === 0 ? null : share(sumOf(last.teams.map((t) => t.hp)), hpMax),
    firstMateriaMinutesByTeam: firstMateria,
    deliveredMateriaByTeam: delivered,
    encountersByTeam: asAggressor,
    deathsByTeam,
    ...paceColumns(result.pace),
  };
}

/** The pace's CSV columns of a run, in real minutes at its ×N. */
function paceColumns(f: PaceFacts) {
  const real = (tick: number | null) =>
    tick === null ? null : (tick * f.tickSeconds) / f.multiplier / 60;
  const w = f.wanderers;
  return {
    crossingRealMinutes:
      f.crossingSeconds === null ? null : f.crossingSeconds / f.multiplier / 60,
    firstCreepRealMinutesByTeam: f.teams.map((t) => real(t.firstBornTick)),
    exploredRealMinutesByTeam: f.teams.map((t) => real(t.exploredTick)),
    firstWandererRealMinutes: real(w.firstBornTick),
    wandererAlivePercent:
      w.ticksAfterFirst === 0
        ? null
        : (100 * w.ticksWithOneAlive) / w.ticksAfterFirst,
    battlesByTeam: f.teams.map((t) => t.battles),
    tickMicros: f.tickMicros,
  };
}

type ScalarKey = {
  [K in keyof RunSummary]: RunSummary[K] extends number | null ? K : never;
}[keyof RunSummary];

/**
 * A column's time unit, for the row of its real minutes at the run's ×N
 * beside it: the moments a run reaches something, not durations.
 */
type Moment = "hours" | "minutes";

const COLUMNS: {
  key: ScalarKey;
  label: string;
  digits: number;
  moment?: Moment;
}[] = [
  { key: "creeps", label: "Creeps no fim", digits: 1 },
  {
    key: "capHours",
    label: "Teto de população atingido (h)",
    digits: 1,
    moment: "hours",
  },
  {
    key: "upgradeHours",
    label: "Upgrade comprado (h)",
    digits: 1,
    moment: "hours",
  },
  { key: "deliveredMateria", label: "Matéria entregue", digits: 0 },
  { key: "deliveredCristal", label: "Cristal entregue", digits: 0 },
  { key: "stockMateria", label: "Estoque de matéria no fim", digits: 0 },
  { key: "stockCristal", label: "Estoque de cristal no fim", digits: 0 },
  { key: "walkingEmptyPercent", label: "Creeps andando vazios (%)", digits: 0 },
  { key: "idlePercent", label: "Creeps parados (%)", digits: 0 },
  { key: "coreIdlePercent", label: "Núcleo ocioso (%)", digits: 0 },
  { key: "tripMinutes", label: "Tempo médio por viagem (min)", digits: 1 },
  { key: "roadCells", label: "Estradas no mapa (células)", digits: 0 },
  {
    key: "cristalGoneHours",
    label: "Cristal esgotado (h)",
    digits: 1,
    moment: "hours",
  },
  {
    key: "firstMateriaMinutes",
    label: "1ª entrega de matéria, time mais lento (min)",
    digits: 0,
    moment: "minutes",
  },
  {
    key: "firstCristalMinutes",
    label: "1ª entrega de cristal, time mais lento (min)",
    digits: 0,
    moment: "minutes",
  },
  {
    key: "firstMateriaGapMinutes",
    label: "Diferença entre os times na 1ª matéria (min)",
    digits: 0,
  },
  {
    key: "deliveredMateriaGap",
    label: "Diferença entre os times na matéria entregue",
    digits: 0,
  },
  {
    key: "enemyCoreSeenHours",
    label: "Núcleo inimigo visto (h)",
    digits: 1,
    moment: "hours",
  },
  { key: "exploredPercent", label: "Mapa explorado no fim (%)", digits: 0 },
  {
    key: "cristalStockPercent",
    label: "Cristal parado no estoque, do entregue (%)",
    digits: 0,
  },
  {
    key: "encountersPerHour",
    label: "Encontros abertos por time por hora",
    digits: 1,
  },
  { key: "paidPercent", label: "Encontros pagos (%)", digits: 0 },
  {
    key: "battlePercent",
    label: "Encontros que viraram batalha (%)",
    digits: 0,
  },
  {
    key: "battlesPerHour",
    label: "Batalhas abertas por time por hora",
    digits: 1,
  },
  {
    key: "participantsPerBattle",
    label: "Participantes por batalha",
    digits: 1,
  },
  {
    key: "battleWorldSeconds",
    label: "Duração da batalha no mundo (s)",
    digits: 0,
  },
  {
    key: "aggressorWinPercent",
    label: "Agressores do lado vencedor (%)",
    digits: 0,
  },
  { key: "victimDeathPercent", label: "Vítimas mortas (%)", digits: 0 },
  {
    key: "victimEscapePercent",
    label: "Vítimas que escaparam pela borda (%)",
    digits: 0,
  },
  { key: "wanderersBorn", label: "Andarilhos nascidos", digits: 1 },
  {
    key: "wandererBattles",
    label: "Batalhas com andarilho (abertas + entradas)",
    digits: 1,
  },
  {
    key: "campingPercent",
    label: "Encontros na zona do Núcleo da vítima (%)",
    digits: 0,
  },
  { key: "deaths", label: "Mortes por time", digits: 1 },
  {
    key: "changedHands",
    label: "Recursos tomados por time (extorsão, saque, despojo)",
    digits: 0,
  },
  { key: "spoilsLeft", label: "Recursos em despojos no fim", digits: 0 },
  { key: "creepsGap", label: "Diferença entre os times em creeps", digits: 0 },
  { key: "hpPercent", label: "HP médio no fim (%)", digits: 0 },
];

/** The participants of a role by fate, all DNAs and loads. */
function fatesOf(tally: EncounterTally, role: Role): Record<Fate, number> {
  const out = Object.fromEntries(FATES.map((f) => [f, 0])) as Record<
    Fate,
    number
  >;
  for (const dna of DNAS) {
    for (const load of LOADS) {
      for (const fate of FATES) {
        out[fate] += tally.battleStats.fates[role][dna][load][fate];
      }
    }
  }
  return out;
}

/** The battle columns of a run (junction spec §7). */
function battleFacts(tally: EncounterTally) {
  const stats = tally.battleStats;
  const rate = (fates: Record<Fate, number>, fate: Fate) => {
    const ended = FATES.reduce(
      (sum, f) => sum + (f === "open" ? 0 : fates[f]),
      0,
    );
    return ended === 0 ? null : (100 * fates[fate]) / ended;
  };
  const aggressors = fatesOf(tally, "aggressor");
  const victims = fatesOf(tally, "victim");
  return {
    participantsPerBattle:
      tally.battlesOpened === 0
        ? null
        : stats.participants / tally.battlesOpened,
    battleWorldSeconds:
      stats.worldSeconds.count === 0
        ? null
        : stats.worldSeconds.total / stats.worldSeconds.count,
    aggressorWinPercent: rate(aggressors, "won"),
    victimDeathPercent: rate(victims, "died"),
    victimEscapePercent: rate(victims, "escaped"),
    wanderersBorn: tally.wanderers.born,
    wandererBattles: tally.wanderers.attacks + tally.wanderers.joins,
  };
}

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
  /**
   * ×N for real time; null reads each variant's world.multiplier, so a sweep
   * of world.multiplier compares the ×N candidates on one world.
   */
  multiplier: number | null;
  /** The recovery scenario on every run (P12), or null. */
  shock: Shock | null;
  strategists: StrategistId[];
};

export type SweepResult = {
  options: SweepOptions;
  runs: RunSummary[];
  /** Each run's pace, in the order of `runs`. */
  paces: PaceFacts[];
};

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
  const paces: PaceFacts[] = [];
  for (const { value, params } of variants) {
    for (const seed of options.seeds) {
      const result = simulate({
        id: runName(options.path, value, seed),
        seed,
        params,
        paramsSource: `${options.paramsSource} com ${options.path}=${value}`,
        ticks: options.ticks,
        multiplier: options.multiplier ?? params.world.multiplier,
        shock: options.shock,
        strategists: options.strategists,
      });
      const summary = summarize(result, value);
      runs.push(summary);
      paces.push(result.pace);
      onRun(result, summary);
    }
  }
  return { options, runs, paces };
}

const VERDICT_MARKS = { true: " ✅", false: " ❌", null: "" } as const;

/**
 * The §7 targets per value, over its seeds (M2 R P13): each criterion met on
 * how many seeds, the values' mean and range, and the verdict.
 */
function paceTargets(
  values: readonly number[],
  path: string,
  runs: readonly RunSummary[],
  paces: readonly PaceFacts[],
): string[] {
  const perValue = values.map((value) =>
    seedTargets(paces.filter((_, i) => runs[i]!.value === value)),
  );
  const first = perValue[0]!;
  const cell = (row: TargetRow) =>
    `${row.measured}${VERDICT_MARKS[String(row.verdict) as keyof typeof VERDICT_MARKS]}`;
  return [
    "## Metas do ritmo (spec R §7)",
    "",
    `Em minutos reais ao ×N de cada run. ✅ a meta vale em todas as seeds (a diferença de creeps: a mediana), ❌ não, sem marca: sem meta ou ainda não medida. Exploração: ${TARGETS.exploredPermille / 10}% das células alcançáveis vistas.`,
    "",
    table(
      ["Critério", "Meta", ...values.map((v) => `${path}=${v}`)],
      first.map((row, i) => [
        row.criterion,
        row.target,
        ...perValue.map((rows) => cell(rows[i]!)),
      ]),
    ),
    "",
  ];
}

export const runName = (path: string, value: number, seed: number) =>
  `${path}=${value}-s${seed}`;

export function renderSweepReport({
  options,
  runs,
  paces,
}: SweepResult): string {
  const { path, values, seeds, ticks } = options;
  const wall = runs.reduce((sum, r) => sum + r.wallSeconds, 0);
  const tickSeconds = options.params.world.tickSeconds;
  const multipliers = [...new Set(runs.map((r) => r.multiplier))];
  const lines = [
    `# Varredura — ${options.id}`,
    "",
    table(
      ["", ""],
      [
        ["Parâmetro", `\`${path}\` = ${values.join(", ")}`],
        ["Seeds", seeds.join(", ")],
        ...(options.shock === null
          ? []
          : [
              [
                "Choque",
                `o time ${options.shock.team} perde ${options.shock.count} creeps no minuto real ${options.shock.minute} (runs não reproduzíveis)`,
              ],
            ]),
        [
          "Duração de cada mundo",
          `${hours(ticks * tickSeconds)} de mundo; ${multipliers
            .map((m) => `${realTime(ticks * tickSeconds, m)} a ×${m}`)
            .join(" · ")}`,
        ],
        [
          "Estrategistas",
          options.strategists.map((s, t) => `time ${t}: ${s}`).join(" · "),
        ],
        ["Parâmetros base", `\`${options.paramsSource}\``],
        ["Runs", `${runs.length} em ${number(wall, 1)} s`],
      ],
    ),
    "",
    ...paceTargets(values, path, runs, paces),
    "## Comparação",
    "",
    "Média das seeds e dos dois times; entre parênteses, o mínimo e o máximo entre as seeds. " +
      '"N× nunca": em N seeds isso não aconteceu.',
    "",
    table(
      ["Métrica", ...values.map((v) => `${path}=${v}`)],
      COLUMNS.flatMap(({ key, label, digits, moment }) => {
        const row = (name: string, read: (r: RunSummary) => number | null) => [
          name,
          ...values.map((value) =>
            cell(runs.filter((r) => r.value === value).map(read), digits),
          ),
        ];
        const rows = [row(label, (r) => r[key])];
        if (moment !== undefined) {
          const perMinute = moment === "hours" ? 60 : 1;
          rows.push(
            row("↳ em minutos reais", (r) => {
              const v = r[key];
              return v === null ? null : (v * perMinute) / r.multiplier;
            }),
          );
        }
        return rows;
      }),
    ),
    "",
    "## Runs",
    "",
    "Por time, na ordem dos times: minuto da 1ª entrega de matéria, matéria entregue, encontros abertos (como agressor) e mortes.",
    "",
    table(
      [
        "Valor",
        "Seed",
        "1ª matéria (min)",
        "Matéria entregue",
        "Encontros",
        "Mortes",
        "Tempo (s)",
        "Hash final",
      ],
      runs.map((r) => [
        String(r.value),
        String(r.seed),
        r.firstMateriaMinutesByTeam
          .map((m) => (m === null ? "nunca" : number(m)))
          .join(" / "),
        r.deliveredMateriaByTeam.map((m) => number(m)).join(" / "),
        r.encountersByTeam.map((m) => number(m)).join(" / "),
        r.deathsByTeam.map((m) => number(m)).join(" / "),
        number(r.wallSeconds, 1),
        `\`${r.finalHash.slice(0, 16)}\``,
      ]),
    ),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

type CsvValue = string | number | null;

/** A cell of sweep.csv; a per-team list is joined with ";". */
const csvValue = (value: CsvValue | CsvValue[]): string =>
  Array.isArray(value)
    ? value.map(csvValue).join(";")
    : value === null
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
      writeFileSync(join(runDir, RUN_FILES.pace), paceJson(run));
    }
    progress(
      `  ${run.meta.id}: ${summary.wallSeconds.toFixed(1)} s, ${summary.finalHash.slice(0, 16)}`,
    );
  });
  writeFileSync(join(dir, "sweep.csv"), sweepCsv(result.runs));
  writeFileSync(join(dir, RUN_FILES.report), renderSweepReport(result));
  return result;
}
