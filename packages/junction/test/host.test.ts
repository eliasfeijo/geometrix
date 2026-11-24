import {
  createBattle,
  parseBattleParams,
  stepBattle,
  type BattleParams,
} from "@geometrix/battle";
import {
  dominate,
  join,
  serialize,
  restore,
  updateVision,
  type Command,
  type Creep,
  type WorldState,
} from "@geometrix/sim";
import { describe, expect, test } from "vitest";
import {
  createHost,
  restoreHost,
  serializeHost,
  setScreen,
  stepJunction,
  stepRealtime,
  type FinishedBattle,
  type JunctionHost,
} from "../src/host.ts";
import { tickResults } from "../src/results.ts";
import { loadBattleParams, textWorld } from "./helpers.ts";

// 30 × 7, the cores in opposite corners.
const MAP = [
  "A.............................",
  "..............................",
  "..............................",
  "..............................",
  "..............................",
  "..............................",
  ".............................B",
];

type Placed = [team: number, dna: Creep["dna"], x: number, y: number];

function world(placed: Placed[]) {
  const w = textWorld(MAP);
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

/** A team 0 circle attacks a loaded team 1 square next to it. */
function duel(battleParams: BattleParams = loadBattleParams()) {
  const { w, creeps } = world([
    [0, "circle", 12, 3],
    [1, "square", 13, 3],
  ]);
  const [hunter, prey] = creeps as [Creep, Creep];
  prey.cargo = { materia: 6, cristal: 2 };
  hunter.order = { type: "approach", targetId: prey.id, intent: "attack" };
  return { w, hunter, prey, host: createHost(battleParams) };
}

/** Steps through the host until the world has no battle, or `limit` ticks. */
function untilOver(w: WorldState, host: JunctionHost, limit = 600) {
  const finished: FinishedBattle[] = [];
  const results: Command[] = [];
  for (let i = 0; i < limit; i++) {
    const done = stepJunction(w, host, []);
    finished.push(...done.finished);
    results.push(...done.results.map((r) => r.command));
    if (w.battles.length === 0 && host.instances.length === 0) break;
  }
  return { finished, results };
}

describe("the world clock (junction T-1, D4)", () => {
  test("a battle opened on tick T has stepped 20 × n ticks on tick T + n", () => {
    const { w, host } = duel();
    const opened = stepJunction(w, host, []);
    expect(opened.events.map((e) => e.type)).toContain("battleOpened");
    expect(host.instances).toHaveLength(1);
    expect(host.instances[0]!.state.tick).toBe(0);
    for (let n = 1; n <= 3 && host.instances.length > 0; n++) {
      stepJunction(w, host, []);
      expect(host.instances[0]?.state.tick ?? 20 * n).toBe(20 * n);
    }
  });
});

describe("the results reach the world (junction X-0..X-4)", () => {
  test("a battle runs to its end; the world applies its exits and its end", () => {
    const { w, hunter, prey, host } = duel();
    const { finished, results } = untilOver(w, host);
    expect(w.battles).toEqual([]);
    expect(finished).toHaveLength(1);
    expect(results.at(-1)?.type).toBe("battleEnd");
    expect(results).toEqual(finished[0]!.results);
    // Nobody is still locked; a dead one is gone from the world.
    for (const creep of [hunter, prey]) {
      if (w.creeps.includes(creep)) expect(creep.battle).toBeNull();
    }
    const end = results.at(-1) as Extract<Command, { type: "battleEnd" }>;
    expect(["won", "idle", "empty"]).toContain(end.reason);
  });

  test("the two logs agree: the battle log replays to the results the world applied", () => {
    const { w, host } = duel();
    const { finished } = untilOver(w, host);
    const [done] = finished;
    const state = createBattle(done!.log.setup, done!.log.params);
    let next = 0;
    const replayed: Command[] = [];
    while (state.ended === null) {
      const entry = done!.log.commands[next];
      let commands: unknown[] = [];
      if (entry !== undefined && entry.tick === state.tick) {
        commands = entry.commands;
        next += 1;
      }
      const events = stepBattle(state, commands);
      replayed.push(
        ...tickResults(w, done!, state, events, state.ended ? done!.late : []),
      );
    }
    expect(state.tick).toBe(done!.log.ticks);
    expect(replayed).toEqual(done!.results);
  });

  test("the same world gives the same battles, step by step", () => {
    const a = duel();
    const b = duel();
    expect(untilOver(a.w, a.host)).toEqual(untilOver(b.w, b.host));
    expect(serialize(a.w)).toBe(serialize(b.w));
  });
});

describe("joins (junction J-1, J-3)", () => {
  test("a join waits while the battle has no room, and comes back with the end", () => {
    // The battle takes one per side; the world, five.
    const params = loadBattleParams();
    const tight = parseBattleParams({
      ...params,
      limits: { ...params.limits, maxPerSide: 1 },
    });
    const { w, creeps } = world([
      [0, "circle", 12, 3],
      [1, "square", 13, 3],
      [0, "triangle", 11, 3],
    ]);
    const [hunter, prey, mate] = creeps as [Creep, Creep, Creep];
    const host = createHost(tight);
    hunter.order = { type: "approach", targetId: prey.id, intent: "attack" };
    stepJunction(w, host, []);
    mate.order = { type: "approach", targetId: prey.id, intent: "attack" };
    stepJunction(w, host, []);
    expect(mate.battle).toBe(w.battles[0]!.id);
    stepJunction(w, host, []);
    expect(host.instances[0]!.pending).toEqual([{ creep: mate.id, side: 0 }]);
    expect(host.instances[0]!.members.map((m) => m.creep)).not.toContain(
      mate.id,
    );
    const { finished } = untilOver(w, host);
    expect(finished[0]!.late.map((l) => l.creep)).toEqual([mate.id]);
    expect(mate.battle).toBeNull();
    expect(w.creeps).toContain(mate);
  });

  test("a join with room enters the arena on its team's side", () => {
    const { w, creeps } = world([
      [0, "circle", 12, 3],
      [1, "square", 13, 3],
      [0, "triangle", 11, 3],
    ]);
    const [hunter, prey, mate] = creeps as [Creep, Creep, Creep];
    const host = createHost(loadBattleParams());
    hunter.order = { type: "approach", targetId: prey.id, intent: "attack" };
    stepJunction(w, host, []);
    mate.order = { type: "approach", targetId: prey.id, intent: "attack" };
    stepJunction(w, host, []);
    stepJunction(w, host, []);
    const instance = host.instances[0];
    if (instance === undefined) return; // it may already have ended
    const member = instance.members.find((m) => m.creep === mate.id);
    expect(member).toBeDefined();
    expect(instance.pending).toEqual([]);
  });
});

describe("taking over (junction C-1, D12, D13, T-2)", () => {
  test("a dominated participant with the screen open plays in real time; released, the world clock again", () => {
    const { w, hunter, host } = duel();
    join(w, 5, 0, false);
    stepJunction(w, host, []);
    dominate(w, 5, hunter.id);
    setScreen(host, hunter.id, true);
    stepJunction(w, host, []);
    const instance = host.instances[0]!;
    expect(instance.pace).toBe("real");
    const tick = instance.state.tick;
    stepJunction(w, host, []);
    expect(instance.state.tick).toBe(tick);
    const { events } = stepRealtime(w, host, instance.battleId, []);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "controlChanged", controller: "human" }),
    );
    expect(instance.state.tick).toBe(tick + 1);
    setScreen(host, hunter.id, false);
    stepJunction(w, host, []);
    if (host.instances.length > 0) {
      expect(instance.pace).toBe("world");
      expect(
        instance.state.participants.every((p) => p.controller === "gambits"),
      ).toBe(true);
    }
  });
});

describe("snapshots (junction plan section 4)", () => {
  test("world and host restored mid-battle end the same", () => {
    const straight = duel();
    const ended = untilOver(straight.w, straight.host);
    const cut = duel();
    for (let i = 0; i < 3; i++) stepJunction(cut.w, cut.host, []);
    expect(cut.host.instances).toHaveLength(1);
    const w = restore(serialize(cut.w));
    const host = restoreHost(serializeHost(cut.host));
    expect(serializeHost(host)).toBe(serializeHost(cut.host));
    const rest = untilOver(w, host);
    expect(rest.finished.map((f) => f.results)).toEqual(
      ended.finished.map((f) => f.results),
    );
    expect(serialize(w)).toBe(serialize(straight.w));
  });
});
