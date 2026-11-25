import { describe, expect, test } from "vitest";
import { SYSTEM_PLAYER_ID, type BattleEndCommand } from "../src/battle.ts";
import type { Command } from "../src/commands.ts";
import { dominate, join, orderRefusal } from "../src/domination.ts";
import { eventsFor } from "../src/events.ts";
import { raiderRules } from "../src/presets.ts";
import { step } from "../src/step.ts";
import { fullView, view } from "../src/view.ts";
import { updateVision } from "../src/vision.ts";
import { bandCells, birthInterval } from "../src/wanderers.ts";
import type { Creep, Wanderer, WorldState } from "../src/world.ts";
import { creepOf, paramsWith, run, textWorld } from "./helpers.ts";

// 30 × 13: the cores in opposite corners, a river on row 6 with a crossing.
const MAP = [
  "A.............................",
  "..............................",
  "..............................",
  "..............................",
  "..............................",
  "..............................",
  "~~~~~~~~~~~~~~==~~~~~~~~~~~~~~",
  "..............................",
  "..............................",
  "..............................",
  "..............................",
  "..............................",
  ".............................B",
];

/** The test params with wanderers on: a band of 2 rows, the cap 4. */
const params = paramsWith((p) => {
  p.wanderers.cap = 4;
  p.wanderers.bandRows = 2;
});

function world(): WorldState {
  return textWorld(MAP, params);
}

/** A wanderer placed by hand, at full HP, stopped. */
function addWanderer(
  w: WorldState,
  x: number,
  y: number,
  over: Partial<Wanderer> = {},
): Wanderer {
  const wanderer: Wanderer = {
    id: w.nextId++,
    dna: "circle",
    name: "Andarilho",
    hp: w.params.wanderers.hp * 1000,
    cargo: { materia: 0, cristal: 0 },
    battle: null,
    order: { type: "stop" },
    movePoints: 0,
    path: null,
    spared: [],
    x,
    y,
    ...over,
  };
  w.wanderers.push(wanderer);
  w.wanderers.sort((a, b) => a.id - b.id);
  return wanderer;
}

function place(creep: Creep, x: number, y: number, materia = 0): Creep {
  Object.assign(creep, { x, y, cargo: { materia, cristal: 0 } });
  return creep;
}

const system = (command: Command) => ({ playerId: SYSTEM_PLAYER_ID, command });

describe("birth (junction W-1, D14)", () => {
  test("the band: standable rows within bandRows of the river, outside the core zones", () => {
    const w = world();
    const cells = bandCells(w);
    expect(cells.every((c) => c.y >= 4 && c.y <= 8)).toBe(true);
    // On the river row, only the crossing.
    expect(cells.filter((c) => c.y === 6).map((c) => c.x)).toEqual([14, 15]);
    // The crossing is in the band; the river is not.
    expect(cells).toContainEqual({ x: 14, y: 6 });
    // The core zones (radius 8, Manhattan) stay out: (0, 4) is 4 from A.
    expect(cells).not.toContainEqual({ x: 0, y: 4 });
    expect(cells).toContainEqual({ x: 9, y: 4 });
  });

  test("the interval shrinks linearly from start to end over the world's duration", () => {
    const w = world();
    const { durationSeconds } = w.params.world;
    expect(birthInterval(w, 0)).toBe(3600);
    expect(birthInterval(w, durationSeconds / 2)).toBe(2250);
    expect(birthInterval(w, durationSeconds)).toBe(900);
    expect(birthInterval(w, durationSeconds * 2)).toBe(900);
  });

  test("the first at firstSeconds, on a band cell drawn by the rng, then up to the cap", () => {
    const w = world();
    run(w, 3600);
    expect(w.wanderers).toHaveLength(0);
    const events = step(w, []);
    expect(w.wanderers).toHaveLength(1);
    const [born] = w.wanderers;
    expect(bandCells(w)).toContainEqual({ x: born!.x, y: born!.y });
    expect(born!.hp).toBe(60_000);
    expect(events.filter((e) => e.type === "wandererBorn")).toEqual([
      expect.objectContaining({
        wanderer: { id: born!.id, team: null, dna: "circle", name: born!.name },
        x: born!.x,
        y: born!.y,
      }),
    ]);
    expect(w.nextWandererTick).toBe(3600 + birthInterval(w, 3600));
    // The same seed draws the same cell.
    const again = world();
    run(again, 3601);
    expect(again.wanderers[0]).toMatchObject({ x: born!.x, y: born!.y });
    // At the cap, the next birth waits.
    for (let i = 0; i < 3; i++) addWanderer(w, 20, 8);
    w.nextWandererTick = w.tick;
    run(w, 5);
    expect(w.wanderers).toHaveLength(4);
  });

  test("no wanderer with the cap at 0", () => {
    const w = textWorld(MAP);
    run(w, 3700);
    expect(w.wanderers).toHaveLength(0);
  });
});

