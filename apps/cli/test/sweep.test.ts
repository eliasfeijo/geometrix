import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseParams } from "@geometrix/sim";
import { afterAll, describe, expect, test } from "vitest";
import { run, type Output } from "../src/main.ts";
import { parseSeeds, parseSet, SweepError, withParam } from "../src/sweep.ts";

const params = parseParams(
  JSON.parse(
    readFileSync(
      new URL("../../../params/default.json", import.meta.url),
      "utf8",
    ),
  ),
);

const scratch = mkdtempSync(join(tmpdir(), "geo-sweep-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

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

describe("arguments", () => {
  test("--set takes one parameter path and its values", () => {
    expect(parseSet("creep.cost.materia=30,40,50")).toEqual({
      path: "creep.cost.materia",
      values: [30, 40, 50],
    });
    for (const bad of ["creep.cost.materia", "a=1.5", "a=", "=1", "a=-1"]) {
      expect(() => parseSet(bad)).toThrow(SweepError);
    }
  });

  test("--seeds takes ranges and lists", () => {
    expect(parseSeeds("1-5")).toEqual([1, 2, 3, 4, 5]);
    expect(parseSeeds("1-3,7")).toEqual([1, 2, 3, 7]);
    expect(parseSeeds("9")).toEqual([9]);
    for (const bad of ["5-1", "a", "1,,2", "-1"]) {
      expect(() => parseSeeds(bad)).toThrow(SweepError);
    }
  });

  test("withParam sets one leaf and validates the result", () => {
    const changed = withParam(params, "creep.cost.materia", 30);
    expect(changed.creep.cost.materia).toBe(30);
    expect(params.creep.cost.materia).toBe(40);
    expect(() => withParam(params, "creep.nope", 1)).toThrow(
      "unknown parameter: creep.nope",
    );
    expect(() => withParam(params, "creep.cost", 1)).toThrow(
      "unknown parameter: creep.cost",
    );
    expect(() => withParam(params, "map.width", 63)).toThrow(
      /map.width=63: .*must be even/s,
    );
  });
});

describe("geo sweep", () => {
  test("runs every value × seed and compares them", () => {
    const out = join(scratch, "runs");
    const io = capture();
    expect(
      run(
        [
          "sweep",
          "--set",
          "creep.cost.materia=30,60",
          "--seeds",
          "1-2",
          "--hours",
          "1",
          "--out",
          out,
          "--id",
          "sw",
        ],
        io,
      ),
    ).toBe(0);
    expect(io.lines[0]).toBe(
      "geo sweep creep.cost.materia=30,60 seeds 1,2: 4 runs of 3600 ticks",
    );
    const dir = join(out, "sw");
    expect(readdirSync(dir).sort()).toEqual([
      "creep.cost.materia=30-s1",
      "creep.cost.materia=30-s2",
      "creep.cost.materia=60-s1",
      "creep.cost.materia=60-s2",
      "report.md",
      "sweep.csv",
    ]);
    expect(readdirSync(join(dir, "creep.cost.materia=60-s2"))).toEqual([
      "run.json",
    ]);
    const meta = JSON.parse(
      readFileSync(join(dir, "creep.cost.materia=60-s2", "run.json"), "utf8"),
    );
    expect(meta.params.creep.cost.materia).toBe(60);
    expect(meta.seed).toBe(2);

    const csv = readFileSync(join(dir, "sweep.csv"), "utf8")
      .trimEnd()
      .split("\n");
    expect(csv).toHaveLength(5);
    expect(csv[0]!.startsWith("value,seed,finalHash,")).toBe(true);

    const report = readFileSync(join(dir, "report.md"), "utf8");
    expect(report).toContain(
      "| Métrica | creep.cost.materia=30 | creep.cost.materia=60 |",
    );
    expect(report).toContain("| Estoque de matéria no fim |");
  });

  test("--keep-runs writes each run in full", () => {
    const out = join(scratch, "keep");
    expect(
      run(
        [
          "sweep",
          "--set",
          "gather.unitsPerSecond=1,2",
          "--seeds",
          "3",
          "--hours",
          "1",
          "--out",
          out,
          "--id",
          "k",
          "--keep-runs",
        ],
        capture(),
      ),
    ).toBe(0);
    expect(
      readdirSync(join(out, "k", "gather.unitsPerSecond=2-s3")).sort(),
    ).toEqual([
      "metrics.csv",
      "replay.json",
      "report.md",
      "run.json",
      "samples.jsonl",
    ]);
  });

  test.each([
    [["sweep", "--seeds", "1"], "geo sweep needs --set"],
    [
      ["sweep", "--set", "nope=1", "--out", join(scratch, "bad")],
      "unknown parameter: nope",
    ],
    [["sweep", "--set", "a.b", "--seeds", "1"], "--set must look like"],
    [
      ["sweep", "--set", "creep.cost.materia=1", "--seeds", "x"],
      "--seeds must look like",
    ],
  ])("%j is a usage error (exit 2)", (argv, message) => {
    const io = capture();
    expect(run(argv, io)).toBe(2);
    expect(io.errors.join("\n")).toContain(message);
    expect(existsSync(join(scratch, "bad"))).toBe(false);
  });
});
