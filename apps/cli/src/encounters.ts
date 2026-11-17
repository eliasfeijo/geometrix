// Encounter metrics of a run (M2 encontro spec §7, plan section 10, P6):
// counted in the CLI from the events step returns, with the state at hand
// for what the events do not say (the terrain a creep fled on, whether the
// encounter was in the victim's core zone, what a dead creep left on the
// ground). Nothing here goes into the state or its hash.

import {
  DNAS,
  inCoreZone,
  Terrain,
  type Dna,
  type SimEvent,
  type Stock,
  type WorldState,
} from "@geometrix/sim";

export const INTENTS = ["attack", "extort"] as const;
export type Intent = (typeof INTENTS)[number];

/** How an encounter ended; "open" when the run ended first. */
export const OUTCOMES = [
  "paid",
  "escapedDialogue",
  "escapedFight",
  "victimDied",
  "aggressorDied",
  "open",
] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const REACTIONS = ["pay", "refuse", "fight", "flee"] as const;
export type Reaction = (typeof REACTIONS)[number];

export const DECIDERS = ["rule", "player", "default"] as const;
export type Decider = (typeof DECIDERS)[number];

/** Where a creep tried to flee: a road cell counts as road whatever is under it. */
export const FLEE_GROUNDS = ["road", "jungle", "crossing", "river"] as const;
export type FleeGround = (typeof FLEE_GROUNDS)[number];

export type Tries = { tries: number; escaped: number };

export type TeamEncounters = {
  team: number;
  /** Encounters opened with a creep of the team as aggressor, by intent. */
  asAggressor: Record<Intent, number>;
  /** Encounters opened with a creep of the team as victim, by intent. */
  asVictim: Record<Intent, number>;
  /** Of those as victim, how many opened in the team's own core zone (D21). */
  victimInOwnCoreZone: number;
  outcomesAsAggressor: Record<Outcome, number>;
  outcomesAsVictim: Record<Outcome, number>;
  /** The victims' reaction in the dialogue, by choice and by who decided. */
  reactions: Record<Reaction, number>;
  reactionsBy: Record<Decider, number>;
  /** Tries to flee (dialogue and fight), by DNA and by ground. */
  fleeByDna: Record<Dna, Tries>;
  fleeByGround: Record<FleeGround, Tries>;
  deaths: Record<Dna, number>;
  kills: number;
  /** What changed hands: extortion, loot, spoils. */
  extortionPaid: Stock;
  extortionReceived: Stock;
  lootLost: Stock;
  lootTaken: Stock;
  /** Dropped into spoils by the team's creeps, fleeing and dying. */
  droppedFleeing: Stock;
  droppedDying: Stock;
  pickedUp: Stock;
};

/** Per team, cumulative from tick 0: the timeline of the report. */
export type EncounterMark = {
  tick: number;
  teams: { asAggressor: number; asVictim: number; deaths: number }[];
};

export type EncounterTally = {
  teams: TeamEncounters[];
  spoils: {
    /** Piles created (a drop on an existing pile adds to it). */
    created: number;
    pickups: number;
    /** On the map at the end. */
    left: number;
    leftCargo: Stock;
  };
  timeline: EncounterMark[];
};

const zeroStock = (): Stock => ({ materia: 0, cristal: 0 });
const countBy = <K extends string>(keys: readonly K[]): Record<K, number> =>
  Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
const triesBy = <K extends string>(keys: readonly K[]): Record<K, Tries> =>
  Object.fromEntries(keys.map((k) => [k, { tries: 0, escaped: 0 }])) as Record<
    K,
    Tries
  >;
const add = (into: Stock, amount: Stock) => {
  into.materia += amount.materia;
  into.cristal += amount.cristal;
};

function teamEncounters(team: number): TeamEncounters {
  return {
    team,
    asAggressor: countBy(INTENTS),
    asVictim: countBy(INTENTS),
    victimInOwnCoreZone: 0,
    outcomesAsAggressor: countBy(OUTCOMES),
    outcomesAsVictim: countBy(OUTCOMES),
    reactions: countBy(REACTIONS),
    reactionsBy: countBy(DECIDERS),
    fleeByDna: triesBy(DNAS),
    fleeByGround: triesBy(FLEE_GROUNDS),
    deaths: countBy(DNAS),
    kills: 0,
    extortionPaid: zeroStock(),
    extortionReceived: zeroStock(),
    lootLost: zeroStock(),
    lootTaken: zeroStock(),
    droppedFleeing: zeroStock(),
    droppedDying: zeroStock(),
    pickedUp: zeroStock(),
  };
}

type Open = { aggressorTeam: number; victimTeam: number; fighting: boolean };

/** Counts a run's encounters as it goes; `tally` is the result. */
export class EncounterTracker {
  readonly tally: EncounterTally;
  /** Encounters still open, by id. */
  private readonly open = new Map<number, Open>();
  /** Cargo of the engaged creeps at the end of the last tick, by id. */
  private readonly engagedCargo = new Map<number, Stock>();
  /** Spoil ids seen so far, to count the new piles. */
  private readonly spoilIds = new Set<number>();

  constructor(teams: number) {
    this.tally = {
      teams: Array.from({ length: teams }, (_, t) => teamEncounters(t)),
      spoils: { created: 0, pickups: 0, left: 0, leftCargo: zeroStock() },
      timeline: [],
    };
  }

