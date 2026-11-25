// report.md (plan section 9): a run's metrics, readable by people and by an
// AI discussing balance. Facts only: totals, rates, shares of time and when
// things happened. Judging them is the reviewer's job.

import {
  ACTIVITIES,
  type Activity,
  type MetricsSample,
  type Stock,
} from "@geometrix/sim";
import {
  BATTLE_RESULTS,
  DECIDERS,
  FATES,
  LOADS,
  ROLES,
  OUTCOMES,
  REACTIONS,
  type BattleResult,
  type BattleStats,
  type Decider,
  type Durations,
  type Fate,
  type Load,
  type Role,
  type EncounterTally,
  type Outcome,
  type Reaction,
  type TeamEncounters,
} from "./encounters.ts";
import {
  botsLine,
  HOUR,
  hours,
  minutes,
  number,
  percent,
  realMinutes,
  realTime,
  table,
  worldAndReal,
} from "./format.ts";
import { paceSection } from "./pace.ts";
import type { RunData } from "./sim.ts";

const ACTIVITY_LABELS: Record<Activity, string> = {
  gathering: "coletando",
  carrying: "carregando",
  walkingEmpty: "andando vazio",
  building: "construindo",
  talking: "em diálogo",
  fighting: "lutando",
  fleeing: "fugindo",
  idle: "parado",
};
const DNA_ORDER = ["square", "triangle", "circle"] as const;
const OUTCOME_LABELS: Record<Outcome, string> = {
  paid: "pagou",
  battle: "abriu batalha",
  open: "em aberto no fim",
};
const REACTION_LABELS: Record<Reaction, string> = {
  pay: "pagou",
  refuse: "recusou",
};
const BATTLE_LABELS: Record<BattleResult, string> = {
  won: "venceu",
  lost: "perdeu",
  idle: "acabou por inatividade",
  empty: "acabou sem ninguém",
  open: "em aberto no fim",
};
const DECIDER_LABELS: Record<Decider, string> = {
  rule: "regra",
  player: "jogador",
  default: "padrão",
};

/** The team's creeps' mean HP share in a sample, or "—" with no creep. */
export const meanHp = (t: { hp: number; hpMax: number }) =>
  t.hpMax === 0 ? "—" : percent(t.hp, t.hpMax);

/** Report windows: the shortest of these giving at most 12 rows. */
export function windowSeconds(totalSeconds: number): number {
  const options = [1, 2, 3, 6, 12, 24].map((h) => h * HOUR);
  return (
    options.find((w) => Math.ceil(totalSeconds / w) <= 12) ?? options.at(-1)!
  );
}

