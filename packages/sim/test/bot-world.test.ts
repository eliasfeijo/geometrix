// Behavior lock for the strategist (M1.5 plan section 7, spec D4): a seed-42
// world with one balanced bot per team, run for 6 world hours the way the
// harness and the server run it. The hash must not change while the strategist
// moves from the state to the team view; a change means a bot decided
// something different.

import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import { validate } from "../src/commands.ts";
import { serialize } from "../src/serialize.ts";
import { step } from "../src/step.ts";
import { botCommands, botsFor } from "../src/strategist.ts";
import { createWorld } from "../src/world.ts";
import { loadTestParams } from "./helpers.ts";

const HOURS = 6;

test("a 6 h bot world of seed 42 hashes to a stable value", () => {
  const params = loadTestParams();
  const state = createWorld(42, params);
  const ticks = (HOURS * 3600) / params.world.tickSeconds;
  const bots = botsFor(["balanced", "balanced"]);
  let commands = 0;
  while (state.tick < ticks) {
    const accepted = botCommands(state, bots).filter(
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
    `"6403a598064d75af1ea3109be5b18c54c821562174ae3b5f8f9cba13189e3fdb"`,
  );
});
