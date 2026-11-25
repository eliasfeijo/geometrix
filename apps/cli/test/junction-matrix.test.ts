import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseBattleParams, type BattleParams } from "@geometrix/battle";
import {
  createWorld,
  inCoreZone,
  isStandable,
  parseParams,
  type Params,
} from "@geometrix/sim";
import { afterAll, describe, expect, test } from "vitest";
import {
  battleCellOf,
  caseKey,
  caseStats,
  junctionMatrix,
  matrixCases,
  matrixCsv,
  renderMatrixReport,
  resolveCase,
  type MatrixOptions,
} from "../src/junction-matrix.ts";
import { run, type Output } from "../src/main.ts";

const readJson = (path: string) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const params: Params = parseParams(readJson("../../../params/default.json"));
const battleParams: BattleParams = parseBattleParams(
  readJson("../../../packages/battle/test/params.json"),
);

const scratch = mkdtempSync(join(tmpdir(), "geo-junction-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function options(over: Partial<MatrixOptions> = {}): MatrixOptions {
  return {
    id: "test",
    params,
    paramsSource: "params/default.json",
    battleParams,
    battleParamsSource: "packages/battle/test/params.json",
    seeds: [1, 2],
    set: null,
    ...over,
  };
}

describe("the junction matrix (C1-2)", () => {
  test("36 cases: three DNAs on each side, empty or full, fight or flee", () => {
    const cases = matrixCases();
    expect(cases).toHaveLength(36);
    expect(new Set(cases.map(caseKey)).size).toBe(36);
  });

  test("the battle cell is standable and outside both core zones", () => {
    for (const seed of [1, 7, 42, 649]) {
      const world = createWorld(seed, params);
      const cell = battleCellOf(world);
      expect(isStandable(world, cell)).toBe(true);
      for (const team of world.teams) {
        expect(inCoreZone(world, team.id, cell)).toBe(false);
      }
    }
  });

  test("a case ends, is deterministic and leaves the world untouched", () => {
    const world = createWorld(3, params);
    const before = JSON.stringify(world);
    const cell = battleCellOf(world);
    const c = matrixCases().find(
      (m) => m.loaded && m.stance === "flee" && m.victim === "square",
    )!;
    const a = resolveCase(world, cell, c, battleParams);
    const b = resolveCase(world, cell, c, battleParams);
    expect(a).toEqual(b);
    expect(a.cut).toBe(false);
    expect(JSON.stringify(world)).toBe(before);
    // The fates agree with the winner.
    if (a.winnerSide === 0) expect(a.aggressor).toBe("won");
    if (a.winnerSide === 1) expect(a.victim).toBe("won");
  });

  test("a fleeing victim never wins: it leaves or dies", () => {
    const result = junctionMatrix(options({ seeds: [1, 2, 3] }));
    for (const c of matrixCases().filter((m) => m.stance === "flee")) {
      for (const r of result.runs[0]!.records.get(caseKey(c))!) {
        expect(["died", "escaped", "idle"]).toContain(r.victim);
      }
    }
  });

  test("--set runs the matrix once per value; the report and the CSV have them all", () => {
    const result = junctionMatrix(
      options({
        seeds: [1],
        set: { path: "battle.zone.depth", values: [3, 5] },
      }),
    );
    expect(result.runs.map((r) => r.value)).toEqual([3, 5]);
    const report = renderMatrixReport(result);
    expect(report).toContain("`battle.zone.depth=3`");
    expect(report).toContain("`battle.zone.depth=5`");
    const csv = matrixCsv(result).trimEnd().split("\n");
    expect(csv).toHaveLength(1 + 2 * 36);
    const stats = caseStats(
      result.runs[0]!.records.get(caseKey(matrixCases()[0]!))!,
      battleParams,
    );
    expect(stats.battles).toBe(1);
    expect(stats.aggressorWins + stats.victimWins + stats.none).toBe(1);
  });

  test("geo junction matrix writes its report", () => {
    const lines: string[] = [];
    const errors: string[] = [];
    const out: Output = {
      log: (l) => lines.push(l),
      error: (l) => errors.push(l),
    };
    const code = run(
      [
        "junction",
        "matrix",
        "--seeds",
        "1",
        "--battle-params",
        "packages/battle/test/params.json",
        "--out",
        scratch,
        "--id",
        "m",
      ],
      out,
    );
    expect(errors).toEqual([]);
    expect(code).toBe(0);
    expect(lines.at(-2)).toMatch(/^ {2}36 battles in /);
    const report = readFileSync(join(scratch, "m", "junction.md"), "utf8");
    expect(report).toContain("## Resumo");
    expect(run(["junction", "nope"], out)).toBe(2);
  });
});