export function renderReport(run: RunData): string {
  const { meta, params, samples } = run;
  const first = samples[0]!;
  const last = samples.at(-1)!;
  const seconds = (s: MetricsSample) => s.tick * meta.tickSeconds;
  const total = seconds(last);
  const teamIds = last.teams.map((t) => t.team);
  const perTeam = (cell: (team: number) => string) => teamIds.map(cell);
  const teamHeader = ["Métrica", ...teamIds.map((t) => `Time ${t}`)];
  const mapCells = params.map.width * params.map.height;
  const mult = meta.multiplier;
  /** A moment in world time, with its real time at ×N. */
  const moment = (s: number, format = hours) => worldAndReal(s, mult, format);
  /** A tick as world and real time, or "—" for null. */
  const atTick = (tick: number | null, format = hours) =>
    tick === null ? "—" : moment(tick * meta.tickSeconds, format);

  /** Seconds at which `when` first holds for the team, as hours, or "—". */
  const firstTime = (
    team: number,
    when: (t: MetricsSample["teams"][number]) => boolean,
  ) => {
    const hit = samples.find((s) => when(s.teams[team]!));
    return hit === undefined ? "—" : moment(seconds(hit));
  };

  const lines: string[] = [];
  const out = (...text: string[]) => lines.push(...text);

  out(
    `# Relatório de simulação — ${meta.id}`,
    "",
    table(
      ["", ""],
      [
        ["Seed", `${meta.seed} (mapa gerado com ${meta.mapSeed})`],
        [
          "Duração",
          `${hours(total)} de mundo (${number(meta.ticks)} ticks de ${meta.tickSeconds} s); ${realTime(total, mult)} a ×${mult}`,
        ],
        [
          "Multiplicador de tempo",
          `×${mult}: os tempos reais do relatório são o tempo de mundo ÷ ${mult}`,
        ],
        ["Estrategistas", botsLine(meta.strategists, meta.difficulties)],
        ["Parâmetros", `\`${meta.paramsSource}\``],
        ["Versão do sim", String(meta.simVersion)],
        ...(meta.shock === null
          ? []
          : [
              [
                "Choque (cenário de recuperação)",
                `o time ${meta.shock.team} perde ${meta.shock.count} creeps no minuto real ${meta.shock.minute}; o run não é reproduzível (sem replay.json)`,
              ],
            ]),
        ["Hash final", `\`${meta.finalHash}\``],
        [
          "Tempo de simulação",
          `${number(meta.wallSeconds, 1)} s (${number(total / meta.wallSeconds)}× o tempo real)`,
        ],
        ["Comandos no log", number(meta.commands)],
      ],
    ),
    "",
  );

  if (run.pace !== null) out(...paceSection(run.pace));

  // Summary per team.
  const stat = (team: number) => last.teams[team]!;
  const creepTotal = (t: MetricsSample["teams"][number]) =>
    DNA_ORDER.reduce((sum, dna) => sum + t.creeps[dna], 0);
  const activityTotal = (team: number) =>
    ACTIVITIES.reduce((sum, a) => sum + stat(team).activitySeconds[a], 0);
  const pair = (a: number, b: number, digits = 0) =>
    `${number(a, digits)} / ${number(b, digits)}`;
  out(
    "## Resumo por time",
    "",
    table(teamHeader, [
      [
        "Creeps no fim (■ / ▲ / ●)",
        ...perTeam((t) => {
          const c = stat(t).creeps;
          return `${creepTotal(stat(t))} (${c.square} / ${c.triangle} / ${c.circle})`;
        }),
      ],
      [
        `Teto de população (${params.population.cap}) atingido em`,
        ...perTeam((t) =>
          firstTime(
            t,
            (s) =>
              creepTotal(s) + (s.producing === null ? 0 : 1) >=
              params.population.cap,
          ),
        ),
      ],
      ["HP médio dos creeps no fim", ...perTeam((t) => meanHp(stat(t)))],
      [
        "Upgrade de capacidade comprado em",
        ...perTeam((t) => firstTime(t, (s) => s.capacityUpgrade)),
      ],
      [
        "1ª entrega (matéria / cristal) em",
        ...perTeam((t) => {
          const first = stat(t).firstDeliveryTick;
          return `${atTick(first.materia, minutes)} / ${atTick(first.cristal, minutes)}`;
        }),
      ],
      [
        "Núcleo inimigo visto em",
        ...perTeam((t) => atTick(stat(t).enemyCoreSeenTick)),
      ],
      [
        "Mapa explorado no fim",
        ...perTeam((t) => percent(stat(t).exploredCells, mapCells)),
      ],
      [
        "Estoque no fim (matéria / cristal)",
        ...perTeam((t) => pair(stat(t).stock.materia, stat(t).stock.cristal)),
      ],
      [
        "Entregue no total (matéria / cristal)",
        ...perTeam((t) =>
          pair(stat(t).delivered.materia, stat(t).delivered.cristal),
        ),
      ],
      [
        "Vazão média por hora (matéria / cristal)",
        ...perTeam((t) =>
          pair(
            (stat(t).delivered.materia * HOUR) / total,
            (stat(t).delivered.cristal * HOUR) / total,
            1,
          ),
        ),
      ],
      [
        "Em trânsito no fim (matéria / cristal)",
        ...perTeam((t) =>
          pair(stat(t).inTransit.materia, stat(t).inTransit.cristal),
        ),
      ],
      [
        "Núcleo ocioso",
        ...perTeam(
          (t) =>
            `${hours(stat(t).coreIdleSeconds)} (${percent(stat(t).coreIdleSeconds, total)})`,
        ),
      ],
      ...ACTIVITIES.map((a) => [
        `Tempo dos creeps: ${ACTIVITY_LABELS[a]}`,
        ...perTeam((t) =>
          percent(stat(t).activitySeconds[a], activityTotal(t)),
        ),
      ]),
      ["Viagens concluídas", ...perTeam((t) => number(stat(t).trips))],
      [
        "Tempo médio por viagem",
        ...perTeam((t) =>
          stat(t).trips === 0
            ? "—"
            : `${number(stat(t).tripSeconds / stat(t).trips / 60, 1)} min`,
        ),
      ],
      [
        "Distância média por viagem",
        ...perTeam((t) =>
          stat(t).trips === 0
            ? "—"
            : `${number(stat(t).tripCells / stat(t).trips, 1)} células`,
        ),
      ],
      [
        "Segmentos de estrada pagos e concluídos",
        ...perTeam((t) => number(stat(t).roadSegments)),
      ],
      [
        "Tempo de creeps dominados",
        ...perTeam((t) => hours(stat(t).dominatedSeconds)),
      ],
      [
        "Comandos aceitos (produce / buyUpgrade / applyPreset / setRules / order)",
        ...perTeam((t) => {
          const c = stat(t).commands;
          return [c.produce, c.buyUpgrade, c.applyPreset, c.setRules, c.order]
            .map((n) => number(n))
            .join(" / ");
        }),
      ],
      [
        "Presets aplicados (matéria / cristal / estrada)",
        ...perTeam((t) => {
          const p = stat(t).presets;
          return [p.materiaCollector, p.cristalCollector, p.roadBuilder]
            .map((n) => number(n))
            .join(" / ");
        }),
      ],
    ]),
    "",
    `Comprimento total de estradas no mapa (os dois times): ${number(last.roadCells)} células.`,
    "",
  );

  out(...encounterSection(run.encounters, teamIds, total, params));
  out(...battleSection(run.encounters, teamIds.length, total));
  out(...wandererSection(run.encounters));

  // Timeline.
  const window = windowSeconds(total);
  const marks = samples.filter((s) => seconds(s) % window === 0 || s === last);
  out(
    "## Linha do tempo",
    "",
    `Janelas de ${hours(window)} (${realTime(window, mult)}). Estoque, creeps, mapa explorado, creeps com ordem de explorar e HP médio no fim da janela; vazão, tempo dos creeps, encontros abertos e mortes dentro dela.`,
    "",
  );
  for (const team of teamIds) {
    const rows: string[][] = [];
    for (let i = 1; i < marks.length; i++) {
      const from = marks[i - 1]!;
      const to = marks[i]!;
      const a = from.teams[team]!;
      const b = to.teams[team]!;
      const span = seconds(to) - seconds(from);
      const busy = ACTIVITIES.reduce(
        (sum, x) => sum + b.activitySeconds[x] - a.activitySeconds[x],
        0,
      );
      const share = (x: Activity) =>
        percent(b.activitySeconds[x] - a.activitySeconds[x], busy);
      rows.push([
        `${number(seconds(from) / HOUR, 1)}–${number(seconds(to) / HOUR, 1)}`,
        `${number(realMinutes(seconds(from), mult))}–${number(realMinutes(seconds(to), mult))}`,
        String(creepTotal(b)),
        pair(b.stock.materia, b.stock.cristal),
        pair(
          ((b.delivered.materia - a.delivered.materia) * HOUR) / span,
          ((b.delivered.cristal - a.delivered.cristal) * HOUR) / span,
          1,
        ),
        share("gathering"),
        share("carrying"),
        share("walkingEmpty"),
        share("building"),
        share("idle"),
        String(to.roadCells),
        percent(b.exploredCells, mapCells),
        String(b.exploring),
        ...encounterWindow(run.encounters, from.tick, to.tick, team),
        meanHp(b),
      ]);
    }
    out(
      `### Time ${team}`,
      "",
      table(
        [
          "Horas",
          "Min reais",
          "Creeps",
          "Estoque m / c",
          "Vazão m / c por hora",
          "Coletando",
          "Carregando",
          "Vazio",
          "Construindo",
          "Parado",
          "Estradas no mapa",
          "Explorado",
          "Explorando",
          "Abordou / abordado",
          "Mortes",
          "HP médio",
        ],
        rows,
      ),
      "",
    );
  }

  // Deposits.
  const { cores, deposits } = meta.map;
  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  out(
    "## Depósitos",
    "",
    `Disputa: tempo em que creeps dos dois times tinham ordem de coletar no mesmo depósito.`,
    "",
    table(
      [
        "Id",
        "Tipo",
        "Célula",
        ...cores.map((_, t) => `Dist. Núcleo ${t}`),
        "Inicial",
        "No fim",
        "Zerou pela 1ª vez em",
        "Disputa",
      ],
      last.deposits.map((d) => {
        const site = deposits.find((s) => s.id === d.deposit)!;
        const start = first.deposits.find((s) => s.deposit === d.deposit)!;
        return [
          String(d.deposit),
          d.kind === "materia" ? "matéria" : "cristal",
          `(${site.x}, ${site.y})`,
          ...cores.map((core) => String(distance(core, site))),
          number(start.amount),
          number(d.amount),
          d.emptiedAtTick === null
            ? "—"
            : moment(d.emptiedAtTick * meta.tickSeconds),
          hours(d.contestedSeconds),
        ];
      }),
    ),
    "",
  );

  // Facts worth a look.
  const cristal = last.deposits.filter((d) => d.kind === "cristal");
  const cristalLeft = cristal.reduce((sum, d) => sum + d.amount, 0);
  const lastEmptied = Math.max(
    ...cristal.map((d) => d.emptiedAtTick ?? Infinity),
  );
  const materia = last.deposits.filter((d) => d.kind === "materia");
  out(
    "## Fatos para a revisão",
    "",
    cristalLeft === 0
      ? `- Todo o cristal do mapa se esgotou em ${moment(lastEmptied * meta.tickSeconds)}, ${percent(lastEmptied * meta.tickSeconds, total)} da duração.`
      : `- Restam ${number(cristalLeft)} de cristal no mapa, em ${cristal.filter((d) => d.amount > 0).length} de ${cristal.length} depósitos.`,
    `- Depósitos de matéria que zeraram alguma vez: ${materia.filter((d) => d.emptiedAtTick !== null).length} de ${materia.length}; quantidade média no fim: ${number(materia.reduce((s, d) => s + d.amount, 0) / Math.max(1, materia.length))} (inicial ${number(params.deposits.materia.amount)}).`,
    ...teamIds.map((t) => {
      const s = stat(t);
      return `- Time ${t}: o estoque parado no fim é ${percent(s.stock.materia, s.delivered.materia)} da matéria e ${percent(s.stock.cristal, s.delivered.cristal)} do cristal entregues.`;
    }),
    ...gapFacts(last),
    "",
    "## Configuração",
    "",
    "Estrategista `balanced` (provisório):",
    "",
    "```json",
    JSON.stringify(meta.balanced, null, 2),
    "```",
    "",
    "<details><summary>Parâmetros</summary>",
    "",
    "```json",
    JSON.stringify(params, null, 2),
    "```",
    "",
    "</details>",
    "",
  );
  return `${lines.join("\n")}\n`;
}

