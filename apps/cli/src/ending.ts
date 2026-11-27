// How a run ended (E-min spec §7, plan section 8): the End section of
// report.md and the ends table of the sweep, both read from the sim's
// endSummary, the same data as the end screen.

import type { EndSummary, TeamEvent, TeamOut } from "@geometrix/sim";
import { number, realMinutes, table, worldAndReal } from "./format.ts";

/** How a world ended; "mixed" when the last teams left in different ways. */
export type EndKind =
  "elimination" | "concession" | "botConcession" | "clock" | "mixed";

export const END_KIND_LABELS: Record<EndKind, string> = {
  elimination: "eliminação",
  concession: "desistência",
  botConcession: "desistência do bot",
  clock: "relógio",
  mixed: "saídas diferentes no mesmo tick",
};

const kindOfOut = (out: TeamOut): EndKind =>
  out.how === "eliminated"
    ? "elimination"
    : out.bot
      ? "botConcession"
      : "concession";

/** The way of the teams that left on the end tick, or the clock. */
export function endKind({ result, teams }: EndSummary): EndKind {
  if (result.how === "clock") return "clock";
  const kinds = new Set(
    teams.flatMap(({ out }) =>
      out !== null && out.tick === result.tick ? [kindOfOut(out)] : [],
    ),
  );
  return kinds.size === 1 ? [...kinds][0]! : "mixed";
}

export function resultText({ result }: EndSummary): string {
  return result.winner !== null
    ? `time ${result.winner} venceu`
    : `empate entre os times ${result.teams.join(" e ")}`;
}

/** The end tick as world and real time at ×N. */
function when(end: EndSummary, multiplier: number): string {
  return `${worldAndReal(end.durationSeconds, multiplier)}, tick ${number(end.result.tick)}`;
}

function highlightText(event: TeamEvent, multiplier: number, seconds: number) {
  const at = `min real ${number(realMinutes(event.tick * seconds, multiplier), 1)}`;
  switch (event.type) {
    case "teamOut":
      return `- ${at}: o time ${event.team} saiu da partida (${event.how === "eliminated" ? "eliminado" : event.bot ? "desistência do bot" : "desistência"})`;
    case "died":
      return `- ${at}: primeiro sangue`;
    case "battleEnded": {
      const load = [event.spoiled, ...event.loot.map((l) => l.taken)].reduce(
        (sum, s) => sum + s.materia + s.cristal,
        0,
      );
      return `- ${at}: batalha com ${event.entered} participantes e ${number(load)} de recursos`;
    }
    default:
      return `- ${at}: ${event.type}`;
  }
}

/** report.md's End section; `end` null: the run stopped before the world did. */
export function endSection(
  end: EndSummary | null,
  multiplier: number,
  tickSeconds: number,
): string[] {
  if (end === null) {
    return ["## Fim", "", "A partida não terminou neste run.", ""];
  }
  const perTeam = (cell: (t: EndSummary["teams"][number]) => string) =>
    end.teams.map(cell);
  return [
    "## Fim",
    "",
    table(
      ["", ""],
      [
        ["Como", END_KIND_LABELS[endKind(end)]],
        ["Quando", when(end, multiplier)],
        ["Resultado", resultText(end)],
      ],
    ),
    "",
    table(
      ["Métrica", ...end.teams.map((t) => `Time ${t.team}`)],
      [
        [
          "Saiu da partida",
          ...perTeam(({ out }) =>
            out === null
              ? "—"
              : `${END_KIND_LABELS[kindOfOut(out)]}, min real ${number(realMinutes(out.tick * tickSeconds, multiplier), 1)}`,
          ),
        ],
        ["Creeps nascidos", ...perTeam((t) => number(t.born))],
        ["Creeps perdidos", ...perTeam((t) => number(t.lost))],
        [
          "Batalhas vencidas / perdidas",
          ...perTeam((t) => `${t.battlesWon} / ${t.battlesLost}`),
        ],
        ["Matéria entregue", ...perTeam((t) => number(t.materiaDelivered))],
      ],
    ),
    "",
    "Momentos principais:",
    "",
    ...(end.highlights.length === 0
      ? ["- nenhum"]
      : end.highlights.map((e) => highlightText(e, multiplier, tickSeconds))),
    "",
  ];
}
