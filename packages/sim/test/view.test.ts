import { describe, expect, test } from "vitest";
import { collectorRules } from "../src/presets.ts";
import { serialize } from "../src/serialize.ts";
import { dropSpoil } from "../src/spoils.ts";
import { step } from "../src/step.ts";
import {
  fullView,
  isOwnCreep,
  isOwnEncounter,
  isOwnPlayer,
  isOwnTeam,
  ownTeam,
  view,
} from "../src/view.ts";
import { updateVision } from "../src/vision.ts";
import {
  createWorld,
  type Battle,
  type Creep,
  type Encounter,
  type WorldState,
} from "../src/world.ts";
import { creepOf, loadTestParams, run, textWorld } from "./helpers.ts";

const params = loadTestParams();

/** Seed 42 after the joins and a minute of autopilot, with roads and a job. */
function busyWorld(): WorldState {
  const world = createWorld(42, params);
  step(world, [
    { playerId: 1, command: { type: "join", team: 0, bot: true } },
    { playerId: 2, command: { type: "join", team: 1, bot: true } },
  ]);
  run(world, 60);
  const { map } = world;
  for (const i of [map.width * 20 + 9, 7, map.width * 3 + 30]) map.road[i] = 1;
  world.roadJobs.push({
    id: world.nextId++,
    team: 1,
    x: 5,
    y: 6,
    remainingSeconds: 30,
  });
  return world;
}

const withoutSimFields = (creep: Creep) => {
  const rest: Partial<Creep> = { ...creep };
  delete rest.path;
  delete rest.movePoints;
  delete rest.trip;
  delete rest.extortBlocks;
  return rest;
};

const withHostile = (creep: Creep) => ({
  ...withoutSimFields(creep),
  hostile:
    creep.order.type === "approach"
      ? { intent: creep.order.intent, target: creep.order.targetId }
      : null,
});

// 40 × 3. Core A sees x ≤ 8 on row 1, core B x ≥ 31; the middle is dark.
const ROWS = [
  "........................................",
  "A.........m.......#.................c..B",
  "........................................",
];
const WIDTH = ROWS[0]!.length;

/**
 * A world where team 1 has everything a view could leak: a creep in team 0's
 * sight with an order, rules and a dominating player; one out of sight; stock,
 * production, upgrades and repeat; a player who dominated; a road job and a
 * road out of sight.
 */
function leakyWorld() {
  const world = textWorld(ROWS);
  step(world, [
    { playerId: 1, command: { type: "join", team: 0, bot: false } },
    { playerId: 2, command: { type: "join", team: 1, bot: false } },
  ]);
  const enemy = creepOf(world, 1, "square");
  Object.assign(enemy, { x: 3, y: 1 });
  enemy.order = { type: "moveTo", x: 20, y: 1 };
  enemy.rules = collectorRules("cristal");
  enemy.dominatedBy = 2;
  enemy.cargo.cristal = 4;
  enemy.hp = 123_000;
  enemy.engagement = 777;
  const hidden = creepOf(world, 1, "circle");
  Object.assign(hidden, { x: 25, y: 1 });
  const rival = world.teams[1]!;
  rival.stock = { materia: 99, cristal: 77 };
  rival.production = { dna: "circle", remainingSeconds: 300 };
  rival.upgrades.capacity = true;
  rival.repeat = "triangle";
  world.players[1]!.lastDominateTick = 0;
  world.roadJobs.push({
    id: world.nextId++,
    team: 1,
    x: 22,
    y: 1,
    remainingSeconds: 50,
  });
  world.map.road[WIDTH + 23] = 1;
  updateVision(world);
  return { world, enemy, hidden };
}

