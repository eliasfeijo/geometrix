import { describe, expect, test } from "vitest";
import type { BattleEvent } from "../src/events.ts";
import type { BattleState, Carry } from "../src/state.ts";
import { stepBattle } from "../src/step.ts";
import { brawl, member, plan, TEST_KITS } from "./helpers.ts";

const SEEDS = 40;
const MAX_TICKS = 6000;

type Outcome = {
  state: BattleState;
  events: BattleEvent[];
  start: Map<number, { hp: number; carry: Carry }>;
};

/**
 * A brawl driven by `plan`, with the lab taking participant 1 back to the
 * gambits on tick 10 and a circle joining side 1 on tick 50, until it ends.
 */
function play(seed: number): Outcome {
  const state = brawl(seed);
  const start = new Map(
    state.participants.map((p) => [p.id, { hp: p.hp, carry: { ...p.carry } }]),
  );
  const commands = plan(seed, MAX_TICKS);
  commands[10]!.push({ type: "control", id: 1, controller: "gambits" });
  commands[50]!.push({ type: "join", side: 1, participant: member("circle") });
  const events: BattleEvent[] = [];
  for (let tick = 0; tick < MAX_TICKS && state.ended === null; tick++) {
    const step = stepBattle(state, commands[tick]!);
    // Stamped with the tick being stepped and their place in it.
    expect(step.map((e) => [e.tick, e.index])).toEqual(
      step.map((_, i) => [tick, i]),
    );
    for (const e of step) {
      if (e.type === "joined") {
        start.set(e.participant.id, {
          hp: TEST_KITS[e.participant.dna].maxHp,
          carry: { materia: 0, cristal: 0 },
        });
      }
    }
    events.push(...step);
  }
  return { state, events, start };
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe("the events of whole battles (spec D19, F-3)", () => {
  const outcomes = Array.from({ length: SEEDS }, (_, seed) => play(seed));

  test("every battle ends, once, with the ended event last", () => {
    for (const { state, events } of outcomes) {
      expect(state.ended).not.toBeNull();
      expect(events.filter((e) => e.type === "ended")).toHaveLength(1);
      expect(events.at(-1)!.type).toBe("ended");
    }
  });

  test("the totals are the sum of the hits, and the HP each one lost", () => {
    for (const { state, events, start } of outcomes) {
      const hits = events.filter((e) => e.type === "hit");
      const ended = events.at(-1)!;
      if (ended.type !== "ended") throw new Error("not ended");
      expect(ended.results.map((r) => r.participant.id)).toEqual(
        state.totals.map((t) => t.id),
      );
      for (const result of ended.results) {
        const { id } = result.participant;
        const total = state.totals.find((t) => t.id === id)!;
        expect([result.dealt, result.taken]).toEqual([
          total.dealt,
          total.taken,
        ]);
        expect(total.dealt).toBe(
          sum(hits.filter((h) => h.by.id === id).map((h) => h.damage)),
        );
        expect(total.taken).toBe(
          sum(hits.filter((h) => h.target.id === id).map((h) => h.damage)),
        );
        expect(start.get(id)!.hp - result.hp).toBe(total.taken);
      }
    }
  });

  test("each departure has its event, and the outcome matches it", () => {
    for (const { state, events } of outcomes) {
      for (const gone of state.departed) {
        const own = events.filter(
          (e) =>
            (e.type === "died" || e.type === "escaped") &&
            e.participant.id === gone.id,
        );
        expect(own).toHaveLength(1);
        const [e] = own;
        const outcome =
          e!.type === "died"
            ? "died"
            : e!.type === "escaped" && e.reason === "edge"
              ? "escapedEdge"
              : "escapedIdle";
        expect(gone.outcome).toBe(outcome);
        expect(gone.tick).toBe(e!.tick);
      }
    }
  });

  test("carry is never made or lost: it leaves with someone or stays in a pile", () => {
    for (const { events, start } of outcomes) {
      const ended = events.at(-1)!;
      if (ended.type !== "ended") throw new Error("not ended");
      for (const kind of ["materia", "cristal"] as const) {
        const before = sum([...start.values()].map((s) => s.carry[kind]));
        const after =
          sum(ended.results.map((r) => r.carry[kind])) +
          sum(ended.piles.map((p) => p[kind]));
        expect(after).toBe(before);
      }
    }
  });

  test("the battles emit every kind of event", () => {
    const kinds = new Set(outcomes.flatMap((o) => o.events.map((e) => e.type)));
    expect([...kinds].sort()).toEqual([
      "attacked",
      "controlChanged",
      "died",
      "dropped",
      "ended",
      "escaped",
      "hit",
      "joined",
      "missed",
      "picked",
    ]);
  });
});
