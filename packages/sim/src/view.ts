// What a team sees of the world (M1.5 rede plan section 3, ADR-0006 rule 1):
// the one source both the network stream and the team's bot read. With fog of
// war (M1.5 fog plan section 4) it is filtered: the team's own entities whole,
// other teams' creeps only while in sight and only with the fields of spec
// D7, and everything else from the team's memory.

import type { Player } from "./domination.ts";
import type { Cell } from "./map.ts";
import type { Creep, Deposit, RoadJob, Team, WorldState } from "./world.ts";

/** A creep as its team sees it: no cached path, move points or trip stats. */
export type CreepView = Omit<Creep, "path" | "movePoints" | "trip">;

/** Another team's creep in sight (spec D7): no order, rules or domination. */
export type ForeignCreepView = Pick<
  Creep,
  "id" | "team" | "dna" | "name" | "x" | "y" | "cargo"
>;

/** Another team: its id and, once seen, where its core is (spec D7). */
export type ForeignTeam = { id: number; core: Cell | null };

/** Another team's player (spec D8): who plays, not when they dominated. */
export type ForeignPlayer = Omit<Player, "lastDominateTick">;

export type TeamView = {
  tick: number;
  /** The team whose view this is; -1 for fullView. */
  team: number;
  /** The team itself whole, the others as ForeignTeam; by id. */
  teams: (Team | ForeignTeam)[];
  /** The team's creeps and the other teams' creeps in sight, by id. */
  creeps: (CreepView | ForeignCreepView)[];
  /** The deposits the team remembers, with the last amount seen (V-3). */
  deposits: Deposit[];
  /** Cell indices (y * width + x) with a road the team knows, increasing. */
  roads: number[];
  /** The team's own road jobs and the ones it remembers, by id. */
  roadJobs: RoadJob[];
  players: (Player | ForeignPlayer)[];
  /** Per cell: -1 never seen, else its Terrain (plan N6). */
  known: number[];
  /** Cell indices in sight at the end of the tick, increasing. */
  visible: number[];
};

/** Whether the view has the creep whole: the team's own, or any in fullView. */
export function isOwnCreep(
  creep: CreepView | ForeignCreepView,
): creep is CreepView {
  return "rules" in creep;
}

/** Whether the view has the team whole: its own, or any in fullView. */
export function isOwnTeam(team: Team | ForeignTeam): team is Team {
  return "stock" in team;
}

/** Whether the view has the player whole: the team's own, or any in fullView. */
export function isOwnPlayer(player: Player | ForeignPlayer): player is Player {
  return "lastDominateTick" in player;
}

/** The viewing team's own entry of `seen.teams`. */
export function ownTeam(seen: TeamView): Team {
  const team = seen.teams[seen.team];
  if (team === undefined || !isOwnTeam(team)) {
    throw new Error(`view of team ${seen.team} has no own team`);
  }
  return team;
}

/**
 * The team's view of `state`. A shallow copy: the view and its entities are
 * new objects, but nested objects (stock, cargo, order, rules…) are the
 * state's own. step mutates the state in place, so whoever keeps a view past
 * the next tick must copy what it needs (or serialize it) first.
 */
export function view(state: WorldState, team: number): TeamView {
  const memory = state.memory[team];
  if (memory === undefined) throw new Error(`no team ${team}`);
  const { visible, explored } = memory;
  const width = state.map.width;
  const inSight = (cell: Cell) => visible[cell.y * width + cell.x] === 1;

  const creeps: (CreepView | ForeignCreepView)[] = [];
  for (const creep of state.creeps) {
    if (creep.team === team) creeps.push(creepView(creep));
    else if (inSight(creep)) creeps.push(foreignCreepView(creep));
  }

  const roadJobs: RoadJob[] = [];
  for (const job of state.roadJobs) {
    if (job.team === team) roadJobs.push({ ...job });
  }
  for (const job of memory.roadJobs) roadJobs.push({ ...job });
  roadJobs.sort((a, b) => a.id - b.id);

  const known = new Array<number>(explored.length);
  const roads: number[] = [];
  const seen: number[] = [];
  for (let i = 0; i < explored.length; i++) {
    known[i] = explored[i] === 1 ? memory.terrain[i]! : -1;
    if (memory.road[i] === 1) roads.push(i);
    if (visible[i] === 1) seen.push(i);
  }

  return {
    tick: state.tick,
    team,
    teams: state.teams.map((t) => {
      if (t.id === team) return { ...t };
      const core = memory.cores.find((c) => c.team === t.id);
      return {
        id: t.id,
        core: core === undefined ? null : { x: core.x, y: core.y },
      };
    }),
    creeps,
    deposits: memory.deposits.map((d) => ({ ...d })),
    roads,
    roadJobs,
    players: state.players.map((p) =>
      p.team === team ? { ...p } : { id: p.id, team: p.team, bot: p.bot },
    ),
    known,
    visible: seen,
  };
}

/**
 * The whole world in the view's shape (plan N7), with no fog: what the replay
 * shows. `team` is -1 and every entity is whole.
 */
export function fullView(state: WorldState): TeamView {
  const { map } = state;
  const roads: number[] = [];
  for (let i = 0; i < map.road.length; i++)
    if (map.road[i] === 1) roads.push(i);
  return {
    tick: state.tick,
    team: -1,
    teams: state.teams.map((t) => ({ ...t })),
    creeps: state.creeps.map(creepView),
    deposits: state.deposits.map((d) => ({ ...d })),
    roads,
    roadJobs: state.roadJobs.map((j) => ({ ...j })),
    players: state.players.map((p) => ({ ...p })),
    known: [...map.terrain],
    visible: map.terrain.map((_, i) => i),
  };
}

function creepView(creep: Creep): CreepView {
  return {
    id: creep.id,
    team: creep.team,
    dna: creep.dna,
    name: creep.name,
    hp: creep.hp,
    engagement: creep.engagement,
    x: creep.x,
    y: creep.y,
    cargo: creep.cargo,
    order: creep.order,
    rules: creep.rules,
    dominatedBy: creep.dominatedBy,
    activity: creep.activity,
  };
}

function foreignCreepView(creep: Creep): ForeignCreepView {
  return {
    id: creep.id,
    team: creep.team,
    dna: creep.dna,
    name: creep.name,
    x: creep.x,
    y: creep.y,
    cargo: creep.cargo,
  };
}