describe("view", () => {
  test("has the team's own entities whole, minus the creeps' sim fields", () => {
    const world = busyWorld();
    const seen = view(world, 1);
    expect(seen.tick).toBe(world.tick);
    expect(seen.team).toBe(1);
    expect(seen.teams[1]).toEqual(world.teams[1]);
    expect(seen.teams[1]).not.toBe(world.teams[1]);
    const own = world.creeps.filter((c) => c.team === 1);
    expect(seen.creeps.filter((c) => c.team === 1)).toEqual(
      own.map(withHostile),
    );
    for (const creep of seen.creeps) {
      expect(creep).not.toHaveProperty("path");
      expect(creep).not.toHaveProperty("movePoints");
      expect(creep).not.toHaveProperty("trip");
    }
    expect(seen.roadJobs).toEqual(world.roadJobs.filter((j) => j.team === 1));
    expect(seen.players.find((p) => p.team === 1)).toEqual(
      world.players.find((p) => p.team === 1),
    );
  });

  test("keeps entities in id order and cells in increasing order", () => {
    const world = busyWorld();
    world.memory[0]!.road[40] = 1;
    world.memory[0]!.road[12] = 1;
    const seen = view(world, 0);
    const ids = (list: { id: number }[]) => list.map((e) => e.id);
    const sorted = (list: number[]) => [...list].sort((a, b) => a - b);
    expect(ids(seen.creeps)).toEqual(sorted(ids(seen.creeps)));
    expect(ids(seen.deposits)).toEqual(sorted(ids(seen.deposits)));
    expect(ids(seen.roadJobs)).toEqual(sorted(ids(seen.roadJobs)));
    expect(seen.roads).toEqual([12, 40]);
    expect(seen.visible).toEqual(sorted(seen.visible));
  });

  test("deposits, roads and cores come from the team's memory", () => {
    const { world } = leakyWorld();
    const memory = world.memory[0]!;
    const seen = view(world, 0);
    expect(seen.deposits).toEqual(memory.deposits);
    expect(seen.deposits).toEqual([]);
    // The road at x = 23 is out of sight: not in the view.
    expect(seen.roads).toEqual([]);
    expect(seen.teams[1]).toEqual({ id: 1, core: null, out: null });
    memory.cores.push({ team: 1, x: 39, y: 1 });
    memory.road[WIDTH + 23] = 1;
    memory.deposits.push({ ...world.deposits[0]!, amount: 3 });
    const later = view(world, 0);
    expect(later.teams[1]).toEqual({
      id: 1,
      core: { x: 39, y: 1 },
      out: null,
    });
    expect(later.roads).toEqual([WIDTH + 23]);
    expect(later.deposits).toEqual([{ ...world.deposits[0]!, amount: 3 }]);
  });

  test("known holds the terrain of explored cells and -1 elsewhere", () => {
    const { world } = leakyWorld();
    const memory = world.memory[0]!;
    const seen = view(world, 0);
    expect(seen.known).toHaveLength(world.map.terrain.length);
    seen.known.forEach((terrain, i) => {
      expect(terrain).toBe(
        memory.explored[i] === 1 ? world.map.terrain[i] : -1,
      );
    });
    expect(seen.known[WIDTH + 18]).toBe(-1);
    expect(seen.visible).toEqual(
      memory.visible.flatMap((v, i) => (v === 1 ? [i] : [])),
    );
  });

  test("nothing leaks: other teams only as spec D7 allows", () => {
    const { world, enemy, hidden } = leakyWorld();
    const seen = view(world, 0);
    const foreign = seen.creeps.filter((c) => c.team !== 0);
    expect(foreign).toEqual([
      {
        id: enemy.id,
        team: 1,
        dna: "square",
        name: enemy.name,
        hp: 123_000,
        engagement: 777,
        battle: null,
        x: 3,
        y: 1,
        cargo: { materia: 0, cristal: 4 },
        hostile: null,
      },
    ]);
    expect(seen.creeps.map((c) => c.id)).not.toContain(hidden.id);
    expect(JSON.stringify(seen)).not.toContain(`"${hidden.name}"`);
    expect(seen.teams[1]).toEqual({ id: 1, core: null, out: null });
    expect(seen.players).toEqual([
      world.players[0],
      { id: world.players[1]!.id, team: 1, bot: false },
    ]);
    expect(seen.roadJobs).toEqual([]);
    expect(seen.deposits).toEqual([]);
    expect(seen.roads).toEqual([]);
    // Nothing of team 1 beyond those fields, anywhere in the view.
    const json = JSON.stringify({
      ...seen,
      creeps: seen.creeps.filter((c) => c.team === 1),
      teams: seen.teams.filter((t) => t.id === 1),
      players: seen.players.filter((p) => p.team === 1),
    });
    for (const secret of [
      "stock",
      "production",
      "upgrades",
      "repeat",
      "rules",
      "order",
      "dominatedBy",
      "activity",
      "lastDominateTick",
      "remainingSeconds",
    ]) {
      expect(json).not.toContain(`"${secret}"`);
    }
    // And the enemy's own view does not show team 0's.
    const theirs = view(world, 1);
    // Their creep next to core A has seen it: its position, nothing else.
    expect(theirs.teams[0]).toEqual({
      id: 0,
      core: { x: 0, y: 1 },
      out: null,
    });
    expect(theirs.creeps.every((c) => c.team === 1 || !isOwnCreep(c))).toBe(
      true,
    );
  });

  test("an enemy creep is in the view only while in sight", () => {
    const { world, enemy } = leakyWorld();
    Object.assign(enemy, { x: 20, y: 1 });
    updateVision(world);
    expect(view(world, 0).creeps.map((c) => c.id)).not.toContain(enemy.id);
  });

  test("is pure: same state, same view, and the state is untouched", () => {
    const world = busyWorld();
    const before = serialize(world);
    expect(view(world, 0)).toEqual(view(world, 0));
    expect(serialize(world)).toBe(before);
  });

  test("is a shallow copy: new entities, nested objects shared with the state", () => {
    const world = busyWorld();
    const seen = view(world, 0);
    const creep = world.creeps[0]!;
    expect(seen.creeps[0]).not.toBe(creep);
    expect(seen.teams[0]).not.toBe(world.teams[0]);
    expect(seen.creeps[0]!.cargo).toBe(creep.cargo);
    expect(isOwnCreep(seen.creeps[0]!) && seen.creeps[0].rules).toBe(
      creep.rules,
    );
    // A first-level field does not follow the state; a nested one does.
    creep.x += 1;
    world.teams[0]!.stock.materia += 1;
    expect(seen.creeps[0]!.x).toBe(creep.x - 1);
    expect(ownTeam(seen).stock.materia).toBe(world.teams[0]!.stock.materia);
  });

  test("guards tell whole entities from foreign ones", () => {
    const { world } = leakyWorld();
    const seen = view(world, 0);
    expect(seen.teams.map(isOwnTeam)).toEqual([true, false]);
    expect(seen.players.map(isOwnPlayer)).toEqual([true, false]);
    expect(seen.creeps.map((c) => isOwnCreep(c) === (c.team === 0))).toEqual(
      seen.creeps.map(() => true),
    );
    expect(ownTeam(seen)).toEqual(world.teams[0]);
  });
});

