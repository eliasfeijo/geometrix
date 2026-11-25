// Property of the view deltas (M1.5 plan section 7): in every tick of a bot ×
// bot world and for both teams, the client's view rebuilt from the deltas is
// the server's view. The deltas go through JSON, as on the network, so the
// client never holds an object of the state: a bug of in-place mutation shows
// up as a difference. Views are compared as plain JSON every tick (stricter
// than canonical JSON, and fast enough for CI) and as viewJson, the hashed
// form, every world minute. The world steps through the junction host
// (junction spec N-4), so battles open, lock their creeps and end: creeps die,
// spoils drop and stubs close, and the test asserts floors of each.

import { parseBattleParams } from "@geometrix/battle";
import { createHost, setHold, stepJunction } from "@geometrix/junction";
import {
  botCommands,
  botsFor,
  createWorld,
  parseParams,
  validate,
  view,
  type Rule,
  type WorldState,
} from "@geometrix/sim";
import { expect, test } from "vitest";
import battleParams from "../../battle/test/params.json" with { type: "json" };
import params from "../../sim/test/params.json" with { type: "json" };
import {
  applyDelta,
  diffView,
  emptySent,
  emptyView,
  viewJson,
  type Delta,
} from "../src/delta.ts";

const HOURS = 6;

test.each([1, 42, 649])(
  "seed %i: 6 h of deltas rebuild each team's view in every tick",
  (seed) => {
    const state = createWorld(seed, parseParams(params));
    const host = createHost(parseBattleParams(battleParams));
    const ticks = (HOURS * 3600) / state.params.world.tickSeconds;
    const bots = botsFor(["balanced", "balanced"]);
    const teams = [0, 1];
    const sent = teams.map(() => emptySent());
    const cells = state.map.width * state.map.height;
    const client = teams.map((team) => emptyView(team, cells));
    let upserts = 0;
    let removes = 0;
    let roads = 0;
    let explored = 0;
    let sight = 0;
    let foreign = 0;
    let battles = 0;
    let closed = 0;
    let locked = 0;
    let deaths = 0;
    let spoils = 0;
    const enemyCoreSeen = teams.map(() => false);
    for (;;) {
      for (const team of teams) {
        const seen = view(state, team);
        const delta = JSON.parse(
          JSON.stringify(diffView(sent[team]!, seen)),
        ) as Delta;
        upserts += delta.creeps?.upsert?.length ?? 0;
        removes += delta.creeps?.remove?.length ?? 0;
        roads += delta.roads?.length ?? 0;
        // The team's own creeps never leave its view: a remove is a death.
        const own = new Set(
          client[team]!.creeps.filter((c) => c.team === team).map((c) => c.id),
        );
        deaths += (delta.creeps?.remove ?? []).filter((id) =>
          own.has(id),
        ).length;
        // Battles opened and closed, creeps locked in one, spoils dropped,
        // as each team saw them.
        battles += (delta.battles?.upsert ?? []).filter(
          (battle) => battle.x !== undefined,
        ).length;
        closed += delta.battles?.remove?.length ?? 0;
        locked += (delta.creeps?.upsert ?? []).filter(
          (creep) => creep.battle != null,
        ).length;
        spoils += (delta.spoils?.upsert ?? []).filter(
          (spoil) => spoil.x !== undefined,
        ).length;
        explored += delta.known?.length ?? 0;
        sight += delta.visible?.remove?.length ?? 0;
        foreign += (delta.creeps?.upsert ?? []).filter(
          (creep) => creep.team !== undefined && creep.team !== team,
        ).length;
        for (const other of delta.teams?.upsert ?? []) {
          if (other.id !== team && "core" in other && other.core != null) {
            enemyCoreSeen[team] = true;
          }
        }
        client[team] = applyDelta(client[team]!, delta);
        const same = JSON.stringify(client[team]) === JSON.stringify(seen);
        if (
          !same ||
          (state.tick % 60 === 0 && viewJson(client[team]!) !== viewJson(seen))
        ) {
          // Shows the difference; equal values in another key order fail
          // only the plain JSON check.
          expect(viewJson(client[team]!), `tick ${state.tick}`).toBe(
            viewJson(seen),
          );
          expect.fail(`tick ${state.tick}, team ${team}: key order differs`);
        }
      }
      if (state.tick >= ticks) break;
      const accepted = botCommands(state, bots).filter(
        ({ playerId, command }) => validate(state, command, playerId) === null,
      );
      stepJunction(state, host, accepted);
    }
    // The world did move: creeps were born and changed, roads were built,
    // cells were explored and left sight, enemy creeps came into sight (with
    // the D7 fields: a new entity is sent whole, so it has its team) and left
    // it, and each team found the enemy core (seen after ~4.5-5.3 h in these
    // seeds). Through the junction host, battles open, lock their creeps
    // and close, creeps die and spoils drop. With R F3's hard bots (the
    // defense against threats, C1-1, and the threat pass's drops), seeds 1,
    // 42 and 649 end with 53, 56 and 59 creeps, with 28, 36 and 14 battles
    // opened and closed, 78-144 locked creeps sent, 15-22 deaths and 7-32
    // spoils (as the two teams saw them; before R F3: 12-16 battles, 5-12
    // deaths, 1-8 spoils). A bot's extortion is answered in the tick it
    // opens, so no delta carries it.
    expect(state.creeps.length).toBeGreaterThan(8);
    expect(upserts).toBeGreaterThan(ticks);
    expect(explored).toBeGreaterThan(300);
    expect(sight).toBeGreaterThan(1000);
    expect(roads).toBeGreaterThan(10);
    expect(removes).toBeGreaterThan(0);
    expect(foreign).toBeGreaterThan(20);
    expect(enemyCoreSeen).toEqual([true, true]);
    expect(battles).toBeGreaterThanOrEqual(10);
    expect(closed).toBeGreaterThanOrEqual(10);
    expect(locked).toBeGreaterThanOrEqual(20);
    expect(deaths).toBeGreaterThanOrEqual(5);
    expect(spoils).toBeGreaterThanOrEqual(1);
  },
  120_000,
);

