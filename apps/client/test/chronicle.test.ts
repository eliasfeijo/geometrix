import {
  DNAS,
  eventsFor,
  step,
  type CreepRef,
  type Dna,
  type EventBody,
  type SimEvent,
  type TeamEvent,
} from "@geometrix/sim";
import { describe, expect, it } from "vitest";
import { narrate, plainText, variant } from "../src/chronicle/narrate.ts";
import { TEMPLATES } from "../src/chronicle/templates.ts";
import { CHRONICLE_KEEP, GameStore } from "../src/store.ts";
import { encounterWorld, testWorld, welcomeOf } from "./helpers.ts";

const ref = (id: number, dna: Dna, team: number | null = id % 2): CreepRef => ({
  id,
  team,
  dna,
  name: `Nome${id}`,
});
const stock = (materia: number, cristal: number) => ({ materia, cristal });

/** One body of each event type and outcome, spoken by `dna`. */
function bodies(dna: Dna): EventBody[] {
  const a = ref(1, dna);
  const b = ref(2, "square");
  const wanderer = ref(3, "circle", null);
  const at = { x: 3, y: 4 };
  return [
    { type: "born", creep: a, ...at },
    ...(["attack", "extort"] as const).flatMap((intent) =>
      [false, true].map((mutual): EventBody => ({
        type: "encounter",
        encounter: 9,
        aggressor: a,
        victim: b,
        intent,
        demand: intent === "extort" ? stock(12, 4) : null,
        mutual,
        ...at,
      })),
    ),
    ...(["pay", "refuse"] as const).map((choice): EventBody => ({
      type: "reaction",
      encounter: 9,
      creep: a,
      choice,
      by: "rule",
      ...at,
    })),
    { type: "paid", encounter: 9, from: b, to: a, amount: stock(0, 3), ...at },
    ...(["attack", "refused"] as const).map((cause): EventBody => ({
      type: "battleOpened",
      battle: 20,
      encounter: 9,
      cause,
      sides: [
        { team: a.team, creeps: [a] },
        { team: b.team, creeps: [b] },
      ],
      ...at,
    })),
    { type: "battleJoined", battle: 20, creep: a, side: 0, ...at },
    { type: "battleJoined", battle: 20, creep: wanderer, side: 2, ...at },
    {
      type: "battleLeft",
      battle: 20,
      creep: wanderer,
      reason: "edge",
      hp: 10,
      cargo: stock(0, 0),
      ...at,
    },
    ...(["edge", "idle"] as const).map((reason): EventBody => ({
      type: "battleLeft",
      battle: 20,
      creep: a,
      reason,
      hp: 40,
      cargo: stock(1, 0),
      ...at,
    })),
    ...(["won", "idle", "empty"] as const).map((reason): EventBody => ({
      type: "battleEnded",
      battle: 20,
      reason,
      winner: reason === "won" ? { side: 0, team: a.team } : null,
      sideTeams: [a.team, b.team],
      survivors: reason === "empty" ? [] : [a],
      loot: [],
      spoils: [],
      entered: 2,
      spoiled: stock(0, 0),
      ...at,
    })),
    { type: "died", creep: b, by: a, battle: 20, firstBlood: false, ...at },
    { type: "died", creep: b, by: null, battle: 20, firstBlood: false, ...at },
    { type: "died", creep: b, by: a, battle: 20, firstBlood: true, ...at },
    { type: "died", creep: b, by: null, battle: 20, firstBlood: true, ...at },
    { type: "teamOut", team: 1, how: "eliminated", bot: false, ...at },
    { type: "teamOut", team: 1, how: "conceded", bot: false, ...at },
    { type: "teamOut", team: 1, how: "conceded", bot: true, ...at },
    { type: "concedeVoteOpened", team: 1, deadlineTick: 12, ...at },
    ...(["passed", "rejected", "dropped"] as const).map(
      (outcome): EventBody => ({
        type: "concedeVoteClosed",
        team: 1,
        outcome,
        ...at,
      }),
    ),
    {
      type: "worldEnded",
      result: { tick: 9, how: "lastTeam", winner: 0, teams: [0] },
      ...at,
    },
    ...(["noTeam", "clock"] as const).map((how): EventBody => ({
      type: "worldEnded",
      result: { tick: 9, how, winner: null, teams: [0, 1] },
      ...at,
    })),
    { type: "pickedUp", creep: a, spoil: 77, taken: stock(2, 0), ...at },
    // The wanderers (junction F6): no team, no dialogue.
    { type: "wandererBorn", wanderer, ...at },
    {
      type: "battleOpened",
      battle: 21,
      encounter: null,
      cause: "wanderer",
      sides: [
        { team: null, creeps: [wanderer] },
        { team: b.team, creeps: [b] },
      ],
      ...at,
    },
    {
      type: "battleEnded",
      battle: 21,
      reason: "won",
      winner: { side: 0, team: null },
      sideTeams: [null, b.team],
      survivors: [wanderer],
      loot: [],
      spoils: [],
      entered: 2,
      spoiled: stock(0, 0),
      ...at,
    },
  ];
}

