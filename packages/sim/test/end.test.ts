import { describe, expect, test } from "vitest";
import { SYSTEM_PLAYER_ID } from "../src/battle.ts";
import { applyCommand, validate, type Command } from "../src/commands.ts";
import { dominate, join } from "../src/domination.ts";
import { endSummary, recordHighlights } from "../src/end.ts";
import { createEventLog, type CreepRef, type SimEvent } from "../src/events.ts";
import { restore, serialize } from "../src/serialize.ts";
import { productionRefusal, startProduction } from "../src/production.ts";
import { step } from "../src/step.ts";
import type { Dna } from "../src/params.ts";
import { updateVision } from "../src/vision.ts";
import type { Creep, Stock, WorldState } from "../src/world.ts";
import { addWanderer, creepOf, paramsWith, textWorld } from "./helpers.ts";

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

/** A world whose teams hold no stock and keep only the creeps named. */
function bare(
  keep: [team: number, dna: Dna][],
  params = textWorld(MAP).params,
) {
  const w = textWorld(MAP, params);
  w.creeps = keep.map(([team, dna]) => creepOf(w, team, dna));
  return w;
}

const types = (events: SimEvent[]) => events.map((e) => e.type);

describe("elimination (E-min D2, L-1)", () => {
  test("no creep, no production and no stock for one: out on that tick, the other wins", () => {
    const w = bare([[1, "square"]]);
    const events = step(w, []);
    expect(w.teams[0]!.out).toEqual({ tick: 0, how: "eliminated", bot: false });
    expect(w.result).toEqual({
      tick: 0,
      how: "lastTeam",
      winner: 1,
      teams: [1],
    });
    expect(types(events)).toEqual(["teamOut", "worldEnded"]);
    expect(events[1]).toMatchObject(w.teams[1]!.core);
    // Both teams receive both, whatever they see (D8).
    expect(events.map((e) => e.teams)).toEqual([
      [0, 1],
      [0, 1],
    ]);
    expect(w.tick).toBe(1);
  });

  test("a creep, a stock of one creep's cost or a production keeps the team in", () => {
    const alive = bare([
      [0, "square"],
      [1, "square"],
    ]);
    step(alive, []);
    expect(alive.result).toBeNull();

    const rich = bare([[1, "square"]]);
    rich.teams[0]!.stock = { ...rich.params.creep.cost };
    step(rich, []);
    expect(rich.teams[0]!.out).toBeNull();

    const short = bare([[1, "square"]]);
    short.teams[0]!.stock = { ...short.params.creep.cost };
    short.teams[0]!.stock.materia -= 1;
    step(short, []);
    expect(short.teams[0]!.out).not.toBeNull();

    const producing = bare([[1, "square"]]);
    producing.teams[0]!.production = { dna: "circle", remainingSeconds: 5 };
    step(producing, []);
    expect(producing.teams[0]!.out).toBeNull();
  });

  test("a creep born on the tick saves its team", () => {
    const w = bare([[1, "square"]]);
    w.teams[0]!.production = {
      dna: "circle",
      remainingSeconds: w.params.world.tickSeconds,
    };
    expect(types(step(w, []))).toEqual(["born"]);
    expect(w.teams[0]!.out).toBeNull();
    expect(w.result).toBeNull();
  });

  test("an armed repeat is not production; loads and spoils do not count", () => {
    const w = bare([[1, "square"]]);
    w.teams[0]!.repeat = "circle";
    w.spoils = [
      { id: w.nextId++, cargo: { materia: 999, cristal: 999 }, x: 1, y: 1 },
    ];
    creepOf(w, 1, "square").cargo = { materia: 5, cristal: 0 };
    step(w, []);
    expect(w.teams[0]!.out).toMatchObject({ how: "eliminated" });
    expect(w.teams[0]!.repeat).toBeNull();
  });
});

