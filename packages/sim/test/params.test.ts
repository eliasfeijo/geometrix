import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { ParamsError, parseParams, type Params } from "../src/params.ts";

const defaultParamsUrl = new URL(
  "../../../params/default.json",
  import.meta.url,
);
const loadDefault = (): unknown =>
  JSON.parse(readFileSync(defaultParamsUrl, "utf8"));

function issuesOf(input: unknown): readonly string[] {
  try {
    parseParams(input);
  } catch (error) {
    if (error instanceof ParamsError) return error.issues;
    throw error;
  }
  return [];
}

/** Deep copy of the default params with one leaf replaced. */
function withLeaf(path: string, value: unknown): unknown {
  const copy = loadDefault() as Record<string, unknown>;
  const keys = path.split(".");
  let node = copy;
  for (const key of keys.slice(0, -1)) {
    node = node[key] as Record<string, unknown>;
  }
  node[keys.at(-1)!] = value;
  return copy;
}

describe("parseParams", () => {
  test("accepts params/default.json", () => {
    const params: Params = parseParams(loadDefault());
    expect(params.creep.cost.materia).toBe(40);
    expect(params.world.durationSeconds).toBe(3 * 24 * 60 * 60);
  });

  test.each([
    ["creep.cost.materia", -1, "creep.cost.materia: must be >= 0"],
    ["world.tickSeconds", 0, "world.tickSeconds: must be >= 1"],
    ["dna.circle.capacity", 1.5, "dna.circle.capacity: expected an integer"],
    ["map.width", "64", "map.width: expected an integer"],
    ["map.crossings", undefined, "map.crossings: missing"],
    ["deposits", [], "deposits: expected an object"],
  ])("rejects %s = %s", (path, value, issue) => {
    expect(issuesOf(withLeaf(path, value))).toEqual([issue]);
  });

  test("rejects unknown keys, so typos in sweeps do not pass silently", () => {
    expect(issuesOf(withLeaf("creep.costt", 1))).toEqual([
      "creep.costt: unknown",
    ]);
  });

  test("reports every issue at once", () => {
    const input = withLeaf("road.buildSeconds", -5) as Record<string, unknown>;
    delete input.domination;
    expect(issuesOf(input)).toEqual([
      "domination: missing",
      "road.buildSeconds: must be >= 1",
    ]);
  });

  test("durations must be whole ticks", () => {
    const input = withLeaf("world.tickSeconds", 7);
    expect(issuesOf(input)).toContain(
      "creep.productionSeconds: must be a multiple of world.tickSeconds",
    );
  });

  test.each([
    ["map.width", 63, "map.width: must be even"],
    ["map.height", 65, "map.height: must be even"],
    ["map.riverRows", 3, "map.riverRows: must be even"],
    ["map.riverRows", 64, "map.riverRows: must be smaller than map.height"],
  ])("map shape: %s = %s", (path, value, issue) => {
    expect(issuesOf(withLeaf(path, value))).toEqual([issue]);
  });

  test("rejects a non-object", () => {
    expect(issuesOf(null)).toEqual(["params: expected an object"]);
  });
});
