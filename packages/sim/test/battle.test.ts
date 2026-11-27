import { describe, expect, test } from "vitest";
import {
  SYSTEM_PLAYER_ID,
  windowAround,
  type BattleEndCommand,
  type BattleExitCommand,
} from "../src/battle.ts";
import { validate, type Command } from "../src/commands.ts";
import { dominate, join } from "../src/domination.ts";
import { capacity } from "../src/economy.ts";
import { eventsFor, type SimEvent } from "../src/events.ts";
import { step } from "../src/step.ts";
import { view } from "../src/view.ts";
import { updateVision } from "../src/vision.ts";
import type { Creep, WorldState } from "../src/world.ts";
import { paramsWith, textWorld } from "./helpers.ts";

// 30 × 7, the cores in opposite corners; a rock at (14, 3).
const MAP = [
  "A.............................",
  "..............................",
  "..............................",
  "..............#...............",
  "..............................",
  "..............................",
  ".............................B",
];

type Placed = [team: number, dna: Creep["dna"], x: number, y: number];

/** The world's own creeps (two of each DNA per team), placed; the rest idle at the cores. */
function world(placed: Placed[], params = textWorld(MAP).params) {
  const w = textWorld(MAP, params);
  const used = new Set<Creep>();
  const creeps = placed.map(([team, dna, x, y]) => {
    const creep = w.creeps.find(
      (c) => c.team === team && c.dna === dna && !used.has(c),
    )!;
    used.add(creep);
    Object.assign(creep, { x, y });
    return creep;
  });
  updateVision(w);
  return { w, creeps };
}

/** `hunter` attacks `prey` next to it: the battle opens in this tick. */
function attack(w: WorldState, hunter: Creep, prey: Creep): SimEvent[] {
  hunter.order = { type: "approach", targetId: prey.id, intent: "attack" };
  return step(w, []);
}

const system = (command: Command) => ({ playerId: SYSTEM_PLAYER_ID, command });

const exit = (
  w: WorldState,
  creep: Creep,
  fields: Partial<BattleExitCommand>,
): BattleExitCommand => ({
  type: "battleExit",
  battleId: creep.battle!,
  creepId: creep.id,
  outcome: "escaped",
  hp: 10,
  cargo: { materia: 0, cristal: 0 },
  cell: { x: creep.x, y: creep.y },
  by: null,
  ...fields,
});

const survivor = (creep: Creep, hp = 10) => ({
  creepId: creep.id,
  hp,
  cargo: { ...creep.cargo },
  cell: { x: creep.x, y: creep.y },
});

describe("the battle opens (junction O-1, O-5, D5)", () => {
  test("on the victim's cell, the bubble centered on it, both sides locked", () => {
    const { w, creeps } = world([
      [0, "circle", 12, 3],
      [1, "square", 13, 3],
    ]);
    const [hunter, prey] = creeps as [Creep, Creep];
    const events = attack(w, hunter, prey);
    expect(events.map((e) => e.type)).toEqual(["encounter", "battleOpened"]);
    const [battle] = w.battles;
    expect(battle).toEqual({
      id: battle!.id,
      window: { x: 9, y: 1, width: 9, height: 5 },
      sides: [
        { kind: "team", team: 0 },
        { kind: "team", team: 1 },
      ],
      participants: [
        { id: hunter.id, side: 0, stance: "fight" },
        { id: prey.id, side: 1, stance: "fight" },
      ],
      openedTick: w.tick - 1,
      entered: 2,
      x: 13,
      y: 3,
    });
    for (const creep of [hunter, prey]) {
      expect(creep).toMatchObject({
        battle: battle!.id,
        engagement: null,
        order: { type: "stop" },
      });
    }
  });

  test("the bubble shifts to stay inside the map", () => {
    const { w } = world([]);
    expect(windowAround(w, { x: 1, y: 0 })).toEqual({
      x: 0,
      y: 0,
      width: 9,
      height: 5,
    });
    expect(windowAround(w, { x: 29, y: 6 })).toEqual({
      x: 21,
      y: 2,
      width: 9,
      height: 5,
    });
  });

  test("a locked creep keeps still: no autopilot, no order, no regeneration", () => {
    const { w, creeps } = world([
      [0, "circle", 12, 3],
      [1, "square", 13, 3],
    ]);
    const [hunter, prey] = creeps as [Creep, Creep];
    join(w, 7, 1, false);
    attack(w, hunter, prey);
    // Domination stays allowed (O-5); world orders do not.
    expect(dominate(w, 7, prey.id)).toBeUndefined();
    const order = {
      type: "order",
      creepId: prey.id,
      order: { type: "moveTo", x: 20, y: 3 },
    } as const;
    expect(validate(w, order, 7)).toBe("inBattle");
    prey.rules = [
      { when: { type: "always" }, then: { type: "moveTo", x: 20, y: 3 } },
    ];
    prey.hp = 1_000;
    for (let i = 0; i < 120; i++) step(w, []);
    expect(prey).toMatchObject({
      x: 13,
      y: 3,
      hp: 1_000,
      order: { type: "stop" },
      activity: "fighting",
    });
  });
});

