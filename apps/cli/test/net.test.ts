import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { botsFor, parseParams } from "@geometrix/sim";
import { afterAll, describe, expect, test } from "vitest";
import { run, type Output } from "../src/main.ts";
import {
  measureNet,
  NET_FILES,
  NET_TARGETS,
  netVerdicts,
  renderNet,
  type NetResult,
} from "../src/net.ts";
import { runBots } from "../src/harness.ts";
import { stateHash } from "../src/hash.ts";

const params = parseParams(
  JSON.parse(
    readFileSync(
      // The sim tests' fixed params, so balancing does not change the runs.
      new URL("../../../packages/sim/test/params.json", import.meta.url),
      "utf8",
    ),
  ),
);

const scratch = mkdtempSync(join(tmpdir(), "geo-net-"));
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

const options = {
  id: "t",
  seed: 7,
  params,
  paramsSource: "test/params.json",
  ticks: 3600,
  strategists: ["balanced", "balanced"] as ("balanced" | "none")[],
  hashEveryTicks: 60,
};

describe("measureNet", () => {
  const result = measureNet(options);

  test("rebuilds the client's view from the deltas in every tick", () => {
    expect(result.property).toEqual({
      checks: 2 * 3600,
      mismatches: 0,
      first: null,
    });
    expect(result.sends).toBe(3600);
    expect(result.hash.count).toBe(2 * 60);
  });

  test("runs the same world as the harness", () => {
    const { state } = runBots(7, params, 3600, botsFor(options.strategists));
    expect(result.finalHash).toBe(stateHash(state));
  });

  test("measures delta messages and their parts", () => {
    expect(result.bytes.median).toBeGreaterThan(20);
    expect(result.bytes.max).toBeGreaterThanOrEqual(result.bytes.p95);
    expect(result.bytes.p95).toBeGreaterThanOrEqual(result.bytes.median);
    expect(result.welcomeBytes).toBeGreaterThan(result.bytes.median);
    expect(result.windows.map((w) => w.from)).toEqual([0]);
    expect(result.windowSeconds).toBe(3600);
  });

  test("the deltas carry the teams' events (births, in this hour)", () => {
    expect(result.events.sent).toBeGreaterThan(0);
    expect(result.events.deltas).toBeGreaterThan(0);
    expect(result.events.maxPerDelta).toBeGreaterThanOrEqual(1);
    expect(result.chronicleBytes).toBeGreaterThan(2);
    expect(renderNet(result)).toContain("Eventos enviados (2 times)");
  });

  test("the criteria follow the spec targets", () => {
    const at = (bytes: number, cpu: number, mismatches = 0): NetResult => ({
      ...result,
      bytes: { ...result.bytes, mean: bytes },
      cpuMicros: { ...result.cpuMicros, median: cpu },
      hash: { ...result.hash, amortizedMicros: 0 },
      property: { ...result.property, mismatches },
    });
    const { bytesPerSecond, cpuMicros } = NET_TARGETS;
    expect(netVerdicts(at(bytesPerSecond, cpuMicros))).toEqual({
      bandwidth: true,
      cpu: true,
      property: true,
    });
    expect(netVerdicts(at(bytesPerSecond + 1, cpuMicros + 1, 1))).toEqual({
      bandwidth: false,
      cpu: false,
      property: false,
    });
  });

  test("net.md has the criteria, the measurements and the windows", () => {
    const md = renderNet(result);
    expect(md).toContain("## Critérios (spec §7)");
    expect(md).toContain("0 divergências em 7.200 verificações");
    expect(md).toContain("1,0 h de mundo");
    expect(md).toContain("| 0–1 h |");
    expect(md).toContain(result.finalHash);
  });
});

describe("geo net", () => {
  test("writes net.md and net.json and passes the targets", () => {
    const io = capture();
    const out = join(scratch, "cli");
    const args = ["net", "--seed", "3", "--hours", "1", "--out", out];
    const code = run([...args, "--id", "one"], io);
    expect(io.lines[0]).toBe(
      "geo net --seed 3: 3600 ticks, balanced x balanced",
    );
    const json = JSON.parse(
      readFileSync(join(out, "one", NET_FILES.json), "utf8"),
    ) as NetResult;
    expect(json.property.mismatches).toBe(0);
    // Bandwidth and the diff property are deterministic and must pass. The
    // CPU target is a wall-clock measurement: with another session running
    // tests it can miss, and then the CLI reports it and exits 1. The test
    // checks that the exit code follows the verdicts, not the machine's load.
    const verdicts = netVerdicts(json);
    expect(verdicts.bandwidth).toBe(true);
    expect(verdicts.property).toBe(true);
    expect(code).toBe(verdicts.cpu ? 0 : 1);
    expect(io.errors).toEqual(verdicts.cpu ? [] : ["FAIL: cpu"]);
    expect(json.options.paramsSource).toBe("params/default.json");
    expect(readFileSync(join(out, "one", NET_FILES.report), "utf8")).toContain(
      "# geo net — one",
    );
    const again = capture();
    expect(run([...args, "--id", "one"], again)).toBe(2);
    expect(again.errors[0]).toContain("run already exists");
  });
});