/** "a / b" of a stock. */
const stockPair = (s: Stock) => `${number(s.materia)} / ${number(s.cristal)}`;
const encountersOf = (r: Record<"attack" | "extort", number>) =>
  r.attack + r.extort;

/**
 * Encounters and battles (M2 encontro spec §7, junction spec §7): how often,
 * how they ended, escapes, deaths, and what changed hands. Facts, as the rest
 * of the report.
 */
function encounterSection(
  tally: EncounterTally,
  teamIds: number[],
  totalSeconds: number,
  params: RunData["params"],
): string[] {
  const team = (t: number) => tally.teams[t]!;
  const perTeam = (cell: (t: TeamEncounters) => string) =>
    teamIds.map((t) => cell(team(t)));
  const perHour = (n: number) => number((n * HOUR) / totalSeconds, 1);
  const victimTotal = (t: TeamEncounters) => encountersOf(t.asVictim);
  const reactionTotal = (t: TeamEncounters) =>
    REACTIONS.reduce((sum, r) => sum + t.reactions[r], 0);
  const deaths = (t: TeamEncounters) =>
    DNA_ORDER.reduce((sum, dna) => sum + t.deaths[dna], 0);
  const { spoils } = tally;
  return [
    "## Encontros",
    "",
    `Zona do Núcleo: até ${params.hp.coreZoneRadius} células (Manhattan) do Núcleo da vítima. Recursos em matéria / cristal.`,
    "",
    table(
      ["Métrica", ...teamIds.map((t) => `Time ${t}`)],
      [
        [
          "Abordou (atacar / extorquir)",
          ...perTeam(
            (t) =>
              `${encountersOf(t.asAggressor)} (${t.asAggressor.attack} / ${t.asAggressor.extort})`,
          ),
        ],
        [
          "Foi abordado (atacar / extorquir)",
          ...perTeam(
            (t) =>
              `${victimTotal(t)} (${t.asVictim.attack} / ${t.asVictim.extort})`,
          ),
        ],
        [
          "Encontros por hora (abordou / foi abordado)",
          ...perTeam(
            (t) =>
              `${perHour(encountersOf(t.asAggressor))} / ${perHour(victimTotal(t))}`,
          ),
        ],
        [
          "Abordado na zona do próprio Núcleo",
          ...perTeam(
            (t) =>
              `${t.victimInOwnCoreZone} (${percent(t.victimInOwnCoreZone, victimTotal(t))})`,
          ),
        ],
        ...REACTIONS.map((r) => [
          `Reação da vítima: ${REACTION_LABELS[r]}`,
          ...perTeam(
            (t) =>
              `${t.reactions[r]} (${percent(t.reactions[r], reactionTotal(t))})`,
          ),
        ]),
        [
          `Reação decidida por (${DECIDERS.map((d) => DECIDER_LABELS[d]).join(" / ")})`,
          ...perTeam((t) => DECIDERS.map((d) => t.reactionsBy[d]).join(" / ")),
        ],
        ...OUTCOMES.map((o) => [
          `Desfecho como vítima: ${OUTCOME_LABELS[o]}`,
          ...perTeam((t) => String(t.outcomesAsVictim[o])),
        ]),
        ...OUTCOMES.map((o) => [
          `Desfecho como agressor: ${OUTCOME_LABELS[o]}`,
          ...perTeam((t) => String(t.outcomesAsAggressor[o])),
        ]),
        ...BATTLE_RESULTS.map((r) => [
          `Batalha: ${BATTLE_LABELS[r]}`,
          ...perTeam((t) => String(t.battles[r])),
        ]),
        ["Entrou em batalha já aberta", ...perTeam((t) => String(t.joins))],
        [
          "Escapou pela borda (■ / ▲ / ●)",
          ...perTeam((t) => DNA_ORDER.map((dna) => t.escapes[dna]).join(" / ")),
        ],
        [
          "Mortes (■ / ▲ / ●)",
          ...perTeam(
            (t) =>
              `${deaths(t)} (${DNA_ORDER.map((dna) => t.deaths[dna]).join(" / ")})`,
          ),
        ],
        ["Inimigos mortos", ...perTeam((t) => String(t.kills))],
        [
          "Extorsão paga / recebida",
          ...perTeam(
            (t) =>
              `${stockPair(t.extortionPaid)} · ${stockPair(t.extortionReceived)}`,
          ),
        ],
        ["Saque tomado", ...perTeam((t) => stockPair(t.lootTaken))],
        ["Catado de despojos", ...perTeam((t) => stockPair(t.pickedUp))],
      ],
    ),
    "",
    `Batalhas abertas: ${number(tally.battlesOpened)}. Despojos: ${number(spoils.created)} pilhas criadas com ${stockPair(spoils.dropped)}, ${number(spoils.pickups)} catadas; no fim, ${number(spoils.left)} no mapa com ${stockPair(spoils.leftCargo)}.`,
    "",
  ];
}

