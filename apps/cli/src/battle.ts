// geo battle (M2 laboratório spec R-1..R-3, D16, section 7; plan section 12):
// the battle without a page. `sweep` runs the preset matchups of the report
// on every arena and seed, all participants under the gambits, and writes
// runs/<id>/battle.md and battle.csv. `verify` is in battle-verify.ts.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createBattle,
  defaultGambits,
  presetGambits,
  serializeBattle,
  stepBattle,
  type BattleEvent,
  type BattleParams,
  type BattleSetup,
  type BattleState,
  type Dna,
  type Gambit,
  type ParticipantSetup,
  type Reaction,
} from "@geometrix/battle";
import { parseParams, type Params } from "@geometrix/sim";

/** The lab's arenas: the verdicts and the verify sample use these. */
export const ARENAS = ["aberta", "pedras", "corredor"] as const;
/**
 * The sweep also runs the open arena at 3× (F3 checkpoint, plan C2), only to
 * compare in the report: does more room change the fight?
 */
export const REPORT_ARENAS = [...ARENAS, "aberta-3x"] as const;
export type ArenaName = (typeof REPORT_ARENAS)[number];

const ARENAS_DIR = new URL("../../../params/arenas/", import.meta.url);

/** An arena of params/arenas, one string per row (plan section 4). */
export function readArena(name: ArenaName): string[] {
  return readFileSync(new URL(`${name}.txt`, ARENAS_DIR), "utf8")
    .trimEnd()
    .split("\n");
}

const WORLD_PARAMS = new URL("../../../params/default.json", import.meta.url);

/** A DNA's max HP and capacity, which the world owns (junction spec D9). */
export type Kit = { maxHp: number; capacity: number };

/**
 * Each DNA's max HP and base capacity in the world's params (junction plan
 * section 5): the battle setups of the sweep and the verify take them from
 * here, so the number has one home.
 */
export function kitsOf(world: Params): Record<Dna, Kit> {
  const kit = (dna: Dna): Kit => ({
    maxHp: world.hp.dna[dna].max,
    capacity: world.dna[dna].capacity,
  });
  return {
    square: kit("square"),
    triangle: kit("triangle"),
    circle: kit("circle"),
  };
}

let worldKitsCache: Record<Dna, Kit> | null = null;

/** The kits of params/default.json, read once. */
export function worldKits(): Record<Dna, Kit> {
  worldKitsCache ??= kitsOf(
    parseParams(JSON.parse(readFileSync(WORLD_PARAMS, "utf8"))),
  );
  return worldKitsCache;
}

/** sha256 of the canonical snapshot (plan section 11). */
export function battleHash(state: BattleState): string {
  return createHash("sha256").update(serializeBattle(state)).digest("hex");
}

/**
 * A battle that never ends is cut here and counted (10 minutes of battle):
 * the inactivity clock should end every battle long before.
 */
export const MAX_BATTLE_SECONDS = 600;

// The matrix -------------------------------------------------------------

/**
 * What each scenario measures (spec section 7):
 *   duel     1 × 1 of two DNAs at full HP: does the DNA decide alone?
 *   mirror   1 × 1 of a DNA against itself: does the side decide (~50%)?
 *   wounded  a duel or mirror with one side at 500‰ HP: does a wound weigh?
 *   reaction a mirror with side A hard and side B easy (spec D20): does the
 *            difficulty weigh, the way the lab offers it?
 *   team     2 × 2 and 3 × 3: duration and cost of a bigger fight
 *   ffa      1 × 1 × 1, three sides: three-way fights end
 *   carry    a square with a full bag against a circle, with the carrier
 *            preset (drops the bag when the enemy is near, then runs) and
 *            with the same square only running: does dropping save it? It
 *            spawns in its zone, a quarter of the way in, so it has to cross
 *            to the exit with the brake of the load
 */
export const GROUPS = [
  "duel",
  "mirror",
  "wounded",
  "reaction",
  "team",
  "ffa",
  "carry",
] as const;
export type Group = (typeof GROUPS)[number];

