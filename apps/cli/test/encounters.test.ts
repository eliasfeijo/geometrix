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

describe("EncounterTracker", () => {
  const runs = [42, 1].map((seed) => violentWorld(seed, 2));

  test("the worlds have every kind of outcome", () => {
    const all = (pick: (t: EncounterTally["teams"][number]) => number) =>
      sum(runs.flatMap((tally) => tally.teams.map(pick)));
    expect(all((t) => t.outcomesAsVictim.paid)).toBeGreaterThan(0);
    expect(all((t) => t.outcomesAsVictim.battle)).toBeGreaterThan(0);
    expect(all((t) => t.battles.won)).toBeGreaterThan(0);
    expect(all((t) => t.battles.lost)).toBeGreaterThan(0);
  });

  test.each([0, 1])("seed %#: the counts add up", (run) => {
    const tally = runs[run]!;
    const { teams } = tally;
    // Every encounter has one aggressor, one victim and one outcome.
    const asAggressor = sum(
      teams.map((t) => t.asAggressor.attack + t.asAggressor.extort),
    );
    const asVictim = sum(
      teams.map((t) => t.asVictim.attack + t.asVictim.extort),
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
      sum(teams.map((t) => t.outcomesAsVictim.battle)),
    );
    expect(
      sum(teams.map((t) => sum(BATTLE_RESULTS.map((r) => t.battles[r])))),
    ).toBe(2 * tally.battlesOpened);
    // Every death here has a killer.
    expect(sum(teams.map((t) => t.kills))).toBe(
      sum(teams.map((t) => sum(DNAS.map((d) => t.deaths[d])))),
    );
    // Deaths in the timeline end where the totals do.
    const last = tally.timeline.at(-1)!;
    expect(sum(last.teams.map((t) => t.deaths))).toBeLessThanOrEqual(
      sum(teams.map((t) => sum(DNAS.map((d) => t.deaths[d])))),
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
    expect(stats.joins).toBe(sum(tally.teams.map((t) => t.joins)));
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
    const deaths = sum(
      tally.teams.map((t) => sum(DNAS.map((d) => t.deaths[d]))),
    );
    let died = 0;
    for (const role of ROLES) {
      for (const dna of DNAS) {
        for (const load of LOADS) died += stats.fates[role][dna][load].died;
      }
    }
    expect(died).toBe(deaths);
  });

  test.each([0, 1])("seed %#: what changes hands is conserved", (run) => {
    const { teams, spoils } = runs[run]!;
    const all = (pick: (t: (typeof teams)[number]) => Stock) =>
      sum(teams.map((t) => total(pick(t))));
    expect(all((t) => t.extortionPaid)).toBe(all((t) => t.extortionReceived));
    expect(total(spoils.dropped)).toBeGreaterThan(0);
    // Spoils: what was dropped, less what was picked up, is on the map.
    for (const kind of ["materia", "cristal"] as const) {
      const picked = sum(teams.map((t) => t.pickedUp[kind]));
      expect(spoils.dropped[kind] - picked).toBe(spoils.leftCargo[kind]);
    }
  });
});
