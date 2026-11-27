// The end of the world (E-min spec, plan section 3): a team leaving the match,
// by concession or elimination, and the result. Teams in id order; nothing
// here assumes how many there are.

import { emit, type EventLog } from "./events.ts";
import type { Team, TeamOut, WorldState } from "./world.ts";

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
