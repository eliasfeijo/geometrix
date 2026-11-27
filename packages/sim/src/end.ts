// The end of the world (E-min spec, plan section 3): a team leaving the match,
// by concession or elimination, and the result. Teams in id order; nothing
// here assumes how many there are.

import { canAfford } from "./economy.ts";
import {
  emit,
  type EventLog,
  type SimEvent,
  type TeamEvent,
} from "./events.ts";
import type { Cell } from "./map.ts";
import type { Stock, Team, TeamOut, WorldResult, WorldState } from "./world.ts";

/**
 * Why a concession is refused (spec F-4, plan P3): the team already left, or
 * at most one team is still in the match, so the world ends on this tick.
 */
export type EndRefusal = "teamOut" | "worldEnded";

export function teamsInMatch(state: WorldState): Team[] {
  return state.teams.filter((team) => team.out === null);
}

export function concedeRefusal(
  state: WorldState,
  team: Team,
): EndRefusal | null {
  if (team.out !== null) return "teamOut";
  return teamsInMatch(state).length <= 1 ? "worldEnded" : null;
}

/**
 * The team leaves the match on this tick (spec L-2..L-4): its players release
 * their creeps, its armed repeat drops, its creeps and core stay as they are.
 * `bot`: a bot player conceded.
 */
export function leaveMatch(
  state: WorldState,
  log: EventLog,
  team: Team,
  how: TeamOut["how"],
  bot: boolean,
): void {
  team.out = { tick: state.tick, how, bot };
  for (const creep of state.creeps) {
    if (creep.team === team.id) creep.dominatedBy = null;
  }
  team.repeat = null;
  emit(log, { type: "teamOut", team: team.id, how, bot, ...team.core });
}

/**
 * No creep alive (a creep in a battle is), nothing in production and a stock
 * below one creep's cost: the team cannot come back (spec D2, L-1). An armed
 * repeat is not production, and spoils and loads do not count.
 */
function cannotComeBack(state: WorldState, team: Team): boolean {
  return (
    team.production === null &&
    !canAfford(team.stock, state.params.creep.cost) &&
    !state.creeps.some((creep) => creep.team === team.id)
  );
}

/** The result of the tick, or null while the world goes on (spec D5). */
function resultOf(state: WorldState): WorldResult | null {
  const { tick } = state;
  const { durationSeconds, tickSeconds } = state.params.world;
  const left = teamsInMatch(state).map((team) => team.id);
  if (left.length === 1) {
    return { tick, how: "lastTeam", winner: left[0]!, teams: left };
  }
  if (left.length === 0) {
    const together = state.teams.filter((team) => team.out!.tick === tick);
    return {
      tick,
      how: "noTeam",
      winner: null,
      teams: together.map((team) => team.id),
    };
  }
  if ((tick + 1) * tickSeconds < durationSeconds) return null;
  return { tick, how: "clock", winner: null, teams: left };
}

/** Where the end is told: the winner's core, the map's center in a draw. */
function endCell(state: WorldState, result: WorldResult): Cell {
  if (result.winner !== null) return { ...state.teams[result.winner]!.core };
  const { width, height } = state.map;
  return { x: Math.floor(width / 2), y: Math.floor(height / 2) };
}

/**
 * The end's stage of the tick (plan P1): eliminations, in team id order, then
 * the result. Setting it ends the world: this is its last tick.
 */
export function checkEnd(state: WorldState, log: EventLog): void {
  for (const team of teamsInMatch(state)) {
    if (cannotComeBack(state, team)) {
      leaveMatch(state, log, team, "eliminated", false);
    }
  }
  const result = resultOf(state);
  if (result === null) return;
  state.result = result;
  emit(log, {
    type: "worldEnded",
    result: { ...result, teams: [...result.teams] },
    ...endCell(state, result),
  });
}

type Candidate = Extract<
  TeamEvent,
  { type: "teamOut" | "died" | "battleEnded" }
>;

function isCandidate(event: TeamEvent): event is Candidate {
  if (event.type === "died") return event.firstBlood;
  return event.type === "teamOut" || event.type === "battleEnded";
}

const total = (stock: Stock) => stock.materia + stock.cristal;

/**
 * What ranks a main event, in order (plan P6): its kind, how many entered the
 * battle, and the load collected in it or left as spoils.
 */
function rank(event: TeamEvent): [number, number, number] {
  if (event.type === "teamOut") return [3, 0, 0];
  if (event.type !== "battleEnded") return [2, 0, 0];
  const loot = event.loot.reduce((sum, l) => sum + total(l.taken), 0);
  return [1, event.entered, loot + total(event.spoiled)];
}

/** Better first; between equals, the earlier. */
function compare(a: TeamEvent, b: TeamEvent): number {
  const [x, y] = [rank(a), rank(b)];
  return (
    y[0] - x[0] ||
    y[1] - x[1] ||
    y[2] - x[2] ||
    a.tick - b.tick ||
    a.index - b.index
  );
}

/**
 * Stage 8, with the stats: the tick's candidates (a team leaving, the first
 * blood, a battle ended) compete for the match's main events, of which the
 * best `end.highlights` stay (spec D10, plan P6). Copies without the
 * audience, so the state shares nothing with the events returned.
 */
export function recordHighlights(
  state: WorldState,
  events: readonly SimEvent[],
): void {
  const candidates: TeamEvent[] = [];
  for (const event of events) {
    if (!isCandidate(event)) continue;
    const copy = JSON.parse(JSON.stringify(event)) as Partial<SimEvent>;
    delete copy.teams;
    candidates.push(copy as TeamEvent);
  }
  if (candidates.length === 0) return;
  state.highlights = [...state.highlights, ...candidates]
    .sort(compare)
    .slice(0, state.params.end.highlights);
}

export type TeamSummary = {
  team: number;
  out: TeamOut | null;
  born: number;
  lost: number;
  battlesWon: number;
  battlesLost: number;
  materiaDelivered: number;
};

/** What the end screen and the harness report show of a match (spec D9). */
export type EndSummary = {
  result: WorldResult;
  /** World seconds, the end tick included. */
  durationSeconds: number;
  /** By team id. */
  teams: TeamSummary[];
  /** The main events, best first. */
  highlights: TeamEvent[];
};

/** The ended world's summary, or null while it goes on. Pure. */
export function endSummary(state: WorldState): EndSummary | null {
  const { result } = state;
  if (result === null) return null;
  return {
    result,
    durationSeconds: (result.tick + 1) * state.params.world.tickSeconds,
    teams: state.teams.map((team) => {
      const stats = state.stats.teams[team.id]!;
      return {
        team: team.id,
        out: team.out,
        born: stats.born,
        lost: stats.lost,
        battlesWon: stats.battlesWon,
        battlesLost: stats.battlesLost,
        materiaDelivered: stats.delivered.materia,
      };
    }),
    highlights: state.highlights,
  };
}
