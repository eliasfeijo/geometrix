import { readFileSync } from "node:fs";
import { createWorld, parseParams, step } from "@geometrix/sim";
import { describe, expect, test } from "vitest";
import { stateHash } from "../src/hash.ts";
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

describe("verify", () => {
  test("all three runs reach the hash of a plain run", () => {
    const world = createWorld(7, params);
    for (let i = 0; i < 11; i++) step(world, []);
    const result = verify(7, 11, params);
    expect(result.ok).toBe(true);
    expect(result.runs.map((r) => r.name)).toEqual([
      "run 1",
      "run 2",
      "snapshot at tick 5 -> restore",
    ]);
    for (const r of result.runs) expect(r.hash).toBe(stateHash(world));
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
