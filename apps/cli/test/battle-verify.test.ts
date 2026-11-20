import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
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

  test("a log exported by the lab's page reaches the worker's hash (spec R-3)", () => {
    // Exported by the lab in Chromium (F7, BATTLE_VERSION 4: the countdown
    // keeps only what is held): the worker hashed it with Web Crypto; here
    // node:crypto hashes the replay. A real session at 300 ms of RTT: the
    // owner's keys on the square the start dominated (a Q let go and a
    // direction held during the countdown), a reinforcement on a new side
    // and the circle's gambits swapped for the carrier preset.
    const file = fileURLToPath(
      new URL("fixtures/lab-battle.json", import.meta.url),
    );
    const { out, lines } = capture();
    expect(run(["battle", "verify", "--log", file], out)).toBe(0);
    expect(lines.at(-1)).toBe("OK: the log reaches its hash");
    const log = JSON.parse(readFileSync(file, "utf8")) as {
      commands: { commands: { type: string }[] }[];
    };
    const kinds = new Set(
      log.commands.flatMap((c) => c.commands.map((x) => x.type)),
    );
    expect([...kinds].sort()).toEqual([
      "attackOnce",
      "control",
      "drop",
      "intent",
      "join",
      "setGambits",
    ]);
  });
});
