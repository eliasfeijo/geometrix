import { describe, expect, test } from "vitest";
import { validate, type Command, type CommandInput } from "../src/commands.ts";
import { serialize } from "../src/serialize.ts";
import { step } from "../src/step.ts";
import { createWorld, type WorldState } from "../src/world.ts";
import { loadTestParams, run, textWorld } from "./helpers.ts";

const params = loadTestParams();

/** Players 1 and 2 on team 0, player 3 on team 1, joined through step. */
function world(): WorldState {
  const w = textWorld(["A.m....c.B"]);
  step(w, [
    { playerId: 1, command: { type: "join", team: 0, bot: false } },
    { playerId: 2, command: { type: "join", team: 0, bot: false } },
    { playerId: 3, command: { type: "join", team: 1, bot: false } },
  ]);
  return w;
}

const ownCreep = (w: WorldState, n = 0) =>
  w.creeps.filter((c) => c.team === 0)[n]!;
const as = (playerId: number, command: Command): CommandInput => ({
  playerId,
  command,
});

describe("validate", () => {
  test("never changes the state", () => {
    const w = world();
    w.teams[0]!.stock = { materia: 500, cristal: 500 };
    const creep = ownCreep(w);
    const before = serialize(w);
    const commands: Command[] = [
      { type: "join", team: 1, bot: false },
      { type: "dominate", creepId: creep.id },
      { type: "release" },
      { type: "order", creepId: creep.id, order: { type: "stop" } },
      { type: "setRules", creepId: creep.id, rules: [] },
      { type: "applyPreset", creepId: creep.id, preset: "cristalCollector" },
      { type: "produce", dna: "square", repeat: true },
      { type: "stopRepeat" },
      { type: "buyUpgrade", upgrade: "capacity" },
    ];
    for (const command of commands) validate(w, command, 1);
    expect(serialize(w)).toBe(before);
  });

  test.each([
    ["an unknown command", { type: "attack" }, "unknownCommand"],
    [
      "an unknown DNA",
      { type: "produce", dna: "hexagon", repeat: false },
      "invalidDna",
    ],
    [
      "an unknown upgrade",
      { type: "buyUpgrade", upgrade: "speed" },
      "invalidUpgrade",
    ],
    [
      "production without stock",
      { type: "produce", dna: "circle", repeat: false },
      "stock",
    ],
    [
      "an upgrade without stock",
      { type: "buyUpgrade", upgrade: "capacity" },
      "stock",
    ],
  ])("refuses %s", (_, command, reason) => {
    expect(validate(world(), command as Command, 1)).toBe(reason);
  });

  test.each<Command>([
    { type: "produce", dna: "circle", repeat: false },
    { type: "stopRepeat" },
    { type: "buyUpgrade", upgrade: "capacity" },
    { type: "dominate", creepId: 1 },
    { type: "setRules", creepId: 1, rules: [] },
  ])("refuses $type from a player who has not joined", (command) => {
    expect(validate(world(), command, 99)).toBe("unknownPlayer");
  });
});

describe("step, stage 1", () => {
  test("applies team commands for the player's team", () => {
    const w = world();
    w.teams[1]!.stock = { materia: 40, cristal: 160 };
    step(w, [
      as(3, { type: "produce", dna: "triangle", repeat: true }),
      as(3, { type: "buyUpgrade", upgrade: "capacity" }),
    ]);
    expect(w.teams[1]).toMatchObject({
      production: { dna: "triangle" },
      repeat: "triangle",
      upgrades: { capacity: true },
      stock: { materia: 0, cristal: 0 },
    });
    expect(w.teams[0]!.production).toBeNull();
    step(w, [as(3, { type: "stopRepeat" })]);
    expect(w.teams[1]!.repeat).toBeNull();
  });

  test("checks each command against the state left by the ones before it", () => {
    const w = world();
    w.teams[0]!.stock = { materia: 80, cristal: 20 };
    step(w, [
      as(1, { type: "produce", dna: "square", repeat: false }),
      as(2, { type: "produce", dna: "circle", repeat: false }),
    ]);
    expect(w.teams[0]!.production!.dna).toBe("square");
    expect(w.teams[0]!.stock).toEqual({ materia: 40, cristal: 10 });
  });

  test("skips a refused command and goes on with the next", () => {
    const w = world();
    const creep = ownCreep(w);
    step(w, [
      as(3, { type: "dominate", creepId: creep.id }),
      as(2, { type: "dominate", creepId: creep.id }),
    ]);
    expect(creep.dominatedBy).toBe(2);
  });

  test("a dominated creep follows its player, then goes back to its rules", () => {
    const w = world();
    const creep = ownCreep(w, 5);
    step(w, [
      as(1, {
        type: "applyPreset",
        creepId: creep.id,
        preset: "cristalCollector",
      }),
    ]);
    expect(creep.order).toMatchObject({ type: "gather" });
    step(w, [
      as(1, { type: "dominate", creepId: creep.id }),
      as(1, {
        type: "order",
        creepId: creep.id,
        order: { type: "moveTo", x: 1, y: 0 },
      }),
    ]);
    run(w, 20);
    expect(creep).toMatchObject({ x: 1, order: { type: "stop" } });
    step(w, [as(1, { type: "release" })]);
    expect(creep.order).toMatchObject({ type: "gather" });
  });

  test("the road builder preset takes no target (R spec D12)", () => {
    const w = world();
    const creep = ownCreep(w);
    step(w, [
      as(1, {
        type: "applyPreset",
        creepId: creep.id,
        preset: "roadBuilder",
        target: { x: 4, y: 0 },
      }),
    ]);
    expect(creep.rules).toEqual([]);
    step(w, [
      as(1, { type: "applyPreset", creepId: creep.id, preset: "roadBuilder" }),
    ]);
    expect(creep.rules[2]!.then).toEqual({ type: "buildRoad" });
  });
});

describe("replaying a command log", () => {
  test("gives the same state", () => {
    // Seed 42: deposits are ids 1-14, team 0 creeps 15-20, team 1 creeps 21-26.
    const log = new Map<number, CommandInput[]>([
      [
        0,
        [
          as(1, { type: "join", team: 0, bot: false }),
          as(3, { type: "join", team: 1, bot: false }),
        ],
      ],
      [
        10,
        [
          as(1, { type: "dominate", creepId: 15 }),
          as(3, {
            type: "applyPreset",
            creepId: 21,
            preset: "cristalCollector",
          }),
        ],
      ],
      [
        50,
        [
          as(1, {
            type: "order",
            creepId: 15,
            order: { type: "buildRoad", x: 20, y: 9 },
          }),
        ],
      ],
      [
        900,
        [
          as(1, { type: "release" }),
          as(3, { type: "produce", dna: "circle", repeat: true }),
        ],
      ],
    ]);
    const play = () => {
      const w = createWorld(42, params);
      for (let t = 0; t < 3000; t++) step(w, log.get(t) ?? []);
      return serialize(w);
    };
    expect(play()).toBe(play());
  });
});
