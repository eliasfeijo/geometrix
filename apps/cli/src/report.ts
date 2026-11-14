// report.md (plan section 9): a run's metrics, readable by people and by an
// AI discussing balance. Facts only: totals, rates, shares of time and when
// things happened. Judging them is the reviewer's job.

import { ACTIVITIES, type Activity, type MetricsSample } from "@geometrix/sim";
import type { RunData } from "./sim.ts";

export const HOUR = 3600;
const ACTIVITY_LABELS: Record<Activity, string> = {
  gathering: "coletando",
  carrying: "carregando",
  walkingEmpty: "andando vazio",
  building: "construindo",
  idle: "parado",
};
const DNA_ORDER = ["square", "triangle", "circle"] as const;

export const number = (value: number, digits = 0) =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
export const percent = (part: number, whole: number) =>
  whole === 0 ? "—" : `${number((100 * part) / whole)}%`;
export const hours = (seconds: number) => `${number(seconds / HOUR, 1)} h`;

export function table(header: string[], rows: string[][]): string {
  const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
  return [line(header), line(header.map(() => "---")), ...rows.map(line)].join(
    "\n",
  );
}

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

  /** Seconds at which `when` first holds for the team, as hours, or "—". */
  const firstTime = (
    team: number,
    when: (t: MetricsSample["teams"][number]) => boolean,
  ) => {
    const hit = samples.find((s) => when(s.teams[team]!));
    return hit === undefined ? "—" : hours(seconds(hit));
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
          `${hours(total)} de mundo (${number(meta.ticks)} ticks de ${meta.tickSeconds} s)`,
        ],
        [
          "Estrategistas",
          meta.strategists.map((s, t) => `time ${t}: ${s}`).join(" · "),
        ],
        ["Parâmetros", `\`${meta.paramsSource}\``],
        ["Versão do sim", String(meta.simVersion)],
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
      [
        "Upgrade de capacidade comprado em",
        ...perTeam((t) => firstTime(t, (s) => s.capacityUpgrade)),
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

  // Timeline.
  const window = windowSeconds(total);
  const marks = samples.filter((s) => seconds(s) % window === 0 || s === last);
  out(
    "## Linha do tempo",
    "",
    `Janelas de ${hours(window)}. Estoque e creeps no fim da janela; vazão e tempo dos creeps dentro dela.`,
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
      ]);
    }
    out(
      `### Time ${team}`,
      "",
      table(
        [
          "Horas",
          "Creeps",
          "Estoque m / c",
          "Vazão m / c por hora",
          "Coletando",
          "Carregando",
          "Vazio",
          "Construindo",
          "Parado",
          "Estradas no mapa",
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
            : hours(d.emptiedAtTick * meta.tickSeconds),
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
      ? `- Todo o cristal do mapa se esgotou em ${hours(lastEmptied * meta.tickSeconds)} (${percent(lastEmptied * meta.tickSeconds, total)} da duração).`
      : `- Restam ${number(cristalLeft)} de cristal no mapa, em ${cristal.filter((d) => d.amount > 0).length} de ${cristal.length} depósitos.`,
    `- Depósitos de matéria que zeraram alguma vez: ${materia.filter((d) => d.emptiedAtTick !== null).length} de ${materia.length}; quantidade média no fim: ${number(materia.reduce((s, d) => s + d.amount, 0) / Math.max(1, materia.length))} (inicial ${number(params.deposits.materia.amount)}).`,
    ...teamIds.map((t) => {
      const s = stat(t);
      return `- Time ${t}: o estoque parado no fim é ${percent(s.stock.materia, s.delivered.materia)} da matéria e ${percent(s.stock.cristal, s.delivered.cristal)} do cristal entregues.`;
    }),
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