// The wanderers (junction F6): the test params have none (cap 0), so this
// world turns them on. The property holds while they are born, roam, come
// into a team's sight and leave it, fight and die.
test.each([42])(
  "seed %i: 2 h with wanderers, the deltas rebuild each team's view",
  (seed) => {
    const withWanderers = JSON.parse(JSON.stringify(params)) as typeof params;
    // Born from minute 10, one every 10 minutes: they meet the teams early.
    withWanderers.wanderers.cap = 4;
    withWanderers.wanderers.firstSeconds = 600;
    withWanderers.wanderers.intervalSeconds = { start: 600, end: 600 };
    const state = createWorld(seed, parseParams(withWanderers));
    const host = createHost(parseBattleParams(battleParams));
    const ticks = (2 * 3600) / state.params.world.tickSeconds;
    const bots = botsFor(["balanced", "balanced"]);
    const teams = [0, 1];
    const sent = teams.map(() => emptySent());
    const cells = state.map.width * state.map.height;
    const client = teams.map((team) => emptyView(team, cells));
    let upserts = 0;
    let removes = 0;
    let alive = 0;
    for (;;) {
      alive = Math.max(alive, state.wanderers.length);
      for (const team of teams) {
        const seen = view(state, team);
        const delta = JSON.parse(
          JSON.stringify(diffView(sent[team]!, seen)),
        ) as Delta;
        upserts += delta.wanderers?.upsert?.length ?? 0;
        removes += delta.wanderers?.remove?.length ?? 0;
        client[team] = applyDelta(client[team]!, delta);
        if (JSON.stringify(client[team]) !== JSON.stringify(seen)) {
          expect(viewJson(client[team]!), `tick ${state.tick}`).toBe(
            viewJson(seen),
          );
          expect.fail(`tick ${state.tick}, team ${team}: key order differs`);
        }
      }
      if (state.tick >= ticks) break;
      const accepted = botCommands(state, bots).filter(
        ({ playerId, command }) => validate(state, command, playerId) === null,
      );
      stepJunction(state, host, accepted);
    }
    // The most alive at once: the hard bots may kill the last ones (R F3).
    expect(alive).toBeGreaterThan(0);
    // 62 upserts and 31 removes in this seed.
    expect(upserts).toBeGreaterThan(30);
    expect(removes).toBeGreaterThan(10);
  },
  60_000,
);

