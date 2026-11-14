// Property of the view deltas (M1.5 plan section 7): in every tick of a bot ×
// bot world and for both teams, the client's view rebuilt from the deltas is
// the server's view. The deltas go through JSON, as on the network, so the
// client never holds an object of the state: a bug of in-place mutation shows
// up as a difference. Views are compared as plain JSON every tick (stricter
// than canonical JSON, and fast enough for CI) and as viewJson, the hashed
// form, every world minute.

import {
  botCommands,
  botsFor,
  createWorld,
  parseParams,
  step,
  validate,
  view,
} from "@geometrix/sim";
import { expect, test } from "vitest";
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
    for (;;) {
      for (const team of teams) {
        const seen = view(state, team);
        const delta = JSON.parse(
          JSON.stringify(diffView(sent[team]!, seen)),
        ) as Delta;
        upserts += delta.creeps?.upsert?.length ?? 0;
        removes += delta.creeps?.remove?.length ?? 0;
        roads += delta.roads?.length ?? 0;
        explored += delta.known?.length ?? 0;
        sight += delta.visible?.remove?.length ?? 0;
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
      step(state, accepted);
    }
    // The world did move: creeps were born and changed, roads were built,
    // cells were explored and left sight, enemy creeps came into sight and
    // left it (no creep dies in M1.5: every remove is one leaving sight).
    expect(state.creeps.length).toBeGreaterThan(12);
    expect(upserts).toBeGreaterThan(ticks);
    expect(explored).toBeGreaterThan(300);
    expect(sight).toBeGreaterThan(1000);
    expect(roads).toBeGreaterThan(10);
    expect(removes).toBeGreaterThan(0);
  },
  60_000,
);
