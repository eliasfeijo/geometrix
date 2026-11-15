// Behavior lock for the strategist (M1.5 rede plan section 7, spec D4): a
// seed-42 world with one balanced bot per team, run for 6 world hours the way
// the harness and the server run it. A changed hash means a bot decided
// something different; it changes on purpose with the fog (fog spec D12).

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
    `"e71d034d32c1fc9be1a8253cd3cb0cb1d4cd2f834463165927a549a24babbcf5"`,
  );
  // Growing to the population cap, the world takes a few seconds.
}, 30_000);
