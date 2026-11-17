import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createBattle,
  parseBattleParams,
  type BattleParams,
} from "@geometrix/battle";
import { afterAll, describe, expect, test } from "vitest";
import {
  ARENAS,
  battleVerdicts,
  GROUPS,
  moveToCenter,
  quantile,
  readArena,
  scenarios,
  type BattleRecord,
  type BattleSweepResult,
} from "../src/battle.ts";
import { run, type Output } from "../src/main.ts";

const params: BattleParams = parseBattleParams(
  JSON.parse(
    readFileSync(
      // The battle tests' fixed params, so balancing does not change them.
      new URL("../../../packages/battle/test/params.json", import.meta.url),
      "utf8",
    ),
  ),
);
const PARAMS_FILE = "packages/battle/test/params.json";

const scratch = mkdtempSync(join(tmpdir(), "geo-battle-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function capture(clock?: () => number) {
  const lines: string[] = [];
  const errors: string[] = [];
  const out: Output = {
    log: (l) => lines.push(l),
    error: (l) => errors.push(l),
    ...(clock === undefined ? {} : { clock }),
  };
  return { out, lines, errors };
}

describe("the matrix (spec sections 7, 8)", () => {
  test("every group has scenarios, and every setup is valid on every arena", () => {
    const list = scenarios(params);
    for (const group of GROUPS) {
      expect(
        list.some((s) => s.group === group),
        group,
      ).toBe(true);
    }
    expect(new Set(list.map((s) => s.id)).size).toBe(list.length);
    for (const scenario of list) {
      for (const arena of ARENAS) {
        const setup = {
          rule: "grid" as const,
          arena: readArena(arena),
          seed: 1,
          sides: scenario.sides,
        };
        expect(() => createBattle(setup, params), scenario.id).not.toThrow();
      }
    }
  });

  test("1 × 1 of each pair and mirror, wounded at 500‰ on either side", () => {
    const ids = scenarios(params).map((s) => s.id);
    expect(ids).toContain("1x1 square-triangle");
    expect(ids).toContain("1x1 circle-circle");
    expect(ids).toContain("1x1 square@500-circle");
    expect(ids).toContain("1x1 square-circle@500");
    const wounded = scenarios(params).find(
      (s) => s.id === "1x1 triangle@500-circle",
    )!;
    expect(wounded.sides[0]![0]!.hp).toBe(100);
    expect(wounded.sides[1]![0]!.hp).toBe(120);
  });

  test("the carry scenarios start a full square on its stretch or at the centre", () => {
    const carry = scenarios(params).filter((s) => s.group === "carry");
    expect(carry.map((s) => s.id)).toEqual([
      "carry drop",
      "carry keep",
      "carry drop center",
      "carry keep center",
    ]);
    for (const s of carry) {
      expect(s.sides[0]![0]!.carry.materia).toBe(params.dna.square.capacity);
    }
    const scenario = carry[2]!;
    const state = createBattle(
      {
        rule: "grid",
        arena: readArena("pedras"),
        seed: 1,
        sides: scenario.sides,
      },
      params,
    );
    moveToCenter(state, 0);
    const square = state.participants[0]!;
    // The centre of pedras is rock: the nearest floor next to it.
    const x = square.cell % state.arena.width;
    const y = Math.floor(square.cell / state.arena.width);
    expect(state.arena.rock[square.cell]).toBe(0);
    expect(Math.abs(x - 11) + Math.abs(y - 7)).toBe(1);
  });

  test("a pair fails only when the same DNA wins above 75% on every arena", () => {
    /** Ten battles per cell; side 0 wins `wins[scenario][arena]` of them. */
    function result(wins: (id: string, arena: number) => number) {
      const cells = scenarios(params).flatMap((scenario) =>
        ARENAS.map((arena, a) => ({
          scenario,
          arena,
          records: Array.from({ length: 10 }, (_, i): BattleRecord => ({
            scenario: scenario.id,
            arena,
            seed: i,
            winnerSide: i < wins(scenario.id, a) ? 0 : 1,
            ticks: 300,
            ms: 1,
            idle: false,
            edge: false,
            cut: false,
            firstEscaped: false,
          })),
        })),
      );
      const options = { id: "t", params, paramsSource: "", seeds: [1] };
      return { options, cells, wallSeconds: 1 } as BattleSweepResult;
    }
    // Side 0 wins 8 of 10 everywhere: every pair is decided by the DNA.
    expect(battleVerdicts(result(() => 8)).decidedPairs).toHaveLength(3);
    // The winner flips with the arena: the arena decides, not the DNA.
    const flip = battleVerdicts(result((_, a) => (a === 0 ? 2 : 8)));
    expect(flip.decidedPairs).toEqual([]);
    // 7 of 10 is not above 75%.
    expect(battleVerdicts(result(() => 7)).decidedPairs).toEqual([]);
  });

  test("quantile by nearest rank", () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2);
    expect(quantile([1, 2, 3, 4], 0.9)).toBe(4);
    expect(quantile([5], 0.1)).toBe(5);
    expect(Number.isNaN(quantile([], 0.5))).toBe(true);
  });
});

describe("geo battle sweep (spec R-1)", () => {
  test("writes battle.md and battle.csv for the whole matrix", () => {
    const { out, lines } = capture();
    const code = run(
      [
        "battle",
        "sweep",
        "--seeds",
        "1-2",
        "--params",
        PARAMS_FILE,
        "--out",
        scratch,
        "--id",
        "two",
      ],
      out,
    );
    expect(code).toBe(0);
    expect(lines.join("\n")).toContain(
      `${scenarios(params).length * ARENAS.length * 2} battles`,
    );
    const report = readFileSync(join(scratch, "two", "battle.md"), "utf8");
    // Win share and duration are informative (F3 checkpoint): only the
    // cost can fail.
    const informative = report
      .split("\n")
      .filter((l) => /^\| (O DNA não decide|Duração do)/.test(l));
    expect(informative).toHaveLength(3);
    for (const line of informative) expect(line).not.toContain("reprovado");
    for (const heading of [
      "## Resumo",
      "## Vitórias no 1 × 1, por arena",
      "## Espelhos",
      "## O ferido pesa",
      "## Lutas maiores",
      "## Duração",
      "## Inatividade e borda",
      "## Fuga carregada",
      "## Custo do auto-resolve",
    ]) {
      expect(report).toContain(heading);
    }
    const csv = readFileSync(join(scratch, "two", "battle.csv"), "utf8")
      .trimEnd()
      .split("\n");
    expect(csv).toHaveLength(1 + scenarios(params).length * ARENAS.length);
    expect(csv[1]).toMatch(/^1x1 square-triangle,duel,aberta,2,/);
  });

  test("--max-seconds fails a sweep over the budget", () => {
    let now = 0;
    const { out, errors } = capture(() => (now += 1000));
    const code = run(
      [
        "battle",
        "sweep",
        "--seeds",
        "1",
        "--params",
        PARAMS_FILE,
        "--out",
        scratch,
        "--id",
        "slow",
        "--max-seconds",
        "1",
      ],
      out,
    );
    expect(code).toBe(1);
    expect(errors[0]).toMatch(/^FAIL: .* over the 1 s budget/);
  });

  test("an unknown battle command is a usage error", () => {
    const { out, errors } = capture();
    expect(run(["battle", "fight"], out)).toBe(2);
    expect(errors[0]).toContain("unknown battle command: fight");
  });
});
