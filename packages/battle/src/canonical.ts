// Canonical JSON for snapshots and hashing: object keys in sorted order at
// every level, no whitespace. A copy of the sim's canonicalJson (plan P1): the
// battle does not import the sim (ADR-0008); test/shared.test.ts checks both
// give the same output. Hashing happens outside the package (node:crypto in the
// CLI, Web Crypto in the lab's worker).

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