export type Scenario = {
  id: string;
  group: Group;
  /** Report label, in Portuguese. */
  label: string;
  sides: ParticipantSetup[][];
};

const DNA_LABELS: Record<Dna, string> = {
  square: "quadrado",
  triangle: "triângulo",
  circle: "círculo",
};

const WOUNDED_PERMILLE = 500;

type FighterOptions = {
  hpPermille?: number;
  carry?: number;
  gambits?: Gambit[];
  reaction?: Reaction;
};

function fighter(dna: Dna, options: FighterOptions = {}): ParticipantSetup {
  const { maxHp, capacity } = worldKits()[dna];
  return {
    name: DNA_LABELS[dna],
    dna,
    hp: Math.floor((maxHp * (options.hpPermille ?? 1000)) / 1000),
    maxHp,
    carry: { materia: options.carry ?? 0, cristal: 0 },
    capacity,
    gambits: options.gambits ?? defaultGambits(dna),
    reaction: options.reaction ?? "normal",
  };
}

const PAIRS: [Dna, Dna][] = [
  ["square", "triangle"],
  ["square", "circle"],
  ["triangle", "circle"],
];
const MIRRORS: Dna[] = ["square", "triangle", "circle"];

/** The scenarios of the sweep, in report order. */
export function scenarios(): Scenario[] {
  const list: Scenario[] = [];
  const duel = (a: Dna, b: Dna, wounded: 0 | 1 | null): ParticipantSetup[][] =>
    [a, b].map((dna, side) => [
      fighter(dna, {
        hpPermille: side === wounded ? WOUNDED_PERMILLE : 1000,
      }),
    ]);
  for (const [a, b] of PAIRS) {
    list.push({
      id: `1x1 ${a}-${b}`,
      group: "duel",
      label: `${DNA_LABELS[a]} × ${DNA_LABELS[b]}`,
      sides: duel(a, b, null),
    });
  }
  for (const dna of MIRRORS) {
    list.push({
      id: `1x1 ${dna}-${dna}`,
      group: "mirror",
      label: `${DNA_LABELS[dna]} × ${DNA_LABELS[dna]}`,
      sides: duel(dna, dna, null),
    });
  }
  for (const [a, b] of PAIRS) {
    for (const wounded of [0, 1] as const) {
      const mark = (side: number) => (side === wounded ? "@500" : "");
      list.push({
        id: `1x1 ${a}${mark(0)}-${b}${mark(1)}`,
        group: "wounded",
        label: `${DNA_LABELS[a]}${wounded === 0 ? " ferido" : ""} × ${DNA_LABELS[b]}${wounded === 1 ? " ferido" : ""}`,
        sides: duel(a, b, wounded),
      });
    }
  }
  for (const dna of MIRRORS) {
    list.push({
      id: `1x1 ${dna}@500-${dna}`,
      group: "wounded",
      label: `${DNA_LABELS[dna]} ferido × ${DNA_LABELS[dna]}`,
      sides: duel(dna, dna, 0),
    });
  }
  for (const dna of MIRRORS) {
    list.push({
      id: `1x1 ${dna}!hard-${dna}!easy`,
      group: "reaction",
      label: `${DNA_LABELS[dna]} difícil × ${DNA_LABELS[dna]} fácil`,
      sides: [
        [fighter(dna, { reaction: "hard" })],
        [fighter(dna, { reaction: "easy" })],
      ],
    });
  }
  const team = (dnas: Dna[]) => dnas.map((dna) => fighter(dna));
  list.push({
    id: "2x2 square+triangle-square+circle",
    group: "team",
    label: "2 × 2: quadrado + triângulo × quadrado + círculo",
    sides: [team(["square", "triangle"]), team(["square", "circle"])],
  });
  list.push({
    id: "3x3",
    group: "team",
    label: "3 × 3: um de cada × um de cada",
    sides: [
      team(["square", "triangle", "circle"]),
      team(["square", "triangle", "circle"]),
    ],
  });
  list.push({
    id: "1x1x1",
    group: "ffa",
    label: "1 × 1 × 1: quadrado × triângulo × círculo",
    sides: [team(["square"]), team(["triangle"]), team(["circle"])],
  });
  const full = worldKits().square.capacity;
  const runOnly: Gambit[] = [
    { when: { type: "always" }, then: { type: "flee" } },
  ];
  const carriers: [string, string, Gambit[]][] = [
    ["drop", "larga a bolsa e foge", presetGambits("carrier")],
    ["keep", "só foge", runOnly],
  ];
  for (const [key, text, gambits] of carriers) {
    list.push({
      id: `carry ${key}`,
      group: "carry",
      label: `quadrado cheio, ${text} × círculo`,
      sides: [
        [fighter("square", { carry: full, gambits })],
        [fighter("circle")],
      ],
    });
  }
  return list;
}

