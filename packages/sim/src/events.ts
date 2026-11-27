// Events of the sim (ADR-0007; M2 encontro plan section 7, P9): what happened
// in a tick, as structured data, outside the state and its hash. step returns
// them; the same state and commands give the same list in the same order.
// Each event carries its audience (rule 3): the teams with a creep in it, and
// the teams that see its cell in the vision at the end of the tick. The
// replay reads the whole list; everyone else reads eventsFor(team).

import type { BattleCause, BattleEndReason } from "./battle.ts";
import type { Cell } from "./map.ts";
import type { Dna } from "./params.ts";
import {
  isWanderer,
  sideTeam,
  type Fighter,
  type Stock,
  type TeamOut,
  type WorldResult,
  type WorldState,
} from "./world.ts";

/**
 * A creep as events name it: the dead leave the state, the chronicle needs
 * them. A wanderer has no team (null, junction D14).
 */
export type CreepRef = {
  id: number;
  team: number | null;
  dna: Dna;
  name: string;
};

/** What an event says, without its place in the tick or its audience. */
export type EventBody = (
  | { type: "born"; creep: CreepRef }
  /** A wanderer was born on its cell (junction D15, W-1). */
  | { type: "wandererBorn"; wanderer: CreepRef }
  | {
      type: "encounter";
      encounter: number;
      aggressor: CreepRef;
      victim: CreepRef;
      intent: "attack" | "extort";
      demand: Stock | null;
      mutual: boolean;
    }
  | {
      /** The victim of an extortion answers (junction D1). */
      type: "reaction";
      encounter: number;
      creep: CreepRef;
      choice: "pay" | "refuse";
      by: "rule" | "player" | "default";
    }
  | {
      type: "paid";
      encounter: number;
      from: CreepRef;
      to: CreepRef;
      amount: Stock;
    }
  | {
      /**
       * A battle opened on its cell (junction D15, O-1, O-2), from the
       * declaration `encounter` (null for a wanderer's attack, which
       * declares nothing): each side's team (null for the wanderers) and
       * creeps.
       */
      type: "battleOpened";
      battle: number;
      encounter: number | null;
      cause: BattleCause;
      sides: { team: number | null; creeps: CreepRef[] }[];
    }
  | { type: "battleJoined"; battle: number; creep: CreepRef; side: number }
  | {
      /**
       * A participant back in the world alive before the end, by the border
       * (with the flee bonus), or at the end by inactivity (X-2, X-4); on the
       * cell it comes back on.
       */
      type: "battleLeft";
      battle: number;
      creep: CreepRef;
      reason: "edge" | "idle";
      hp: number;
      cargo: Stock;
    }
  | {
      /** The end (X-3, X-4): who won, what each winner looted, the spoils. */
      type: "battleEnded";
      battle: number;
      reason: BattleEndReason;
      winner: { side: number; team: number | null } | null;
      /** The team of each battle side, by side index; null the wanderers'. */
      sideTeams: (number | null)[];
      survivors: CreepRef[];
      loot: { creep: CreepRef; taken: Stock }[];
      spoils: number[];
      /** Participants that ever entered the battle (E-min plan P7). */
      entered: number;
      /** What the battle left as spoils on the map, both resources. */
      spoiled: Stock;
    }
  /**
   * A death; `battle` is the battle it happened in (junction X-1).
   * `firstBlood`: the match's first death of a team's creep (E-min D15).
   */
  | {
      type: "died";
      creep: CreepRef;
      by: CreepRef | null;
      battle: number;
      firstBlood: boolean;
    }
  /**
   * A team left the match, on its core's cell; `bot`: a bot player conceded.
   * Every team receives it (E-min D8).
   */
  | { type: "teamOut"; team: number; how: TeamOut["how"]; bot: boolean }
  /**
   * A team's concession vote opened, or closed (E-min plan P14), on its
   * core's cell. Only that team receives them.
   */
  | { type: "concedeVoteOpened"; team: number; deadlineTick: number }
  | {
      type: "concedeVoteClosed";
      team: number;
      outcome: "passed" | "rejected" | "dropped";
    }
  /**
   * The world ended (E-min D5), on the winner's core, the map's center in a
   * draw. Every team receives it.
   */
  | { type: "worldEnded"; result: WorldResult }
  | { type: "pickedUp"; creep: CreepRef; spoil: number; taken: Stock }
  /** A creep dropped its whole load as spoils on its cell (R spec D24). */
  | { type: "dropped"; creep: CreepRef; spoil: number; cargo: Stock }
) &
  Cell;

