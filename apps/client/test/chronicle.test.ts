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

const ref = (id: number, dna: Dna, team = id % 2): CreepRef => ({
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
    ...(["pay", "refuse", "fight", "flee"] as const).map(
      (choice): EventBody => ({
        type: "reaction",
        encounter: 9,
        creep: a,
        choice,
        by: "rule",
        ...at,
      }),
    ),
    { type: "paid", encounter: 9, from: b, to: a, amount: stock(0, 3), ...at },
    ...[
      [true, stock(5, 0)],
      [true, stock(0, 0)],
      [false, null],
    ].map(([escaped, dropped]): EventBody => ({
      type: "fleeAttempt",
      encounter: 9,
      creep: a,
      escaped: escaped as boolean,
      dropped: dropped as ReturnType<typeof stock> | null,
      spoil: null,
      ...at,
    })),
    { type: "fightEnded", encounter: 9, winner: a, loser: b, rounds: 1, ...at },
    { type: "died", creep: b, by: a, ...at },
    { type: "died", creep: b, by: null, ...at },
    ...[
      [stock(3, 1), null],
      [stock(3, 1), 77],
      [stock(0, 0), 77],
    ].map(([taken, spoil]): EventBody => ({
      type: "looted",
      by: a,
      from: b,
      taken: taken as ReturnType<typeof stock>,
      spoil: spoil as number | null,
      ...at,
    })),
    { type: "pickedUp", creep: a, spoil: 77, taken: stock(2, 0), ...at },
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

  it("says the demand, the rounds and what was dropped", () => {
    const texts = bodies("triangle").map((b) =>
      plainText(narrate({ ...b, tick: 0, index: 0 })),
    );
    expect(texts.join("\n")).toContain("12 matéria e 4 cristal");
    expect(texts.join("\n")).toContain("1 rodada");
    expect(texts.join("\n")).toContain("5 matéria");
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
    const { world, prey, events } = encounterWorld("attack");
    const all: SimEvent[] = [...events];
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