describe("joins (junction D6, J-1..J-3)", () => {
  test("an attacker inside the bubble joins its team's side; an ally of the victim, the other", () => {
    const { w, creeps } = world([
      [0, "circle", 12, 3],
      [1, "square", 13, 3],
      [0, "triangle", 10, 2],
      [1, "triangle", 16, 4],
    ]);
    const [hunter, prey, mate, ally] = creeps as [Creep, Creep, Creep, Creep];
    attack(w, hunter, prey);
    mate.order = { type: "approach", targetId: prey.id, intent: "attack" };
    ally.order = { type: "approach", targetId: hunter.id, intent: "attack" };
    const events = step(w, []);
    expect(
      events.map((e) => [e.type, e.type === "battleJoined" && e.side]),
    ).toEqual([
      ["battleJoined", 0],
      ["battleJoined", 1],
    ]);
    const [battle] = w.battles;
    expect(battle!.participants.map((p) => [p.id, p.side])).toEqual(
      [
        [hunter.id, 0],
        [prey.id, 1],
        [mate.id, 0],
        [ally.id, 1],
      ].sort((a, b) => a[0]! - b[0]!),
    );
    expect([mate.battle, ally.battle]).toEqual([battle!.id, battle!.id]);
  });

  test("an attacker outside the bubble walks in first", () => {
    const { w, creeps } = world([
      [0, "circle", 12, 3],
      [1, "square", 13, 3],
      [0, "circle", 3, 3],
    ]);
    const [hunter, prey, late] = creeps as [Creep, Creep, Creep];
    attack(w, hunter, prey);
    late.order = { type: "approach", targetId: prey.id, intent: "attack" };
    step(w, []);
    expect(late.battle).toBeNull();
    for (let i = 0; i < 600 && late.battle === null; i++) step(w, []);
    expect(late.battle).toBe(w.battles[0]!.id);
    expect(late.x).toBeGreaterThanOrEqual(9);
  });

  test("a full side waits at the edge, its approach intact, until a place opens", () => {
    const params = paramsWith((p) => {
      p.battle.sideCap = 1;
    });
    const { w, creeps } = world(
      [
        [0, "circle", 12, 3],
        [1, "square", 13, 3],
        [0, "triangle", 11, 3],
      ],
      params,
    );
    const [hunter, prey, mate] = creeps as [Creep, Creep, Creep];
    attack(w, hunter, prey);
    mate.order = { type: "approach", targetId: prey.id, intent: "attack" };
    for (let i = 0; i < 10; i++) step(w, []);
    expect(mate.battle).toBeNull();
    expect(mate).toMatchObject({ x: 11, y: 3 });
    expect(mate.order).toMatchObject({ type: "approach", targetId: prey.id });
    step(w, [system(exit(w, hunter, {}))]);
    expect(mate.battle).toBe(w.battles[0]!.id);
  });

  test("an extortion of a participant stops at the approach (J-2)", () => {
    const { w, creeps } = world([
      [0, "circle", 12, 3],
      [1, "square", 13, 3],
      [0, "triangle", 11, 3],
    ]);
    const [hunter, prey, mate] = creeps as [Creep, Creep, Creep];
    prey.cargo.cristal = 5;
    attack(w, hunter, prey);
    mate.order = { type: "approach", targetId: prey.id, intent: "extort" };
    for (let i = 0; i < 30 && mate.order.type === "approach"; i++) step(w, []);
    expect(mate.battle).toBeNull();
    expect(w.encounters).toEqual([]);
    expect(mate.order).toEqual({ type: "stop" });
  });
});

