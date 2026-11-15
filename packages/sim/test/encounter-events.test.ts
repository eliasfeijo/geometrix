import { describe, expect, test } from "vitest";
import { eventsFor, type SimEvent } from "../src/events.ts";
import { dominate, join } from "../src/domination.ts";
import { createRng } from "../src/rng.ts";
import { dropSpoil } from "../src/spoils.ts";
import { step } from "../src/step.ts";
import { updateVision } from "../src/vision.ts";
import type { WorldState } from "../src/world.ts";
import { creepOf, textWorld } from "./helpers.ts";

// 40 cells: the cores far apart, the middle dark for both.
const ROW = ["A......................................B"];

/** A team 0 circle attacks a team 1 square at x=9 / 10 until one dies. */
function fightToDeath(seed: number): { w: WorldState; events: SimEvent[] } {
  const w = textWorld(ROW);
  w.rng = createRng(seed);
  const hunter = creepOf(w, 0, "circle");
  const prey = creepOf(w, 1, "square");
  // Both carry something: whoever dies leaves loot.
  Object.assign(hunter, { x: 9, y: 0, cargo: { materia: 2, cristal: 0 } });
  Object.assign(prey, { x: 10, y: 0, cargo: { materia: 20, cristal: 6 } });
  updateVision(w);
  // The victim fights: a dominated one refuses through its player.
  join(w, 2, 1, false);
  dominate(w, 2, prey.id);
  hunter.order = { type: "approach", targetId: prey.id, intent: "attack" };
  const events: SimEvent[] = [];
  events.push(...step(w, []));
  events.push(
    ...step(w, [
      {
        playerId: 2,
        command: { type: "react", creepId: prey.id, choice: "fight" },
      },
    ]),
  );
  for (let i = 0; i < 600 && w.encounters.length > 0; i++) {
    events.push(...step(w, []));
  }
  return { w, events };
}

describe("encounter events (spec K-1, K-2; plan section 7)", () => {
  test("a fight emits, in order, the declaration, the reaction, the end, the death and the loot", () => {
    const { events } = fightToDeath(3);
    expect(events.map((e) => e.type)).toEqual([
      "encounter",
      "reaction",
      "fightEnded",
      "died",
      "looted",
    ]);
    const [opened, reaction, ended, died] = events;
    if (
      opened?.type !== "encounter" ||
      reaction?.type !== "reaction" ||
      ended?.type !== "fightEnded" ||
      died?.type !== "died"
    ) {
      throw new Error("unreachable");
    }
    expect(reaction).toMatchObject({ choice: "fight", by: "player" });
    expect(died.creep).toEqual(ended.loser);
    expect(died.by).toEqual(ended.winner);
    // The dead keep their name in the events: the chronicle needs it.
    expect(died.creep.name.length).toBeGreaterThan(0);
  });

  test("the same world and commands give the same events", () => {
    const strip = (events: SimEvent[]) => JSON.stringify(events);
    expect(strip(fightToDeath(5).events)).toBe(strip(fightToDeath(5).events));
  });

  test("the participants' teams always hear it, even when the dead see no more", () => {
    const { events } = fightToDeath(3);
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
