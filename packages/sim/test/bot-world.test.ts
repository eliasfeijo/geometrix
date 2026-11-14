// Behavior lock for the strategist (M1.5 plan section 7, spec D4): a seed-42
// world with one balanced bot per team, run for 6 world hours the way the
// harness and the server run it. The hash must not change while the strategist
// moves from the state to the team view; a change means a bot decided
// something different.

import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import type { CommandInput } from "../src/commands.ts";
import { validate } from "../src/commands.ts";
import { serialize } from "../src/serialize.ts";
import { step } from "../src/step.ts";
import { strategistActs, strategistCommands } from "../src/strategist.ts";
import { view } from "../src/view.ts";
import { createWorld, type WorldState } from "../src/world.ts";
import { loadTestParams } from "./helpers.ts";

const HOURS = 6;

/** What both bots send on this tick: their join at tick 0, then decisions. */
function botInputs(state: WorldState): CommandInput[] {
  if (state.tick === 0) {
    return [0, 1].map((team) => ({
      playerId: team + 1,
      command: { type: "join", team, bot: true },
    }));
  }
  if (!strategistActs(state.tick)) return [];
  return [0, 1].flatMap((team) =>
    strategistCommands(
      "balanced",
      view(state, team),
      state.map,
      state.params,
    ).map((command) => ({
      playerId: team + 1,
      command,
    })),
  );
}

test("a 6 h bot world of seed 42 hashes to a stable value", () => {
  const params = loadTestParams();
  const state = createWorld(42, params);
  const ticks = (HOURS * 3600) / params.world.tickSeconds;
  let commands = 0;
  while (state.tick < ticks) {
    const accepted = botInputs(state).filter(
      ({ playerId, command }) => validate(state, command, playerId) === null,
    );
    commands += accepted.length;
    step(state, accepted);
  }
  // The bots did act: production, upgrades and role changes.
  expect(state.creeps.length).toBeGreaterThan(12);
  expect(commands).toBeGreaterThan(20);
  expect(
    createHash("sha256").update(serialize(state)).digest("hex"),
  ).toMatchInlineSnapshot(
    `"9974df6a5437172ca650f81e53bbc9fc04ad9fb37293e9b20be1f22b1a1d8bbb"`,
  );
});