describe("the result (E-min D5, F-1..F-5)", () => {
  test("no team left on one tick: a draw among those that left on it", () => {
    const w = bare([]);
    const events = step(w, []);
    expect(w.result).toEqual({
      tick: 0,
      how: "noTeam",
      winner: null,
      teams: [0, 1],
    });
    expect(types(events)).toEqual(["teamOut", "teamOut", "worldEnded"]);
    expect(events[2]).toMatchObject({ x: 15, y: 3 });
  });

  test("a concession that leaves one team wins it that tick", () => {
    const w = world();
    step(w, [{ playerId: 1, command: concede }]);
    expect(w.result).toMatchObject({ how: "lastTeam", winner: 1, teams: [1] });
    expect(w.teams[0]!.out).toMatchObject({ how: "conceded" });
  });

  test("a concession and the other team's elimination on one tick: a draw", () => {
    const w = bare([]);
    join(w, 1, 0, false);
    w.teams[0]!.stock = { ...w.params.creep.cost };
    step(w, [{ playerId: 1, command: concede }]);
    expect(w.result).toMatchObject({ how: "noTeam", teams: [0, 1] });
  });

  test("after the end no tick runs and every command is refused", () => {
    const w = world();
    step(w, [{ playerId: 1, command: concede }]);
    const frozen = serialize(w);
    expect(() => step(w, [])).toThrow("the world has ended");
    for (const command of playerCommands(w)) {
      expect(validate(w, command, 2), command.type).toBe("worldEnded");
    }
    expect(validate(w, { type: "join", team: 0, bot: false }, 5)).toBe(
      "worldEnded",
    );
    expect(serialize(w)).toBe(frozen);
  });

  const short = paramsWith((p) => {
    p.world.durationSeconds = 5;
  });

  test("the clock's last tick is a draw among the teams still in", () => {
    const w = textWorld(MAP, short);
    for (let i = 0; i < 4; i++) step(w, []);
    expect(w.result).toBeNull();
    const events = step(w, []);
    expect(w.result).toEqual({
      tick: 4,
      how: "clock",
      winner: null,
      teams: [0, 1],
    });
    expect(types(events)).toContain("worldEnded");
    expect(w.teams.map((t) => t.out)).toEqual([null, null]);
    expect(w.tick).toBe(5);
  });

  test("an elimination on the clock's last tick wins, no draw", () => {
    const w = bare(
      [
        [0, "square"],
        [1, "square"],
      ],
      short,
    );
    for (let i = 0; i < 4; i++) step(w, []);
    w.creeps = w.creeps.filter((c) => c.team === 1);
    step(w, []);
    expect(w.result).toMatchObject({ how: "lastTeam", winner: 1 });
  });

  test("a snapshot restored before the end reaches the same end", () => {
    const w = textWorld(MAP, short);
    for (let i = 0; i < 3; i++) step(w, []);
    const restored = restore(serialize(w));
    for (let i = 0; i < 2; i++) {
      step(w, []);
      step(restored, []);
    }
    expect(w.result).not.toBeNull();
    expect(serialize(restored)).toBe(serialize(w));
  });
});

const system = (command: Command) => ({ playerId: SYSTEM_PLAYER_ID, command });

/** `hunter` attacks `prey` next to it, on their cells (12, 3) and (13, 3). */
function openBattle(w: WorldState, hunter: Creep, prey: { id: number }) {
  Object.assign(hunter, { x: 12, y: 3 });
  Object.assign(prey, { x: 13, y: 3 });
  updateVision(w);
  hunter.order = { type: "approach", targetId: prey.id, intent: "attack" };
  step(w, []);
}

/** The host's results: `dead` die, then `winner`'s side keeps the field. */
function finish(
  w: WorldState,
  winner: Creep | null,
  dead: { id: number; x: number; y: number }[],
  reason: "won" | "idle" = "won",
) {
  const [battle] = w.battles;
  const left = battle!.participants.filter(
    (p) => !dead.some((d) => d.id === p.id),
  );
  const survivors = left.map((p) => {
    const creep = [...w.creeps, ...w.wanderers].find((c) => c.id === p.id)!;
    return {
      creepId: p.id,
      hp: 1,
      cargo: { ...creep.cargo },
      cell: { x: creep.x, y: creep.y },
    };
  });
  const side = battle!.participants.find((p) => p.id === winner?.id)?.side;
  return step(w, [
    ...dead.map((d) =>
      system({
        type: "battleExit",
        battleId: battle!.id,
        creepId: d.id,
        outcome: "died",
        hp: 0,
        cargo: { materia: 0, cristal: 0 },
        cell: { x: d.x, y: d.y },
        by: winner?.id ?? null,
      }),
    ),
    system({
      type: "battleEnd",
      battleId: battle!.id,
      winnerSide: reason === "won" ? side! : null,
      reason,
      survivors,
      piles: [],
    }),
  ]);
}

const counters = (w: WorldState) =>
  w.stats.teams.map((t) => [t.born, t.lost, t.battlesWon, t.battlesLost]);

