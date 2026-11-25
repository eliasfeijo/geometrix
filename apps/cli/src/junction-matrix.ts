// geo junction matrix (junction checkpoint C1-2): the junction's battles
// without the bots' policy. For each seed, the seed's world and a battle cell
// in it; on that cell, every aggressor DNA against every victim DNA, the
// victim empty or full, fighting or fleeing (the carrier), each battle built
// by the junction's battleSetup (the real arena of the window, the real
// setups) and auto-resolved by the gambits. With --set, the whole matrix
// runs for each value of one parameter (C1-3: the spawn zones' distance to
// the border) and the report compares them.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createBattle,
  stepBattle,
  type BattleEvent,
  type BattleParams,
} from "@geometrix/battle";
import {
  capacity,
  createWorld,
  DNAS,
  inCoreZone,
  isStandable,
  teamOf,
  windowAround,
  type Battle,
  type Cell,
  type Creep,
  type Dna,
  type Params,
  type Stance,
  type WorldState,
} from "@geometrix/sim";
import { battleSeed, battleSetup } from "@geometrix/junction";
import { MAX_BATTLE_SECONDS, quantile } from "./battle.ts";
import { withParam } from "./sweep.ts";

/** One cell of the matrix: who attacks whom, and how the victim enters. */
export type MatrixCase = {
  aggressor: Dna;
  victim: Dna;
  /** The victim carries a full bag of materia (its capacity). */
  loaded: boolean;
  /** The victim's stance: its DNA's preset, or the carrier (D2). */
  stance: Stance;
};

/** The matrix in report order: by stance, load, aggressor and victim. */
export function matrixCases(): MatrixCase[] {
  const cases: MatrixCase[] = [];
  for (const stance of ["fight", "flee"] as const) {
    for (const loaded of [false, true]) {
      for (const aggressor of DNAS) {
        for (const victim of DNAS) {
          cases.push({ aggressor, victim, loaded, stance });
        }
      }
    }
  }
  return cases;
}

export function caseKey(c: MatrixCase): string {
  return `${c.aggressor}-${c.victim}-${c.loaded ? "full" : "empty"}-${c.stance}`;
}

/** How one side's creep left the battle. */
export type Fate = "won" | "survived" | "died" | "escaped" | "idle";

export type MatrixRecord = {
  seed: number;
  /** Battle side 0 (the aggressor) or 1 (the victim), or null. */
  winnerSide: number | null;
  aggressor: Fate;
  victim: Fate;
  ticks: number;
  /** Cut at MAX_BATTLE_SECONDS without an end. */
  cut: boolean;
};

/**
 * The seed's battle cell: a cell a creep can stand on, outside both core
 * zones, picked by an integer mix of the seed (not the world's rng), so every
 * case of a seed fights on the same arena.
 */
export function battleCellOf(world: WorldState): Cell {
  const cells: Cell[] = [];
  for (let y = 0; y < world.map.height; y++) {
    for (let x = 0; x < world.map.width; x++) {
      const cell = { x, y };
      if (!isStandable(world, cell)) continue;
      if (world.teams.some((t) => inCoreZone(world, t.id, cell))) continue;
      cells.push(cell);
    }
  }
  return cells[battleSeed(world.seed, 0) % cells.length]!;
}

/** The first creep of `team` with `dna` in a fresh world. */
function creepOf(world: WorldState, team: number, dna: Dna): Creep {
  const creep = world.creeps.find((c) => c.team === team && c.dna === dna);
  if (creep === undefined) {
    throw new Error(`the world has no ${dna} of team ${team}`);
  }
  return creep;
}

function fateOf(
  outcome: string | undefined,
  side: number,
  winner: number | null,
): Fate {
  switch (outcome) {
    case "died":
      return "died";
    case "escapedEdge":
      return "escaped";
    case "escapedIdle":
      return "idle";
    default:
      return side === winner ? "won" : "survived";
  }
}

/**
 * Resolves one case on `cell` of `world` (team 0 attacks team 1), as the
 * junction would open it, to its end.
 */
