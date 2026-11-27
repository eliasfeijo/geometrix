import { parseBattleParams, type BattleParams } from "@geometrix/battle";
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
import { serializeBattle } from "@geometrix/battle";
import {
  addInstances,
  createHost,
  humanControls,
  instanceRecord,
  participantOf,
  rebuildInstance,
  restoreHost,
  serializeHost,
  setHold,
  setScreen,
  stepJunction,
  stepRealtime,
  type FinishedBattle,
  type JunctionHost,
} from "../src/host.ts";
import { replayResults } from "../src/replay.ts";
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

describe("the battles a world tick stepped (the screen's frames, F4)", () => {
  test("each world-paced battle comes with the events of its second", () => {
    const { w, host } = duel();
    expect(stepJunction(w, host, []).stepped).toEqual([]);
    const battleId = host.instances[0]!.battleId;
    const { stepped } = stepJunction(w, host, []);
    expect(stepped.map((b) => b.battleId)).toEqual([battleId]);
    // The countdown's first second: nothing happens yet.
    expect(stepped[0]!.events).toEqual([]);
    const later = [];
    for (let i = 0; i < 30 && host.instances.length > 0; i++) {
      later.push(...stepJunction(w, host, []).stepped.flatMap((b) => b.events));
    }
    expect(later.map((e) => e.type)).toContain("ended");
  });

  test("a battle in real time is not stepped by the world tick", () => {
    const { w, hunter, host } = duel();
    join(w, 5, 0, false);
    stepJunction(w, host, []);
    dominate(w, 5, hunter.id);
    setScreen(host, hunter.id, true);
    expect(stepJunction(w, host, []).stepped).toEqual([]);
  });
});

describe("the world's end (E-min X-1, plan P8)", () => {
  test("an open battle stops where it is, and the world takes no more ticks", () => {
    const { w, host } = duel();
    stepJunction(w, host, []);
    stepJunction(w, host, []);
    join(w, 1, 0, false);
    stepJunction(w, host, [{ playerId: 1, command: { type: "concede" } }]);
    expect(w.result).toMatchObject({ how: "lastTeam", winner: 1 });
    const [instance] = host.instances;
    expect(instance).toBeDefined();
    expect(w.battles).toHaveLength(1);
    const battle = serializeBattle(instance!.state);
    expect(() => stepJunction(w, host, [])).toThrow("the world has ended");
    expect(host.instances).toEqual([instance]);
    expect(serializeBattle(instance!.state)).toBe(battle);
  });
});

describe("a held battle (R plan P11, D6, D28)", () => {
  /** The duel's battle, opened and stepped one world second. */
  function open() {
    const d = duel();
    stepJunction(d.w, d.host, []);
    stepJunction(d.w, d.host, []);
    return { ...d, instance: d.host.instances[0]! };
  }

  test("does not advance on the world clock, while the world does", () => {
    const { w, host, instance } = open();
    setHold(w, host, instance.battleId, true);
    expect(instance.pace).toBe("held");
    const tick = instance.state.tick;
    const worldTick = w.tick;
    const logged = instance.log.commands.length;
    for (let i = 0; i < 5; i++) {
      expect(stepJunction(w, host, []).stepped).toEqual([]);
    }
    expect(instance.pace).toBe("held");
    expect(instance.state.tick).toBe(tick);
    expect(instance.log.commands).toHaveLength(logged);
    expect(w.tick).toBe(worldTick + 5);
    expect(w.battles).toHaveLength(1);
    setHold(w, host, instance.battleId, false);
    expect(instance.pace).toBe("world");
    stepJunction(w, host, []);
    expect(instance.state.tick).toBe(tick + 20);
  });

  test("released with a human on the screen, goes straight to real time", () => {
    const { w, hunter, host, instance } = open();
    join(w, 5, 0, false);
    dominate(w, 5, hunter.id);
    expect(humanControls(w, host, instance.battleId)).toBe(false);
    setScreen(host, hunter.id, true);
    expect(humanControls(w, host, instance.battleId)).toBe(true);
    setHold(w, host, instance.battleId, true);
    expect(instance.pace).toBe("held");
    setHold(w, host, instance.battleId, false);
    expect(instance.pace).toBe("real");
  });

  test("the hold ends as the battle ran without it", () => {
    const straight = duel();
    const ended = untilOver(straight.w, straight.host);
    const { w, host, instance } = open();
    setHold(w, host, instance.battleId, true);
    for (let i = 0; i < 4; i++) stepJunction(w, host, []);
    setHold(w, host, instance.battleId, false);
    const { finished } = untilOver(w, host);
    expect(finished[0]!.log.ticks).toBe(ended.finished[0]!.log.ticks);
    expect(replayResults(w, finished[0]!)).toEqual(finished[0]!.results);
    expect(host.holds).toEqual([]);
  });

  test("is not in a snapshot: restored, it goes on with the world clock (OC-6)", () => {
    const { w, host, instance } = open();
    setHold(w, host, instance.battleId, true);
    const restored = restoreHost(serializeHost(host));
    expect(restored.holds).toEqual([]);
    expect(rebuildInstance(instanceRecord(instance), instance.log).pace).toBe(
      "world",
    );
  });
});