describe("narrate (spec K-3, D17)", () => {
  it("fills every placeholder of every variant of every voice", () => {
    for (const dna of DNAS) {
      for (const body of bodies(dna)) {
        // 7919 is prime: ticks 0..12 reach every variant of up to 13.
        for (let tick = 0; tick < 13; tick++) {
          const segments = narrate({ ...body, tick, index: 0 });
          const text = plainText(segments);
          expect(text, `${body.type} ${dna}`).not.toMatch(/[{}]/);
          expect(text[0], text).toBe(text[0]!.toUpperCase());
        }
      }
    }
  });

  it("names the creeps as segments, to click", () => {
    const [encounter] = bodies("circle").filter((b) => b.type === "encounter");
    const segments = narrate({ ...encounter!, tick: 5, index: 2 });
    const named = segments.flatMap((s) =>
      typeof s === "string" ? [] : [s.creep.id],
    );
    expect(named.sort()).toEqual([1, 2]);
  });

  it("says the demand and the battle's winner", () => {
    const texts = bodies("triangle").map((b) =>
      plainText(narrate({ ...b, tick: 0, index: 0 })),
    );
    expect(texts.join("\n")).toContain("12 matéria e 4 cristal");
    expect(texts.join("\n")).toContain("vitória do time Laranja");
    expect(texts.join("\n")).toContain("vitória dos andarilhos");
    expect(texts.join("\n")).toMatch(/Nome3, um andarilho, cai sobre Nome2/);
  });

  it("joins and escapes in the creep's voice, a wanderer's in the narrator's", () => {
    const say = (body: EventBody, tick: number) =>
      plainText(narrate({ ...body, tick, index: 0 }));
    const lines = (dna: Dna, type: string, team: number | null) => {
      const body = bodies(dna).find(
        (b) =>
          b.type === type &&
          (b.type !== "battleLeft" || b.reason === "edge") &&
          "creep" in b &&
          b.creep.team === team,
      )!;
      return new Set([0, 1, 2, 3, 4, 5].map((t) => say(body, t)));
    };
    for (const type of ["battleJoined", "battleLeft"]) {
      const square = lines("square", type, 1);
      const circle = lines("circle", type, 1);
      expect(
        [...square].some((l) => circle.has(l)),
        type,
      ).toBe(false);
      for (const line of lines("square", type, null)) {
        expect(line).toContain("andarilho");
      }
    }
  });

  it("picks the variant by (tick × 7919 + index) mod n", () => {
    expect(variant({ tick: 1, index: 0 }, 3)).toBe(7919 % 3);
    expect(variant({ tick: 2, index: 5 }, 3)).toBe((2 * 7919 + 5) % 3);
    const body = bodies("square")[0]!;
    const text = (tick: number) =>
      plainText(narrate({ ...body, tick, index: 0 }));
    expect(text(0)).toContain(
      TEMPLATES.born.square[0].replace(/\{creep\}/, "Nome1").slice(0, 10),
    );
  });

  it("gives both teams and the replay the same sentence", () => {
    const { world, prey, events } = encounterWorld("extort", true);
    const all: SimEvent[] = [...events];
    all.push(
      ...step(world, [
        {
          playerId: 9,
          command: { type: "react", creepId: prey.id, choice: "pay" },
        },
      ]),
    );
    for (let i = 0; i < 400 && world.creeps.includes(prey); i++) {
      all.push(...step(world, []));
    }
    const said = (events: readonly TeamEvent[]) =>
      new Map(
        events.map((e) => [`${e.tick}.${e.index}`, plainText(narrate(e))]),
      );
    const replay = said(all);
    for (const team of [0, 1]) {
      for (const [key, text] of said(eventsFor(all, team))) {
        expect(replay.get(key)).toBe(text);
      }
    }
    const types = new Set(all.map((e) => e.type));
    expect(types).toContain("encounter");
    expect(types).toContain("reaction");
  });
});

describe("the chronicle in the store (spec N-1, C-4)", () => {
  const event = (tick: number, index = 0): TeamEvent => ({
    ...bodies("square")[0]!,
    tick,
    index,
  });

  it("starts from the welcome and appends the deltas' events", () => {
    const world = testWorld();
    const store = new GameStore();
    store.receive({ ...welcomeOf(world), chronicle: [event(1), event(2)] }, 0);
    expect(store.info.value).not.toHaveProperty("chronicle");
    step(world, []);
    store.receive(
      {
        type: "delta",
        seq: 1,
        delta: { tick: world.tick },
        events: [event(3), event(3, 1)],
      },
      1,
    );
    expect(store.chronicle.value.map((e) => e.tick)).toEqual([1, 2, 3, 3]);
    // A new welcome (a resync) starts over from its chronicle.
    store.receive({ ...welcomeOf(world), chronicle: [event(9)] }, 2);
    expect(store.chronicle.value.map((e) => e.tick)).toEqual([9]);
  });

  it("keeps the latest entries only", () => {
    const store = new GameStore();
    store.chronicled(
      Array.from({ length: CHRONICLE_KEEP + 5 }, (_, i) => event(i)),
    );
    expect(store.chronicle.value).toHaveLength(CHRONICLE_KEEP);
    expect(store.chronicle.value[0]!.tick).toBe(5);
  });
});