const DNA_GLYPHS = { square: "■", triangle: "▲", circle: "●" } as const;
const ROLE_LABELS: Record<Role, string> = {
  aggressor: "agressor",
  victim: "vítima",
};
const LOAD_LABELS: Record<Load, string> = {
  loaded: "carregado",
  empty: "vazio",
};
const FATE_LABELS: Record<Fate, string> = {
  won: "venceu",
  died: "morreu",
  escaped: "escapou",
  idle: "inatividade",
  open: "aberta",
};

/** "mean / max" of a duration, in seconds; "—" with none. */
const durationPair = (d: Durations) =>
  d.count === 0 ? "—" : `${number(d.total / d.count)} s / ${number(d.max)} s`;

/**
 * The battles (junction spec §7): how they opened and ended, who and how many
 * were in them, how long they took, and how each participant came out by
 * role, DNA and load.
 */
function battleSection(
  tally: EncounterTally,
  teams: number,
  totalSeconds: number,
): string[] {
  const stats: BattleStats = tally.battleStats;
  const opened = tally.battlesOpened;
  const ended = stats.ended.won + stats.ended.idle + stats.ended.empty;
  const rows: string[][] = [];
  for (const role of ROLES) {
    for (const dna of DNA_ORDER) {
      for (const load of LOADS) {
        const fates = stats.fates[role][dna][load];
        const total = FATES.reduce((sum, f) => sum + fates[f], 0);
        if (total === 0) continue;
        rows.push([
          `${ROLE_LABELS[role]} ${DNA_GLYPHS[dna]} ${LOAD_LABELS[load]}`,
          number(total),
          ...FATES.map((f) => `${fates[f]} (${percent(fates[f], total)})`),
        ]);
      }
    }
  }
  return [
    "## Batalhas",
    "",
    `- Abertas: ${number(opened)} (ataque ${number(stats.byCause.attack)}, extorsão recusada ${number(stats.byCause.refused)}, andarilho ${number(stats.byCause.wanderer)}), ${number((opened * HOUR) / totalSeconds / teams, 1)} por time por hora.`,
    `- Terminadas: ${number(ended)} (vitória ${number(stats.ended.won)}, inatividade ${number(stats.ended.idle)}, ninguém sobrou ${number(stats.ended.empty)}); abertas no fim: ${number(opened - ended)}.`,
    `- Participantes: ${number(stats.participants)} (${opened === 0 ? "—" : number(stats.participants / opened, 1)} por batalha), dos quais ${number(stats.joins)} entraram com a batalha aberta (${opened === 0 ? "—" : number(stats.joins / opened, 1)} por batalha).`,
    `- Duração (média / máxima): ${durationPair(stats.worldSeconds)} no relógio do mundo; ${durationPair(stats.battleSeconds)} de tempo de batalha.`,
    "",
    ...(rows.length === 0
      ? []
      : [
          "Como cada participante de um time saiu, pelo lado (o do agressor ou o da vítima), DNA e carga ao entrar (numa batalha aberta por um andarilho, o creep do time é a vítima):",
          "",
          table(
            ["Participante", "Entraram", ...FATES.map((f) => FATE_LABELS[f])],
            rows,
          ),
          "",
        ]),
  ];
}

