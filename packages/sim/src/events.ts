// Events of the sim (ADR-0007; M2 encontro plan section 7, P9): what happened
// in a tick, as structured data, outside the state and its hash. step returns
// them; the same state and commands give the same list in the same order.
// Each event carries its audience (rule 3): the teams with a creep in it, and
// the teams that see its cell in the vision at the end of the tick. The
// replay reads the whole list; everyone else reads eventsFor(team).

import type { Cell } from "./map.ts";
import type { Dna } from "./params.ts";
import type { Creep, Stock, WorldState } from "./world.ts";

/** A creep as events name it: the dead leave the state, the chronicle needs them. */
export type CreepRef = { id: number; team: number; dna: Dna; name: string };

/** What an event says, without its place in the tick or its audience. */
export type EventBody = (
  | { type: "born"; creep: CreepRef }
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
      type: "reaction";
      encounter: number;
      creep: CreepRef;
      choice: "pay" | "refuse" | "fight" | "flee";
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
      type: "fleeAttempt";
      encounter: number;
      creep: CreepRef;
      escaped: boolean;
      dropped: Stock | null;
      spoil: number | null;
    }
  | {
      type: "fightEnded";
      encounter: number;
      winner: CreepRef;
      loser: CreepRef;
      rounds: number;
    }
  | { type: "died"; creep: CreepRef; by: CreepRef | null }
  | {
      type: "looted";
      by: CreepRef;
      from: CreepRef;
      taken: Stock;
      spoil: number | null;
    }
  | { type: "pickedUp"; creep: CreepRef; spoil: number; taken: Stock }
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

export function creepRef(creep: Creep): CreepRef {
  return { id: creep.id, team: creep.team, dna: creep.dna, name: creep.name };
}

/** The creeps an event is about: their teams are always in its audience. */
function participants(event: EventBody): CreepRef[] {
  switch (event.type) {
    case "born":
    case "reaction":
    case "fleeAttempt":
    case "pickedUp":
      return [event.creep];
    case "encounter":
      return [event.aggressor, event.victim];
    case "paid":
      return [event.from, event.to];
    case "fightEnded":
      return [event.winner, event.loser];
    case "died":
      return event.by === null ? [event.creep] : [event.creep, event.by];
    case "looted":
      return [event.by, event.from];
  }
}

/**
 * Sets each event's audience (ADR-0007 rule 3), after the vision of the tick
 * is updated: the participants' teams and the teams with the event's cell in
 * sight, in team id order.
 */
export function setAudience(state: WorldState, events: SimEvent[]): void {
  const { width } = state.map;
  for (const event of events) {
    const cell = event.y * width + event.x;
    const involved = participants(event);
    const teams: number[] = [];
    for (const memory of state.memory) {
      const team = memory.team;
      if (
        memory.visible[cell] === 1 ||
        involved.some((creep) => creep.team === team)
      ) {
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