describe("battleExit (junction X-1, X-2, D7)", () => {
  test("a death removes the creep, its killer named, the stub without it", () => {
    const { w, creeps } = world([
      [0, "circle", 12, 3],
      [1, "square", 13, 3],
    ]);
    const [hunter, prey] = creeps as [Creep, Creep];
    attack(w, hunter, prey);
    const battleId = prey.battle!;
    const events = step(w, [
      system(exit(w, prey, { outcome: "died", hp: 0, by: hunter.id })),
    ]);
    expect(w.creeps).not.toContain(prey);
    expect(w.battles[0]!.participants.map((p) => p.id)).toEqual([hunter.id]);
    expect(events).toMatchObject([
      {
        type: "died",
        creep: { id: prey.id },
        by: { id: hunter.id },
        battle: battleId,
        x: 13,
        y: 3,
        teams: [0, 1],
      },
    ]);
  });

  test("an escape comes back on its cell with its HP and load, running home with the bonus", () => {
    const { w, creeps } = world([
      [0, "circle", 12, 3],
      [1, "square", 13, 3],
    ]);
    const [hunter, prey] = creeps as [Creep, Creep];
    attack(w, hunter, prey);
    const events = step(w, [
      system(
        exit(w, prey, {
          hp: 42,
          cargo: { materia: 2, cristal: 1 },
          cell: { x: 17, y: 5 },
        }),
      ),
    ]);
    expect(prey).toMatchObject({
      battle: null,
      hp: 42_000,
      cargo: { materia: 2, cristal: 1 },
      order: { type: "flee", untilTick: w.tick - 1 + 60 },
    });
    // It already ran a tick.
    expect(Math.abs(prey.x - 17) + Math.abs(prey.y - 5)).toBeLessThanOrEqual(1);
    expect(events).toMatchObject([
      {
        type: "battleLeft",
        creep: { id: prey.id },
        reason: "edge",
        hp: 42,
        cargo: { materia: 2, cristal: 1 },
        x: 17,
        y: 5,
      },
    ]);
  });
});