/** An encounter between two creeps, opened by hand on the victim's cell. */
function encounterOf(
  world: WorldState,
  aggressor: Creep,
  victim: Creep,
): Encounter {
  const encounter: Encounter = {
    id: world.nextId++,
    aggressor: aggressor.id,
    victim: victim.id,
    intent: "extort",
    demand: { materia: 0, cristal: 4 },
    deadlineTick: world.tick + 60,
    reply: "refuse",
    x: victim.x,
    y: victim.y,
  };
  world.encounters.push(encounter);
  aggressor.engagement = encounter.id;
  victim.engagement = encounter.id;
  return encounter;
}

/** A battle stub between `a` (side 0) and `b` (side 1), on b's cell. */
function battleOf(world: WorldState, a: Creep, b: Creep): Battle {
  const battle: Battle = {
    id: world.nextId++,
    window: { x: 0, y: 0, width: 9, height: 3 },
    sides: [
      { kind: "team", team: a.team },
      { kind: "team", team: b.team },
    ],
    participants: [
      { id: a.id, side: 0, stance: "fight" as const },
      { id: b.id, side: 1, stance: "flee" as const },
    ].sort((p, q) => p.id - q.id),
    openedTick: world.tick,
    entered: 2,
    x: b.x,
    y: b.y,
  };
  world.battles.push(battle);
  a.battle = battle.id;
  b.battle = battle.id;
  a.engagement = null;
  b.engagement = null;
  return battle;
}

describe("battles in the view (junction D16, K-3)", () => {
  /** The battle as a view has it: no stances, no `entered`. */
  const stub = (battle: Battle) => {
    const seen: Partial<Battle> = {
      ...battle,
      participants: battle.participants.map(({ id, side }) => ({ id, side })),
    } as Partial<Battle>;
    delete seen.entered;
    return seen;
  };

  test("a battle of the team is in its view wherever it is, without the stances", () => {
    const { world, enemy } = leakyWorld();
    const mine = creepOf(world, 0, "triangle");
    Object.assign(mine, { x: 2, y: 1 });
    const battle = battleOf(world, mine, enemy);
    expect(view(world, 0).battles).toEqual([stub(battle)]);
    expect(view(world, 1).battles).toEqual([stub(battle)]);
    Object.assign(battle, { x: 20, y: 1 });
    expect(view(world, 0).battles.map((b) => b.id)).toEqual([battle.id]);
    const own = view(world, 0).creeps.find((c) => c.id === mine.id)!;
    expect(own.battle).toBe(battle.id);
    expect(JSON.stringify(view(world, 0))).not.toContain("stance");
    expect(fullView(world).battles).toEqual([stub(battle)]);
  });

  test("other teams' battles only on a cell in sight; their creeps marked in battle", () => {
    const { world, enemy, hidden } = leakyWorld();
    const battle = battleOf(world, hidden, enemy);
    expect(view(world, 0).battles).toEqual([stub(battle)]);
    const seen = view(world, 0).creeps.find((c) => c.id === enemy.id)!;
    expect(seen.battle).toBe(battle.id);
    // The hidden participant stays hidden: only its id is in the stub.
    expect(view(world, 0).creeps.map((c) => c.id)).not.toContain(hidden.id);
    expect(JSON.stringify(view(world, 0))).not.toContain(`"${hidden.name}"`);
    Object.assign(battle, { x: 20, y: 1 });
    expect(view(world, 0).battles).toEqual([]);
  });
});

