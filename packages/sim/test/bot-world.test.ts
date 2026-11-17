// Behavior lock for the strategist (M1.5 rede plan section 7, spec D4): a
// seed-42 world with one balanced bot per team, run for 6 world hours the way
// the harness and the server run it. A changed hash means a bot decided
// something different; it changes on purpose with the fog (fog spec D12)
// and with the raiders (M2 encontro spec D15, D20).

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
    `"88f4793acbcfc5a3ac39636e1797ebcb245b6910a586b5c5bd71ce2255f1fc00"`,
  );
  // Growing to the population cap, with raiders exploring, the world takes
  // over 10 s alone and some 30 s with the whole suite running.
}, 60_000);

/**
 * The mirrored teams play the same world: the first hours, before contested
 * deposits split them by creep id (fog F2 checkpoint, accepted) and before
 * the first draw of the rng in an encounter (M2 encontro plan section 4,
 * accepted), each creep of team 1 is the mirror of the one born in the same
 * place of team 0.
 */
test.each([3, 42])(
  "seed %i: the teams stay mirrored for the first 2 h, until the rng draws",
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
      const rng = JSON.stringify(state.rng);
      step(state, accepted);
      if (JSON.stringify(state.rng) !== rng) break;
    }
    expect(state.tick).toBeGreaterThan(3600);
    expect(of(0).length).toBeGreaterThan(6);
  },
  30_000,
);