export function resolveCase(
  world: WorldState,
  cell: Cell,
  matrixCase: MatrixCase,
  battleParams: BattleParams,
): MatrixRecord {
  const aggressor = creepOf(world, 0, matrixCase.aggressor);
  const victim = creepOf(world, 1, matrixCase.victim);
  const full = capacity(victim, teamOf(world, victim), world.params);
  victim.cargo = { materia: matrixCase.loaded ? full : 0, cristal: 0 };
  const battle: Battle = {
    id: world.nextId,
    window: windowAround(world, cell),
    sides: [
      { kind: "team", team: 0 },
      { kind: "team", team: 1 },
    ],
    participants: [
      { id: aggressor.id, side: 0, stance: "fight" as Stance },
      { id: victim.id, side: 1, stance: matrixCase.stance },
    ].sort((a, b) => a.id - b.id),
    openedTick: world.tick,
    ...cell,
  };
  const { setup, placed } = battleSetup(world, battle);
  victim.cargo = { materia: 0, cristal: 0 };
  const state = createBattle(setup, battleParams);
  const maxTicks = MAX_BATTLE_SECONDS * battleParams.tick.ticksPerSecond;
  let ended: Extract<BattleEvent, { type: "ended" }> | null = null;
  const outcomes = new Map<number, string>();
  while (state.ended === null && state.tick < maxTicks) {
    for (const event of stepBattle(state, [])) {
      if (event.type === "died") outcomes.set(event.participant.id, "died");
      if (event.type === "escaped") {
        outcomes.set(
          event.participant.id,
          event.reason === "edge" ? "escapedEdge" : "escapedIdle",
        );
      }
      if (event.type === "ended") ended = event;
    }
  }
  for (const r of ended?.results ?? []) {
    if (!outcomes.has(r.participant.id)) {
      outcomes.set(r.participant.id, r.outcome);
    }
  }
  const winner = state.ended?.winnerSide ?? null;
  // Participant ids are 1, 2, … in the order battleSetup placed them.
  const idOf = (worldId: number) => placed.indexOf(worldId) + 1;
  return {
    seed: world.seed,
    winnerSide: winner,
    aggressor: fateOf(outcomes.get(idOf(aggressor.id)), 0, winner),
    victim: fateOf(outcomes.get(idOf(victim.id)), 1, winner),
    ticks: state.tick,
    cut: state.ended === null,
  };
}

// The matrix ---------------------------------------------------------------

/** One parameter value's matrix: the records of each case, by case key. */
export type MatrixRun = {
  /** The --set value, or null without --set. */
  value: number | null;
  /** The seeds' battle cells, in seed order. */
  cells: Cell[];
  records: Map<string, MatrixRecord[]>;
};

export type MatrixOptions = {
  id: string;
  params: Params;
  paramsSource: string;
  battleParams: BattleParams;
  battleParamsSource: string;
  seeds: number[];
  /** A sim parameter and the values to compare, or null. */
  set: { path: string; values: number[] } | null;
};

export type MatrixResult = {
  options: MatrixOptions;
  runs: MatrixRun[];
  wallSeconds: number;
};

export function junctionMatrix(
  options: MatrixOptions,
  clock: () => number = () => performance.now(),
  progress: (line: string) => void = () => {},
): MatrixResult {
  const start = clock();
  const values: (number | null)[] = options.set?.values ?? [null];
  const runs: MatrixRun[] = [];
  for (const value of values) {
    const params =
      value === null
        ? options.params
        : withParam(options.params, options.set!.path, value);
    const records = new Map<string, MatrixRecord[]>(
      matrixCases().map((c) => [caseKey(c), []]),
    );
    const cells: Cell[] = [];
    for (const seed of options.seeds) {
      const world = createWorld(seed, params);
      const cell = battleCellOf(world);
      cells.push(cell);
      for (const c of matrixCases()) {
        records
          .get(caseKey(c))!
          .push(resolveCase(world, cell, c, options.battleParams));
      }
    }
    runs.push({ value, cells, records });
    if (value !== null) progress(`  ${options.set!.path}=${value} done`);
  }
  return { options, runs, wallSeconds: (clock() - start) / 1000 };
}

