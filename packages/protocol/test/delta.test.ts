import {
  collectorRules,
  createWorld,
  parseParams,
  step,
  updateVision,
  view,
  type TeamView,
  type WorldState,
} from "@geometrix/sim";
import { describe, expect, test } from "vitest";
import params from "../../sim/test/params.json" with { type: "json" };
import {
  applyDelta,
  diffView,
  emptySent,
  emptyView,
  viewJson,
  type Delta,
  type Sent,
} from "../src/delta.ts";

/** The seed-42 world after the joins, a sent record and the client's view. */
function setup(): {
  world: WorldState;
  sent: Sent;
  client: TeamView;
  next: () => Delta;
} {
  const world = createWorld(42, parseParams(params));
  step(world, [
    { playerId: 1, command: { type: "join", team: 0, bot: true } },
    { playerId: 2, command: { type: "join", team: 1, bot: false } },
  ]);
  const sent = emptySent();
  diffView(sent, view(world, 0));
  const client = wire(view(world, 0));
  return {
    world,
    sent,
    client,
    next: () => wire(diffView(sent, view(world, 0))),
  };
}

/** Through JSON, as on the network: nothing shared with the state. */
function wire<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

/** Applies the delta to the client's view and checks it against the server's. */
function expectApplies(world: WorldState, client: TeamView, delta: Delta) {
  const next = applyDelta(deepFreeze(client), delta);
  expect(viewJson(next)).toBe(viewJson(view(world, 0)));
  return next;
}