describe("the counters and the summary (E-min D9, D10)", () => {
  test("born from the core only; lost; battles won and lost by team", () => {
    const w = textWorld(MAP);
    w.teams[1]!.production = {
      dna: "circle",
      remainingSeconds: w.params.world.tickSeconds,
    };
    step(w, []);
    expect(counters(w)).toEqual([
      [0, 0, 0, 0],
      [1, 0, 0, 0],
    ]);
    const hunter = creepOf(w, 0, "circle");
    const prey = creepOf(w, 1, "square");
    openBattle(w, hunter, prey);
    finish(w, hunter, [prey]);
    expect(counters(w)).toEqual([
      [0, 0, 1, 0],
      [1, 1, 0, 1],
    ]);
  });

  test("a battle with no winner counts for neither", () => {
    const w = textWorld(MAP);
    openBattle(w, creepOf(w, 0, "circle"), creepOf(w, 1, "square"));
    finish(w, null, [], "idle");
    expect(counters(w)).toEqual([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
  });

  test("a battle the wanderers win is lost by the team in it", () => {
    const w = textWorld(MAP);
    const mine = creepOf(w, 0, "square");
    const wanderer = addWanderer(w, 13, 3);
    openBattle(w, mine, wanderer);
    const [battle] = w.battles;
    step(w, [
      system({
        type: "battleExit",
        battleId: battle!.id,
        creepId: mine.id,
        outcome: "died",
        hp: 0,
        cargo: { materia: 0, cristal: 0 },
        cell: { x: 12, y: 3 },
        by: wanderer.id,
      }),
      system({
        type: "battleEnd",
        battleId: battle!.id,
        winnerSide: 1,
        reason: "won",
        survivors: [
          {
            creepId: wanderer.id,
            hp: 1,
            cargo: { materia: 0, cristal: 0 },
            cell: { x: 13, y: 3 },
          },
        ],
        piles: [],
      }),
    ]);
    expect(counters(w)).toEqual([
      [0, 1, 0, 1],
      [0, 0, 0, 0],
    ]);
  });

  test("the summary of an ended world; null before", () => {
    const w = world();
    expect(endSummary(w)).toBeNull();
    w.stats.teams[1]!.delivered.materia = 120;
    step(w, [{ playerId: 1, command: concede }]);
    expect(endSummary(w)).toEqual({
      result: w.result,
      durationSeconds: w.params.world.tickSeconds,
      teams: [
        {
          team: 0,
          out: w.teams[0]!.out,
          born: 0,
          lost: 0,
          battlesWon: 0,
          battlesLost: 0,
          materiaDelivered: 0,
        },
        {
          team: 1,
          out: null,
          born: 0,
          lost: 0,
          battlesWon: 0,
          battlesLost: 0,
          materiaDelivered: 120,
        },
      ],
      highlights: [expect.objectContaining({ type: "teamOut", team: 0 })],
    });
    expect(w.highlights[0]).not.toHaveProperty("teams");
  });
});

const who: CreepRef = { id: 1, team: 0, dna: "square", name: "A" };
const stock = (materia: number, cristal = 0): Stock => ({ materia, cristal });
const at = { x: 0, y: 0, teams: [0, 1] };

const battleEnded = (
  tick: number,
  index: number,
  entered: number,
  loot: number,
  spoiled = 0,
): SimEvent => ({
  type: "battleEnded",
  battle: index,
  reason: "won",
  winner: { side: 0, team: 0 },
  sideTeams: [0, 1],
  survivors: [who],
  loot: loot > 0 ? [{ creep: who, taken: stock(loot) }] : [],
  spoils: [],
  entered,
  spoiled: stock(spoiled),
  tick,
  index,
  ...at,
});

const died = (tick: number, firstBlood: boolean): SimEvent => ({
  type: "died",
  creep: who,
  by: null,
  battle: 1,
  firstBlood,
  tick,
  index: 0,
  ...at,
});

describe("the main events' ranking (E-min D10, plan P6)", () => {
  const kept = (w: WorldState) => w.highlights.map((e) => [e.tick, e.index]);

  test("a team leaving, the first blood, then battles by size, load and age", () => {
    const w = textWorld(MAP);
    recordHighlights(w, [
      battleEnded(1, 0, 2, 5),
      battleEnded(1, 1, 3, 0),
      died(1, true),
    ]);
    recordHighlights(w, [
      battleEnded(2, 0, 2, 3, 4), // load 7: over the load 5
      died(2, false), // not a candidate
      battleEnded(2, 2, 2, 5), // ties tick 1's load: the later one
    ]);
    expect(kept(w)).toEqual([
      [1, 0], // first blood (index 0 of tick 1)
      [1, 1], // three entered
      [2, 0], // load 7
      [1, 0], // load 5, the earlier
      [2, 2],
    ]);
    expect(w.highlights.map((e) => e.type)).toEqual([
      "died",
      "battleEnded",
      "battleEnded",
      "battleEnded",
      "battleEnded",
    ]);
    recordHighlights(w, [
      {
        type: "teamOut",
        team: 1,
        how: "eliminated",
        bot: false,
        tick: 3,
        index: 0,
        ...at,
      },
    ]);
    expect(w.highlights).toHaveLength(w.params.end.highlights);
    expect(w.highlights[0]!.type).toBe("teamOut");
    // The weakest fell off.
    expect(kept(w)).not.toContainEqual([2, 2]);
  });
});