// One battle --------------------------------------------------------------

export type BattleRecord = {
  scenario: string;
  arena: ArenaName;
  seed: number;
  winnerSide: number | null;
  ticks: number;
  /** Wall-clock milliseconds to resolve it. */
  ms: number;
  /** Someone fled by inactivity, by the edge. */
  idle: boolean;
  edge: boolean;
  /** Cut at MAX_BATTLE_SECONDS without an end. */
  cut: boolean;
  /** Side 0's first participant left by the edge (the carry scenarios). */
  firstEscaped: boolean;
};

/** Resolves one battle with the gambits only, to its end (spec D16). */
export function resolve(
  scenario: Scenario,
  arena: ArenaName,
  rows: string[],
  seed: number,
  params: BattleParams,
  clock: () => number = () => performance.now(),
): BattleRecord {
  const start = clock();
  const setup: BattleSetup = {
    rule: "grid",
    arena: rows,
    seed,
    sides: scenario.sides,
  };
  const state = createBattle(setup, params);
  const maxTicks = MAX_BATTLE_SECONDS * params.tick.ticksPerSecond;
  let ended: Extract<BattleEvent, { type: "ended" }> | null = null;
  while (state.ended === null && state.tick < maxTicks) {
    for (const event of stepBattle(state, [])) {
      if (event.type === "ended") ended = event;
    }
  }
  const ms = clock() - start;
  const outcomes = ended?.results ?? [];
  return {
    scenario: scenario.id,
    arena,
    seed,
    winnerSide: state.ended?.winnerSide ?? null,
    ticks: state.tick,
    ms,
    idle: outcomes.some((r) => r.outcome === "escapedIdle"),
    edge: outcomes.some((r) => r.outcome === "escapedEdge"),
    cut: state.ended === null,
    firstEscaped: outcomes[0]?.outcome === "escapedEdge",
  };
}

// The sweep ---------------------------------------------------------------

/** The battles of one scenario on one arena. */
export type SweepCell = {
  scenario: Scenario;
  arena: ArenaName;
  records: BattleRecord[];
};

export type BattleSweepOptions = {
  id: string;
  params: BattleParams;
  paramsSource: string;
  seeds: number[];
};

export type BattleSweepResult = {
  options: BattleSweepOptions;
  cells: SweepCell[];
  wallSeconds: number;
};

export function battleSweep(
  options: BattleSweepOptions,
  clock: () => number = () => performance.now(),
): BattleSweepResult {
  const start = clock();
  const cells: SweepCell[] = [];
  const rows = Object.fromEntries(REPORT_ARENAS.map((a) => [a, readArena(a)]));
  for (const scenario of scenarios()) {
    for (const arena of REPORT_ARENAS) {
      const records = options.seeds.map((seed) =>
        resolve(scenario, arena, rows[arena]!, seed, options.params, clock),
      );
      cells.push({ scenario, arena, records });
    }
  }
  return { options, cells, wallSeconds: (clock() - start) / 1000 };
}