describe("diffView / applyDelta", () => {
  test("from an empty sent record, the delta is the whole view", () => {
    const world = createWorld(42, parseParams(params));
    const seen = view(world, 0);
    const delta = wire(diffView(emptySent(), seen));
    expect(delta.creeps?.upsert).toHaveLength(seen.creeps.length);
    expect(delta.deposits?.upsert).toHaveLength(seen.deposits.length);
    expect(delta.teams?.upsert).toHaveLength(2);
    expect(delta.known).toHaveLength(seen.known.filter((t) => t >= 0).length);
    expect(delta.visible).toEqual({ add: seen.visible });
    const { width, height } = world.map;
    expectApplies(world, emptyView(0, width * height), delta);
  });

  test("nothing changed: only the tick", () => {
    const { world, next } = setup();
    world.tick += 1;
    expect(next()).toEqual({ tick: world.tick });
  });

  test("a changed field goes alone, with the id", () => {
    const { world, client, next } = setup();
    const creep = world.creeps[3]!;
    creep.x += 1;
    // The view's deposits are the team's memory.
    const deposit = world.memory[0]!.deposits[0]!;
    deposit.amount -= 5;
    const delta = next();
    expect(delta).toEqual({
      tick: world.tick,
      creeps: { upsert: [{ id: creep.id, x: creep.x }] },
      deposits: { upsert: [{ id: deposit.id, amount: deposit.amount }] },
    });
    expectApplies(world, client, delta);
  });

  test("a nested object mutated in place is caught, and sent whole", () => {
    const { world, client, next } = setup();
    const creep = world.creeps[0]!;
    creep.cargo.materia += 3;
    world.teams[0]!.stock.cristal += 7;
    const delta = next();
    expect(delta.creeps).toEqual({
      upsert: [{ id: creep.id, cargo: { materia: 3, cristal: 0 } }],
    });
    expect(delta.teams?.upsert).toEqual([
      { id: 0, stock: { ...world.teams[0]!.stock } },
    ]);
    expectApplies(world, client, delta);
  });

  test("an order recreated with the same value is not a change", () => {
    const { world, next } = setup();
    const creep = world.creeps[0]!;
    creep.order = { type: "gather", depositId: 5 };
    next();
    creep.order = { type: "gather", depositId: 5 };
    expect(next().creeps).toBeUndefined();
    creep.order = { type: "gather", depositId: 6 };
    expect(next().creeps?.upsert).toEqual([
      { id: creep.id, order: { type: "gather", depositId: 6 } },
    ]);
  });

  test("rules are compared by reference: a new array is a change", () => {
    const { world, client, next } = setup();
    const creep = world.creeps[1]!;
    creep.rules = collectorRules("cristal");
    const delta = next();
    expect(delta.creeps?.upsert).toEqual([
      { id: creep.id, rules: collectorRules("cristal") },
    ]);
    expectApplies(world, client, delta);
    expect(next().creeps).toBeUndefined();
  });

  test("production starting and ending is a change of the team", () => {
    const { world, client, next } = setup();
    world.teams[0]!.production = { dna: "circle", remainingSeconds: 600 };
    const started = next();
    expect(started.teams?.upsert).toEqual([
      { id: 0, production: { dna: "circle", remainingSeconds: 600 } },
    ]);
    const after = expectApplies(world, client, started);
    world.teams[0]!.production.remainingSeconds -= 1;
    const ticking = next();
    expect(ticking.teams?.upsert).toEqual([
      { id: 0, production: { dna: "circle", remainingSeconds: 599 } },
    ]);
    const ticked = expectApplies(world, after, ticking);
    world.teams[0]!.production = null;
    expectApplies(world, ticked, next());
  });

  test("new and removed entities, in id order", () => {
    const { world, client, next } = setup();
    const removed = world.creeps.splice(2, 1)[0]!;
    const born = { ...world.creeps[0]!, id: world.nextId++, x: 1, y: 1 };
    world.creeps.push(born);
    world.roadJobs.push({
      id: world.nextId++,
      team: 0,
      x: 4,
      y: 4,
      remainingSeconds: 120,
    });
    const delta = next();
    expect(delta.creeps?.remove).toEqual([removed.id]);
    expect(delta.creeps?.upsert).toHaveLength(1);
    expect(delta.creeps?.upsert?.[0]).toMatchObject({ id: born.id, x: 1 });
    expect(delta.creeps?.upsert?.[0]).not.toHaveProperty("path");
    expect(delta.roadJobs?.upsert).toHaveLength(1);
    expectApplies(world, client, delta);
  });

  test("new roads only, merged in increasing order", () => {
    const { world, client, next } = setup();
    // The view's roads are the team's memory.
    const { road } = world.memory[0]!;
    road[500] = 1;
    road[20] = 1;
    const first = next();
    expect(first.roads).toEqual([20, 500]);
    const after = expectApplies(world, client, first);
    road[300] = 1;
    const second = next();
    expect(second.roads).toEqual([300]);
    expect(expectApplies(world, after, second).roads).toEqual([20, 300, 500]);
  });

  test("a road that goes away is refused", () => {
    const { world, next } = setup();
    world.memory[0]!.road[20] = 1;
    next();
    world.memory[0]!.road[20] = 0;
    expect(next).toThrow(/road went away/);
  });

  test("cells explored go as [cell, terrain] pairs, sight as add and remove", () => {
    const { world, client, next } = setup();
    const scout = world.creeps.find((c) => c.team === 0 && c.dna === "circle")!;
    const before = view(world, 0);
    scout.y += scout.y < world.map.height / 2 ? 3 : -3;
    updateVision(world);
    const delta = next();
    const after = view(world, 0);
    const explored = after.known.flatMap((t, i) =>
      t !== before.known[i] ? [[i, t]] : [],
    );
    expect(explored.length).toBeGreaterThan(0);
    expect(delta.known).toEqual(explored);
    expect(delta.visible?.add ?? []).toEqual(
      after.visible.filter((i) => !before.visible.includes(i)),
    );
    expect(delta.visible?.remove ?? []).toEqual(
      before.visible.filter((i) => !after.visible.includes(i)),
    );
    expectApplies(world, client, delta);
    expect(next()).toEqual({ tick: world.tick });
  });

  test("an enemy creep enters sight with D7 fields only, and leaves as a remove", () => {
    const { world, client, next } = setup();
    const enemy = world.creeps.find((c) => c.team === 1)!;
    const home = { x: enemy.x, y: enemy.y };
    Object.assign(enemy, world.teams[0]!.core);
    const entered = next();
    expect(entered.creeps?.upsert).toEqual([
      {
        id: enemy.id,
        team: 1,
        dna: enemy.dna,
        name: enemy.name,
        hp: enemy.hp,
        engagement: null,
        ...world.teams[0]!.core,
        cargo: enemy.cargo,
      },
    ]);
    const seen = expectApplies(world, client, entered);
    Object.assign(enemy, home);
    const left = next();
    expect(left.creeps).toEqual({ remove: [enemy.id] });
    expectApplies(world, seen, left);
  });

  test("the enemy core goes from unknown to known", () => {
    const { world, client, next } = setup();
    expect(client.teams[1]).toEqual({ id: 1, core: null });
    world.memory[0]!.cores.push({ team: 1, ...world.teams[1]!.core });
    const delta = next();
    expect(delta.teams?.upsert).toEqual([
      { id: 1, core: world.teams[1]!.core },
    ]);
    expectApplies(world, client, delta);
  });

  test("a remembered enemy road job that is forgotten is a remove", () => {
    const { world, client, next } = setup();
    const job = {
      id: world.nextId++,
      team: 1,
      x: 3,
      y: 3,
      remainingSeconds: 60,
    };
    world.memory[0]!.roadJobs.push(job);
    const remembered = next();
    expect(remembered.roadJobs?.upsert).toEqual([job]);
    const seen = expectApplies(world, client, remembered);
    world.memory[0]!.roadJobs = [];
    const forgotten = next();
    expect(forgotten.roadJobs).toEqual({ remove: [job.id] });
    expectApplies(world, seen, forgotten);
  });

  test("an encounter opens, changes stage and closes; its demand by value", () => {
    const { world, client, next } = setup();
    const mine = world.creeps.find((c) => c.team === 0)!;
    const enemy = world.creeps.find((c) => c.team === 1)!;
    const encounter = {
      id: world.nextId++,
      aggressor: mine.id,
      victim: enemy.id,
      intent: "extort" as const,
      stage: "dialogue" as "dialogue" | "fight",
      demand: { materia: 3, cristal: 0 },
      deadlineTick: null,
      reply: null,
      aggressorReply: null,
      nextRoundTick: null as number | null,
      rounds: 0,
      x: mine.x,
      y: mine.y,
    };
    world.encounters.push(encounter);
    const opened = next();
    expect(opened.encounters).toEqual({ upsert: [encounter] });
    let seen = expectApplies(world, client, opened);
    // The demand recreated with the same value is no change.
    encounter.demand = { materia: 3, cristal: 0 };
    expect(next().encounters).toBeUndefined();
    encounter.stage = "fight";
    encounter.nextRoundTick = 10;
    const fight = next();
    expect(fight.encounters).toEqual({
      upsert: [{ id: encounter.id, stage: "fight", nextRoundTick: 10 }],
    });
    seen = expectApplies(world, seen, fight);
    world.encounters = [];
    const closed = next();
    expect(closed.encounters).toEqual({ remove: [encounter.id] });
    expectApplies(world, seen, closed);
  });

  test("a remembered spoil's cargo changing in place is caught", () => {
    const { world, client, next } = setup();
    const spoil = {
      id: world.nextId++,
      cargo: { materia: 4, cristal: 1 },
      x: 2,
      y: 2,
    };
    world.memory[0]!.spoils.push(spoil);
    const dropped = next();
    expect(dropped.spoils).toEqual({ upsert: [spoil] });
    const seen = expectApplies(world, client, dropped);
    spoil.cargo.materia = 1;
    const taken = next();
    expect(taken.spoils).toEqual({
      upsert: [{ id: spoil.id, cargo: { materia: 1, cristal: 1 } }],
    });
    expectApplies(world, seen, taken);
  });

  test("applyDelta shares what did not change and leaves the base alone", () => {
    const { world, client, next } = setup();
    world.creeps[0]!.x += 1;
    const delta = next();
    const before = viewJson(client);
    const after = applyDelta(client, delta);
    expect(viewJson(client)).toBe(before);
    expect(after.creeps[0]).not.toBe(client.creeps[0]);
    expect(after.creeps[1]).toBe(client.creeps[1]);
    expect(after.deposits).toBe(client.deposits);
    expect(after.teams).toBe(client.teams);
  });
});
