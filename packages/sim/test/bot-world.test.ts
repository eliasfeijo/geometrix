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
  // The bots did act: role changes. (Until the autopilot explores, fog F2,
  // they know no cristal and produce nothing.)
  expect(commands).toBeGreaterThan(5);
  expect(
    createHash("sha256").update(serialize(state)).digest("hex"),
  ).toMatchInlineSnapshot(
    `"6adbdc9d2fc09f6cf24b597e1db336f32e49f89f30f1be132e8a2224d551858c"`,
  );
});
