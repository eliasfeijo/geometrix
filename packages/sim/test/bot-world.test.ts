// The bots' mirrored worlds. The 6 h behavior lock of the strategist runs
// through the junction host now, as the harness and the server run the world
// (packages/junction/test/bot-world.test.ts).

import { expect, test } from "vitest";
import { validate } from "../src/commands.ts";
import { step } from "../src/step.ts";
import { botCommands, botsFor } from "../src/strategist.ts";
import { mirrorCell } from "../src/map.ts";
import { createWorld, type Creep, type WorldState } from "../src/world.ts";
import { loadTestParams } from "./helpers.ts";

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
