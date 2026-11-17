import { eventsFor, type SimEvent } from "@geometrix/sim";
import { describe, expect, test } from "vitest";
import {
  interruptions,
  parseSoakArgs,
  rebuild,
  samplesCsv,
  SoakError,
  summarize,
  type SoakSample,
} from "../src/soak.ts";
import { stateHash } from "../src/hash.ts";
import { WorldHost } from "../src/world-host.ts";
import { Store } from "../src/persistence.ts";
import { testParams } from "./helpers.ts";

describe("parseSoakArgs", () => {
  test("defaults: ×360, 5 kills, seed 42, port 8089, 2 clients per team dropping every 60 s, temp db, runs/", () => {
    expect(parseSoakArgs([])).toEqual({
      multiplier: 360,
      kills: 5,
      seed: 42,
      port: 8089,
      clients: 2,
      dropEverySeconds: 60,
      db: undefined,
      out: "runs",
    });
  });

  test("reads every option", () => {
    expect(
      parseSoakArgs([
        "--mult=36",
        "--kills=0",
        "--seed=7",
        "--port=9000",
        "--clients=3",
        "--drop-every=20",
        "--db=x.db",
        "--out=o",
      ]),
    ).toEqual({
      multiplier: 36,
      kills: 0,
      seed: 7,
      port: 9000,
      clients: 3,
      dropEverySeconds: 20,
      db: "x.db",
      out: "o",
    });
  });

  test.each([
    [["--mult=0"]],
    [["--kills=-1"]],
    [["--port=70000"]],
    [["--clients=4"]],
    [["--drop-every=1"]],
    [["--x"]],
  ])("refuses %j", (args) => {
    expect(() => parseSoakArgs(args)).toThrow(SoakError);
  });
});

describe("interruptions", () => {
  test("kills plus one clean stop, sorted, inside 5%..95% of the world", () => {
    const plan = interruptions(42, 5, 259_200);
    expect(plan).toHaveLength(6);
    expect(plan.filter((p) => p.kind === "term")).toHaveLength(1);
    const ticks = plan.map((p) => p.tick);
    expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
    expect(new Set(ticks).size).toBe(6);
    for (const tick of ticks) {
      expect(tick).toBeGreaterThanOrEqual(12_960);
      expect(tick).toBeLessThan(246_240);
    }
  });

  test("the same seed gives the same plan; another seed another", () => {
    expect(interruptions(7, 3, 10_000)).toEqual(interruptions(7, 3, 10_000));
    expect(interruptions(8, 3, 10_000)).not.toEqual(
      interruptions(7, 3, 10_000),
    );
  });

  test("no kills still stops cleanly once", () => {
    expect(interruptions(1, 0, 1000).map((p) => p.kind)).toEqual(["term"]);
  });
});

describe("rebuild", () => {
  test("a hosted world's log rebuilds its state and its events", () => {
    const store = new Store(":memory:");
    const host = WorldHost.create(
      {
        store,
        config: {
          snapshotEveryTicks: 300,
          metricsEveryTicks: 60,
          chronicleWelcome: 100,
        },
      },
      {
        seed: 3,
        params: testParams(),
        multiplier: 1,
        botTeams: [0, 1],
        createdAt: "2026-11-14T00:00:00.000Z",
      },
    );
    for (let i = 0; i < 400; i++) host.tick();
    while (host.chronicle(0).length < 2) host.tick();
    const ticks = host.state.tick;
    const events: SimEvent[] = [];
    const state = rebuild(
      {
        simVersion: 2,
        seed: 3,
        params: testParams(),
        ticks,
        finalHash: stateHash(host.state),
        commands: store.commandsFrom(host.id, 0),
      },
      (tick) => events.push(...tick),
    );
    expect(state.tick).toBe(ticks);
    expect(stateHash(state)).toBe(stateHash(host.state));
    for (const team of [0, 1]) {
      expect(eventsFor(events, team)).toEqual(
        store.recentChronicle(host.id, team, 1000),
      );
    }
  });
});

describe("summarize", () => {
  const sample = (
    seconds: number,
    pid: number,
    tick: number,
    rssMb: number,
    ticksPerSecond: number | null,
  ): SoakSample => ({
    seconds,
    pid,
    tick,
    rssMb,
    dbMb: tick / 1000,
    ticksPerSecond,
  });

  test("memory per process, final database size and loop speed", () => {
    const samples = [
      sample(2, 10, 700, 80, null),
      sample(4, 10, 1420, 90, 360),
      sample(6, 11, 1500, 70, null),
      sample(8, 11, 2100, 75, 300),
      sample(10, 11, 2820, 76, 360),
    ];
    expect(summarize(samples, 360)).toEqual({
      samples: 5,
      maxRssMb: 90,
      rssByProcess: [
        { pid: 10, firstMb: 80, lastMb: 90 },
        { pid: 11, firstMb: 70, lastMb: 76 },
      ],
      finalDbMb: 2.82,
      minSpeedShare: 300 / 360,
      medianSpeedShare: 1,
    });
    expect(samplesCsv(samples).split("\n")[2]).toBe(
      "4.0,10,1420,90.0,1.42,360.0",
    );
  });
});
