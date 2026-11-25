import { readFileSync } from "node:fs";
import {
  createWorld,
  DNAS,
  parseParams,
  raiderRules,
  type Rule,
  type Stock,
} from "@geometrix/sim";
import { createHost, stepJunction } from "@geometrix/junction";
import { describe, expect, test } from "vitest";
import {
  BATTLE_RESULTS,
  CAUSES,
  END_REASONS,
  EncounterTracker,
  FATES,
  LOADS,
  ROLES,
  OUTCOMES,
  REACTIONS,
  type EncounterTally,
} from "../src/encounters.ts";
import { defaultBattleParams } from "../src/harness.ts";

const params = parseParams(
  JSON.parse(
    readFileSync(
      // The sim tests' fixed params, so balancing does not change the world.
      new URL("../../../packages/sim/test/params.json", import.meta.url),
      "utf8",
    ),
  ),
);

/** The raider, attacking instead of extorting. */
const attackerRules = (): Rule[] =>
  raiderRules().map((rule) =>
    rule.then.type === "approach"
      ? { ...rule, then: { ...rule.then, intent: "attack" as const } }
      : rule,
  );

/**
 * A world without bots where a third of each team's creeps extort, a third
 * attack and a third collect materia: raiders fight raiders, collectors pay
 * or refuse. The battles run in the junction host.
 */