// The vocabulary of the R slice (spec U-4): follow orders, drops, hostile
// intents, held battles and the new rules. The bots do not use follow or drop
// yet, so after every other strategist minute the test rewrites some creeps'
// rules, as the bot that owns them: a follower of a teammate that helps
// allies, a gatherer that drops its load and a hunter. Battles are held and
// released on the junction host every half minute.
test.each([42])(
  "seed %i: 3 h with follows, drops, hostile intents and held battles",
  (seed) => {
    const withWanderers = JSON.parse(JSON.stringify(params)) as typeof params;
    withWanderers.wanderers.cap = 4;
    withWanderers.wanderers.firstSeconds = 600;
    withWanderers.wanderers.intervalSeconds = { start: 600, end: 600 };
    const state = createWorld(seed, parseParams(withWanderers));
    const host = createHost(parseBattleParams(battleParams));
    const ticks = (3 * 3600) / state.params.world.tickSeconds;
    const bots = botsFor(["balanced", "balanced"]);
    const teams = [0, 1];
    const sent = teams.map(() => emptySent());
    const cells = state.map.width * state.map.height;
    const client = teams.map((team) => emptyView(team, cells));
    let follows = 0;
    let hostiles = 0;
    let drops = 0;
    let held = 0;
    for (;;) {
      for (const team of teams) {
        const seen = view(state, team);
        const delta = JSON.parse(
          JSON.stringify(diffView(sent[team]!, seen)),
        ) as Delta;
        for (const creep of delta.creeps?.upsert ?? []) {
          if ("order" in creep && creep.order?.type === "follow") follows++;
          if (creep.hostile != null) hostiles++;
        }
        hostiles += (delta.wanderers?.upsert ?? []).filter(
          (wanderer) => wanderer.hostile != null,
        ).length;
        client[team] = applyDelta(client[team]!, delta);
        if (JSON.stringify(client[team]) !== JSON.stringify(seen)) {
          expect(viewJson(client[team]!), `tick ${state.tick}`).toBe(
            viewJson(seen),
          );
          expect.fail(`tick ${state.tick}, team ${team}: key order differs`);
        }
      }
      if (state.tick >= ticks) break;
      const commands = botCommands(state, bots);
      // Just after the strategist's minute, so the rules last until its next.
      if (state.tick % 120 === 1) commands.push(...vocabulary(state, bots));
      const accepted = commands.filter(
        ({ playerId, command }) => validate(state, command, playerId) === null,
      );
      const hold = Math.floor(state.tick / 30) % 2 === 1;
      for (const instance of host.instances) {
        setHold(state, host, instance.battleId, hold);
        if (hold) held++;
      }
      const { events } = stepJunction(state, host, accepted);
      drops += events.filter((e) => e.type === "dropped").length;
    }
    // 180 follow orders and 59 hostile intents sent, 45 loads dropped and 314
    // battle ticks held in this seed.
    expect(follows).toBeGreaterThan(0);
    expect(hostiles).toBeGreaterThan(0);
    expect(drops).toBeGreaterThan(0);
    expect(held).toBeGreaterThan(0);
  },
  90_000,
);

/** New rules for each team's first creeps, as the team's bot player. */
function vocabulary(state: WorldState, bots: ReturnType<typeof botsFor>) {
  return bots.flatMap(({ playerId, team }) => {
    const [leader, follower, dropper, hunter] = state.creeps.filter(
      (c) => c.team === team,
    );
    const set = (creep: typeof leader, rules: Rule[]) =>
      creep === undefined
        ? []
        : [
            {
              playerId,
              command: {
                type: "setRules" as const,
                creepId: creep.id,
                rules,
              },
            },
          ];
    return [
      ...(leader === undefined
        ? []
        : set(follower, [
            {
              when: { type: "allyInBattle", radius: 12 },
              then: { type: "joinBattle", minHpPermille: 200 },
            },
            {
              when: { type: "always" },
              then: { type: "follow", creepId: leader.id },
            },
          ])),
      ...set(dropper, [
        { when: { type: "cargoFull" }, then: { type: "drop" } },
        {
          when: { type: "always" },
          then: { type: "gather", resource: "materia" },
        },
      ]),
      ...set(hunter, [
        {
          when: { type: "always" },
          then: {
            type: "approach",
            intent: "attack",
            radius: 20,
            minCargo: 0,
          },
        },
        { when: { type: "always" }, then: { type: "explore" } },
      ]),
    ];
  });
}
