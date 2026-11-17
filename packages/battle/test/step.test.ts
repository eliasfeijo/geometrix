import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  createEventLog,
  createRng,
  DIRS,
  emit,
  nextInt,
  participantRef,
  restoreBattle,
  serializeBattle,
  stepBattle,
  type BattleState,
} from "@geometrix/battle";
import { battleOn, FIELD, put, readArenaRows, xyOf } from "./helpers.ts";

const sha256 = (text: string) =>
  createHash("sha256").update(text).digest("hex");

function dominated(): BattleState {
  const state = battleOn(FIELD, [["circle"], ["square"]]);
  state.participants[0]!.controller = "human";
  put(state, 1, 3, 3, "right");
  put(state, 2, 8, 6);
  return state;
}

describe("stepBattle", () => {
  test("advances the tick and returns the tick's events", () => {
    const state = dominated();
    expect(stepBattle(state, [])).toEqual([]);
    expect(state.tick).toBe(1);
  });

  test("a command acts in the tick it is passed to", () => {
    const state = dominated();
    stepBattle(state, [{ type: "intent", id: 1, move: "up", attack: false }]);
    const circle = state.participants[0]!;
    expect(circle.facing).toBe("up");
    expect(circle.movePoints).toBe(1500);
    // A circle steps every 4 ticks.
    for (let i = 0; i < 3; i++) stepBattle(state, []);
    expect(xyOf(state, 1)).toEqual([3, 2]);
  });

  test("releasing the key stops the walk; a face command only turns", () => {
    const state = dominated();
    stepBattle(state, [{ type: "intent", id: 1, move: "left", attack: false }]);
    stepBattle(state, [
      { type: "intent", id: 1, move: null, attack: false },
      { type: "face", id: 1, dir: "down" },
    ]);
    for (let i = 0; i < 10; i++) stepBattle(state, []);
    expect(xyOf(state, 1)).toEqual([3, 3]);
    expect(state.participants[0]!.facing).toBe("down");
  });

  test("walking overrides a face command of the same tick", () => {
    const state = dominated();
    stepBattle(state, [
      { type: "face", id: 1, dir: "down" },
      { type: "intent", id: 1, move: "left", attack: false },
    ]);
    expect(state.participants[0]!.facing).toBe("left");
  });

  test("a command that arrives after the domination moved on is dropped", () => {
    const state = dominated();
    state.participants[0]!.controller = "gambits";
    stepBattle(state, [{ type: "intent", id: 1, move: "up", attack: false }]);
    expect(state.participants[0]!.intent.move).toBeNull();
  });
});

describe("determinism (spec R-2, with movement only)", () => {
  /** A 3 × 3 on the rocks arena, every participant under a human. */
  function battle() {
    const side = () => ["square", "triangle", "circle"] as const;
    const state = battleOn(
      readArenaRows("pedras"),
      [[...side()], [...side()]],
      7,
    );
    for (const p of state.participants) p.controller = "human";
    return state;
  }

  /** A seeded stream of walk intents for participants 1 to 6, per tick. */
  function planOf(seed: number, ticks: number): unknown[][] {
    const input = createRng(seed);
    return Array.from({ length: ticks }, () => {
      const commands: unknown[] = [];
      for (let id = 1; id <= 6; id++) {
        if (nextInt(input, 6) !== 0) continue;
        const move = nextInt(input, 5);
        const dir = move === 4 ? null : DIRS[move];
        commands.push({ type: "intent", id, move: dir, attack: false });
      }
      return commands;
    });
  }

  /** Runs `plan`, with a snapshot → restore before tick `restoreAt`. */
  function run(plan: unknown[][], restoreAt = -1): BattleState {
    let state = battle();
    plan.forEach((commands, tick) => {
      if (tick === restoreAt) state = restoreBattle(serializeBattle(state));
      stepBattle(state, commands);
    });
    return state;
  }

  const hash = (state: BattleState) => sha256(serializeBattle(state));

  test("two runs of the same commands reach the same hash", () => {
    const plan = planOf(3, 400);
    expect(hash(run(plan))).toBe(hash(run(plan)));
    expect(hash(run(planOf(4, 400)))).not.toBe(hash(run(plan)));
  });

  test("a snapshot → restore in the middle continues identically", () => {
    const plan = planOf(5, 400);
    const straight = run(plan);
    expect(hash(run(plan, 200))).toBe(hash(straight));
    // The creeps did move around.
    expect(straight.participants.map((p) => p.cell)).not.toEqual(
      battle().participants.map((p) => p.cell),
    );
  });
});

describe("the event collector", () => {
  test("stamps the tick being stepped and the position in the tick", () => {
    const state = dominated();
    const log = createEventLog(state.tick);
    const ref = participantRef(state.participants[0]!);
    emit(log, {
      type: "controlChanged",
      participant: ref,
      controller: "human",
    });
    emit(log, { type: "attacked", participant: ref, dir: "up" });
    expect(log.events).toEqual([
      {
        type: "controlChanged",
        participant: ref,
        controller: "human",
        tick: 0,
        index: 0,
      },
      { type: "attacked", participant: ref, dir: "up", tick: 0, index: 1 },
    ]);
    expect(ref).toEqual({ id: 1, side: 0, dna: "circle", name: "circle" });
  });
});