export type CaseStats = {
  battles: number;
  aggressorWins: number;
  victimWins: number;
  none: number;
  victimDied: number;
  victimEscaped: number;
  victimIdle: number;
  aggressorDied: number;
  aggressorEscaped: number;
  cut: number;
  /** Battle seconds: median, p90. */
  seconds: [number, number];
};

export function caseStats(
  records: readonly MatrixRecord[],
  battleParams: BattleParams,
): CaseStats {
  const count = (f: (r: MatrixRecord) => boolean) => records.filter(f).length;
  const seconds = records
    .map((r) => r.ticks / battleParams.tick.ticksPerSecond)
    .sort((a, b) => a - b);
  return {
    battles: records.length,
    aggressorWins: count((r) => r.winnerSide === 0),
    victimWins: count((r) => r.winnerSide === 1),
    none: count((r) => r.winnerSide === null),
    victimDied: count((r) => r.victim === "died"),
    victimEscaped: count((r) => r.victim === "escaped"),
    victimIdle: count((r) => r.victim === "idle"),
    aggressorDied: count((r) => r.aggressor === "died"),
    aggressorEscaped: count((r) => r.aggressor === "escaped"),
    cut: count((r) => r.cut),
    seconds: [quantile(seconds, 0.5), quantile(seconds, 0.9)],
  };
}

// The report ----------------------------------------------------------------

const DNA_LABELS: Record<Dna, string> = {
  square: "quadrado",
  triangle: "triângulo",
  circle: "círculo",
};

const CONDITIONS: { loaded: boolean; stance: Stance; label: string }[] = [
  { loaded: false, stance: "fight", label: "vazia, luta" },
  { loaded: true, stance: "fight", label: "cheia, luta" },
  { loaded: false, stance: "flee", label: "vazia, foge" },
  { loaded: true, stance: "flee", label: "cheia, foge" },
];

const pct = (part: number, whole: number) =>
  whole === 0 ? "—" : `${Math.round((part * 100) / whole)}%`;

