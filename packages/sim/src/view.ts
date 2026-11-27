// What a team sees of the world (M1.5 rede plan section 3, ADR-0006 rule 1):
// the one source both the network stream and the team's bot read. With fog of
// war (M1.5 fog plan section 4) it is filtered: the team's own entities whole,
// other teams' creeps only while in sight and only with the fields of spec
// D7 (and, since M2, its name, HP and whether it is in an encounter: M2
// encontro spec D18, or a battle: junction D16), and everything else from the
// team's memory.

import type { Player } from "./domination.ts";
import { endSummary, type EndSummary } from "./end.ts";
import type { Cell } from "./map.ts";
import type { Order } from "./orders.ts";
import type {
  Battle,
  Creep,
  Deposit,
  Encounter,
  RoadJob,
  Spoil,
  Team,
  Wanderer,
  WandererOrder,
  WorldResult,
  WorldState,
} from "./world.ts";

/** A creep's or a wanderer's hostile intent (R spec D25, HS-1). */
export type HostileView = {
  intent: "attack" | "extort";
  /** The target's id when the team sees it (HS-3), else null. */
  target: number | null;
};

/**
 * A creep as its team sees it: no cached path, move points, trip stats or
 * extortion blocks (sim bookkeeping).
 */
export type CreepView = Omit<
  Creep,
  "path" | "movePoints" | "trip" | "extortBlocks"
> & { hostile: HostileView | null };

/**
 * Another team's creep in sight (spec D7, M2 encontro D18): no order, rules
 * or domination; its name, HP, encounter and battle, so a wounded one can be
 * chosen and a locked one is drawn as such.
 */
export type ForeignCreepView = Pick<
  Creep,
  | "id"
  | "team"
  | "dna"
  | "name"
  | "hp"
  | "engagement"
  | "battle"
  | "x"
  | "y"
  | "cargo"
> & { hostile: HostileView | null };

/**
 * An extortion with one of the team's creeps (M2 encontro plan section 8):
 * whole. In fullView, whole.
 */
export type EncounterView = Encounter;

/**
 * Other teams' extortion on a cell in sight (plan section 8): who, the
 * intent and where; no demand, window or reply.
 */
export type ForeignEncounterView = Pick<
  Encounter,
  "id" | "aggressor" | "victim" | "intent" | "x" | "y"
>;

/**
 * A battle as a team sees it (junction D16, K-3): where, its bubble, its
 * sides and who is locked in it. How each enters (its stance) and the fight
 * itself stay out.
 */
export type BattleStubView = Omit<Battle, "participants" | "entered"> & {
  participants: { id: number; side: number }[];
};

/**
 * A wanderer in sight (junction W-5): seen like another team's creep, with
 * no order or path.
 */
export type WandererView = Pick<
  Wanderer,
  "id" | "dna" | "name" | "hp" | "battle" | "x" | "y" | "cargo"
> & { hostile: HostileView | null };

/**
 * Another team: its id, once seen where its core is (spec D7), and whether it
 * left the match, which is public (E-min D8).
 */
export type ForeignTeam = {
  id: number;
  core: Cell | null;
  out: Team["out"];
};

/** Another team's player (spec D8): who plays, not when they dominated. */
/** Another team's player: not its cooldown, nor its bot's difficulty (P8). */
export type ForeignPlayer = Omit<Player, "lastDominateTick" | "difficulty">;

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
  /**
   * The encounters with a creep of the team, and the others on a cell in
   * sight, by id (plan section 8).
   */
  encounters: (EncounterView | ForeignEncounterView)[];
  /**
   * The battles with a creep of the team, and the others on a cell in
   * sight, by id (junction D16).
   */
  battles: BattleStubView[];
  /** The wanderers in sight, by id (junction W-5). */
  wanderers: WandererView[];
  /** The spoils the team remembers, with the last cargo seen, by id. */
  spoils: Spoil[];
  /** Per cell: -1 never seen, else its Terrain (plan N6). */
  known: number[];
  /** Cell indices in sight at the end of the tick, increasing. */
  visible: number[];
  /** The world's result once it ended, else null (E-min K-3). */
  result: WorldResult | null;
  /** The ended world's summary, the same for every team, else null. */
  summary: EndSummary | null;
};

/** Whether the view has the creep whole: the team's own, or any in fullView. */
export function isOwnCreep(
  creep: CreepView | ForeignCreepView,
): creep is CreepView {
  return "rules" in creep;
}

