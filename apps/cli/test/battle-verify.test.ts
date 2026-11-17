import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createBattle,
  createLog,
  parseBattleParams,
  stepLogged,
  type BattleParams,
} from "@geometrix/battle";
import { afterAll, describe, expect, test } from "vitest";
import { battleHash, readArena, scenarios } from "../src/battle.ts";
import {
  battleVerify,
  scriptedCommands,
  verifyLogFile,
} from "../src/battle-verify.ts";
import { run, type Output } from "../src/main.ts";

const params: BattleParams = parseBattleParams(
  JSON.parse(
    readFileSync(
      new URL("../../../packages/battle/test/params.json", import.meta.url),
      "utf8",
    ),
  ),
);
const PARAMS_FILE = "packages/battle/test/params.json";

const scratch = mkdtempSync(join(tmpdir(), "geo-battle-verify-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function capture() {
  const lines: string[] = [];
  const errors: string[] = [];
  const out: Output = {
    log: (l) => lines.push(l),
    error: (l) => errors.push(l),
  };
  return { out, lines, errors };
}

/** A logged battle with the scripted human, as the lab would export it. */
function labLog(seed: number) {
  const scenario = scenarios(params).find((s) => s.id === "1x1 square-circle")!;
  const setup = {
    rule: "grid" as const,
    arena: readArena("pedras"),
    seed,
    sides: scenario.sides,
  };
  const state = createBattle(setup, params);
  const log = createLog(setup, params);
  const script = scriptedCommands(seed, 2000);
  while (state.ended === null && state.tick < 2000) {
    stepLogged(state, log, script[state.tick] ?? []);
  }
  log.finalHash = battleHash(state);
  return log;
}

describe("geo battle verify (spec R-2, R-3)", () => {
  test("two runs, a snapshot → restore and the log replay agree", () => {
    const result = battleVerify(params, [7]);
    expect(result.ok).toBe(true);
    expect(result.cases.length).toBeGreaterThanOrEqual(6);
    for (const c of result.cases) {
      expect(c.runs.map((r) => r.name)).toEqual([
        "run",
        "run again",
        "snapshot → restore",
        "log replay",
      ]);
      expect(c.ticks, c.name).toBeGreaterThan(0);
    }
  });

  test("the scripted human exercises every command kind", () => {
    const kinds = new Set(
      scriptedCommands(3, 600)
        .flat()
        .map((c) => (c as { type: string }).type),
    );
    expect([...kinds].sort()).toEqual([
      "attackOnce",
      "control",
      "face",
      "intent",
      "join",
      "setGambits",
    ]);
  });

  test("the CLI prints each case and exits 0", () => {
    const { out, lines } = capture();
    const code = run(
      ["battle", "verify", "--seeds", "1", "--params", PARAMS_FILE],
      out,
    );
    expect(code).toBe(0);
    expect(lines.at(-1)).toBe("OK: deterministic");
    expect(lines.join("\n")).toContain("3x3 corredor");
  });

  test("--log replays a lab log against its hash; a wrong hash fails", () => {
    const log = labLog(11);
    expect(verifyLogFile(JSON.stringify(log))).toMatchObject({ ok: true });
    const file = join(scratch, "lab.json");
    writeFileSync(file, JSON.stringify(log));
    const ok = capture();
    expect(run(["battle", "verify", "--log", file], ok.out)).toBe(0);
    expect(ok.lines.at(-1)).toBe("OK: the log reaches its hash");

    writeFileSync(file, JSON.stringify({ ...log, finalHash: "0".repeat(64) }));
    const bad = capture();
    expect(run(["battle", "verify", "--log", file], bad.out)).toBe(1);
    expect(bad.errors[0]).toMatch(/^FAIL: /);
  });
});
