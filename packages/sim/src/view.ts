// What a team sees of the world (M1.5 plan section 3, ADR-0006 rule 1): the
// one source both the network stream and the team's bot read. Without fog of
// war (spec D1) every team sees everything the M1 client got, minus the
// creep fields only the sim uses. The fog slice changes only this function.

import type { Player } from "./domination.ts";
import type { Creep, Deposit, RoadJob, Team, WorldState } from "./world.ts";

/** A creep as a team sees it: no cached path, move points or trip stats. */
export type CreepView = Omit<Creep, "path" | "movePoints" | "trip">;

export type TeamView = {
  tick: number;
  /** The team whose view this is. */
  team: number;
  teams: Team[];
  /** By id, as in the state. */
  creeps: CreepView[];
  deposits: Deposit[];
  /** Cell indices (y * width + x) with a road, increasing. */
  roads: number[];
  roadJobs: RoadJob[];
  players: Player[];
};

/**
 * The team's view of `state`. A shallow copy: the view and its entities are
 * new objects, but nested objects (stock, cargo, order, rules…) are the
 * state's own. step mutates the state in place, so whoever keeps a view past
 * the next tick must copy what it needs (or serialize it) first.
 */
export function view(state: WorldState, team: number): TeamView {
  const roads: number[] = [];
  const { road } = state.map;
  for (let i = 0; i < road.length; i++) if (road[i] === 1) roads.push(i);
  return {
    tick: state.tick,
    team,
    teams: state.teams.map((t) => ({ ...t })),
    creeps: state.creeps.map(creepView),
    deposits: state.deposits.map((d) => ({ ...d })),
    roads,
    roadJobs: state.roadJobs.map((j) => ({ ...j })),
    players: state.players.map((p) => ({ ...p })),
  };
}

function creepView(creep: Creep): CreepView {
  return {
    id: creep.id,
    team: creep.team,
    dna: creep.dna,
    x: creep.x,
    y: creep.y,
    cargo: creep.cargo,
    order: creep.order,
    rules: creep.rules,
    dominatedBy: creep.dominatedBy,
    activity: creep.activity,
  };
}