describe("the member lookup (C-2)", () => {
  test("a creep's participant while it is in the arena, null otherwise", () => {
    const { w, hunter, prey, host } = duel();
    stepJunction(w, host, []);
    const instance = host.instances[0]!;
    expect(participantOf(instance, hunter.id)).toBe(
      instance.members.find((m) => m.creep === hunter.id)!.participant,
    );
    expect(participantOf(instance, prey.id)).not.toBeNull();
    expect(participantOf(instance, 999)).toBeNull();
    untilOver(w, host);
    // Whoever left the arena (died or escaped) has no participant now.
    const departed = instance.state.departed.map((d) => d.id);
    expect(departed.length).toBeGreaterThan(0);
    for (const { creep, participant } of instance.members) {
      expect(participantOf(instance, creep)).toBe(
        departed.includes(participant) ? null : participant,
      );
    }
  });
});

describe("rebuilding an instance (P6, N-3)", () => {
  test("from its record and its log, it is the battle it was and ends the same", () => {
    const straight = duel();
    const ended = untilOver(straight.w, straight.host);
    const cut = duel();
    for (let i = 0; i < 4; i++) stepJunction(cut.w, cut.host, []);
    const live = cut.host.instances[0]!;
    const rebuilt = rebuildInstance(instanceRecord(live), live.log);
    expect(serializeBattle(rebuilt.state)).toBe(serializeBattle(live.state));
    expect(rebuilt.pace).toBe("world");
    const w = restore(serialize(cut.w));
    const host = createHost(cut.host.battleParams);
    addInstances(host, [rebuilt]);
    expect(serializeHost(host)).toBe(serializeHost(cut.host));
    const rest = untilOver(w, host);
    expect(rest.finished.map((f) => f.results)).toEqual(
      ended.finished.map((f) => f.results),
    );
    expect(serialize(w)).toBe(serialize(straight.w));
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
    expect(finished).toHaveLength(1);
    expect(replayResults(w, finished[0]!)).toEqual(finished[0]!.results);
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
  test("two players on the screen each keep their participant (D12)", () => {
    const { w, hunter, prey, host } = duel();
    join(w, 5, 0, false);
    join(w, 6, 1, false);
    stepJunction(w, host, []);
    dominate(w, 5, hunter.id);
    dominate(w, 6, prey.id);
    setScreen(host, hunter.id, true);
    setScreen(host, prey.id, true);
    stepJunction(w, host, []);
    const instance = host.instances[0]!;
    const changes = [];
    for (let i = 0; i < 10 && instance.state.ended === null; i++) {
      const { events } = stepRealtime(w, host, instance.battleId, []);
      changes.push(...events.filter((e) => e.type === "controlChanged"));
    }
    // Each one handed over once, then left alone (no flapping).
    expect(changes.map((e) => e.controller)).toEqual(["human", "human"]);
    expect(instance.state.participants.map((p) => p.controller)).toEqual([
      "human",
      "human",
    ]);
  });

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
