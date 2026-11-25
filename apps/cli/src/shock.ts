// The recovery scenario (M2 R spec §7, plan §3, P12): at a real minute of a
// bot run, the harness kills some of a team's creeps and the pace measures
// how long the team takes to be back to its count. It is a mutation of the
// world from outside the commands, so a shocked run has no replay and
// `geo verify` refuses it.

import { dropSpoil, kill, type Params, type WorldState } from "@geometrix/sim";

/** `--shock <team>:<count>@<real minute>`. */
export type Shock = { team: number; count: number; minute: number };

export class ShockError extends Error {}

/** `0:4@30` → team 0 loses 4 creeps at real minute 30. */
export function parseShock(raw: string, teams: number): Shock {
  const match = /^(\d+):(\d+)@(\d+)$/.exec(raw);
  if (match === null) {
    throw new ShockError(`--shock must look like team:count@minute: ${raw}`);
  }
  const [team, count, minute] = match.slice(1).map(Number) as [
    number,
    number,
    number,
  ];
  if (team >= teams) {
    throw new ShockError(`--shock: no team ${team} (teams 0-${teams - 1})`);
  }
  if (count < 1) throw new ShockError(`--shock: count must be >= 1: ${raw}`);
  return { team, count, minute };
}

/** The tick the shock lands on: its real minute at ×N, in whole ticks. */
export function shockTick(
  shock: Shock,
  params: Params,
  multiplier: number,
): number {
  return Math.floor(
    (shock.minute * 60 * multiplier) / params.world.tickSeconds,
  );
}

/** The team's creeps in the world, in a battle or not. */
export const teamCreeps = (state: WorldState, team: number) =>
  state.creeps.reduce((n, c) => n + (c.team === team ? 1 : 0), 0);

/**
 * Kills up to `count` of the team's free creeps (outside an encounter or a
 * battle), the highest HP first, ties by the lower id, by slice A's death:
 * the creep leaves the world, and with no killer its whole load becomes a
 * spoil on its cell. Returns the ids killed.
 */
export function applyShock(state: WorldState, shock: Shock): number[] {
  const victims = state.creeps
    .filter(
      (c) =>
        c.team === shock.team && c.engagement === null && c.battle === null,
    )
    .sort((a, b) => b.hp - a.hp || a.id - b.id)
    .slice(0, shock.count);
  for (const creep of victims) {
    if (creep.cargo.materia + creep.cargo.cristal > 0) {
      dropSpoil(state, creep, creep.cargo);
    }
    kill(state, creep);
  }
  return victims.map((c) => c.id);
}
