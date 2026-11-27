import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorld, endSummary, parseParams, step } from "@geometrix/sim";
import { afterAll, describe, expect, test } from "vitest";
import { logCursor } from "../src/harness.ts";
import { run, type Output } from "../src/main.ts";
import { renderReport } from "../src/report.ts";
import { readRun, simulate, writeRun } from "../src/sim.ts";
import { renderSweepReport, sweep } from "../src/sweep.ts";
import { verify } from "../src/verify.ts";

const params = parseParams(
  JSON.parse(
    readFileSync(
      // The sim tests' fixed params, so balancing does not change the bots.
      new URL("../../../packages/sim/test/params.json", import.meta.url),
      "utf8",
    ),
  ),
);

/** The same world with a 10-minute clock. */
const short = {
  ...params,
  world: { ...params.world, durationSeconds: 600 },
};

const scratch = mkdtempSync(join(tmpdir(), "geo-end-"));
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
  id: "ended",
  seed: 42,
  paramsSource: "test",
  ticks: 3600,
  strategists: ["balanced", "balanced"] as const,
};

describe("a run past the world's end (E-min D13)", () => {
  test("stops at a forced concession and reports the sim's summary", () => {
    const result = simulate({
      ...options,
      strategists: [...options.strategists],
      params,
      concede: { team: 1, minute: 5 },
    });
    const { meta, state, log, samples } = result;
    expect(state.result).toMatchObject({ how: "lastTeam", winner: 0 });
    expect(meta.ticks).toBe(301);
    expect(samples.at(-1)!.tick).toBe(301);
    expect(
      log.filter((c) => c.command.type === "concede").map((c) => c.tick),
    ).toEqual([300]);

    // The log alone reaches the same end, and the report holds that summary.
    const replayed = createWorld(42, params);
    const commandsAt = logCursor(log);
    for (let i = 0; i < meta.ticks; i++) {
      step(replayed, commandsAt(replayed.tick));
    }
    expect(meta.end).toEqual(endSummary(replayed));
    const dir = join(scratch, "ended");
    writeRun(dir, result);
    const read = readRun(dir);
    expect(read.meta.end).toEqual(meta.end);
    const report = renderReport(read);
    expect(report).toContain("| Como | desistência do bot |");
    expect(report).toContain("| Resultado | time 0 venceu |");
    expect(report).toContain("o time 1 desiste no minuto de mundo 5");
  });

  test("stops at the clock, and a run cut short says it did not end", () => {
    const strategists = [...options.strategists];
    const clock = simulate({ ...options, strategists, params: short });
    expect(clock.meta.ticks).toBe(600);
    expect(clock.meta.end?.result).toMatchObject({ how: "clock" });
    const cut = simulate({ ...options, strategists, params, ticks: 60 });
    expect(cut.meta.end).toBeNull();
  });

  test("the sweep tables the ends", () => {
    const report = renderSweepReport(
      sweep({
        id: "ends",
        params,
        paramsSource: "test",
        path: "world.durationSeconds",
        values: [120, 7200],
        seeds: [42],
        ticks: 600,
        multiplier: 6,
        shock: null,
        strategists: [...options.strategists],
      }),
    );
    expect(report).toContain("## Fins (spec E-min §7)");
    expect(report).toContain("| relógio | 1 | 0 |");
    expect(report).toContain("| não terminou | 0 | 1 |");
  });
});

describe("geo verify with an end", () => {
  test.each([
    ["a concession", params, { team: 0, minute: 10 }, "lastTeam", 600],
    ["the clock", short, null, "clock", 599],
  ])(
    "the three paths reach the same end by %s",
    (_, p, concede, how, tick) => {
      const result = verify(42, 3600, p, undefined, [], concede);
      expect(result.ok).toBe(true);
      expect(result.sameEnd).toBe(true);
      expect(result.end?.result).toMatchObject({ how, tick });
      // The snapshot is taken before the end.
      const cut = Number(/tick (\d+)/.exec(result.runs[2]!.name)![1]);
      expect(cut).toBeLessThan(tick);
    },
    30_000,
  );

  test("--set and --concede reach it from the command line", () => {
    const out = capture();
    expect(
      run(
        ["verify", "--ticks", "900", "--set", "world.durationSeconds=300"],
        out,
      ),
    ).toBe(0);
    expect(out.lines.join("\n")).toContain("end: relógio");
    for (const bad of ["2@5", "0@0", "0", "a@1"]) {
      expect(run(["verify", "--concede", bad], capture())).toBe(2);
    }
    expect(
      run(
        ["sim", "--strategist", "none", "--concede", "0@5", "--out", scratch],
        capture(),
      ),
    ).toBe(2);
  }, 30_000);
});
