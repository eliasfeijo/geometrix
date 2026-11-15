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
import { mirrorCell } from "../src/map.ts";
import { createWorld, type Creep, type WorldState } from "../src/world.ts";
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
    `"1695584d071b1d3dadb748c36431d403046b5397f5f718d9a0bed6f74154ec9a"`,
  );
  // Growing to the population cap, the world takes a few seconds.
}, 30_000);

/**
 * The mirrored teams play the same world: the first hours, before contested
 * deposits split them by creep id (fog F2 checkpoint, accepted), each creep
 * of team 1 is the mirror of the one born in the same place of team 0.
 */
test.each([3, 42])(
  "seed %i: the teams stay mirrored for the first 2 h",
  (seed) => {
    const state = createWorld(seed, loadTestParams());
    const bots = botsFor(["balanced", "balanced"]);
    const of = (team: number) => state.creeps.filter((c) => c.team === team);
    const key = (c: Creep, s: WorldState, mirror: boolean) => {
      const at = mirror ? mirrorCell(c, s.map) : c;
      return `${c.dna} ${at.x},${at.y} ${c.cargo.materia}/${c.cargo.cristal} ${c.order.type}`;
    };
    while (state.tick < 2 * 3600) {
      const ours = of(0).map((c) => key(c, state, false));
      const theirs = of(1).map((c) => key(c, state, true));
      if (ours.join() !== theirs.join()) {
        expect(theirs, `tick ${state.tick}`).toEqual(ours);
      }
      const accepted = botCommands(state, bots).filter(
        ({ playerId, command }) => validate(state, command, playerId) === null,
      );
      step(state, accepted);
    }
    expect(of(0).length).toBeGreaterThan(6);
  },
  30_000,
);