/** The value at quantile q (0..1) of an ascending list, by nearest rank. */
export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return Number.NaN;
  const rank = Math.ceil(q * sorted.length) - 1;
  return sorted[Math.min(Math.max(rank, 0), sorted.length - 1)]!;
}

const ascending = (values: number[]) => [...values].sort((a, b) => a - b);

export type CellStats = {
  battles: number;
  /** Wins per side. */
  wins: number[];
  none: number;
  cut: number;
  idle: number;
  edge: number;
  firstEscaped: number;
  /** Battle seconds: p10, median, p90, max. */
  seconds: [number, number, number, number];
  /** Wall ms per battle: median, p95; and per 2 400 ticks, median. */
  ms: [number, number];
  msPer2400: number;
};

export function cellStats(cell: SweepCell, params: BattleParams): CellStats {
  const { records } = cell;
  const sides = cell.scenario.sides.length;
  const wins = new Array<number>(sides).fill(0);
  let none = 0;
  for (const r of records) {
    if (r.winnerSide === null) none += 1;
    else wins[r.winnerSide]! += 1;
  }
  const seconds = ascending(
    records.map((r) => r.ticks / params.tick.ticksPerSecond),
  );
  const ms = ascending(records.map((r) => r.ms));
  const per2400 = ascending(records.map((r) => (r.ms * 2400) / r.ticks));
  const count = (f: (r: BattleRecord) => boolean) => records.filter(f).length;
  return {
    battles: records.length,
    wins,
    none,
    cut: count((r) => r.cut),
    idle: count((r) => r.idle),
    edge: count((r) => r.edge),
    firstEscaped: count((r) => r.firstEscaped),
    seconds: [
      quantile(seconds, 0.1),
      quantile(seconds, 0.5),
      quantile(seconds, 0.9),
      seconds.at(-1) ?? Number.NaN,
    ],
    ms: [quantile(ms, 0.5), quantile(ms, 0.95)],
    msPer2400: quantile(per2400, 0.5),
  };
}

// The report ---------------------------------------------------------------

/**
 * Spec section 7 targets (chutes): the report shows them next to the numbers.
 * The win share and the durations are informative since the F3 checkpoint
 * (owner, 2026-11-17: raw combat, without skills, levels or stats, is not
 * balanced); only the cost fails.
 */
export const TARGETS = {
  /** No DNA pair above this share of wins in all three arenas. */
  maxWinPermille: 750,
  duelMedianSeconds: [15, 90] as const,
  teamMedianSeconds: 120,
  msPer2400: 50,
};

/** Outside a target that no longer fails (see TARGETS). */
const INFORMATIVE = "fora do chute (informativo)";

const pct = (part: number, whole: number) =>
  whole === 0 ? "—" : `${Math.round((part * 100) / whole)}%`;
const secs = (s: number) => (Number.isNaN(s) ? "—" : `${s.toFixed(1)} s`);
const msText = (ms: number) => (Number.isNaN(ms) ? "—" : `${ms.toFixed(1)} ms`);

export type Verdicts = {
  /** Pairs above the limit in every arena (empty: pass). */
  decidedPairs: string[];
  duelMedianSeconds: number;
  teamMedianSeconds: number;
  msPer2400: number;
};

/** The cells of the lab's arenas (not the 3× one) whose scenario passes. */
function cellsOf(result: BattleSweepResult, filter: (s: Scenario) => boolean) {
  const lab: readonly string[] = ARENAS;
  return result.cells.filter(
    (c) => lab.includes(c.arena) && filter(c.scenario),
  );
}

/** Pooled seconds and ms per 2 400 ticks of some cells. */
function pooled(cells: readonly SweepCell[], params: BattleParams) {
  const records = cells.flatMap((c) => c.records);
  return {
    seconds: ascending(
      records.map((r) => r.ticks / params.tick.ticksPerSecond),
    ),
    per2400: ascending(records.map((r) => (r.ms * 2400) / r.ticks)),
  };
}

