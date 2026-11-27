import { describe, expect, test } from "vitest";
import { applyCommand, validate, type Command } from "../src/commands.ts";
import { dominate, join } from "../src/domination.ts";
import { createEventLog } from "../src/events.ts";
import { productionRefusal, startProduction } from "../src/production.ts";
import { step } from "../src/step.ts";
import type { WorldState } from "../src/world.ts";
import { creepOf, textWorld } from "./helpers.ts";

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

/** Players 1 and 2 (team 0, team 1), with stock to spend. */
function world(bot = false): WorldState {
  const w = textWorld(MAP);
  join(w, 1, 0, bot);
  join(w, 2, 1, bot);
  for (const team of w.teams) team.stock = { materia: 10_000, cristal: 10_000 };
  return w;
}

const concede = { type: "concede" } as const;

/** One of each command a player can send. */
function playerCommands(w: WorldState): Command[] {
  const creepId = creepOf(w, 0, "square").id;
  return [
    { type: "dominate", creepId },
    { type: "release" },
    { type: "order", creepId, order: { type: "stop" } },
    { type: "setRules", creepId, rules: [] },
    { type: "applyPreset", creepId, preset: "materiaCollector" },
    { type: "produce", dna: "square", repeat: false },
    { type: "stopRepeat" },
    { type: "buyUpgrade", upgrade: "capacity" },
    { type: "react", creepId, choice: "pay" },
    concede,
  ];
}

describe("concede (E-min D3, L-2..L-4)", () => {
  test("the team leaves the match on the tick the command applies", () => {
    const w = world();
    const log = createEventLog(w.tick);
    expect(applyCommand(w, concede, 1, log)).toBeNull();
    expect(w.teams[0]!.out).toEqual({ tick: 0, how: "conceded", bot: false });
    expect(w.teams[1]!.out).toBeNull();
    expect(log.events).toMatchObject([
      { type: "teamOut", team: 0, how: "conceded", bot: false },
    ]);
    expect(log.events[0]).toMatchObject(w.teams[0]!.core);
  });

  test("a bot's concession says so", () => {
    const w = world(true);
    expect(applyCommand(w, concede, 2)).toBeNull();
    expect(w.teams[1]!.out).toMatchObject({ how: "conceded", bot: true });
  });

  test("dominations end, the repeat drops; creeps, core and stock stay", () => {
    const w = world();
    const mine = creepOf(w, 0, "square");
    dominate(w, 1, mine.id);
    const theirs = creepOf(w, 1, "square");
    dominate(w, 2, theirs.id);
    startProduction(w, 0, "circle", true);
    const rules = mine.rules;
    const stock = { ...w.teams[0]!.stock };
    const creeps = w.creeps.length;
    applyCommand(w, concede, 1);
    expect(mine.dominatedBy).toBeNull();
    expect(theirs.dominatedBy).toBe(2);
    expect(mine.rules).toBe(rules);
    expect(w.creeps).toHaveLength(creeps);
    expect(w.teams[0]!.stock).toEqual(stock);
    expect(w.teams[0]!.repeat).toBeNull();
    // The production already running is left to finish.
    expect(w.teams[0]!.production).not.toBeNull();
  });

  test("every later command of its players is refused with teamOut", () => {
    const w = world();
    applyCommand(w, concede, 1);
    for (const command of playerCommands(w)) {
      expect(validate(w, command, 1), command.type).toBe("teamOut");
    }
    expect(productionRefusal(w, w.teams[0]!)).toBe("teamOut");
    // The other team is unaffected, but for concede: it is the last one.
    expect(
      validate(w, { type: "produce", dna: "square", repeat: false }, 2),
    ).toBeNull();
    expect(validate(w, concede, 2)).toBe("worldEnded");
  });

  test("concessions on one tick follow the log: the second is refused", () => {
    const w = world();
    step(w, [
      { playerId: 2, command: concede },
      { playerId: 1, command: concede },
    ]);
    expect(w.teams[0]!.out).toBeNull();
    expect(w.teams[1]!.out).toMatchObject({ how: "conceded" });
    expect(w.stats.teams.map((t) => t.commands.concede)).toEqual([0, 1]);
  });

  test("a player who never joined cannot concede", () => {
    expect(validate(world(), concede, 9)).toBe("unknownPlayer");
  });
});