describe("roaming and targets (W-2, owner 2026-11-25)", () => {
  test("with nothing in sight it roams to band cells at the circle's speed", () => {
    const w = world();
    const wanderer = addWanderer(w, 15, 4);
    step(w, []);
    expect(wanderer.order.type).toBe("roam");
    const order = wanderer.order as Extract<
      Wanderer["order"],
      { type: "roam" }
    >;
    expect(bandCells(w)).toContainEqual({ x: order.x, y: order.y });
    // 5 cells per minute on jungle: a cell every 12 ticks.
    const start = { x: wanderer.x, y: wanderer.y };
    run(w, 24);
    const moved =
      Math.abs(wanderer.x - start.x) + Math.abs(wanderer.y - start.y);
    expect(moved).toBeGreaterThanOrEqual(1);
    expect(moved).toBeLessThanOrEqual(3);
  });

  test("it goes for a loaded team creep in sight; not an empty one", () => {
    const w = world();
    const wanderer = addWanderer(w, 15, 4);
    const empty = place(creepOf(w, 0, "square"), 17, 4);
    step(w, []);
    expect(wanderer.order.type).toBe("roam");
    const loaded = place(creepOf(w, 1, "triangle"), 18, 4, 5);
    updateVision(w);
    step(w, []);
    expect(wanderer.order).toEqual({ type: "approach", targetId: loaded.id });
    expect(empty.battle).toBeNull();
  });

  test("it attacks with no dialogue: the battle opens, the wanderers on side 0", () => {
    const w = world();
    const wanderer = addWanderer(w, 15, 4);
    const victim = place(creepOf(w, 1, "triangle"), 16, 4, 5);
    const events = step(w, []);
    const opened = events.find((e) => e.type === "battleOpened")!;
    expect(opened).toMatchObject({
      cause: "wanderer",
      encounter: null,
      sides: [
        { team: null, creeps: [{ id: wanderer.id, team: null }] },
        { team: 1, creeps: [{ id: victim.id }] },
      ],
    });
    expect(events.some((e) => e.type === "encounter")).toBe(false);
    const battle = w.battles[0]!;
    expect(battle.sides).toEqual([
      { kind: "wanderers" },
      { kind: "team", team: 1 },
    ]);
    expect(wanderer.battle).toBe(battle.id);
    expect(victim.battle).toBe(battle.id);
    // Locked: it does not move.
    run(w, 30);
    expect(wanderer).toMatchObject({ x: 15, y: 4 });
  });

  test("it never steps into a core zone, nor goes for a creep inside one", () => {
    const w = world();
    // Core A at (0, 0), zone radius 8: (5, 4) is 9 away, (4, 4) is 8.
    const wanderer = addWanderer(w, 7, 4);
    const prey = place(creepOf(w, 0, "triangle"), 4, 4, 5);
    run(w, 120);
    expect(prey.battle).toBeNull();
    expect(Math.abs(wanderer.x) + Math.abs(wanderer.y)).toBeGreaterThan(8);
    // Out of the zone, the same creep is a target.
    const out = place(creepOf(w, 0, "circle"), 10, 4, 5);
    wanderer.x = 12;
    wanderer.y = 4;
    updateVision(w);
    step(w, []);
    expect(wanderer.order).toEqual({ type: "approach", targetId: out.id });
  });

  test("it joins a battle with a team in sight, on the wanderers' side", () => {
    const w = world();
    const a = place(creepOf(w, 0, "square"), 15, 4);
    const b = place(creepOf(w, 1, "square"), 16, 4);
    updateVision(w);
    a.order = { type: "approach", targetId: b.id, intent: "attack" };
    step(w, []);
    const battle = w.battles[0]!;
    const wanderer = addWanderer(w, 19, 4);
    const events = step(w, []);
    expect(wanderer.battle).toBe(battle.id);
    expect(battle.sides[2]).toEqual({ kind: "wanderers" });
    expect(events.find((e) => e.type === "battleJoined")).toMatchObject({
      creep: { id: wanderer.id, team: null },
      side: 2,
    });
    // A second wanderer joins the same side.
    const second = addWanderer(w, 20, 5);
    step(w, []);
    expect(second.battle).toBe(battle.id);
    expect(battle.participants.find((p) => p.id === second.id)!.side).toBe(2);
  });
});