/** The wanderers (junction spec §7): born, alive, battles, loot, deaths. */
function wandererSection(tally: EncounterTally): string[] {
  const w = tally.wanderers;
  const alive = tally.timeline
    .filter((_, i, all) => i % Math.max(1, Math.floor(all.length / 12)) === 0)
    .map((m) => String(m.wanderers));
  return [
    "## Andarilhos",
    "",
    `- Nascidos: ${number(w.born)}; mortos: ${number(w.died)} (${number(w.killedByTeams)} por creeps de time); vivos no máximo ${number(w.maxAlive)} ao mesmo tempo, ${number(w.aliveAtEnd)} no fim.`,
    `- Vivos ao longo da partida (amostras): ${alive.length === 0 ? "—" : alive.join(" · ")}.`,
    `- Batalhas: ${number(w.attacks)} abertas por um andarilho; ${number(w.joins)} entradas de andarilho numa batalha aberta.`,
    `- Creeps de time mortos por andarilhos: ${number(w.kills)}.`,
    `- Saque dos andarilhos (matéria / cristal): ${stockPair(w.looted)}; o que carregavam ao morrer (vira pilha ou espólio): ${stockPair(w.lostOnDeath)}.`,
    "",
  ];
}

/** Encounters opened (as aggressor / as victim) and deaths between two ticks. */
function encounterWindow(
  tally: EncounterTally,
  from: number,
  to: number,
  team: number,
): string[] {
  const at = (tick: number) =>
    tally.timeline.find((m) => m.tick === tick)?.teams[team];
  const a = at(from);
  const b = at(to);
  if (a === undefined || b === undefined) return ["—", "—"];
  return [
    `${b.asAggressor - a.asAggressor} / ${b.asVictim - a.asVictim}`,
    String(b.deaths - a.deaths),
  ];
}

/** Between the teams at the end: population and materia delivered (B-2). */
function gapFacts(last: MetricsSample): string[] {
  const creeps = last.teams.map(
    (t) => t.creeps.square + t.creeps.triangle + t.creeps.circle,
  );
  const materia = last.teams.map((t) => t.delivered.materia);
  const spread = (values: number[]) =>
    Math.max(...values) - Math.min(...values);
  return [
    `- Diferença entre os times no fim: ${number(spread(creeps))} creeps (${creeps.join(" / ")}) e ${number(spread(materia))} de matéria entregue (${percent(spread(materia), Math.max(...materia))} do maior).`,
  ];
}
