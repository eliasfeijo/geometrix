import { describe, expect, test } from "vitest";
import type { Command } from "../src/commands.ts";
import { collectorRules, roadBuilderRules } from "../src/presets.ts";
import { serialize } from "../src/serialize.ts";
import { step } from "../src/step.ts";
import { roadTarget, strategistCommands } from "../src/strategist.ts";
import { createWorld, type WorldState } from "../src/world.ts";
import { loadTestParams } from "./helpers.ts";

const params = loadTestParams();

/** The seed-42 world after one bot per team joined at tick 0. */
function joined(): WorldState {
  const world = createWorld(42, params);
  step(world, [
    { playerId: 1, command: { type: "join", team: 0, bot: true } },
    { playerId: 2, command: { type: "join", team: 1, bot: true } },
  ]);
  return world;
}

/** What both bots send on this tick, as the harness would. */
const botInputs = (world: WorldState) =>
  [0, 1].flatMap((team) =>
    strategistCommands("balanced", world, team).map((command) => ({
      playerId: team + 1,
      command,
    })),
  );

const teamCreeps = (world: WorldState, team: number) =>
  world.creeps.filter((c) => c.team === team);

const presetsOf = (commands: Command[]) =>
  commands.flatMap((c) =>
    c.type === "applyPreset" ? [[c.creepId, c.preset] as const] : [],
  );

describe("balanced", () => {
  test("splits 6 creeps into 2 cristal, 1 road builder and 3 materia, lowest ids first", () => {
    const world = joined();
    const [a, b, c] = teamCreeps(world, 0);
    const commands = strategistCommands("balanced", world, 0);
    expect(presetsOf(commands)).toEqual([
      [a!.id, "cristalCollector"],
      [b!.id, "cristalCollector"],
      [c!.id, "roadBuilder"],
    ]);
    const builder = commands.find(
      (cmd) => cmd.type === "applyPreset" && cmd.preset === "roadBuilder",
    );
    expect(builder).toMatchObject({
      target: roadTarget(world, world.teams[0]!),
    });
  });

  test("leaves a team that already has the split alone", () => {
    const world = joined();
    for (const input of botInputs(world)) {
      step(world, [input]);
      world.tick -= 1;
    }
    expect(presetsOf(strategistCommands("balanced", world, 0))).toEqual([]);
  });

  test("produces the DNA the team has fewest of, ties in ■ ▲ ● order", () => {
    const world = joined();
    world.teams[0]!.stock = { materia: 100, cristal: 20 };
    expect(strategistCommands("balanced", world, 0)).toContainEqual({
      type: "produce",
      dna: "square",
      repeat: false,
    });
    world.creeps = world.creeps.filter(
      (c) => !(c.team === 0 && c.dna === "circle"),
    );
    expect(strategistCommands("balanced", world, 0)).toContainEqual({
      type: "produce",
      dna: "circle",
      repeat: false,
    });
  });

  test("buys the capacity upgrade with what is left after producing", () => {
    const world = joined();
    const team = world.teams[0]!;
    const types = () =>
      strategistCommands("balanced", world, 0).map((c) => c.type);
    team.stock = { materia: 40, cristal: 159 };
    expect(types()).toContain("produce");
    expect(types()).not.toContain("buyUpgrade");
    team.stock = { materia: 40, cristal: 160 };
    expect(types()).toEqual(expect.arrayContaining(["produce", "buyUpgrade"]));
    team.upgrades.capacity = true;
    expect(types()).not.toContain("buyUpgrade");
  });

  test("moves cristal collectors back to materia once the map has no cristal", () => {
    const world = joined();
    const [a, b] = teamCreeps(world, 0);
    a!.rules = collectorRules("cristal");
    b!.rules = collectorRules("cristal");
    for (const d of world.deposits) if (d.kind === "cristal") d.amount = 0;
    // Freed first, a is then the lowest-id materia creep: it fills the builder.
    expect(presetsOf(strategistCommands("balanced", world, 0))).toEqual([
      [a!.id, "roadBuilder"],
      [b!.id, "materiaCollector"],
    ]);
  });

  test("the road target is the nearest deposit without a road, then the next", () => {
    const world = joined();
    const team = world.teams[0]!;
    const first = roadTarget(world, team)!;
    const deposit = world.deposits.find(
      (d) => d.x === first.x && d.y === first.y,
    )!;
    const distance = (d: { x: number; y: number }) =>
      Math.abs(d.x - team.core.x) + Math.abs(d.y - team.core.y);
    for (const d of world.deposits) {
      expect(distance(d)).toBeGreaterThanOrEqual(distance(deposit));
    }
    world.map.road[first.y * world.map.width + first.x] = 1;
    const second = roadTarget(world, team)!;
    expect(second).not.toEqual(first);
    // The builder moves on to the new target.
    const builder = teamCreeps(world, 0)[2]!;
    builder.rules = roadBuilderRules(first);
    expect(strategistCommands("balanced", world, 0)).toContainEqual({
      type: "applyPreset",
      creepId: builder.id,
      preset: "roadBuilder",
      target: second,
    });
  });

  test("decides from the state alone, without changing it", () => {
    const world = joined();
    world.teams[0]!.stock = { materia: 100, cristal: 200 };
    const before = serialize(world);
    const first = strategistCommands("balanced", world, 0);
    expect(serialize(world)).toBe(before);
    expect(strategistCommands("balanced", world, 0)).toEqual(first);
  });
});
