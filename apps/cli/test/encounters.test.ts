import { readFileSync } from "node:fs";
import {
  createWorld,
  DNAS,
  parseParams,
  raiderRules,
  step,
  type Rule,
  type Stock,
} from "@geometrix/sim";
import { describe, expect, test } from "vitest";
import {
  EncounterTracker,
  FLEE_GROUNDS,
  OUTCOMES,
  REACTIONS,
  type EncounterTally,
} from "../src/encounters.ts";

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
 * and flee.
 */
function violentWorld(seed: number, hours: number): EncounterTally {
  const state = createWorld(seed, params);
  state.creeps.forEach((creep, i) => {
    if (i % 3 === 0) creep.rules = raiderRules();
    if (i % 3 === 1) creep.rules = attackerRules();
  });
  const tracker = new EncounterTracker(state.teams.length);
  tracker.mark(state);
  const ticks = (hours * 3600) / params.world.tickSeconds;
  for (let i = 0; i < ticks; i++) {
    tracker.record(state, step(state, []));
    if (state.tick % 3600 === 0) tracker.mark(state);
  }
  return tracker.finish(state);
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const total = (s: Stock) => s.materia + s.cristal;

describe("EncounterTracker", () => {
  const runs = [42, 1].map((seed) => violentWorld(seed, 2));

  test.each([0, 1])("seed %#: the world has every kind of outcome", (run) => {
    const tally = runs[run]!;
    const outcomes = (o: (typeof OUTCOMES)[number]) =>
      sum(tally.teams.map((t) => t.outcomesAsVictim[o]));
    expect(outcomes("paid")).toBeGreaterThan(0);
    expect(outcomes("victimDied") + outcomes("aggressorDied")).toBeGreaterThan(
      0,
    );
    expect(
      sum(tally.teams.map((t) => sum(DNAS.map((d) => t.fleeByDna[d].tries)))),
    ).toBeGreaterThan(0);
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
      // One dialogue reaction per encounter that did not open in the fight
      // nor stay open waiting for it.
      expect(sum(REACTIONS.map((r) => t.reactions[r]))).toBeLessThanOrEqual(
        t.asVictim.attack + t.asVictim.extort,
      );
      // A try to flee is on one ground and has one DNA.
      expect(sum(DNAS.map((d) => t.fleeByDna[d].tries))).toBe(
        sum(FLEE_GROUNDS.map((g) => t.fleeByGround[g].tries)),
      );
    }
    // Every death in a fight has a killer.
    expect(sum(teams.map((t) => t.kills))).toBe(
      sum(teams.map((t) => sum(DNAS.map((d) => t.deaths[d])))),
    );
    // Deaths in the timeline end where the totals do.
    const last = tally.timeline.at(-1)!;
    expect(sum(last.teams.map((t) => t.deaths))).toBeLessThanOrEqual(
      sum(teams.map((t) => sum(DNAS.map((d) => t.deaths[d])))),
    );
  });

  test.each([0, 1])("seed %#: what changes hands is conserved", (run) => {
    const { teams, spoils } = runs[run]!;
    const all = (pick: (t: (typeof teams)[number]) => Stock) =>
      sum(teams.map((t) => total(pick(t))));
    expect(all((t) => t.extortionPaid)).toBe(all((t) => t.extortionReceived));
    expect(all((t) => t.lootLost)).toBe(all((t) => t.lootTaken));
    // Spoils: what was dropped, less what was picked up, is on the map.
    for (const kind of ["materia", "cristal"] as const) {
      const dropped = sum(
        teams.map((t) => t.droppedFleeing[kind] + t.droppedDying[kind]),
      );
      const picked = sum(teams.map((t) => t.pickedUp[kind]));
      expect(dropped - picked).toBe(spoils.leftCargo[kind]);
    }
  });
});
