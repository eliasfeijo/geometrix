import { readFileSync } from "node:fs";
import { botsFor, parseParams, type SimEvent } from "@geometrix/sim";
import { runBots } from "../src/harness.ts";
import { describe, expect, test } from "vitest";
import { EventHash, stateHash } from "../src/hash.ts";
import { run, type Output } from "../src/main.ts";
import { verify } from "../src/verify.ts";

const params = parseParams(
  JSON.parse(
    readFileSync(
      new URL("../../../params/default.json", import.meta.url),
      "utf8",
    ),
  ),
);

const testParams = parseParams(
  JSON.parse(
    readFileSync(
      new URL("../../../packages/sim/test/params.json", import.meta.url),
      "utf8",
    ),
  ),
);

function capture(): Output & { lines: string[]; errors: string[] } {
  const lines: string[] = [];
  const errors: string[] = [];
  return {
    lines,
    errors,
    log: (l) => lines.push(l),
    error: (l) => errors.push(l),
  };
}

/** A bot run's events, in order. */
function withEvents(seed: number, ticks: number) {
  const events: SimEvent[] = [];
  runBots(seed, testParams, ticks, botsFor(["balanced", "balanced"]), (_, e) =>
    events.push(...e),
  );
  return { events };
}

describe("verify", () => {
  test("all four runs reach the hash of a bot run", () => {
    const ticks = 2 * 3600 + 1;
    const { state, log } = runBots(
      7,
      params,
      ticks,
      botsFor(["balanced", "balanced"]),
    );
    const result = verify(7, ticks, params);
    expect(result.ok).toBe(true);
    expect(result.runs.map((r) => r.name)).toEqual([
      "run 1",
      "run 2",
      "snapshot at tick 3600 -> restore",
      `replay of the log (${log.length} commands)`,
    ]);
    for (const r of result.runs) expect(r.hash).toBe(stateHash(state));
    const [first] = result.runs;
    for (const r of result.runs) expect(r.eventsHash).toBe(first!.eventsHash);
  });

  test("all four runs emit the same events", () => {
    // The sim tests' params: creeps are cheap, so there are births and
    // encounters to hash.
    const result = verify(42, 2 * 3600, testParams);
    expect(result.ok).toBe(true);
    const [first] = result.runs;
    expect(first!.events).toBeGreaterThan(10);
    for (const r of result.runs) {
      expect(r.eventsHash).toBe(first!.eventsHash);
      expect(r.events).toBe(first!.events);
    }
  });

  test("the events hash takes every event in order, however the run is split", () => {
    const { events } = withEvents(42, 2 * 3600);
    expect(events.length).toBeGreaterThan(2);
    const whole = new EventHash();
    whole.add(events);
    const split = new EventHash();
    split.add(events.slice(0, 2));
    split.add(events.slice(2));
    expect(split.digest()).toBe(whole.digest());
    const swapped = new EventHash();
    swapped.add([events[1]!, events[0]!, ...events.slice(2)]);
    expect(swapped.digest()).not.toBe(whole.digest());
    const fewer = new EventHash();
    fewer.add(events.slice(1));
    expect(fewer.digest()).not.toBe(whole.digest());
  });

  test("the bots change the world, so the replay run is not vacuous", () => {
    const ticks = 3 * 60;
    const withBots = verify(7, ticks, params).runs[0]!.hash;
    const withoutBots = verify(7, ticks, params, ["none", "none"]).runs[0]!
      .hash;
    expect(withoutBots).not.toBe(withBots);
  });

  test("different seeds reach different hashes", () => {
    expect(verify(1, 10, params).runs[0]!.hash).not.toBe(
      verify(2, 10, params).runs[0]!.hash,
    );
  });
});

describe("geo CLI", () => {
  test("verify prints the hashes and exits 0", () => {
    const out = capture();
    expect(run(["verify", "--seed", "3", "--ticks", "20"], out)).toBe(0);
    expect(out.lines[0]).toBe("geo verify --seed 3 --ticks 20");
    expect(out.lines.at(-1)).toBe("OK: deterministic");
    expect(out.errors).toEqual([]);
  });

  test.each([
    [["verify", "--ticks", "0"], "--ticks must be an integer >= 1: 0"],
    [["verify", "--seed=-1"], "--seed must be an integer >= 0: -1"],
    [["verify", "--seed", "4294967296"], "--seed must be < 2^32"],
    [["verify", "--nope"], "Unknown option '--nope'"],
    [["frobnicate"], "unknown command: frobnicate"],
  ])("%j is a usage error (exit 2)", (argv, message) => {
    const out = capture();
    expect(run(argv, out)).toBe(2);
    expect(out.errors.join("\n")).toContain(message);
  });

  test("no command prints usage and exits 2", () => {
    const out = capture();
    expect(run([], out)).toBe(2);
    expect(out.lines.join("\n")).toContain("usage: geo");
  });
});
