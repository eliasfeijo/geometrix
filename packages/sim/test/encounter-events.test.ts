import { describe, expect, test } from "vitest";
import { eventsFor, type SimEvent } from "../src/events.ts";
import { createRng } from "../src/rng.ts";
import { dropSpoil } from "../src/spoils.ts";
import { SYSTEM_PLAYER_ID } from "../src/battle.ts";
import type { Command } from "../src/commands.ts";
import { step } from "../src/step.ts";
import { updateVision } from "../src/vision.ts";
import type { WorldState } from "../src/world.ts";
import { creepOf, textWorld } from "./helpers.ts";

// 40 cells: the cores far apart, the middle dark for both.
const ROW = ["A......................................B"];

/**
 * A team 0 circle attacks a team 1 square at x=9 / 10; the junction host's
 * results, built by hand: the square dies, its load left as a pile, and the
 * circle wins and loots it.
 */
function battleToDeath(seed: number): { w: WorldState; events: SimEvent[] } {
  const w = textWorld(ROW);
  w.rng = createRng(seed);
  const hunter = creepOf(w, 0, "circle");
  const prey = creepOf(w, 1, "square");
  Object.assign(hunter, { x: 9, y: 0, cargo: { materia: 2, cristal: 0 } });
  Object.assign(prey, { x: 10, y: 0, cargo: { materia: 20, cristal: 6 } });
  updateVision(w);
  hunter.order = { type: "approach", targetId: prey.id, intent: "attack" };
  const events: SimEvent[] = [];
  events.push(...step(w, []));
  const battleId = w.battles[0]!.id;
  const system = (command: Command) => ({
    playerId: SYSTEM_PLAYER_ID,
    command,
  });
  events.push(
    ...step(w, [
      system({
        type: "battleExit",
        battleId,
        creepId: prey.id,
        outcome: "died",
        hp: 0,
        cargo: { materia: 0, cristal: 0 },
        cell: { x: 11, y: 0 },
        by: hunter.id,
      }),
      system({
        type: "battleEnd",
        battleId,
        winnerSide: 0,
        reason: "won",
        survivors: [
          {
            creepId: hunter.id,
            hp: 100,
            cargo: { materia: 2, cristal: 0 },
            cell: { x: 9, y: 0 },
          },
        ],
        piles: [{ cell: { x: 11, y: 0 }, cargo: { materia: 20, cristal: 6 } }],
      }),
    ]),
  );
  return { w, events };
}

describe("encounter and battle events (spec K-1, K-2; junction D15)", () => {
  test("an attack emits the declaration and the opening; the results, the death and the end", () => {
    const { events } = battleToDeath(3);
    expect(events.map((e) => e.type)).toEqual([
      "encounter",
      "battleOpened",
      "died",
      "battleEnded",
    ]);
    const [opened, battle, died, ended] = events;
    if (
      opened?.type !== "encounter" ||
      battle?.type !== "battleOpened" ||
      died?.type !== "died" ||
      ended?.type !== "battleEnded"
    ) {
      throw new Error("unreachable");
    }
    expect(battle).toMatchObject({
      encounter: opened.encounter,
      cause: "attack",
      sides: [
        { team: 0, creeps: [opened.aggressor] },
        { team: 1, creeps: [opened.victim] },
      ],
    });
    expect(died.creep).toEqual(opened.victim);
    expect(died.by).toEqual(opened.aggressor);
    expect(died.battle).toBe(battle.battle);
    // The dead keep their name in the events: the chronicle needs it.
    expect(died.creep.name.length).toBeGreaterThan(0);
    // Circle capacity 10, 2 carried: 6 cristal, then 2 materia.
    expect(ended).toMatchObject({
      reason: "won",
      winner: { side: 0, team: 0 },
      survivors: [opened.aggressor],
      loot: [{ creep: opened.aggressor, taken: { materia: 2, cristal: 6 } }],
    });
    expect(ended.spoils).toHaveLength(1);
  });

  test("the same world and commands give the same events", () => {
    const strip = (events: SimEvent[]) => JSON.stringify(events);
    expect(strip(battleToDeath(5).events)).toBe(strip(battleToDeath(5).events));
  });

  test("the participants' teams always hear it, even when the dead see no more", () => {
    const { events } = battleToDeath(3);
    for (const event of events) expect(event.teams).toEqual([0, 1]);
  });

  test("an event in the dark reaches only its creeps' teams", () => {
    const w = textWorld(ROW);
    const picker = creepOf(w, 0, "circle");
    Object.assign(picker, { x: 20, y: 0 });
    const spoil = dropSpoil(w, { x: 20, y: 0 }, { materia: 2, cristal: 0 });
    updateVision(w);
    picker.order = { type: "pickup", spoilId: spoil };
    const events = step(w, []);
    expect(events.map((e) => [e.type, e.teams])).toEqual([["pickedUp", [0]]]);
    expect(eventsFor(events, 1)).toEqual([]);
  });

  test("a team that sees the cell hears an encounter of others", () => {
    const w = textWorld(ROW);
    const picker = creepOf(w, 0, "circle");
    const watcher = creepOf(w, 1, "circle");
    Object.assign(picker, { x: 20, y: 0 });
    // Circle sight is 6: x=25 sees x=20.
    Object.assign(watcher, { x: 25, y: 0 });
    const spoil = dropSpoil(w, { x: 20, y: 0 }, { materia: 2, cristal: 0 });
    updateVision(w);
    picker.order = { type: "pickup", spoilId: spoil };
    const events = step(w, []);
    expect(events.map((e) => [e.type, e.teams])).toEqual([
      ["pickedUp", [0, 1]],
    ]);
  });
});