function table(head: string[], rows: string[][]): string {
  return [
    `| ${head.join(" | ")} |`,
    `|${head.map(() => "---").join("|")}|`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
}

/** The records of every case of `run` that passes `filter`, pooled. */
function pooled(
  run: MatrixRun,
  filter: (c: MatrixCase) => boolean,
): MatrixRecord[] {
  return matrixCases()
    .filter(filter)
    .flatMap((c) => run.records.get(caseKey(c))!);
}

function valueLabel(options: MatrixOptions, run: MatrixRun): string {
  return run.value === null ? "params" : `${options.set!.path}=${run.value}`;
}

export function renderMatrixReport(result: MatrixResult): string {
  const { options, runs } = result;
  const { battleParams, seeds } = options;
  const battles = runs.reduce(
    (n, run) => n + [...run.records.values()].reduce((m, r) => m + r.length, 0),
    0,
  );
  const cut = runs.reduce(
    (n, run) =>
      n +
      [...run.records.values()].reduce(
        (m, r) => m + r.filter((x) => x.cut).length,
        0,
      ),
    0,
  );
  const out: string[] = [];
  out.push(`# geo junction matrix — ${options.id}`);
  out.push("");
  out.push(
    `Params: \`${options.paramsSource}\` · \`${options.battleParamsSource}\`` +
      (options.set === null
        ? ""
        : ` · comparando \`${options.set.path}\` = ${options.set.values.join(", ")}`) +
      ` · seeds ${seeds[0]}–${seeds.at(-1)} (${seeds.length}) · ${battles} batalhas · ${result.wallSeconds.toFixed(1)} s` +
      (cut > 0
        ? ` · **${cut} cortadas em ${MAX_BATTLE_SECONDS} s sem fim**`
        : ""),
  );
  out.push("");
  out.push(
    "As batalhas da junção sem a política dos bots. Em cada seed, o mundo da seed e uma célula de batalha nele (fora das zonas dos núcleos); nela, cada DNA agressor (time 0, vazio, lutando) contra cada DNA vítima (time 1), a vítima vazia ou com a bolsa cheia de matéria, lutando (o preset do DNA) ou fugindo (o portador). Cada batalha é montada pelo `battleSetup` da junção: a arena real da janela, os setups reais, a semente da batalha. Todos pela IA, até o fim. O agressor nasce na zona 1 (esquerda), a vítima na zona 2 (direita).",
  );
  out.push("");

  out.push("## Resumo");
  out.push("");
  out.push(
    "Por condição da vítima, todos os pares juntos. Vence quem fica sozinho na arena: o agressor vence também quando a vítima foge pela borda. Sem vencedor: os dois morreram ou saíram. A vítima morre / sai pela borda / sai por inatividade; a duração mediana.",
  );
  out.push("");
  const summaryRows: string[][] = [];
  for (const run of runs) {
    for (const cond of CONDITIONS) {
      const st = caseStats(
        pooled(
          run,
          (c) => c.loaded === cond.loaded && c.stance === cond.stance,
        ),
        battleParams,
      );
      summaryRows.push([
        valueLabel(options, run),
        cond.label,
        pct(st.aggressorWins, st.battles),
        pct(st.victimWins, st.battles),
        pct(st.victimDied, st.battles),
        pct(st.victimEscaped, st.battles),
        pct(st.victimIdle, st.battles),
        `${st.seconds[0].toFixed(1)} s`,
      ]);
    }
  }
  out.push(
    table(
      [
        "Valor",
        "Vítima",
        "Agressor vence",
        "Vítima vence",
        "Vítima morre",
        "Vítima escapa",
        "Inatividade",
        "Duração (mediana)",
      ],
      summaryRows,
    ),
  );
  out.push("");

  for (const run of runs) {
    out.push(
      runs.length === 1
        ? "## Por par"
        : `## Por par — \`${valueLabel(options, run)}\``,
    );
    out.push("");
    out.push(
      "Cada célula: vence o agressor / a vítima · a vítima morre · a vítima escapa pela borda · duração mediana (p90).",
    );
    out.push("");
    const rows: string[][] = [];
    for (const aggressor of DNAS) {
      for (const victim of DNAS) {
        rows.push([
          `${DNA_LABELS[aggressor]} × ${DNA_LABELS[victim]}`,
          ...CONDITIONS.map((cond) => {
            const st = caseStats(
              run.records.get(
                caseKey({
                  aggressor,
                  victim,
                  loaded: cond.loaded,
                  stance: cond.stance,
                }),
              )!,
              battleParams,
            );
            return `${pct(st.aggressorWins, st.battles)} / ${pct(st.victimWins, st.battles)} · morre ${pct(st.victimDied, st.battles)} · escapa ${pct(st.victimEscaped, st.battles)} · ${st.seconds[0].toFixed(0)} s (${st.seconds[1].toFixed(0)})`;
          }),
        ]);
      }
    }
    out.push(
      table(
        ["Agressor × vítima", ...CONDITIONS.map((c) => `Vítima ${c.label}`)],
        rows,
      ),
    );
    out.push("");
  }
  return out.join("\n");
}

export function matrixCsv(result: MatrixResult): string {
  const { options } = result;
  const lines = [
    "value,aggressor,victim,loaded,stance,battles,aggressor_wins,victim_wins,none,victim_died,victim_escaped,victim_idle,aggressor_died,aggressor_escaped,cut,seconds_p50,seconds_p90",
  ];
  for (const run of result.runs) {
    for (const c of matrixCases()) {
      const st = caseStats(run.records.get(caseKey(c))!, options.battleParams);
      lines.push(
        [
          run.value ?? "",
          c.aggressor,
          c.victim,
          c.loaded ? 1 : 0,
          c.stance,
          st.battles,
          st.aggressorWins,
          st.victimWins,
          st.none,
          st.victimDied,
          st.victimEscaped,
          st.victimIdle,
          st.aggressorDied,
          st.aggressorEscaped,
          st.cut,
          st.seconds[0].toFixed(2),
          st.seconds[1].toFixed(2),
        ].join(","),
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

export const MATRIX_FILES = { report: "junction.md", csv: "junction.csv" };

export function writeMatrix(dir: string, result: MatrixResult): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, MATRIX_FILES.report), renderMatrixReport(result));
  writeFileSync(join(dir, MATRIX_FILES.csv), matrixCsv(result));
}
