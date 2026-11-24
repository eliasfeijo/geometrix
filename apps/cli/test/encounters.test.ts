import { readFileSync } from "node:fs";
import {
  createWorld,
  DNAS,
  parseParams,
  raiderRules,
  step,
  SYSTEM_PLAYER_ID,
  type Command,
  type Rule,
  type Stock,
  type WorldState,
} from "@geometrix/sim";
import { describe, expect, test } from "vitest";
import {
  BATTLE_RESULTS,
  EncounterTracker,
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
 * A stand-in for the junction host (F3), so battles end: a battle open for a
 * tick ends with side 0 the winner, every other participant dead on its cell
 * with its load as a pile there.
 */
function quickResults(state: WorldState): Command[] {
  const commands: Command[] = [];
  for (const battle of state.battles) {
    if (battle.openedTick >= state.tick) continue;
    const creeps = battle.participants.map((p) => ({
      p,
      creep: state.creeps.find((c) => c.id === p.id)!,
    }));
    const winners = creeps.filter(({ p }) => p.side === 0);
    const killer = winners[0]?.creep.id ?? null;
    for (const { p, creep } of creeps) {
      if (p.side === 0) continue;
      commands.push({
        type: "battleExit",
        battleId: battle.id,
        creepId: creep.id,
        outcome: "died",
        hp: 0,
        cargo: { materia: 0, cristal: 0 },
        cell: { x: creep.x, y: creep.y },
        by: killer,
      });
    }
    commands.push({
      type: "battleEnd",
      battleId: battle.id,
      winnerSide: winners.length > 0 ? 0 : null,
      reason: winners.length > 0 ? "won" : "empty",
      survivors: winners.map(({ creep }) => ({
        creepId: creep.id,
        hp: Math.max(1, Math.floor(creep.hp / 1000)),
        cargo: { ...creep.cargo },
        cell: { x: creep.x, y: creep.y },
      })),
      piles: creeps
        .filter(({ p }) => p.side !== 0)
        .map(({ creep }) => ({
          cell: { x: creep.x, y: creep.y },
          cargo: { ...creep.cargo },
        })),
    });
  }
  return commands;
}

/**
 * A world without bots where a third of each team's creeps extort, a third
 * attack and a third collect materia: raiders fight raiders, collectors pay
 * or refuse. Battles end through quickResults.
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
    const commands = quickResults(state).map((command) => ({
      playerId: SYSTEM_PLAYER_ID,
      command,
    }));
    tracker.record(state, step(state, commands));
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