describe("battleEnd (junction X-3, X-4, D8)", () => {
  test("the winners loot the piles, cristal first and in id order; the rest is spoils", () => {
    const { w, creeps } = world([
      [0, "circle", 12, 3],
      [1, "square", 13, 3],
      [0, "circle", 11, 3],
    ]);
    const [hunter, prey, mate] = creeps as [Creep, Creep, Creep];
    attack(w, hunter, prey);
    mate.order = { type: "approach", targetId: prey.id, intent: "attack" };
    step(w, []);
    const room = capacity(hunter, w.teams[0]!, w.params);
    hunter.cargo = { materia: room - 3, cristal: 0 };
    const battleId = hunter.battle!;
    const pile = { materia: 20, cristal: 2 };
    const events = step(w, [
      system(exit(w, prey, { outcome: "died", hp: 0, by: hunter.id })),
      system({
        type: "battleEnd",
        battleId,
        winnerSide: 0,
        reason: "won",
        survivors: [survivor(hunter, 50), survivor(mate, 60)],
        piles: [{ cell: { x: 13, y: 3 }, cargo: pile }],
      }),
    ]);
    expect(w.battles).toEqual([]);
    // Hunter (lower id): its 3 free units, the 2 cristal and 1 materia.
    expect(hunter.cargo).toEqual({ materia: room - 2, cristal: 2 });
    expect(mate.cargo).toEqual({ materia: room, cristal: 0 });
    expect(w.spoils).toMatchObject([
      { x: 13, y: 3, cargo: { materia: 19 - room, cristal: 0 } },
    ]);
    expect([hunter.battle, mate.battle, hunter.hp, mate.hp]).toEqual([
      null,
      null,
      50_000,
      60_000,
    ]);
    const ended = events.find((e) => e.type === "battleEnded");
    expect(ended).toMatchObject({
      battle: battleId,
      reason: "won",
      winner: { side: 0, team: 0 },
      sideTeams: [0, 1],
      survivors: [{ id: hunter.id }, { id: mate.id }],
      loot: [
        { creep: { id: hunter.id }, taken: { materia: 1, cristal: 2 } },
        { creep: { id: mate.id }, taken: { materia: room, cristal: 0 } },
      ],
      spoils: [w.spoils[0]!.id],
      teams: [0, 1],
    });
  });

  test("by inactivity the survivors come back stopped, without the bonus, and every pile is spoils", () => {
    const { w, creeps } = world([
      [0, "circle", 12, 3],
      [1, "square", 13, 3],
    ]);
    const [hunter, prey] = creeps as [Creep, Creep];
    attack(w, hunter, prey);
    const events = step(w, [
      system({
        type: "battleEnd",
        battleId: hunter.battle!,
        winnerSide: null,
        reason: "idle",
        survivors: [survivor(hunter), survivor(prey)],
        piles: [{ cell: { x: 12, y: 2 }, cargo: { materia: 0, cristal: 3 } }],
      }),
    ]);
    expect(events.map((e) => e.type)).toEqual([
      "battleLeft",
      "battleLeft",
      "battleEnded",
    ]);
    expect(events[0]).toMatchObject({ reason: "idle" });
    expect([hunter.order, prey.order]).toEqual([
      { type: "stop" },
      { type: "stop" },
    ]);
    expect(w.spoils).toMatchObject([{ x: 12, y: 2, cargo: { cristal: 3 } }]);
  });

  test("with nobody left, the piles are spoils", () => {
    const { w, creeps } = world([
      [0, "circle", 12, 3],
      [1, "square", 13, 3],
    ]);
    const [hunter, prey] = creeps as [Creep, Creep];
    attack(w, hunter, prey);
    const battleId = hunter.battle!;
    step(w, [
      system(exit(w, hunter, { outcome: "died", hp: 0, by: prey.id })),
      system(exit(w, prey, { outcome: "died", hp: 0, by: hunter.id })),
      system({
        type: "battleEnd",
        battleId,
        winnerSide: null,
        reason: "empty",
        survivors: [],
        piles: [{ cell: { x: 13, y: 3 }, cargo: { materia: 4, cristal: 0 } }],
      }),
    ]);
    expect(w.creeps).not.toContain(hunter);
    expect(w.creeps).not.toContain(prey);
    expect(w.battles).toEqual([]);
    expect(w.spoils).toMatchObject([{ cargo: { materia: 4, cristal: 0 } }]);
  });
});

