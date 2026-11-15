import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  canonicalJson,
  restore,
  serialize,
  SnapshotVersionError,
} from "../src/serialize.ts";
import { createWorld, SIM_VERSION } from "../src/world.ts";
import { loadTestParams } from "./helpers.ts";

const params = loadTestParams();
const sha256 = (text: string) =>
  createHash("sha256").update(text).digest("hex");

describe("canonicalJson", () => {
  test("sorts keys at every level, so key order does not matter", () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { z: 0, y: 1 }], c: "x" } })).toBe(
      '{"a":{"c":"x","d":[2,{"y":1,"z":0}]},"b":1}',
    );
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
  });

  test.each([
    ["undefined", { a: undefined }, "value.a: not plain JSON data (undefined)"],
    ["NaN", { a: [Number.NaN] }, "value.a[0]: non-finite number NaN"],
    ["Infinity", { a: Infinity }, "value.a: non-finite number Infinity"],
    ["Map", { a: new Map() }, "value.a: not plain JSON data (Map)"],
    ["Set", { a: new Set([1]) }, "value.a: not plain JSON data (Set)"],
    ["function", { a: () => 1 }, "value.a: not plain JSON data (function)"],
  ])("refuses %s instead of dropping it", (_, value, message) => {
    expect(() => canonicalJson(value)).toThrow(message);
  });
});

describe("serialize / restore", () => {
  const world = createWorld(42, params);

  test("restore(serialize(state)) equals the state", () => {
    expect(restore(serialize(world))).toEqual(world);
  });

  test("serialization is a fixed point", () => {
    const json = serialize(world);
    expect(serialize(restore(json))).toBe(json);
  });

  test("the world for seed 42 hashes to a stable value", () => {
    // Locks map generation, rng and serialization together. If this changes
    // on purpose, update it, and bump SIM_VERSION once worlds are persisted
    // (see SIM_VERSION).
    expect(sha256(serialize(world))).toMatchInlineSnapshot(
      `"0cce305ae4036436c26a6670816c786f508dc5c53361ccb5947ff9c35709467f"`,
    );
  });

  test("rejects a snapshot from another sim version", () => {
    const old = JSON.stringify({ ...world, simVersion: SIM_VERSION + 1 });
    expect(() => restore(old)).toThrow(SnapshotVersionError);
  });

  test("rejects a snapshot with invalid params", () => {
    const broken = JSON.stringify({ ...world, params: { world: {} } });
    expect(() => restore(broken)).toThrow(/invalid params/);
  });

  test("rejects a non-object snapshot", () => {
    expect(() => restore("[]")).toThrow("snapshot: expected an object");
  });
});
