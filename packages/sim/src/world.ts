// World state (plan section 3) and world creation. Arrays are ordered by id;
// ids come from one increasing counter and are never reused.

import type { Rule } from "./autopilot.ts";
import type { Player } from "./domination.ts";
import type { TeamEvent } from "./events.ts";
import type { UpgradeId } from "./economy.ts";
import { presetRules } from "./presets.ts";
import { generateMap, type Cell, type GameMap } from "./map.ts";
import { DNAS, type Dna, type Params, type Resource } from "./params.ts";
import type { Order } from "./orders.ts";
import type { PathCache } from "./pathfinding.ts";
import type { RngState } from "./rng.ts";
import { createStats, type Activity, type Stats, type Trip } from "./stats.ts";
import { createMemory, updateVision, type TeamMemory } from "./vision.ts";
import { nameAt } from "./names.ts";

/**
 * Bump when a rule or state change makes old snapshots or replays invalid
 * (ADR-0004): the server persists worlds since F6 and refuses to recover one
 * of another version. 2: gather keeps its deposit and waits for regeneration.
 * 3: fog of war, vision and team memory (M1.5 fog). 4: the explore target
 * ties go to the most cells never seen in sight (fog F5 checkpoint). 5: gather
 * picks the deposit by travel time and waits at a dry one only when quicker
 * (fog F6, E1), and each resource has its own gather pace (E2). 6: creeps
 * have a name from the birth counter, HP that regenerates, and can die; step
 * returns events (M2 encontro F1). 7: encounters, fights, flight, spoils
 * and the encounter vocabulary (M2 encontro F2). 8: the deposit reached at
 * the same cost goes to the first cell in the team's frame, not the lower id
 * (M2 encontro F3). 9: the raider preset approaches targets carrying at least
 * 10, not 1 (M2 encontro F6, plan C11). 10: the battle replaces the roll: an
 * attack or a refused extortion opens a battle stub, its participants lock,
 * the junction host's result commands end it; no dialogue flee (M2 junction
 * F2). 11: the wanderers, a side that is not a team (M2 junction F6). 12:
 * the R vocabulary: follow, help, drop, the road builder with its own target,
 * the hostile intent and the bot's difficulty (M2 R F2). 13: the params hold
 * the battle pause times, so a stored world of 12 has not enough params (M2 R
 * F5). 14: the world's end (concede, elimination, the clock, the result),
 * first blood, the match's counters and main events (M2 E-min F1). 15: no
 * concession before end.concedeAfterSeconds, and a team's humans vote on it
 * (M2 E-min F2).
 */
export const SIM_VERSION = 15;

export type Stock = Record<Resource, number>;

/** Team ids match their index in WorldState.teams. */
export type Team = {
  id: number;
  core: Cell;
  stock: Stock;
  /** Upgrades bought (spec I-3). */
  upgrades: Record<UpgradeId, boolean>;
  /** The creep the core is producing; one at a time, no queue. */
  production: Production | null;
  /**
   * DNA to produce again whenever the core is free ("repeat", plan P5). It
   * waits, armed, while the stock or the population cap does not allow it.
   */
  repeat: Dna | null;
  /**
   * How and when the team left the match, or null while it is in it (E-min
   * plan P2). A team out never comes back.
   */
  out: TeamOut | null;
  /**
   * The open concession vote of a team with two or more humans, or null
   * (E-min plan P14). Replaced whole, never mutated: the delta compares it by
   * reference.
   */
  vote: ConcedeVote | null;
  /** The tick its last rejected vote closed on, for the retry wait. */
  voteRejectedTick: number | null;
};

export type ConcedeVote = {
  openedTick: number;
  /** The humans who said yes, by id. A "no" ends the vote, so none is kept. */
  yes: number[];
};

export type TeamOut = {
  tick: number;
  how: "eliminated" | "conceded";
  /** A bot player conceded. */
  bot: boolean;
};

/** How the world ended (E-min spec D5). */
export type WorldResult = {
  /** The end tick. */
  tick: number;
  how: "lastTeam" | "noTeam" | "clock";
  /** The winning team, when how is lastTeam. */
  winner: number | null;
  /** The winner, or the teams of the draw, by id. */
  teams: number[];
};

export type Production = { dna: Dna; remainingSeconds: number };