describe("leaving a battle (W-3, W-6, W-7)", () => {
  /** A wanderer and a loaded triangle in a battle the wanderer opened. */
  function fight() {
    const w = world();
    const wanderer = addWanderer(w, 15, 4);
    const victim = place(creepOf(w, 1, "triangle"), 16, 4, 5);
    step(w, []);
    return { w, wanderer, victim, battle: w.battles[0]! };
  }

  test("a wanderer that wins carries the loot up to the circle's capacity", () => {
    const { w, wanderer, victim, battle } = fight();
    const died: Command = {
      type: "battleExit",
      battleId: battle.id,
      creepId: victim.id,
      outcome: "died",
      hp: 0,
      cargo: { materia: 0, cristal: 0 },
      cell: { x: 16, y: 4 },
      by: wanderer.id,
    };
    const end: BattleEndCommand = {
      type: "battleEnd",
      battleId: battle.id,
      winnerSide: 0,
      reason: "won",
      survivors: [
        {
          creepId: wanderer.id,
          hp: 40,
          cargo: { materia: 0, cristal: 0 },
          cell: { x: 15, y: 4 },
        },
      ],
      piles: [{ cell: { x: 16, y: 4 }, cargo: { materia: 15, cristal: 0 } }],
    };
    const events = step(w, [system(died), system(end)]);
    expect(w.battles).toEqual([]);
    expect(wanderer).toMatchObject({
      battle: null,
      hp: 40_000,
      cargo: { materia: 10, cristal: 0 },
    });
    expect(w.spoils).toEqual([
      expect.objectContaining({
        x: 16,
        y: 4,
        cargo: { materia: 5, cristal: 0 },
      }),
    ]);
    expect(events.find((e) => e.type === "died")).toMatchObject({
      creep: { id: victim.id },
      by: { id: wanderer.id, team: null },
    });
    expect(events.find((e) => e.type === "battleEnded")).toMatchObject({
      winner: { side: 0, team: null },
      sideTeams: [null, 1],
      loot: [
        { creep: { id: wanderer.id }, taken: { materia: 10, cristal: 0 } },
      ],
    });
  });

  test("a dead wanderer leaves the state; one that escapes roams again, no flee", () => {
    const { w, wanderer, victim, battle } = fight();
    const escape: Command = {
      type: "battleExit",
      battleId: battle.id,
      creepId: wanderer.id,
      outcome: "escaped",
      hp: 30,
      cargo: { materia: 0, cristal: 0 },
      cell: { x: 14, y: 4 },
      by: null,
    };
    step(w, [system(escape)]);
    expect(wanderer).toMatchObject({ battle: null, hp: 30_000, x: 14, y: 4 });
    expect(wanderer.order.type).not.toBe("approach");
    // It spares the creep it fought (W-7) while the battle goes on.
    expect(wanderer.spared).toEqual([
      { creep: victim.id, untilTick: w.tick - 1 + 600 },
    ]);
    const other = fight();
    const died: Command = {
      type: "battleExit",
      battleId: other.battle.id,
      creepId: other.wanderer.id,
      outcome: "died",
      hp: 0,
      cargo: { materia: 0, cristal: 0 },
      cell: { x: 15, y: 4 },
      by: other.victim.id,
    };
    const events = step(other.w, [system(died)]);
    expect(other.w.wanderers).toEqual([]);
    expect(events.find((e) => e.type === "died")).toMatchObject({
      creep: { id: other.wanderer.id, team: null },
      by: { id: other.victim.id, team: 1 },
    });
  });

  test("after a battle it leaves the creeps of that battle alone for spareSeconds", () => {
    const { w, wanderer, victim, battle } = fight();
    const escape: Command = {
      type: "battleExit",
      battleId: battle.id,
      creepId: victim.id,
      outcome: "escaped",
      hp: 100,
      cargo: { materia: 5, cristal: 0 },
      cell: { x: 18, y: 4 },
      by: null,
    };
    const end: BattleEndCommand = {
      type: "battleEnd",
      battleId: battle.id,
      winnerSide: 0,
      reason: "won",
      survivors: [
        {
          creepId: wanderer.id,
          hp: 60,
          cargo: { materia: 0, cristal: 0 },
          cell: { x: 15, y: 4 },
        },
      ],
      piles: [],
    };
    step(w, [system(escape), system(end)]);
    victim.order = { type: "stop" };
    run(w, 5);
    expect(wanderer.order.type).toBe("roam");
    expect(victim.battle).toBeNull();
    // Another loaded creep is still fair game.
    const other = place(creepOf(w, 1, "circle"), wanderer.x + 2, wanderer.y, 3);
    updateVision(w);
    step(w, []);
    expect(wanderer.order).toEqual({ type: "approach", targetId: other.id });
    // Once spareSeconds are over, the first one is a target again.
    place(other, 28, 11, 0);
    victim.x = wanderer.x + 1;
    victim.y = wanderer.y;
    wanderer.spared = wanderer.spared.map((s) => ({ ...s, untilTick: w.tick }));
    updateVision(w);
    step(w, []);
    expect(wanderer.spared).toEqual([]);
    expect(victim.battle).not.toBeNull();
  });

  test("a wounded wanderer heals on the map like a creep, not in a battle", () => {
    const w = world();
    const wanderer = addWanderer(w, 15, 4, { hp: 30_000 });
    run(w, 60);
    // 10‰ of 60 per minute.
    expect(wanderer.hp).toBe(30_600);
    wanderer.battle = 999;
    run(w, 60);
    expect(wanderer.hp).toBe(30_600);
  });
});

