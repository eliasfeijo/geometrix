// Encounter and battle metrics of a run (M2 encontro spec §7, plan section
// 10, P6; junction spec §7): counted in the CLI from the events step returns,
// with the state at hand for what the events do not say (whether the
// encounter was in the victim's core zone, what went into spoils). Nothing
// here goes into the state or its hash.

import {
  DNAS,
  inCoreZone,
  type Dna,
  type SimEvent,
  type Stock,
  type WorldState,
} from "@geometrix/sim";

export const INTENTS = ["attack", "extort"] as const;
export type Intent = (typeof INTENTS)[number];

/**
 * How an encounter ended: paid, or a battle opened (an attack at once, an
 * extortion refused); "open" when the run ended in the dialogue.
 */
export const OUTCOMES = ["paid", "battle", "open"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const REACTIONS = ["pay", "refuse"] as const;
export type Reaction = (typeof REACTIONS)[number];

export const DECIDERS = ["rule", "player", "default"] as const;
export type Decider = (typeof DECIDERS)[number];

/**
 * How a battle ended for a team with a side in it: its side won, another
 * won, the end by inactivity or with nobody left; "open" when the run ended
 * first (junction X-3, X-4).
 */
export const BATTLE_RESULTS = ["won", "lost", "idle", "empty", "open"] as const;
export type BattleResult = (typeof BATTLE_RESULTS)[number];

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
  /** The victims' reaction to an extortion, by choice and by who decided. */
  reactions: Record<Reaction, number>;
  reactionsBy: Record<Decider, number>;
  /** Battles the team had a side in, by result. */
  battles: Record<BattleResult, number>;
  /** Creeps of the team that joined a battle already open. */
  joins: number;
  /** Creeps of the team out by the arena's border, by DNA. */
  escapes: Record<Dna, number>;
  deaths: Record<Dna, number>;
  kills: number;
  /** What changed hands: extortion, the winners' loot, spoils picked up. */
  extortionPaid: Stock;
  extortionReceived: Stock;
  lootTaken: Stock;
  pickedUp: Stock;
};

/** Per team, cumulative from tick 0: the timeline of the report. */
export type EncounterMark = {
  tick: number;
  teams: { asAggressor: number; asVictim: number; deaths: number }[];
};

export type EncounterTally = {
  teams: TeamEncounters[];
  /** Battles opened, all teams. */
  battlesOpened: number;
  spoils: {
    /** Piles created (a drop on an existing pile adds to it). */
    created: number;
    pickups: number;
    /** Cargo that went into spoils. */
    dropped: Stock;
    /** On the map at the end. */
    left: number;
    leftCargo: Stock;
  };
  timeline: EncounterMark[];
};

const zeroStock = (): Stock => ({ materia: 0, cristal: 0 });
const countBy = <K extends string>(keys: readonly K[]): Record<K, number> =>
  Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
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
    battles: countBy(BATTLE_RESULTS),
    joins: 0,
    escapes: countBy(DNAS),
    deaths: countBy(DNAS),
    kills: 0,
    extortionPaid: zeroStock(),
    extortionReceived: zeroStock(),
    lootTaken: zeroStock(),
    pickedUp: zeroStock(),
  };
}

type Open = { aggressorTeam: number; victimTeam: number };

/** Counts a run's encounters and battles as it goes; `tally` is the result. */
export class EncounterTracker {
  readonly tally: EncounterTally;
  /** Encounters still open, by id. */
  private readonly open = new Map<number, Open>();
  /** Battles still open, by id: the team of each side. */
  private readonly battles = new Map<number, number[]>();
  /** Spoil ids seen so far, to count the new piles. */
  private readonly spoilIds = new Set<number>();
  /** Cargo in spoils at the end of the last tick. */
  private spoilCargo = zeroStock();

  constructor(teams: number) {
    this.tally = {
      teams: Array.from({ length: teams }, (_, t) => teamEncounters(t)),
      battlesOpened: 0,
      spoils: {
        created: 0,
        pickups: 0,
        dropped: zeroStock(),
        left: 0,
        leftCargo: zeroStock(),
      },
      timeline: [],
    };
  }

  /** The tick's events, with the state after the tick. */
  record(state: WorldState, events: readonly SimEvent[]): void {
    const teams = this.tally.teams;
    const picked = zeroStock();
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
          });
          break;
        }
        case "reaction": {
          const team = teams[event.creep.team]!;
          team.reactions[event.choice] += 1;
          team.reactionsBy[event.by] += 1;
          break;
        }
        case "paid":
          add(teams[event.from.team]!.extortionPaid, event.amount);
          add(teams[event.to.team]!.extortionReceived, event.amount);
          this.close(event.encounter, "paid");
          break;
        case "battleOpened":
          this.tally.battlesOpened += 1;
          this.close(event.encounter, "battle");
          this.battles.set(
            event.battle,
            event.sides.map((s) => s.team),
          );
          break;
        case "battleJoined": {
          teams[event.creep.team]!.joins += 1;
          const sides = this.battles.get(event.battle);
          if (sides !== undefined && event.side === sides.length) {
            sides.push(event.creep.team);
          }
          break;
        }
        case "battleLeft":
          if (event.reason === "edge") {
            teams[event.creep.team]!.escapes[event.creep.dna] += 1;
          }
          break;
        case "battleEnded": {
          this.battles.delete(event.battle);
          for (const [side, team] of event.sideTeams.entries()) {
            const result: BattleResult =
              event.reason !== "won"
                ? event.reason
                : event.winner?.side === side
                  ? "won"
                  : "lost";
            teams[team]!.battles[result] += 1;
          }
          for (const { creep, taken } of event.loot) {
            add(teams[creep.team]!.lootTaken, taken);
          }
          break;
        }
        case "died": {
          teams[event.creep.team]!.deaths[event.creep.dna] += 1;
          if (event.by !== null) teams[event.by.team]!.kills += 1;
          break;
        }
        case "pickedUp":
          add(teams[event.creep.team]!.pickedUp, event.taken);
          add(picked, event.taken);
          this.tally.spoils.pickups += 1;
          break;
        case "born":
          break;
      }
    }
    const cargo = zeroStock();
    for (const spoil of state.spoils) {
      add(cargo, spoil.cargo);
      if (!this.spoilIds.has(spoil.id)) {
        this.spoilIds.add(spoil.id);
        this.tally.spoils.created += 1;
      }
    }
    // What the spoils gained, plus what was picked up from them.
    add(this.tally.spoils.dropped, {
      materia: cargo.materia - this.spoilCargo.materia + picked.materia,
      cristal: cargo.cristal - this.spoilCargo.cristal + picked.cristal,
    });
    this.spoilCargo = cargo;
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

  /** Closes the run: open encounters and battles, the spoils on the map. */
  finish(state: WorldState): EncounterTally {
    for (const id of [...this.open.keys()]) this.close(id, "open");
    for (const sides of this.battles.values()) {
      for (const team of sides) this.tally.teams[team]!.battles.open += 1;
    }
    this.battles.clear();
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