  /** The tick's events, with the state after the tick. */
  record(state: WorldState, events: readonly SimEvent[]): void {
    const teams = this.tally.teams;
    for (const event of events) {
      switch (event.type) {
        case "encounter": {
          const aggressor = teams[event.aggressor.team]!;
          const victim = teams[event.victim.team]!;
          aggressor.asAggressor[event.intent] += 1;
          victim.asVictim[event.intent] += 1;
          if (inCoreZone(state, event.victim.team, event)) {
            victim.victimInOwnCoreZone += 1;
          }
          this.open.set(event.encounter, {
            aggressorTeam: event.aggressor.team,
            victimTeam: event.victim.team,
            fighting: false,
          });
          break;
        }
        case "reaction": {
          const open = this.open.get(event.encounter);
          if (open === undefined || open.fighting) break;
          // The victim's reaction in the dialogue; in the fight only tries
          // to flee emit one, and fleeAttempt counts those.
          if (event.creep.team !== open.victimTeam) break;
          const team = teams[event.creep.team]!;
          team.reactions[event.choice] += 1;
          team.reactionsBy[event.by] += 1;
          if (event.choice === "refuse" || event.choice === "fight") {
            open.fighting = true;
          }
          break;
        }
        case "paid":
          add(teams[event.from.team]!.extortionPaid, event.amount);
          add(teams[event.to.team]!.extortionReceived, event.amount);
          this.close(event.encounter, "paid");
          break;
        case "fleeAttempt": {
          const team = teams[event.creep.team]!;
          const ground = groundAt(state, event);
          for (const tries of [
            team.fleeByDna[event.creep.dna],
            team.fleeByGround[ground],
          ]) {
            tries.tries += 1;
            if (event.escaped) tries.escaped += 1;
          }
          if (event.dropped !== null) add(team.droppedFleeing, event.dropped);
          const open = this.open.get(event.encounter);
          if (event.escaped) {
            this.close(
              event.encounter,
              open?.fighting === false ? "escapedDialogue" : "escapedFight",
            );
          } else if (open !== undefined) {
            open.fighting = true;
          }
          break;
        }
        case "fightEnded": {
          const open = this.open.get(event.encounter);
          const victimDied = open?.victimTeam === event.loser.team;
          this.close(
            event.encounter,
            victimDied ? "victimDied" : "aggressorDied",
          );
          break;
        }
        case "died": {
          teams[event.creep.team]!.deaths[event.creep.dna] += 1;
          if (event.by !== null) teams[event.by.team]!.kills += 1;
          break;
        }
        case "looted": {
          add(teams[event.from.team]!.lootLost, event.taken);
          add(teams[event.by.team]!.lootTaken, event.taken);
          // The loser's cargo stood still in the fight: what the winner did
          // not take went to the spoil.
          const cargo = this.engagedCargo.get(event.from.id);
          if (cargo !== undefined) {
            add(teams[event.from.team]!.droppedDying, {
              materia: cargo.materia - event.taken.materia,
              cristal: cargo.cristal - event.taken.cristal,
            });
          }
          break;
        }
        case "pickedUp":
          add(teams[event.creep.team]!.pickedUp, event.taken);
          this.tally.spoils.pickups += 1;
          break;
        case "born":
          break;
      }
    }
    // An attack that caught a fleeing creep opened in the fight (F-4).
    for (const encounter of state.encounters) {
      const open = this.open.get(encounter.id);
      if (open !== undefined && encounter.stage === "fight") {
        open.fighting = true;
      }
    }
    for (const spoil of state.spoils) {
      if (!this.spoilIds.has(spoil.id)) {
        this.spoilIds.add(spoil.id);
        this.tally.spoils.created += 1;
      }
    }
    this.engagedCargo.clear();
    if (state.encounters.length === 0) return;
    for (const creep of state.creeps) {
      if (creep.engagement !== null) {
        this.engagedCargo.set(creep.id, { ...creep.cargo });
      }
    }
  }

  /** A timeline mark at the state's tick (call it when sampling). */
  mark(state: WorldState): void {
    this.tally.timeline.push({
      tick: state.tick,
      teams: this.tally.teams.map((t) => ({
        asAggressor: t.asAggressor.attack + t.asAggressor.extort,
        asVictim: t.asVictim.attack + t.asVictim.extort,
        deaths: t.deaths.square + t.deaths.triangle + t.deaths.circle,
      })),
    });
  }

  /** Closes the run: open encounters and the spoils left on the map. */
  finish(state: WorldState): EncounterTally {
    for (const id of [...this.open.keys()]) this.close(id, "open");
    const { spoils } = this.tally;
    spoils.left = state.spoils.length;
    spoils.leftCargo = zeroStock();
    for (const spoil of state.spoils) add(spoils.leftCargo, spoil.cargo);
    return this.tally;
  }

  private close(id: number, outcome: Outcome): void {
    const open = this.open.get(id);
    if (open === undefined) return;
    this.open.delete(id);
    this.tally.teams[open.aggressorTeam]!.outcomesAsAggressor[outcome] += 1;
    this.tally.teams[open.victimTeam]!.outcomesAsVictim[outcome] += 1;
  }
}

function groundAt(state: WorldState, cell: { x: number; y: number }) {
  const i = cell.y * state.map.width + cell.x;
  if (state.map.road[i] === 1) return "road";
  switch (state.map.terrain[i]) {
    case Terrain.crossing:
      return "crossing";
    case Terrain.river:
      return "river";
    default:
      return "jungle";
  }
}