/** Whether the view has the encounter whole: the team's own, or any in fullView. */
export function isOwnEncounter(
  encounter: EncounterView | ForeignEncounterView,
): encounter is EncounterView {
  return "demand" in encounter;
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
  // The ids the team sees: its own creeps and the others in sight.
  const seenIds = new Set<number>();
  for (const creep of state.creeps) {
    if (creep.team === team || inSight(creep)) seenIds.add(creep.id);
  }
  for (const wanderer of state.wanderers) {
    if (inSight(wanderer)) seenIds.add(wanderer.id);
  }
  const sees = (id: number) => seenIds.has(id);
  for (const creep of state.creeps) {
    if (creep.team === team) creeps.push(creepView(creep, sees));
    else if (inSight(creep)) creeps.push(foreignCreepView(creep, sees));
  }

  const encounters: (EncounterView | ForeignEncounterView)[] = [];
  for (const encounter of state.encounters) {
    const own = state.creeps.some(
      (c) =>
        c.team === team &&
        (c.id === encounter.aggressor || c.id === encounter.victim),
    );
    if (own) encounters.push(encounterView(state, encounter, team));
    else if (inSight(encounter))
      encounters.push(foreignEncounterView(encounter));
  }

  const battles: BattleStubView[] = [];
  for (const battle of state.battles) {
    const own = battle.participants.some(
      (p) => state.creeps.find((c) => c.id === p.id)?.team === team,
    );
    if (own || inSight(battle)) battles.push(stubView(battle));
  }

  const wanderers = state.wanderers
    .filter(inSight)
    .map((wanderer) => wandererView(wanderer, sees));

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
        out: t.out,
      };
    }),
    creeps,
    deposits: memory.deposits.map((d) => ({ ...d })),
    roads,
    roadJobs,
    players: state.players.map((p) =>
      p.team === team ? { ...p } : { id: p.id, team: p.team, bot: p.bot },
    ),
    encounters,
    battles,
    wanderers,
    spoils: memory.spoils.map((s) => ({ ...s })),
    known,
    visible: seen,
    result: state.result,
    summary: endSummary(state),
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
    creeps: state.creeps.map((creep) => creepView(creep, seesAll)),
    deposits: state.deposits.map((d) => ({ ...d })),
    roads,
    roadJobs: state.roadJobs.map((j) => ({ ...j })),
    players: state.players.map((p) => ({ ...p })),
    encounters: state.encounters.map((e) => ({ ...e })),
    battles: state.battles.map(stubView),
    wanderers: state.wanderers.map((wanderer) =>
      wandererView(wanderer, seesAll),
    ),
    spoils: state.spoils.map((s) => ({ ...s, cargo: { ...s.cargo } })),
    known: [...map.terrain],
    visible: map.terrain.map((_, i) => i),
    result: state.result,
    summary: endSummary(state),
  };
}

/** The full view sees every id. */
const seesAll = (): boolean => true;

function creepView(creep: Creep, sees: (id: number) => boolean): CreepView {
  return {
    id: creep.id,
    team: creep.team,
    dna: creep.dna,
    name: creep.name,
    hp: creep.hp,
    engagement: creep.engagement,
    battle: creep.battle,
    safeConduct: creep.safeConduct,
    x: creep.x,
    y: creep.y,
    cargo: creep.cargo,
    order: creep.order,
    rules: creep.rules,
    dominatedBy: creep.dominatedBy,
    activity: creep.activity,
    hostile: hostileOf(creep.order, sees),
  };
}

function foreignCreepView(
  creep: Creep,
  sees: (id: number) => boolean,
): ForeignCreepView {
  return {
    id: creep.id,
    team: creep.team,
    dna: creep.dna,
    name: creep.name,
    hp: creep.hp,
    engagement: creep.engagement,
    battle: creep.battle,
    x: creep.x,
    y: creep.y,
    cargo: creep.cargo,
    hostile: hostileOf(creep.order, sees),
  };
}

/**
 * The creep's or wanderer's hostile intent (D25): its attack or extortion
 * approach while it chases. A wanderer's approach is an attack. The target's
 * id only when the team sees it, so a hidden one never leaks (HS-3).
 */
function hostileOf(
  order: Order | WandererOrder,
  sees: (id: number) => boolean,
): HostileView | null {
  if (order.type !== "approach") return null;
  const intent = "intent" in order ? order.intent : "attack";
  return { intent, target: sees(order.targetId) ? order.targetId : null };
}

/**
 * The team's extortion: whole, with the victim's pending reply hidden from
 * the aggressor's side.
 */
function encounterView(
  state: WorldState,
  encounter: Encounter,
  team: number,
): EncounterView {
  const aggressorSide =
    state.creeps.find((c) => c.id === encounter.aggressor)?.team === team;
  return { ...encounter, reply: aggressorSide ? null : encounter.reply };
}

function foreignEncounterView(encounter: Encounter): ForeignEncounterView {
  return {
    id: encounter.id,
    aggressor: encounter.aggressor,
    victim: encounter.victim,
    intent: encounter.intent,
    x: encounter.x,
    y: encounter.y,
  };
}

function wandererView(
  wanderer: Wanderer,
  sees: (id: number) => boolean,
): WandererView {
  return {
    id: wanderer.id,
    dna: wanderer.dna,
    name: wanderer.name,
    hp: wanderer.hp,
    battle: wanderer.battle,
    x: wanderer.x,
    y: wanderer.y,
    cargo: wanderer.cargo,
    hostile: hostileOf(wanderer.order, sees),
  };
}

function stubView(battle: Battle): BattleStubView {
  return {
    id: battle.id,
    window: battle.window,
    sides: battle.sides,
    participants: battle.participants.map((p) => ({ id: p.id, side: p.side })),
    openedTick: battle.openedTick,
    x: battle.x,
    y: battle.y,
  };
}
