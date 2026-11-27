import {
  updateVision,
  type Command,
  type Wanderer,
  type WorldState,
} from "@geometrix/sim";
import { describe, expect, test } from "vitest";
import {
  createHost,
  stepJunction,
  type FinishedBattle,
  type JunctionHost,
} from "../src/host.ts";
import { replayResults } from "../src/replay.ts";
import { participantSetup } from "../src/setup.ts";
import { creepOf, loadBattleParams, paramsWith, textWorld } from "./helpers.ts";

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

const params = paramsWith((p) => {
  p.wanderers.cap = 4;
});

function addWanderer(w: WorldState, x: number, y: number): Wanderer {
  const wanderer: Wanderer = {
    id: w.nextId++,
    dna: "circle",
    name: `Andarilho ${w.nextId}`,
    hp: w.params.wanderers.hp * 1000,
    cargo: { materia: 0, cristal: 0 },
    battle: null,
    order: { type: "stop" },
    movePoints: 0,
    path: null,
    spared: [],
    x,
    y,
  };
  w.wanderers.push(wanderer);
  return wanderer;
}

/** A loaded team 1 triangle at (15, 3) and wanderers next to it. */
function ambush(...cells: [number, number][]) {
  const w = textWorld(MAP, params);
  const prey = creepOf(w, 1, "triangle");
  Object.assign(prey, { x: 15, y: 3, cargo: { materia: 8, cristal: 0 } });
  const wanderers = cells.map(([x, y]) => addWanderer(w, x, y));
  updateVision(w);
  return { w, prey, wanderers, host: createHost(loadBattleParams()) };
}

function untilOver(w: WorldState, host: JunctionHost, limit = 900) {
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

describe("the wanderers in a battle instance (junction D14, W-3)", () => {
  test("a wanderer's setup: its own HP and damage, the circle's DNA and capacity", () => {
    const { w, wanderers, prey } = ambush([14, 3]);
    const setup = participantSetup(w, wanderers[0]!, "fight");
    expect(setup).toMatchObject({
      dna: "circle",
      hp: 60,
      maxHp: 60,
      damage: 12,
      capacity: w.params.dna.circle.capacity,
    });
    // A team's creep keeps its DNA's damage: no override.
    expect(participantSetup(w, prey, "fight")).not.toHaveProperty("damage");
  });

  test("a wanderer's attack runs to its end; the battle log replays to the results", () => {
    const { w, prey, wanderers, host } = ambush([14, 3]);
    const { finished, results } = untilOver(w, host);
    expect(finished).toHaveLength(1);
    expect(results.at(-1)?.type).toBe("battleEnd");
    expect(replayResults(w, finished[0]!)).toEqual(finished[0]!.results);
    // Nobody is still locked; a dead one is gone from the world.
    if (w.creeps.includes(prey)) expect(prey.battle).toBeNull();
    if (w.wanderers.includes(wanderers[0]!)) {
      expect(wanderers[0]!.battle).toBeNull();
    }
  });

  test("a wanderer joining on the opening's tick enters once, by its join", () => {
    // The first opens the attack, the second joins in the same world tick.
    const { w, wanderers, host } = ambush([14, 3], [16, 3]);
    const first = stepJunction(w, host, []);
    expect(first.events.map((e) => e.type)).toEqual(
      expect.arrayContaining(["battleOpened", "battleJoined"]),
    );
    const { finished, results } = untilOver(w, host);
    expect(finished).toHaveLength(1);
    const end = results.at(-1) as Extract<Command, { type: "battleEnd" }>;
    const ids = end.survivors.map((s) => s.creepId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(finished[0]!.members.map((m) => m.creep).sort()).toEqual(
      [...new Set(finished[0]!.members.map((m) => m.creep))].sort(),
    );
    for (const wanderer of wanderers.filter((x) => w.wanderers.includes(x))) {
      expect(wanderer.battle).toBeNull();
    }
    expect(replayResults(w, finished[0]!)).toEqual(finished[0]!.results);
  });
});

describe("a wanderer that leaves and rejoins on one tick (R F4)", () => {
  test("is not read as a refused exit", () => {
    // The wanderer attacks the triangle: battle on (15, 3).
    const { w, prey, wanderers, host } = ambush([14, 3]);
    const wanderer = wanderers[0]!;
    stepJunction(w, host, []);
    const battle = w.battles[0]!;
    // A loaded teammate of nobody in the battle, on its way to attack.
    const newcomer = creepOf(w, 0, "square");
    Object.assign(newcomer, { x: 17, y: 3, cargo: { materia: 5, cristal: 0 } });
    newcomer.order = { type: "approach", targetId: prey.id, intent: "attack" };
    updateVision(w);
    // The wanderer escapes this tick, near the newcomer (which it did not
    // fight, so it is not spared): it goes for it, the newcomer joins the
    // battle and the wanderer follows it back in.
    host.results.push({
      type: "battleExit",
      battleId: battle.id,
      creepId: wanderer.id,
      outcome: "escaped",
      by: null,
      hp: w.params.wanderers.hp,
      cargo: { materia: 0, cristal: 0 },
      cell: { x: 19, y: 3 },
    });
    const { events } = stepJunction(w, host, []);
    const of = (type: string) =>
      events
        .filter((e) => e.type === type)
        .map((e) => ("creep" in e ? e.creep.id : null));
    expect(of("battleLeft")).toContain(wanderer.id);
    expect(of("battleJoined")).toEqual([newcomer.id, wanderer.id]);
    expect(wanderer.battle).toBe(battle.id);
  });
});
