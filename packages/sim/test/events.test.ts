import { describe, expect, test } from "vitest";
import { eventsFor, type SimEvent } from "../src/events.ts";
import { startProduction } from "../src/production.ts";
import { step } from "../src/step.ts";
import type { WorldState } from "../src/world.ts";
import { run, textWorld } from "./helpers.ts";

// Far: the cores are out of each other's sight (core vision 8). Near: team 1's
// core sees team 0's core cell.
const FAR = ["A............................B"];
const NEAR = ["A.....B"];

function producing(world: WorldState, teams: number[]): void {
  for (const team of teams) {
    world.teams[team]!.stock = { materia: 1000, cristal: 1000 };
    expect(startProduction(world, team, "circle", false)).toBeNull();
  }
}

/** Steps until a tick returns events, and returns that tick's list. */
function nextEvents(world: WorldState, limit = 2000): SimEvent[] {
  for (let i = 0; i < limit; i++) {
    const events = step(world, []);
    if (events.length > 0) return events;
  }
  throw new Error("no events");
}

describe("sim events (ADR-0007, plan section 7)", () => {
  test("a quiet tick returns no events", () => {
    const world = textWorld(FAR);
    expect(step(world, [])).toEqual([]);
  });

  test("a creep born at the core emits born, seen by its own team", () => {
    const world = textWorld(FAR);
    producing(world, [0]);
    const events = nextEvents(world);
    const born = world.creeps.at(-1)!;
    expect(events).toEqual([
      {
        type: "born",
        creep: { id: born.id, team: 0, dna: "circle", name: born.name },
        ...world.teams[0]!.core,
        tick: world.tick - 1,
        index: 0,
        teams: [0],
      },
    ]);
    expect(eventsFor(events, 0)).toEqual([
      {
        type: "born",
        creep: { id: born.id, team: 0, dna: "circle", name: born.name },
        ...world.teams[0]!.core,
        tick: world.tick - 1,
        index: 0,
      },
    ]);
    // Nothing leaks: team 1 does not see the core cell.
    expect(eventsFor(events, 1)).toEqual([]);
  });

  test("a team that sees the event's cell is in its audience", () => {
    const world = textWorld(NEAR);
    producing(world, [0]);
    const events = nextEvents(world);
    expect(events.map((e) => e.teams)).toEqual([[0, 1]]);
    expect(eventsFor(events, 1)).toHaveLength(1);
  });

  test("index is the place in the tick's whole list, before any filter", () => {
    const world = textWorld(FAR);
    producing(world, [0, 1]);
    const events = nextEvents(world);
    const teamOf = (e: SimEvent) => (e.type === "born" ? e.creep.team : -1);
    expect(events.map((e) => [e.index, teamOf(e), e.teams])).toEqual([
      [0, 0, [0]],
      [1, 1, [1]],
    ]);
    expect(eventsFor(events, 1).map((e) => e.index)).toEqual([1]);
  });

  test("the same world and commands give the same events", () => {
    const record = () => {
      const world = textWorld(FAR);
      producing(world, [0, 1]);
      const all: SimEvent[] = [];
      for (let i = 0; i < 1500; i++) all.push(...step(world, []));
      return all;
    };
    const first = record();
    expect(first.length).toBeGreaterThan(0);
    expect(record()).toEqual(first);
  });

  test("events stay outside the state", () => {
    const world = textWorld(FAR);
    producing(world, [0]);
    run(world, 1500);
    expect(JSON.stringify(world)).not.toContain("born");
  });
});