/** An event as a team receives it: no audience. */
export type TeamEvent = EventBody & {
  tick: number;
  /** Position in the tick's whole list, before any filter (ADR-0007 rule 2). */
  index: number;
};

/** An event as step returns it, with its audience, by team id. */
export type SimEvent = TeamEvent & { teams: number[] };

/** The events of the tick being stepped, in emission order. */
export type EventLog = { tick: number; events: SimEvent[] };

export function createEventLog(tick: number): EventLog {
  return { tick, events: [] };
}

/** Appends an event to the tick's list; its audience is set at the end of step. */
export function emit(log: EventLog, body: EventBody): void {
  log.events.push({
    ...body,
    tick: log.tick,
    index: log.events.length,
    teams: [],
  });
}

export function creepRef(fighter: Fighter): CreepRef {
  return {
    id: fighter.id,
    team: isWanderer(fighter) ? null : fighter.team,
    dna: fighter.dna,
    name: fighter.name,
  };
}

/**
 * The teams an event is about: always in its audience. A battle's events
 * reach every team with a side in it (junction K-2), `battleTeams` by battle
 * id.
 */
function involvedTeams(
  event: EventBody,
  battleTeams: ReadonlyMap<number, readonly (number | null)[]>,
): number[] {
  const teams = participants(event).map((creep) => creep.team);
  const battle = battleOf(event);
  const all =
    battle === null ? teams : [...teams, ...(battleTeams.get(battle) ?? [])];
  return all.filter((team) => team !== null);
}

/** The battle an event belongs to, if any. */
function battleOf(event: EventBody): number | null {
  switch (event.type) {
    case "battleOpened":
    case "battleJoined":
    case "battleLeft":
    case "battleEnded":
    case "died":
      return event.battle;
    default:
      return null;
  }
}

/** The creeps an event is about. */
function participants(event: EventBody): CreepRef[] {
  switch (event.type) {
    case "wandererBorn":
      return [event.wanderer];
    case "born":
    case "reaction":
    case "pickedUp":
    case "dropped":
    case "battleJoined":
    case "battleLeft":
      return [event.creep];
    case "encounter":
      return [event.aggressor, event.victim];
    case "paid":
      return [event.from, event.to];
    case "battleOpened":
      return event.sides.flatMap((s) => s.creeps);
    case "battleEnded":
      return event.survivors;
    case "died":
      return event.by === null ? [event.creep] : [event.creep, event.by];
    case "teamOut":
    case "concedeVoteOpened":
    case "concedeVoteClosed":
    case "worldEnded":
      return [];
  }
}

/**
 * Sets each event's audience (ADR-0007 rule 3), after the vision of the tick
 * is updated: the participants' teams (for a battle's events, the teams of
 * its sides) and the teams with the event's cell in sight, in team id order.
 * A team leaving the match and the world's end reach every team (E-min D8).
 */
export function setAudience(state: WorldState, events: SimEvent[]): void {
  const { width } = state.map;
  // The sides of the battles open, and of those that ended in the tick.
  const battleTeams = new Map<number, readonly (number | null)[]>(
    state.battles.map((b) => [b.id, b.sides.map(sideTeam)]),
  );
  for (const event of events) {
    if (event.type === "battleEnded") {
      battleTeams.set(event.battle, event.sideTeams);
    }
  }
  for (const event of events) {
    // A team's vote is its own business, whoever sees its core.
    if (
      event.type === "concedeVoteOpened" ||
      event.type === "concedeVoteClosed"
    ) {
      event.teams = [event.team];
      continue;
    }
    const cell = event.y * width + event.x;
    const involved = involvedTeams(event, battleTeams);
    const everyone = event.type === "teamOut" || event.type === "worldEnded";
    const teams: number[] = [];
    for (const memory of state.memory) {
      const team = memory.team;
      if (everyone || memory.visible[cell] === 1 || involved.includes(team)) {
        teams.push(team);
      }
    }
    event.teams = teams;
  }
}

/** The events `team` sees, in order, without their audience. */
export function eventsFor(
  events: readonly SimEvent[],
  team: number,
): TeamEvent[] {
  const seen: TeamEvent[] = [];
  for (const event of events) {
    if (!event.teams.includes(team)) continue;
    const copy: Partial<SimEvent> = { ...event };
    delete copy.teams;
    seen.push(copy as TeamEvent);
  }
  return seen;
}
