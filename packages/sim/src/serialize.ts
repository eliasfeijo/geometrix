// Canonical JSON for snapshots and hashing (plan section 3): object keys in
// sorted order at every level, no whitespace. The same state always yields the
// same string, whatever order its keys were created in. Hashing happens outside
// the sim (node:crypto in the server and the CLI).

import { parseParams } from "./params.ts";
import { SIM_VERSION, type WorldState } from "./world.ts";

export function serialize(state: WorldState): string {
  return canonicalJson(state, "state");
}

export function canonicalJson(value: unknown, path = "value"): string {
  if (value === null || typeof value === "boolean") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${path}: non-finite number ${value}`);
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item, i) => canonicalJson(item, `${path}[${i}]`)).join(",")}]`;
  }
  if (
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    const record = value as Record<string, unknown>;
    const fields = Object.keys(record)
      .sort()
      .map((key) => {
        const field = canonicalJson(record[key], `${path}.${key}`);
        return `${JSON.stringify(key)}:${field}`;
      });
    return `{${fields.join(",")}}`;
  }
  // undefined, functions, Map, Set, class instances...: JSON.stringify would
  // drop or flatten them silently, losing state.
  throw new TypeError(`${path}: not plain JSON data (${describe(value)})`);
}

function describe(value: unknown): string {
  if (typeof value !== "object" || value === null) return typeof value;
  return Object.getPrototypeOf(value)?.constructor?.name ?? "object";
}

export class SnapshotVersionError extends Error {
  constructor(found: unknown) {
    super(
      `snapshot is from sim version ${String(found)}, this is ${SIM_VERSION}`,
    );
    this.name = "SnapshotVersionError";
  }
}

/** Rebuilds a state from `serialize` output. */
export function restore(json: string): WorldState {
  const data: unknown = JSON.parse(json);
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new TypeError("snapshot: expected an object");
  }
  const { simVersion, params } = data as Record<string, unknown>;
  if (simVersion !== SIM_VERSION) throw new SnapshotVersionError(simVersion);
  parseParams(params);
  return data as WorldState;
}
