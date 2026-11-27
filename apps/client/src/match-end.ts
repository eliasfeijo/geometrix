// The end of a match as the client reads it (E-min spec D3, D9, S-4, S-5;
// plan section 7): where "Desistir" and the team's vote stand, and the texts of
// the result. Pure: the components only draw what comes from here. Real times
// are world times divided by the world's ×N, never a fixed one.

import {
  isOwnTeam,
  mayConcede,
  voteDeadline,
  type EndSummary,
  type Params,
  type TeamView,
  type WorldResult,
} from "@geometrix/sim";
import { teamName } from "./format.ts";

/** Real seconds a span of world seconds takes, rounded up. */
export function realSeconds(worldSeconds: number, multiplier: number): number {
  return Math.max(0, Math.ceil(worldSeconds / multiplier));
}

export type Concession =
  /** No button: not joined, a spectator, the team out or the world over. */
  | { kind: "hidden" }
  /** Before the minimum time, or after a rejected vote: real seconds left. */
  | { kind: "tooEarly" | "cooldown"; seconds: number }
  /** `opensVote`: the team has two or more humans, so it asks them (L-6). */
  | { kind: "ready"; opensVote: boolean }
  /** The team's vote: who said yes, whether I did, the real seconds left. */
  | { kind: "vote"; yes: number[]; mine: boolean; seconds: number };

export function concession(
  seen: TeamView,
  playerId: number,
  params: Params,
  multiplier: number,
): Concession {
  const me = seen.players.find((p) => p.id === playerId);
  if (me === undefined || me.bot || seen.result !== null) {
    return { kind: "hidden" };
  }
  const team = seen.teams[me.team];
  if (team === undefined || !isOwnTeam(team) || team.out !== null) {
    return { kind: "hidden" };
  }
  const { tickSeconds } = params.world;
  const { tick } = seen;
  if (team.vote !== null) {
    // The vote passes at the end of its deadline's tick.
    const ticks = voteDeadline(team.vote.openedTick, params) + 1 - tick;
    return {
      kind: "vote",
      yes: team.vote.yes,
      mine: team.vote.yes.includes(playerId),
      seconds: realSeconds(ticks * tickSeconds, multiplier),
    };
  }
  if (!mayConcede(tick, params)) {
    // The current tick counts whole (F2 record).
    const left = params.end.concedeAfterSeconds - (tick + 1) * tickSeconds;
    return { kind: "tooEarly", seconds: realSeconds(left, multiplier) };
  }
  const humans = seen.players.filter((p) => p.team === me.team && !p.bot);
  const opensVote = humans.length > 1;
  if (opensVote && team.voteRejectedTick !== null) {
    const left =
      params.end.concedeRetrySeconds -
      (tick - team.voteRejectedTick) * tickSeconds;
    if (left > 0) {
      return { kind: "cooldown", seconds: realSeconds(left, multiplier) };
    }
  }
  return { kind: "ready", opensVote };
}

/** "Azul", "Azul e Laranja", "Azul, Laranja e Time 2". */
export function teamList(teams: readonly number[]): string {
  const names = teams.map(teamName);
  const last = names.pop() ?? "";
  return names.length === 0 ? last : `${names.join(", ")} e ${last}`;
}

/** "Azul venceu" or "Empate entre Azul e Laranja" (D9). */
export function resultHeadline(
  result: Pick<WorldResult, "winner" | "teams">,
): string {
  return result.winner !== null
    ? `${teamName(result.winner)} venceu`
    : `Empate entre ${teamList(result.teams)}`;
}

/** The lobby's short form (S-4). */
export function lobbyResult(result: Pick<WorldResult, "winner">): string {
  return result.winner !== null
    ? `${teamName(result.winner)} venceu`
    : "Empate";
}

/** How a team left the match, as a phrase. */
export function outText(
  team: number,
  out: NonNullable<EndSummary["teams"][number]["out"]>,
): string {
  const name = teamName(team);
  if (out.how === "eliminated") return `${name} foi eliminado`;
  return out.bot ? `o bot de ${name} desistiu` : `${name} desistiu`;
}

/** How the world ended: the clock, or how the last teams left (D9). */
export function endHow(summary: EndSummary): string {
  const { result } = summary;
  if (result.how === "clock") return "o tempo acabou";
  const last = summary.teams.flatMap((t) =>
    t.out !== null && t.out.tick === result.tick
      ? [outText(t.team, t.out)]
      : [],
  );
  return last.join(" · ");
}