describe("the result commands are the host's only (junction plan P2)", () => {
  function opened() {
    const { w, creeps } = world([
      [0, "circle", 12, 3],
      [1, "square", 13, 3],
      [0, "square", 20, 3],
    ]);
    const [hunter, prey, outsider] = creeps as [Creep, Creep, Creep];
    attack(w, hunter, prey);
    return { w, hunter, prey, outsider, battleId: hunter.battle! };
  }

  test("battleExit: system only, a known battle, a participant, a valid return", () => {
    const { w, hunter, outsider, battleId } = opened();
    const check = (command: BattleExitCommand, playerId = SYSTEM_PLAYER_ID) =>
      validate(w, command, playerId);
    expect(check(exit(w, hunter, {}))).toBeNull();
    expect(check(exit(w, hunter, {}), 1)).toBe("notSystem");
    expect(check({ ...exit(w, hunter, {}), battleId: 9999 })).toBe(
      "unknownBattle",
    );
    expect(check({ ...exit(w, hunter, {}), creepId: outsider.id })).toBe(
      "notInBattle",
    );
    const max = w.params.hp.dna.circle.max;
    const room = capacity(hunter, w.teams[0]!, w.params);
    for (const bad of [
      { hp: 0 },
      { hp: max + 1 },
      { cargo: { materia: room + 1, cristal: 0 } },
      { cargo: { materia: -1, cristal: 0 } },
      { cell: { x: 14, y: 3 } },
      { cell: { x: 30, y: 3 } },
    ]) {
      expect(check(exit(w, hunter, bad)), JSON.stringify(bad)).toBe(
        "invalidResult",
      );
    }
    expect(check(exit(w, hunter, { hp: max }))).toBeNull();
    expect(battleId).toBe(hunter.battle);
  });

  test("battleEnd: the survivors are the participants left, the reason fits the winner", () => {
    const { w, hunter, prey, battleId } = opened();
    const end = (fields: Partial<BattleEndCommand>): BattleEndCommand => ({
      type: "battleEnd",
      battleId,
      winnerSide: null,
      reason: "idle",
      survivors: [survivor(hunter), survivor(prey)],
      piles: [],
      ...fields,
    });
    const check = (command: BattleEndCommand, playerId = SYSTEM_PLAYER_ID) =>
      validate(w, command, playerId);
    expect(check(end({}))).toBeNull();
    expect(check(end({}), 1)).toBe("notSystem");
    expect(check(end({ battleId: 9999 }))).toBe("unknownBattle");
    for (const bad of [
      end({ survivors: [survivor(hunter)] }),
      end({
        survivors: [survivor(prey), survivor(hunter)].reverse().slice(0, 1),
      }),
      end({ winnerSide: 0 }),
      end({ reason: "won", winnerSide: 0 }),
      end({ reason: "empty" }),
      end({ survivors: [survivor(hunter, 0), survivor(prey)] }),
      end({
        piles: [{ cell: { x: 14, y: 3 }, cargo: { materia: 1, cristal: 0 } }],
      }),
    ]) {
      expect(check(bad), JSON.stringify(bad)).toBe("invalidResult");
    }
    // A client cannot send them through the step either.
    step(w, [{ playerId: 1, command: end({}) }]);
    expect(w.battles).toHaveLength(1);
  });

  test("the system commands are not logged as a player's", () => {
    const { w, hunter, prey } = opened();
    const before = JSON.stringify(w.players);
    step(w, [
      system({
        type: "battleEnd",
        battleId: hunter.battle!,
        winnerSide: null,
        reason: "idle",
        survivors: [survivor(hunter), survivor(prey)],
        piles: [],
      }),
    ]);
    expect(JSON.stringify(w.players)).toBe(before);
  });
});

describe("the audience and the view (junction K-2, K-3, D16)", () => {
  test("a team with a creep in the battle hears every event of it; another, only in sight", () => {
    const { w, creeps } = world([
      [0, "square", 1, 0],
      [1, "square", 2, 0],
      [0, "circle", 4, 1],
    ]);
    const [hunter, prey, mate] = creeps as [Creep, Creep, Creep];
    attack(w, hunter, prey);
    mate.order = { type: "approach", targetId: prey.id, intent: "attack" };
    const events = step(w, []);
    expect(events).toMatchObject([{ type: "battleJoined", teams: [0, 1] }]);
    // An escape far from team 1's sight: team 1 still hears it.
    const far = { x: 20, y: 3 };
    const escaped = step(w, [system(exit(w, hunter, { cell: far }))]);
    expect(w.memory[1]!.visible[far.y * w.map.width + far.x]).toBe(0);
    expect(escaped).toMatchObject([
      { type: "battleLeft", ...far, teams: [0, 1] },
    ]);
    expect(eventsFor(escaped, 1)).toHaveLength(1);
  });

  test("the stub reaches the participants' teams without the stances", () => {
    const { w, creeps } = world([
      [0, "circle", 12, 3],
      [1, "square", 13, 3],
    ]);
    const [hunter, prey] = creeps as [Creep, Creep];
    prey.rules = [{ when: { type: "always" }, then: { type: "flee" } }];
    attack(w, hunter, prey);
    expect(w.battles[0]!.participants.map((p) => p.stance)).toContain("flee");
    for (const team of [0, 1]) {
      const seen = view(w, team);
      expect(seen.battles.map((b) => b.id)).toEqual([w.battles[0]!.id]);
      expect(JSON.stringify(seen)).not.toContain("stance");
    }
  });
});
