import { createBattle, presetGambits, defaultGambits } from "@geometrix/battle";
import { capacity, join, windowAround, type Battle } from "@geometrix/sim";
import { describe, expect, test } from "vitest";
import {
  battleHp,
  battleSeed,
  battleSetup,
  participantSetup,
  teamReaction,
} from "../src/setup.ts";
import { creepOf, loadBattleParams, textWorld } from "./helpers.ts";

const MAP = [
  "A.............................",
  "..............................",
  "..............................",
  "..............................",
  "..............................",
  "..............................",
  ".............................B",
];

describe("the setups (junction O-3, D2, D9, D10)", () => {
  test("whole HP points, at least 1; max HP and capacity from the world; the load", () => {
    const world = textWorld(MAP);
    const creep = creepOf(world, 0, "square");
    creep.hp = 41_999;
    creep.cargo = { materia: 3, cristal: 2 };
    world.teams[0]!.upgrades.capacity = true;
    const setup = participantSetup(world, creep, "fight");
    expect(setup).toMatchObject({
      name: creep.name,
      dna: "square",
      hp: 41,
      maxHp: world.params.hp.dna.square.max,
      carry: { materia: 3, cristal: 2 },
      capacity: capacity(creep, world.teams[0]!, world.params),
      reaction: "normal",
    });
    expect(setup.capacity).toBeGreaterThan(
      capacity(creep, { upgrades: { capacity: false } }, world.params),
    );
    creep.hp = 400;
    expect(battleHp(creep)).toBe(1);
  });

  test("the reaction is the team's first bot's difficulty, normal with no bot (R plan P8)", () => {
    const world = textWorld(MAP);
    const own = creepOf(world, 0, "square");
    const other = creepOf(world, 1, "square");
    expect(participantSetup(world, own, "fight").reaction).toBe("normal");
    join(world, 1, 0, false);
    join(world, 3, 0, true, "easy");
    join(world, 5, 0, true, "normal");
    join(world, 2, 1, true);
    expect(participantSetup(world, own, "fight").reaction).toBe("easy");
    expect(participantSetup(world, other, "flee").reaction).toBe("hard");
    expect(teamReaction(world, 0)).toBe("easy");
  });

  test("the DNA's preset when fighting, the carrier's when fleeing", () => {
    const world = textWorld(MAP);
    const circle = creepOf(world, 0, "circle");
    expect(participantSetup(world, circle, "fight").gambits).toEqual(
      defaultGambits("circle"),
    );
    expect(participantSetup(world, circle, "flee").gambits).toEqual(
      presetGambits("carrier"),
    );
  });

  test("the seed is a uint32 of the world seed and the stub id", () => {
    const seeds = [1, 2, 3, 1000].map((id) => battleSeed(42, id));
    expect(new Set(seeds).size).toBe(4);
    for (const seed of seeds) {
      expect(Number.isSafeInteger(seed) && seed >= 0 && seed < 2 ** 32).toBe(
        true,
      );
    }
    expect(battleSeed(42, 7)).toBe(battleSeed(42, 7));
    expect(battleSeed(43, 7)).not.toBe(battleSeed(42, 7));
  });

  test("a stub's setup creates a battle, its creeps placed side by side", () => {
    const world = textWorld(MAP);
    const a = creepOf(world, 0, "circle");
    const b = creepOf(world, 1, "square");
    const stub: Battle = {
      id: 77,
      window: windowAround(world, { x: 13, y: 3 }),
      sides: [
        { kind: "team", team: 0 },
        { kind: "team", team: 1 },
      ],
      participants: [
        { id: a.id, side: 0, stance: "fight" as const },
        { id: b.id, side: 1, stance: "flee" as const },
      ].sort((p, q) => p.id - q.id),
      openedTick: 0,
      x: 13,
      y: 3,
    };
    const { setup, placed } = battleSetup(world, stub);
    expect(placed).toEqual([a.id, b.id]);
    expect(setup.seed).toBe(battleSeed(world.seed, 77));
    const state = createBattle(setup, loadBattleParams());
    expect(state.participants.map((p) => [p.id, p.side, p.name])).toEqual([
      [1, 0, a.name],
      [2, 1, b.name],
    ]);
  });
});