export function battleVerdicts(result: BattleSweepResult): Verdicts {
  const { params } = result.options;
  const decidedPairs: string[] = [];
  for (const scenario of scenarios().filter((s) => s.group === "duel")) {
    // The same side above the limit on every arena: the DNA decides. A pair
    // whose winner flips with the arena is decided by the arena instead.
    const decided = scenario.sides.some((_, side) =>
      ARENAS.every((arena) => {
        const cell = result.cells.find(
          (c) => c.scenario.id === scenario.id && c.arena === arena,
        )!;
        const stats = cellStats(cell, params);
        return (
          stats.wins[side]! * 1000 > TARGETS.maxWinPermille * stats.battles
        );
      }),
    );
    if (decided) decidedPairs.push(scenario.label);
  }
  const duels = pooled(
    cellsOf(result, (s) => s.group === "duel" || s.group === "mirror"),
    params,
  );
  const team = pooled(
    cellsOf(result, (s) => s.id === "3x3"),
    params,
  );
  return {
    decidedPairs,
    duelMedianSeconds: quantile(duels.seconds, 0.5),
    teamMedianSeconds: quantile(team.seconds, 0.5),
    msPer2400: quantile(team.per2400, 0.5),
  };
}

function table(head: string[], rows: string[][]): string {
  return [
    `| ${head.join(" | ")} |`,
    `|${head.map(() => "---").join("|")}|`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
}

export function renderBattleReport(result: BattleSweepResult): string {
  const { options, cells } = result;
  const { params } = options;
  const stats = new Map(
    cells.map((c) => [`${c.scenario.id}|${c.arena}`, cellStats(c, params)]),
  );
  const at = (scenario: Scenario, arena: ArenaName) =>
    stats.get(`${scenario.id}|${arena}`)!;
  const all = scenarios();
  const group = (g: Group) => all.filter((s) => s.group === g);
  const verdicts = battleVerdicts(result);
  const battles = cells.reduce((n, c) => n + c.records.length, 0);
  const cut = cells.reduce((n, c) => n + at(c.scenario, c.arena).cut, 0);
  const seeds = options.seeds;
  const out: string[] = [];

  out.push(`# geo battle sweep — ${options.id}`);
  out.push("");
  out.push(
    `Params: \`${options.paramsSource}\` · seeds ${seeds[0]}–${seeds.at(-1)} (${seeds.length}) · ${battles} batalhas · ${result.wallSeconds.toFixed(1)} s` +
      (cut > 0
        ? ` · **${cut} cortadas em ${MAX_BATTLE_SECONDS} s sem fim**`
        : ""),
  );
  out.push("");
  out.push(
    "Todos os participantes pela IA, com o preset do DNA (quadrado: linha de frente; triângulo: escaramuçador; círculo: atirador), salvo onde o cenário diz outro. O lado A é o primeiro do confronto (zona de nascimento 1). Cada lado nasce na sua zona, a 1/4 da largura a partir da borda (checkpoint da F3). A `aberta-3x` (63 × 39) só serve para comparar: os vereditos contam as três arenas do laboratório. Os alvos são os chutes da spec §7; desde o checkpoint da F3, vitórias e duração são só informativos (o combate cru não se balanceia antes de skills, nível e stats), e só o custo reprova.",
  );
  out.push("");

  out.push("## Resumo");
  out.push("");
  out.push(
    table(
      ["Critério", "Alvo", "Medido", ""],
      [
        [
          "O DNA não decide sozinho (1 × 1)",
          `nenhum DNA acima de ${TARGETS.maxWinPermille / 10}% no mesmo par nas três arenas`,
          verdicts.decidedPairs.length === 0
            ? "nenhum"
            : verdicts.decidedPairs.join("; "),
          verdicts.decidedPairs.length === 0 ? "ok" : INFORMATIVE,
        ],
        [
          "Duração do 1 × 1 (mediana)",
          `${TARGETS.duelMedianSeconds[0]}–${TARGETS.duelMedianSeconds[1]} s`,
          secs(verdicts.duelMedianSeconds),
          verdicts.duelMedianSeconds >= TARGETS.duelMedianSeconds[0] &&
          verdicts.duelMedianSeconds <= TARGETS.duelMedianSeconds[1]
            ? "ok"
            : INFORMATIVE,
        ],
        [
          "Duração do 3 × 3 (mediana)",
          `até ${TARGETS.teamMedianSeconds} s`,
          secs(verdicts.teamMedianSeconds),
          verdicts.teamMedianSeconds <= TARGETS.teamMedianSeconds
            ? "ok"
            : INFORMATIVE,
        ],
        [
          "Custo do 3 × 3 (mediana, por 2 400 ticks)",
          `até ${TARGETS.msPer2400} ms`,
          msText(verdicts.msPer2400),
          verdicts.msPer2400 <= TARGETS.msPer2400 ? "ok" : "**reprovado**",
        ],
      ],
    ),
  );
  out.push("");

  const winRow = (s: Scenario) =>
    REPORT_ARENAS.map((arena) => {
      const st = at(s, arena);
      const parts = st.wins.map((w) => pct(w, st.battles));
      return `${parts.join(" / ")} (− ${pct(st.none, st.battles)})`;
    });

  out.push("## Vitórias no 1 × 1, por arena");
  out.push("");
  out.push(
    "A / B (− sem vencedor: os dois morreram ou fugiram). Um par reprova se o mesmo lado passa do alvo nas três arenas; se o vencedor muda com a arena, é a arena que decide.",
  );
  out.push("");
  out.push(
    table(
      ["Confronto (A × B)", ...REPORT_ARENAS],
      group("duel").map((s) => [s.label, ...winRow(s)]),
    ),
  );
  out.push("");

  out.push("## Espelhos (o lado não decide)");
  out.push("");
  out.push("Vitórias do lado A / lado B; o esperado é perto de 50% / 50%.");
  out.push("");
  out.push(
    table(
      ["Espelho", ...REPORT_ARENAS],
      group("mirror").map((s) => [s.label, ...winRow(s)]),
    ),
  );
  out.push("");

  out.push("## O ferido pesa");
  out.push("");
  out.push(
    "Vitórias de A / B com um dos lados a 500‰ do HP, ao lado do mesmo confronto de HP cheio.",
  );
  out.push("");
  const woundedRows: string[][] = [];
  for (const base of [...group("duel"), ...group("mirror")]) {
    woundedRows.push([`${base.label} (HP cheio)`, ...winRow(base)]);
    const [a, b] = base.id.replace("1x1 ", "").split("-");
    for (const s of group("wounded")) {
      const [wa, wb] = s.id.replace("1x1 ", "").split("-");
      if (wa!.replace("@500", "") === a && wb!.replace("@500", "") === b) {
        woundedRows.push([s.label, ...winRow(s)]);
      }
    }
  }
  out.push(table(["Confronto", ...REPORT_ARENAS], woundedRows));
  out.push("");

  out.push("## A dificuldade pesa");
  out.push("");
  const { easy, normal, hard } = params.ai;
  out.push(
    `Vitórias de A / B num espelho com o lado A difícil (reação de ${hard.decisionMs} ± ${hard.decisionJitterMs} ms) e o lado B fácil (${easy.decisionMs} ± ${easy.decisionJitterMs} ms). O resto da matriz usa o normal (${normal.decisionMs} ± ${normal.decisionJitterMs} ms).`,
  );
  out.push("");
  out.push(
    table(
      ["Espelho", ...REPORT_ARENAS],
      group("reaction").map((s) => [s.label, ...winRow(s)]),
    ),
  );
  out.push("");

  out.push("## Lutas maiores");
  out.push("");
  out.push("Vitórias por lado (− sem vencedor).");
  out.push("");
  out.push(
    table(
      ["Cenário", ...REPORT_ARENAS],
      [...group("team"), ...group("ffa")].map((s) => [s.label, ...winRow(s)]),
    ),
  );
  out.push("");

  out.push("## Duração (segundos de batalha)");
  out.push("");
  out.push("p10 · mediana · p90 · máximo, por cenário e arena.");
  out.push("");
  out.push(
    table(
      ["Cenário", ...REPORT_ARENAS],
      all.map((s) => [
        s.label,
        ...REPORT_ARENAS.map((arena) => {
          const [p10, p50, p90, max] = at(s, arena).seconds;
          return `${p10.toFixed(1)} · **${p50.toFixed(1)}** · ${p90.toFixed(1)} · ${max.toFixed(1)}`;
        }),
      ]),
    ),
  );
  out.push("");

  out.push("## Inatividade e borda");
  out.push("");
  out.push(
    "Batalhas em que alguém fugiu por inatividade (o relógio de 15 s estourou) / em que alguém saiu pela borda. Muita inatividade quer dizer impasse resolvido pelo relógio, ou lutas cortadas: o dono julga qual.",
  );
  out.push("");
  out.push(
    table(
      ["Cenário", ...REPORT_ARENAS],
      all.map((s) => [
        s.label,
        ...REPORT_ARENAS.map((arena) => {
          const st = at(s, arena);
          return `${pct(st.idle, st.battles)} / ${pct(st.edge, st.battles)}`;
        }),
      ]),
    ),
  );
  out.push("");

  out.push("## Fuga carregada");
  out.push("");
  out.push(
    `Um quadrado com a bolsa cheia (${worldKits().square.capacity} de matéria) contra um círculo: a taxa com que o quadrado sai pela borda, com o preset portador (larga a bolsa com o inimigo a 4 células, depois foge) e só fugindo, com a bolsa. Ele nasce na zona do seu lado e precisa chegar à borda com o freio da carga.`,
  );
  out.push("");
  out.push(
    table(
      ["Cenário", ...REPORT_ARENAS],
      group("carry").map((s) => [
        s.label,
        ...REPORT_ARENAS.map((arena) => {
          const st = at(s, arena);
          return `${pct(st.firstEscaped, st.battles)} escapa`;
        }),
      ]),
    ),
  );
  out.push("");

  out.push("## Custo do auto-resolve");
  out.push("");
  out.push(
    "Milissegundos de relógio por batalha (mediana · p95) e a mediana normalizada para 2 400 ticks (120 s de batalha), o alvo da spec para o 3 × 3.",
  );
  out.push("");
  out.push(
    table(
      ["Cenário", ...REPORT_ARENAS],
      [...group("duel"), ...group("team"), ...group("ffa")].map((s) => [
        s.label,
        ...REPORT_ARENAS.map((arena) => {
          const st = at(s, arena);
          return `${msText(st.ms[0])} · ${msText(st.ms[1])} · ${msText(st.msPer2400)}/2400`;
        }),
      ]),
    ),
  );
  out.push("");
  return out.join("\n");
}

export function battleCsv(result: BattleSweepResult): string {
  const { params } = result.options;
  const lines = [
    "scenario,group,arena,battles,wins_a,wins_b,wins_c,none,cut,idle,edge,first_escaped,seconds_p10,seconds_p50,seconds_p90,seconds_max,ms_p50,ms_p95,ms_per_2400",
  ];
  for (const cell of result.cells) {
    const st = cellStats(cell, params);
    lines.push(
      [
        cell.scenario.id,
        cell.scenario.group,
        cell.arena,
        st.battles,
        st.wins[0] ?? 0,
        st.wins[1] ?? 0,
        st.wins[2] ?? "",
        st.none,
        st.cut,
        st.idle,
        st.edge,
        st.firstEscaped,
        ...st.seconds.map((s) => s.toFixed(2)),
        ...st.ms.map((m) => m.toFixed(3)),
        st.msPer2400.toFixed(3),
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

export const BATTLE_FILES = { report: "battle.md", csv: "battle.csv" };

export function writeBattleSweep(dir: string, result: BattleSweepResult): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, BATTLE_FILES.report), renderBattleReport(result));
  writeFileSync(join(dir, BATTLE_FILES.csv), battleCsv(result));
}