export type Creep = {
  id: number;
  team: number;
  dna: Dna;
  /** Given at birth from state.births (spec D1, plan P5); never changes. */
  name: string;
  /** Hit points in thousandths (plan P1): 300 HP is 300_000. */
  hp: number;
  /** Id of the Encounter the creep is in, or null (plan P2). */
  engagement: number | null;
  /**
   * Id of the Battle the creep is locked in, or null (junction plan P3):
   * while in one it does not move, work, regenerate or take orders (O-5).
   */
  battle: number | null;
  /**
   * After paying an extortion (spec D9): immune to approaches of `team` until
   * `untilTick`, entering its own core zone, or approaching someone itself.
   */
  safeConduct: SafeConduct | null;
  /** Aggressors that cannot extort this creep again yet (D9), by creep id. */
  extortBlocks: ExtortBlock[];
  /** What the creep carries. Any amount above 0 counts as loaded. */
  cargo: Stock;
  /** What the creep is doing now. */
  order: Order;
  /** Points gathered toward the next cell (CELL_COST enters it). */
  movePoints: number;
  /** Cached route; see pathTo. */
  path: PathCache | null;
  /** Autopilot rules, in priority order (spec P-1). */
  rules: Rule[];
  /** Id of the player dominating the creep, or null when it is free. */
  dominatedBy: number | null;
  /** What it did in the last tick (stats). */
  activity: Activity;
  /** The trip under way (stats), or null at rest. */
  trip: Trip | null;
} & Cell;

export type SafeConduct = { team: number; untilTick: number };
export type ExtortBlock = { aggressor: number; untilTick: number };

/**
 * A reply of the player dominating the victim of an extortion (command
 * react): pay, or refuse and open the battle (junction spec D1).
 */
export type Reply = "pay" | "refuse";

/**
 * An extortion between two creeps (M2 encontro plan section 3, P2; junction
 * plan P3): the dialogue only. Paying closes it; refusing opens a battle. An
 * attack has no dialogue: it opens the battle at once. Its cell is the
 * victim's when it opened.
 */
export type Encounter = {
  id: number;
  aggressor: number;
  victim: number;
  intent: "extort";
  /** What the aggressor demands (D8). */
  demand: Stock;
  /** When the dominated victim's window ends (D6); null for a free one. */
  deadlineTick: number | null;
  /** The victim's player's answer, applied at the encounters stage. */
  reply: Reply | null;
} & Cell;

/**
 * A side of a battle as the world knows it: a team, or the wanderers (at
 * most one such side per battle, junction plan section 9).
 */
export type BattleSide = { kind: "team"; team: number } | { kind: "wanderers" };

/** The team of a battle side, or null for the wanderers'. */
export function sideTeam(side: BattleSide): number | null {
  return side.kind === "team" ? side.team : null;
}

/**
 * What a wanderer is doing (junction spec W-2): roaming to a cell of the
 * band, approaching a team's creep to attack it (or a participant, to join
 * its battle), or standing.
 */
export type WandererOrder =
  | { type: "stop" }
  | ({ type: "roam" } & Cell)
  | { type: "approach"; targetId: number };

/**
 * A wanderer (junction spec D14, plan P4): a hostile circle of no team, in
 * its own array so no per-team path has to tell it apart. Ids come from the
 * same counter as everything else; its name from the same births.
 */
export type Wanderer = {
  id: number;
  dna: "circle";
  name: string;
  /** Hit points in thousandths, like a creep's. */
  hp: number;
  /** What it looted; it carries it until it dies (W-3). */
  cargo: Stock;
  /** Id of the Battle it is locked in, or null. */
  battle: number | null;
  order: WandererOrder;
  movePoints: number;
  /** Cached route on the real map (a wanderer knows it all). */
  path: PathCache | null;
  /**
   * Creeps it leaves alone until `untilTick`: they were in a battle with it
   * (W-7). By creep id.
   */
  spared: { creep: number; untilTick: number }[];
} & Cell;

/** Whatever a battle locks: a team's creep or a wanderer. */
export type Fighter = Creep | Wanderer;

export function isWanderer(fighter: Fighter): fighter is Wanderer {
  return !("team" in fighter);
}

/**
 * How a participant enters the battle (junction spec D2, D10): with its DNA's
 * preset, or with the carrier gambits when its reaction rule said flee.
 */
export type Stance = "fight" | "flee";

/** A creep in a battle, by creep id: its battle side (index into `sides`). */
export type BattleParticipant = { id: number; side: number; stance: Stance };

/** The world cells of a battle's bubble (junction spec D5). */
export type BattleWindow = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * A battle as the world keeps it (junction plan P3, ADR-0010): the stub. The
 * fight itself runs in the junction host; the world only knows where, who,
 * and gets back the results (battleExit, battleEnd). Its cell is the
 * victim's when it opened.
 */
export type Battle = {
  id: number;
  window: BattleWindow;
  /** Battle side index → who; the side of a participant is its index. */
  sides: BattleSide[];
  /** The locked creeps, by id. */
  participants: BattleParticipant[];
  openedTick: number;
  /** Participants that ever entered: the opening plus the joins (P7). */
  entered: number;
} & Cell;

/** A pile of resources on a cell that any creep can pick up (spec D11). */
export type Spoil = { id: number; cargo: Stock } & Cell;

export type Deposit = { id: number; kind: Resource; amount: number } & Cell;

