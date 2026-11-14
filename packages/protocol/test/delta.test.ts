import {
  collectorRules,
  createWorld,
  parseParams,
  step,
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
    const delta = wire(diffView(emptySent(), view(world, 0)));
    expect(delta.creeps?.upsert).toHaveLength(world.creeps.length);
    expect(delta.deposits?.upsert).toHaveLength(world.deposits.length);
    expect(delta.teams?.upsert).toHaveLength(2);
    const empty: TeamView = {
      tick: 0,
      team: 0,
      teams: [],
      creeps: [],
      deposits: [],
      roads: [],
      roadJobs: [],
      players: [],
    };
    expectApplies(world, empty, delta);
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
    world.deposits[0]!.amount -= 5;
    const delta = next();
    expect(delta).toEqual({
      tick: world.tick,
      creeps: { upsert: [{ id: creep.id, x: creep.x }] },
      deposits: {
        upsert: [
          { id: world.deposits[0]!.id, amount: world.deposits[0]!.amount },
        ],
      },
    });
    expectApplies(world, client, delta);
  });

  test("a nested object mutated in place is caught, and sent whole", () => {
    const { world, client, next } = setup();
    const creep = world.creeps[0]!;
    creep.cargo.materia += 3;
    world.teams[1]!.stock.cristal += 7;
    const delta = next();
    expect(delta.creeps).toEqual({
      upsert: [{ id: creep.id, cargo: { materia: 3, cristal: 0 } }],
    });
    expect(delta.teams?.upsert).toEqual([
      { id: 1, stock: { ...world.teams[1]!.stock } },
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
    world.map.road[500] = 1;
    world.map.road[20] = 1;
    const first = next();
    expect(first.roads).toEqual([20, 500]);
    const after = expectApplies(world, client, first);
    world.map.road[300] = 1;
    const second = next();
    expect(second.roads).toEqual([300]);
    expect(expectApplies(world, after, second).roads).toEqual([20, 300, 500]);
  });

  test("a road that goes away is refused", () => {
    const { world, next } = setup();
    world.map.road[20] = 1;
    next();
    world.map.road[20] = 0;
    expect(next).toThrow(/road went away/);
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