describe("encounters and spoils in the view (M2 encontro plan section 8)", () => {
  test("an encounter of the team is whole, but the other side's pending reply", () => {
    const { world, enemy } = leakyWorld();
    const mine = creepOf(world, 0, "triangle");
    Object.assign(mine, { x: 2, y: 1 });
    const encounter = encounterOf(world, mine, enemy);
    // Team 0 is the aggressor: it does not see the victim's pending reply.
    expect(view(world, 0).encounters).toEqual([{ ...encounter, reply: null }]);
    expect(view(world, 1).encounters).toEqual([encounter]);
    // Wherever the encounter is: the team's creep is in it.
    Object.assign(encounter, { x: 20, y: 1 });
    expect(view(world, 0).encounters.map((e) => e.id)).toEqual([encounter.id]);
    expect(view(world, 0).encounters.every(isOwnEncounter)).toBe(true);
  });

  test("other teams' encounters only on a cell in sight, with the public fields", () => {
    const { world, enemy, hidden } = leakyWorld();
    const encounter = encounterOf(world, hidden, enemy);
    expect(view(world, 0).encounters).toEqual([
      {
        id: encounter.id,
        aggressor: hidden.id,
        victim: enemy.id,
        intent: "extort",
        x: 3,
        y: 1,
      },
    ]);
    expect(view(world, 0).encounters.some(isOwnEncounter)).toBe(false);
    Object.assign(encounter, { x: 20, y: 1 });
    expect(view(world, 0).encounters).toEqual([]);
  });

  test("spoils come from the team's memory, with the last cargo seen", () => {
    const { world } = leakyWorld();
    const near = dropSpoil(world, { x: 4, y: 1 }, { materia: 2, cristal: 1 });
    const far = dropSpoil(world, { x: 14, y: 1 }, { materia: 5, cristal: 0 });
    updateVision(world);
    expect(view(world, 0).spoils).toEqual([
      { id: near, cargo: { materia: 2, cristal: 1 }, x: 4, y: 1 },
    ]);
    // A scout sees the far one, leaves, and the pile changes in the dark.
    const scout = creepOf(world, 0, "circle");
    Object.assign(scout, { x: 14, y: 1 });
    updateVision(world);
    Object.assign(scout, { x: 0, y: 1 });
    updateVision(world);
    world.spoils.find((s) => s.id === far)!.cargo.materia = 9;
    const seen = view(world, 0);
    expect(seen.spoils.map((s) => [s.id, s.cargo.materia])).toEqual([
      [near, 2],
      [far, 5],
    ]);
    expect(seen.spoils).toEqual(world.memory[0]!.spoils);
  });
});

describe("fullView", () => {
  test("is the whole world, with every entity whole and no fog", () => {
    const world = busyWorld();
    const all = fullView(world);
    expect(all.team).toBe(-1);
    expect(all.teams).toEqual(world.teams);
    expect(all.creeps).toEqual(world.creeps.map(withHostile));
    expect(all.deposits).toEqual(world.deposits);
    expect(all.roadJobs).toEqual(world.roadJobs);
    expect(all.players).toEqual(world.players);
    expect(all.encounters).toEqual(world.encounters);
    expect(all.spoils).toEqual(world.spoils);
    expect(all.roads).toEqual(
      world.map.road.flatMap((r, i) => (r === 1 ? [i] : [])),
    );
    expect(all.known).toEqual(world.map.terrain);
    expect(all.visible).toEqual(world.map.terrain.map((_, i) => i));
    expect(all.creeps.every(isOwnCreep)).toBe(true);
    expect(all.teams.every(isOwnTeam)).toBe(true);
  });

  test("has every encounter and spoil whole", () => {
    const { world, enemy, hidden } = leakyWorld();
    const encounter = encounterOf(world, hidden, enemy);
    const spoil = dropSpoil(world, { x: 20, y: 1 }, { materia: 1, cristal: 0 });
    const all = fullView(world);
    expect(all.encounters).toEqual([encounter]);
    expect(all.encounters[0]).not.toBe(encounter);
    expect(all.spoils.map((s) => s.id)).toEqual([spoil]);
    expect(all.spoils[0]!.cargo).not.toBe(world.spoils[0]!.cargo);
  });
});