describe("teams and wanderers (W-4, W-5)", () => {
  test("a team's creep can attack a wanderer: the battle opens with the declaration", () => {
    const w = world();
    const wanderer = addWanderer(w, 16, 4);
    const square = place(creepOf(w, 0, "square"), 15, 4);
    updateVision(w);
    square.order = {
      type: "approach",
      targetId: wanderer.id,
      intent: "attack",
    };
    const events = step(w, []);
    expect(events.find((e) => e.type === "encounter")).toMatchObject({
      aggressor: { id: square.id },
      victim: { id: wanderer.id, team: null },
      intent: "attack",
    });
    expect(w.battles[0]).toMatchObject({
      sides: [{ kind: "team", team: 0 }, { kind: "wanderers" }],
    });
    expect(wanderer.battle).toBe(w.battles[0]!.id);
  });

  test("an extortion of a wanderer is refused; the raider leaves them alone", () => {
    const w = world();
    const wanderer = addWanderer(w, 16, 4, {
      cargo: { materia: 10, cristal: 0 },
    });
    const triangle = place(creepOf(w, 0, "triangle"), 14, 4);
    updateVision(w);
    const player = 1;
    join(w, player, 0, false);
    dominate(w, player, triangle.id);
    expect(
      orderRefusal(w, player, triangle.id, {
        type: "approach",
        targetId: wanderer.id,
        intent: "extort",
      }),
    ).toBe("invalidOrder");
    expect(
      orderRefusal(w, player, triangle.id, {
        type: "approach",
        targetId: wanderer.id,
        intent: "attack",
      }),
    ).toBeNull();
    const raider = place(creepOf(w, 0, "circle"), 17, 5);
    raider.rules = raiderRules();
    updateVision(w);
    step(w, []);
    expect(raider.order.type).not.toBe("approach");
  });

  test("the bots' rules count a wanderer in sight as an enemy", () => {
    const w = world();
    const circle = place(creepOf(w, 0, "circle"), 13, 4);
    circle.rules = [
      {
        when: { type: "enemyInSight", radius: 5, minCargo: 0 },
        then: { type: "approach", intent: "attack", radius: 5, minCargo: 0 },
      },
    ];
    step(w, []);
    expect(circle.order.type).not.toBe("approach");
    const wanderer = addWanderer(w, 16, 4);
    updateVision(w);
    step(w, []);
    expect(circle.order).toEqual({
      type: "approach",
      targetId: wanderer.id,
      intent: "attack",
    });
  });

  test("a team sees a wanderer only in its sight; the full view has them all", () => {
    const w = world();
    const wanderer = addWanderer(w, 15, 4);
    updateVision(w);
    expect(view(w, 0).wanderers).toEqual([]);
    expect(fullView(w).wanderers).toEqual([
      expect.objectContaining({ id: wanderer.id, x: 15, y: 4, hp: 60_000 }),
    ]);
    place(creepOf(w, 0, "circle"), 13, 4);
    updateVision(w);
    const seen = view(w, 0).wanderers;
    expect(seen).toHaveLength(1);
    expect(Object.keys(seen[0]!).sort()).toEqual(
      ["battle", "cargo", "dna", "hp", "id", "name", "x", "y"].sort(),
    );
    // Its birth reaches only the teams that see the cell.
    const w2 = world();
    run(w2, 3600);
    const events = step(w2, []);
    const born = events.find((e) => e.type === "wandererBorn")!;
    for (const team of [0, 1]) {
      const sees =
        w2.memory[team]!.visible[born.y * w2.map.width + born.x] === 1;
      expect(
        eventsFor(events, team).some((e) => e.type === "wandererBorn"),
      ).toBe(sees);
    }
  });
});
