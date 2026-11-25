import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorld, maxHp, parseParams } from "@geometrix/sim";
import { afterAll, describe, expect, test } from "vitest";
import { run, type Output } from "../src/main.ts";
import { runTargets, seedTargets, type PaceFacts } from "../src/pace.ts";
import {
  applyShock,
  parseShock,
  ShockError,
  shockTick,
  teamCreeps,
} from "../src/shock.ts";
import { RUN_FILES, simulate, writeRun } from "../src/sim.ts";

const params = parseParams(
  JSON.parse(
    readFileSync(
      new URL("../../../packages/sim/test/params.json", import.meta.url),
      "utf8",
    ),
  ),
);

const scratch = mkdtempSync(join(tmpdir(), "geo-shock-"));
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

describe("--shock", () => {
  test("team:count@minute", () => {
    expect(parseShock("0:4@30", 2)).toEqual({ team: 0, count: 4, minute: 30 });
    expect(parseShock("1:10@0", 2)).toEqual({ team: 1, count: 10, minute: 0 });
  });

  test.each([
    ["4@30", "must look like team:count@minute"],
    ["0:4", "must look like team:count@minute"],
    ["0:-4@30", "must look like team:count@minute"],
    ["2:4@30", "no team 2"],
    ["0:0@30", "count must be >= 1"],
  ])("refuses %s", (raw, message) => {
    expect(() => parseShock(raw, 2)).toThrow(ShockError);
    expect(() => parseShock(raw, 2)).toThrow(message);
  });

  test("lands on the tick of its real minute at the ×N", () => {
    expect(shockTick({ team: 0, count: 4, minute: 30 }, params, 6)).toBe(
      30 * 60 * 6,
    );
  });
});

describe("applyShock", () => {
  test("kills the team's free creeps, the highest HP first, ties by id", () => {
    const state = createWorld(42, params);
    const own = state.creeps.filter((c) => c.team === 0);
    // One engaged creep is not free; one loaded, with the highest HP, goes
    // first and leaves a spoil; one hurt goes last.
    const [engaged, loaded, hurt] = own;
    engaged!.engagement = 99;
    loaded!.cargo = { materia: 7, cristal: 2 };
    loaded!.hp = maxHp(params, "square") + 1;
    hurt!.hp = 1;
    const expected = own
      .filter((c) => c !== engaged)
      .sort((a, b) => b.hp - a.hp || a.id - b.id)
      .slice(0, 3)
      .map((c) => c.id);
    const before = teamCreeps(state, 0);
    const others = teamCreeps(state, 1);

    const killed = applyShock(state, { team: 0, count: 3, minute: 0 });
    expect(killed).toEqual(expected);
    expect(killed[0]).toBe(loaded!.id);
    expect(killed).not.toContain(engaged!.id);
    expect(killed).not.toContain(hurt!.id);
    expect(teamCreeps(state, 0)).toBe(before - 3);
    expect(teamCreeps(state, 1)).toBe(others);
    expect(state.creeps.some((c) => killed.includes(c.id))).toBe(false);
    expect(state.spoils).toEqual([
      expect.objectContaining({
        x: loaded!.x,
        y: loaded!.y,
        cargo: { materia: 7, cristal: 2 },
      }),
    ]);
  });

  test("with fewer free creeps than the count, kills them all", () => {
    const state = createWorld(1, params);
    const own = teamCreeps(state, 1);
    expect(
      applyShock(state, { team: 1, count: own + 5, minute: 0 }),
    ).toHaveLength(own);
    expect(teamCreeps(state, 1)).toBe(0);
  });
});

describe("the recovery scenario in a run", () => {
  const shock = { team: 0, count: 4, minute: 20 };
  const result = simulate({
    id: "shocked",
    seed: 42,
    params,
    paramsSource: "packages/sim/test/params.json",
    ticks: 6 * 3600,
    multiplier: 6,
    shock,
    strategists: ["balanced", "balanced"],
  });
  const recovery = result.pace.recovery!;

  test("lands at its minute and measures the way back to the count", () => {
    expect(result.meta.shock).toEqual(shock);
    expect(recovery.tick).toBe(20 * 60 * 6);
    expect(recovery.killed).toBe(4);
    expect(recovery.before).toBeGreaterThanOrEqual(4);
    if (recovery.recoveredTick !== null) {
      expect(recovery.recoveredTick).toBeGreaterThan(recovery.tick);
    }
    // The sample at the shock's tick was taken before it.
    const at = result.samples.find((s) => s.tick === recovery.tick)!;
    const c = at.teams[0]!.creeps;
    expect(c.square + c.triangle + c.circle).toBe(recovery.before);
  });

  test("a shocked run writes no replay.json and says so", () => {
    const dir = join(scratch, "shocked");
    writeRun(dir, result);
    expect(existsSync(join(dir, RUN_FILES.replay))).toBe(false);
    const report = readFileSync(join(dir, RUN_FILES.report), "utf8");
    expect(report).toContain(
      "| Choque (cenário de recuperação) | o time 0 perde 4 creeps no minuto real 20; o run não é reproduzível (sem replay.json) |",
    );
    expect(report).toMatch(
      /\| Recuperação: o time do choque volta à sua contagem \| .* \| time 0 perdeu 4 de \d+ no min 20; /,
    );
  });
}, 60_000);

describe("the recovery target", () => {
  /** A run whose team 0 was back `minutes` real minutes after the shock. */
  function shocked(minutes: number | null): PaceFacts {
    const tick = 30 * 60 * 6;
    return {
      multiplier: 6,
      tickSeconds: 1,
      ticks: 120 * 60 * 6,
      matchSeconds: 120 * 60 * 6,
      reactionSeconds: 60,
      crossingSeconds: 720,
      reachableCells: 3000,
      teams: [],
      wanderers: {
        firstBornTick: null,
        ticksAfterFirst: 0,
        ticksWithOneAlive: 0,
        maxAlive: 0,
      },
      tickMicros: 40,
      recovery: {
        shock: { team: 0, count: 4, minute: 30 },
        tick,
        before: 12,
        killed: 4,
        recoveredTick: minutes === null ? null : tick + minutes * 60 * 6,
      },
    };
  }
  const row = (rows: ReturnType<typeof runTargets>) =>
    rows.find((r) => r.criterion.startsWith("Recuperação"))!;

  test.each([
    [15, true],
    [16, false],
    [null, false],
  ])("back in %s real minutes: %s", (minutes, verdict) => {
    expect(row(runTargets(shocked(minutes))).verdict).toBe(verdict);
  });

  test("over the seeds: back in time on at least 90% of them", () => {
    const seeds = (late: number) => [
      ...Array.from({ length: 20 - late }, () => shocked(10)),
      ...Array.from({ length: late }, () => shocked(20)),
    ];
    expect(row(seedTargets(seeds(2)))).toMatchObject({ verdict: true });
    expect(row(seedTargets(seeds(3)))).toMatchObject({
      measured: "17/20 seeds; média 11,5 (10–20)",
      verdict: false,
    });
  });
});

describe("geo CLI", () => {
  test("verify refuses --shock (exit 2)", () => {
    const io = capture();
    expect(run(["verify", "--shock", "0:4@30"], io)).toBe(2);
    expect(io.errors.join("\n")).toContain("geo verify refuses --shock");
  });

  test("a bad --shock is a usage error (exit 2)", () => {
    const io = capture();
    expect(run(["sim", "--shock", "0:4"], io)).toBe(2);
    expect(io.errors.join("\n")).toContain(
      "--shock must look like team:count@minute",
    );
  });
});