function violentWorld(seed: number, hours: number): EncounterTally {
  const state = createWorld(seed, params);
  state.creeps.forEach((creep, i) => {
    if (i % 3 === 0) creep.rules = raiderRules();
    if (i % 3 === 1) creep.rules = attackerRules();
  });
  const host = createHost(defaultBattleParams());
  const tracker = new EncounterTracker(state.teams.length);
  tracker.mark(state);
  const ticks = (hours * 3600) / params.world.tickSeconds;
  for (let i = 0; i < ticks; i++) {
    const done = stepJunction(state, host, []);
    tracker.record(state, done.events, done.finished);
    if (state.tick % 3600 === 0) tracker.mark(state);
  }
  return tracker.finish(state);
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const total = (s: Stock) => s.materia + s.cristal;
type TeamTally = EncounterTally["teams"][number];

/** `pick` summed over a run's teams. */
const teamSum = (tally: EncounterTally, pick: (t: TeamTally) => number) =>
  sum(tally.teams.map(pick));
/** `pick` summed over every run's teams. */
const allTeamSum = (
  tallies: EncounterTally[],
  pick: (t: TeamTally) => number,
) => sum(tallies.map((tally) => teamSum(tally, pick)));
/** A stock over a run's teams. */
const teamStock = (tally: EncounterTally, pick: (t: TeamTally) => Stock) =>
  teamSum(tally, (t) => total(pick(t)));
/** A stock over every run's teams. */
const allTeamStock = (
  tallies: EncounterTally[],
  pick: (t: TeamTally) => Stock,
) => allTeamSum(tallies, (t) => total(pick(t)));
/** A stock of the runs themselves, like the spoils left on the map. */
const runStock = (
  tallies: EncounterTally[],
  pick: (tally: EncounterTally) => Stock,
) => sum(tallies.map((tally) => total(pick(tally))));

describe("EncounterTracker", () => {
  const runs = [42, 1].map((seed) => violentWorld(seed, 2));

  test("the worlds have every kind of outcome", () => {
    expect(allTeamSum(runs, (t) => t.outcomesAsVictim.paid)).toBeGreaterThan(0);
    expect(allTeamSum(runs, (t) => t.outcomesAsVictim.battle)).toBeGreaterThan(
      0,
    );
    expect(allTeamSum(runs, (t) => t.battles.won)).toBeGreaterThan(0);
    expect(allTeamSum(runs, (t) => t.battles.lost)).toBeGreaterThan(0);
    // The floors of extortion paid and spoils dropped are over both worlds:
    // with the DNA's help rule (R spec D11) seed 42's hand-made world goes
    // quiet after its first fights (measured 2026-11-25: 5 battles, 1 death
    // with no cargo, 0 paid and 0 dropped in 2 h, 12 h and the 72 h of the
    // world); seed 1 carries them (100 paid, 20 materia dropped in 2 h).
    expect(allTeamStock(runs, (t) => t.extortionPaid)).toBeGreaterThan(0);
    expect(runStock(runs, (tally) => tally.spoils.dropped)).toBeGreaterThan(0);
  });

  test.each([0, 1])("seed %#: the counts add up", (run) => {
    const tally = runs[run]!;
    const { teams } = tally;
    // Every encounter has one aggressor, one victim and one outcome.
    const asAggressor = teamSum(
      tally,
      (t) => t.asAggressor.attack + t.asAggressor.extort,
    );
    const asVictim = teamSum(
      tally,
      (t) => t.asVictim.attack + t.asVictim.extort,
    );
    expect(asAggressor).toBe(asVictim);
    for (const t of teams) {
      expect(sum(OUTCOMES.map((o) => t.outcomesAsVictim[o]))).toBe(
        t.asVictim.attack + t.asVictim.extort,
      );
      expect(sum(OUTCOMES.map((o) => t.outcomesAsAggressor[o]))).toBe(
        t.asAggressor.attack + t.asAggressor.extort,
      );
      // At most one reaction per extortion; none to an attack.
      expect(sum(REACTIONS.map((r) => t.reactions[r]))).toBeLessThanOrEqual(
        t.asVictim.extort,
      );
    }
    // Every battle came from one encounter, and two teams were in each.
    expect(tally.battlesOpened).toBe(
      teamSum(tally, (t) => t.outcomesAsVictim.battle),
    );
    expect(
      teamSum(tally, (t) => sum(BATTLE_RESULTS.map((r) => t.battles[r]))),
    ).toBe(2 * tally.battlesOpened);
    // Every death here has a killer.
    expect(teamSum(tally, (t) => t.kills)).toBe(
      teamSum(tally, (t) => sum(DNAS.map((d) => t.deaths[d]))),
    );
    // Deaths in the timeline end where the totals do.
    const last = tally.timeline.at(-1)!;
    expect(sum(last.teams.map((t) => t.deaths))).toBeLessThanOrEqual(
      teamSum(tally, (t) => sum(DNAS.map((d) => t.deaths[d]))),
    );
  });

  test.each([0, 1])("seed %#: the battle stats add up", (run) => {
    const tally = runs[run]!;
    const stats = tally.battleStats;
    expect(sum(CAUSES.map((c) => stats.byCause[c]))).toBe(tally.battlesOpened);
    const ended = sum(END_REASONS.map((r) => stats.ended[r]));
    expect(ended).toBeGreaterThan(0);
    expect(stats.worldSeconds.count).toBe(ended);
    // The host finished every battle the world ended, and stepped it.
    expect(stats.battleSeconds.count).toBe(ended);
    expect(stats.battleSeconds.max).toBeGreaterThan(0);
    expect(stats.worldSeconds.max).toBeGreaterThanOrEqual(
      Math.floor(stats.battleSeconds.max),
    );
    expect(stats.participants).toBeGreaterThanOrEqual(2 * tally.battlesOpened);
    expect(stats.joins).toBe(teamSum(tally, (t) => t.joins));
    // Each participant comes out once.
    let fates = 0;
    for (const role of ROLES) {
      for (const dna of DNAS) {
        for (const load of LOADS) {
          fates += sum(FATES.map((f) => stats.fates[role][dna][load][f]));
        }
      }
    }
    expect(fates).toBe(stats.participants);
    const deaths = teamSum(tally, (t) => sum(DNAS.map((d) => t.deaths[d])));
    let died = 0;
    for (const role of ROLES) {
      for (const dna of DNAS) {
        for (const load of LOADS) died += stats.fates[role][dna][load].died;
      }
    }
    expect(died).toBe(deaths);
  });

  test.each([0, 1])("seed %#: what changes hands is conserved", (run) => {
    const tally = runs[run]!;
    const { spoils } = tally;
    expect(teamStock(tally, (t) => t.extortionPaid)).toBe(
      teamStock(tally, (t) => t.extortionReceived),
    );
    // Spoils: what was dropped, less what was picked up, is on the map.
    for (const kind of ["materia", "cristal"] as const) {
      const picked = teamSum(tally, (t) => t.pickedUp[kind]);
      expect(spoils.dropped[kind] - picked).toBe(spoils.leftCargo[kind]);
    }
  });
});