/** A road segment under construction, already paid for by `team`. */
export type RoadJob = {
  id: number;
  team: number;
  /** Build time still missing; the segment is done at 0. */
  remainingSeconds: number;
} & Cell;

export type WorldState = {
  simVersion: number;
  /** Seed the world was created with. */
  seed: number;
  /** Seed that produced the map (seed, or seed + n after retries). */
  mapSeed: number;
  /** Part of the state, so a snapshot is self-contained and hashed with it. */
  params: Params;
  tick: number;
  rng: RngState;
  map: GameMap;
  teams: Team[];
  /** Players who joined, by id (system command join). */
  players: Player[];
  creeps: Creep[];
  deposits: Deposit[];
  /** Segments under construction, by id. */
  roadJobs: RoadJob[];
  /** Open encounters (extortion dialogues), by id (plan P2). */
  encounters: Encounter[];
  /** Open battles, the world's stubs, by id (junction plan P3). */
  battles: Battle[];
  /** Spoils on the map, by id; one per cell at most (D11). */
  spoils: Spoil[];
  /** The wanderers alive, by id (junction plan section 9). */
  wanderers: Wanderer[];
  /**
   * The tick from which the next wanderer may be born (D14): it is, as
   * soon as fewer than the cap are alive.
   */
  nextWandererTick: number;
  /** What each team has seen and remembers, by team id (fog plan N1). */
  memory: TeamMemory[];
  nextId: number;
  /** Creeps born so far, the initial ones included: the next name (plan P5). */
  births: number;
  /** Accumulators behind the metrics (spec section 7). */
  stats: Stats;
  /** The end, once it happened; the world is then frozen (E-min plan P8). */
  result: WorldResult | null;
  /**
   * The match's main events so far, best first, at most
   * params.end.highlights of them (E-min plan P6).
   */
  highlights: TeamEvent[];
};

export function createWorld(seed: number, params: Params): WorldState {
  const { layout, rng, mapSeed } = generateMap(seed, params);
  let nextId = 1;
  let births = 0;

  const deposits: Deposit[] = layout.deposits.map((site) => ({
    id: nextId++,
    kind: site.kind,
    x: site.x,
    y: site.y,
    amount: params.deposits[site.kind].amount,
  }));

  const teams: Team[] = layout.cores.map((core, id) => ({
    id,
    core: { x: core.x, y: core.y },
    stock: {
      materia: params.teams.initialStock.materia,
      cristal: params.teams.initialStock.cristal,
    },
    upgrades: { capacity: false },
    production: null,
    repeat: null,
    out: null,
    vote: null,
    voteRejectedTick: null,
  }));

  const creeps: Creep[] = [];
  for (const team of teams) {
    for (const dna of DNAS) {
      for (let i = 0; i < params.population.initial[dna]; i++) {
        creeps.push(newCreep(nextId++, births++, team, dna, params));
      }
    }
  }

  const state: WorldState = {
    simVersion: SIM_VERSION,
    seed,
    mapSeed,
    params,
    tick: 0,
    rng,
    map: layout.map,
    teams,
    players: [],
    creeps,
    deposits,
    roadJobs: [],
    encounters: [],
    battles: [],
    spoils: [],
    wanderers: [],
    nextWandererTick: params.wanderers.firstSeconds / params.world.tickSeconds,
    memory: createMemory(teams, layout.map),
    nextId,
    births,
    stats: createStats(teams, deposits),
    result: null,
    highlights: [],
  };
  // The vision of tick 0 (fog plan N10).
  updateVision(state);
  return state;
}

/**
 * A creep standing stopped and empty on its team's core, with full HP and the
 * materia collector preset of its DNA (F4 decision, spec section 5; the
 * help rule since R D11). `birth` is its rank
 * in the world's births, which names it.
 */
export function newCreep(
  id: number,
  birth: number,
  team: Team,
  dna: Dna,
  params: Params,
): Creep {
  return {
    id,
    team: team.id,
    dna,
    name: nameAt(birth),
    hp: maxHp(params, dna),
    engagement: null,
    battle: null,
    safeConduct: null,
    extortBlocks: [],
    ...team.core,
    cargo: { materia: 0, cristal: 0 },
    order: { type: "stop" },
    movePoints: 0,
    path: null,
    rules: presetRules("materiaCollector", dna),
    dominatedBy: null,
    activity: "idle",
    trip: null,
  };
}

/** A creep's full HP, in thousandths (plan P1). */
export function maxHp(params: Params, dna: Dna): number {
  return params.hp.dna[dna].max * 1000;
}

/**
 * Spawns a creep of `dna` on the team's core (production), with the next id
 * and the next name. Returns it, already in state.creeps.
 */
export function spawnCreep(state: WorldState, team: Team, dna: Dna): Creep {
  const creep = newCreep(
    state.nextId++,
    state.births++,
    team,
    dna,
    state.params,
  );
  state.creeps.push(creep);
  return creep;
}
