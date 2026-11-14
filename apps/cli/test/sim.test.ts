import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorld, parseParams, serialize, step } from "@geometrix/sim";
import { afterAll, describe, expect, test } from "vitest";
import { logCursor, type LoggedCommand } from "../src/harness.ts";
import { stateHash } from "../src/hash.ts";
import { run, type Output } from "../src/main.ts";
import { renderReport } from "../src/report.ts";
import {
  readRun,
  RUN_FILES,
  runId,
  SAMPLE_EVERY_TICKS,
  simulate,
  writeRun,
} from "../src/sim.ts";

const params = parseParams(
  JSON.parse(
    readFileSync(
      new URL("../../../params/default.json", import.meta.url),
      "utf8",
    ),
  ),
);

const scratch = mkdtempSync(join(tmpdir(), "geo-sim-"));
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

const ticks = 2 * 3600 + 30;
let fakeNow = 0;
const result = simulate(
  {
    id: "two-hours",
    seed: 42,
    params,
    paramsSource: "params/default.json",
    ticks,
    strategists: ["balanced", "balanced"],
  },
  () => (fakeNow += 1500),
);
const dir = join(scratch, "runs", "two-hours");
writeRun(dir, result);
const file = (name: string) => readFileSync(join(dir, name), "utf8");

describe("simulate", () => {
  test("samples tick 0, every world minute and the last tick", () => {
    const ticksSampled = result.samples.map((s) => s.tick);
    expect(ticksSampled.slice(0, 3)).toEqual([0, 60, 120]);
    expect(ticksSampled.at(-2)).toBe(ticks - 30);
    expect(ticksSampled.at(-1)).toBe(ticks);
    expect(ticksSampled.length).toBe(
      Math.floor(ticks / SAMPLE_EVERY_TICKS) + 2,
    );
  });

  test("records the run: hash, wall time, commands and map layout", () => {
    expect(result.meta).toMatchObject({
      id: "two-hours",
      seed: 42,
      ticks,
      finalHash: stateHash(result.state),
      wallSeconds: 1.5,
      commands: result.log.length,
    });
    expect(result.meta.map.cores).toEqual(
      result.state.teams.map((t) => t.core),
    );
    expect(result.meta.map.deposits).toHaveLength(result.state.deposits.length);
  });

  test("run ids sort by time and name the seed", () => {
    expect(runId(7, new Date("2026-11-13T22:59:01.123Z"))).toBe(
      "20261113-225901-s7",
    );
  });
});

describe("runs/<id>/", () => {
  test("replay.json replays to the final hash", () => {
    const replay = JSON.parse(file(RUN_FILES.replay)) as {
      seed: number;
      ticks: number;
      finalHash: string;
      commands: LoggedCommand[];
    };
    expect(replay.finalHash).toBe(result.meta.finalHash);
    const world = createWorld(
      replay.seed,
      parseParams(JSON.parse(file(RUN_FILES.replay)).params),
    );
    const commandsAt = logCursor(replay.commands);
    for (let i = 0; i < replay.ticks; i++) step(world, commandsAt(world.tick));
    expect(serialize(world)).toBe(serialize(result.state));
  });

  test("metrics.csv has one row per team per sample", () => {
    const rows = file(RUN_FILES.csv).trimEnd().split("\n");
    const header = rows[0]!.split(",");
    expect(header.slice(0, 4)).toEqual(["tick", "hours", "roadCells", "team"]);
    expect(header).toEqual(
      expect.arrayContaining([
        "stock.materia",
        "delivered.cristal",
        "activitySeconds.walkingEmpty",
        "creeps.circle",
        "producing",
      ]),
    );
    expect(rows).toHaveLength(1 + 2 * result.samples.length);
    for (const row of rows) expect(row.split(",")).toHaveLength(header.length);
    expect(rows.at(-1)!.startsWith(`${ticks},2.008,`)).toBe(true);
  });

  test("samples.jsonl and run.json read back into the same report", () => {
    const data = readRun(dir);
    expect(data.samples).toEqual(result.samples);
    expect(renderReport(data)).toBe(file(RUN_FILES.report));
  });

  test("report.md covers the spec section 7 metrics", () => {
    const report = file(RUN_FILES.report);
    for (const heading of [
      "# Relatório de simulação — two-hours",
      "## Resumo por time",
      "## Linha do tempo",
      "## Depósitos",
      "## Fatos para a revisão",
      "## Configuração",
    ]) {
      expect(report).toContain(heading);
    }
    for (const metric of [
      "Vazão média por hora",
      "Em trânsito no fim",
      "Núcleo ocioso",
      "Tempo dos creeps: andando vazio",
      "Tempo médio por viagem",
      "Distância média por viagem",
      "Comprimento total de estradas",
      "Zerou pela 1ª vez em",
      "Disputa",
      "Tempo de creeps dominados",
      "Presets aplicados",
    ]) {
      expect(report).toContain(metric);
    }
    expect(report).toContain(`\`${result.meta.finalHash}\``);
  });

  test("refuses to overwrite a run", () => {
    expect(() => writeRun(dir, result)).toThrow(/EEXIST/);
  });
});

describe("geo sim / geo report", () => {
  const out = join(scratch, "cli");

  test("sim writes a run and report rewrites its report.md", () => {
    const io = capture();
    expect(
      run(
        [
          "sim",
          "--seed",
          "3",
          "--hours",
          "1",
          "--strategist",
          "balanced,none",
          "--out",
          out,
          "--id",
          "one",
        ],
        io,
      ),
    ).toBe(0);
    expect(io.lines[0]).toBe("geo sim --seed 3: 3600 ticks, balanced x none");
    const meta = JSON.parse(
      readFileSync(join(out, "one", RUN_FILES.meta), "utf8"),
    );
    expect(meta.strategists).toEqual(["balanced", "none"]);
    expect(meta.paramsSource).toBe("params/default.json");

    const report = capture();
    expect(run(["report", join(out, "one")], report)).toBe(0);
    expect(report.lines).toEqual([join(out, "one", RUN_FILES.report)]);
  });

  test.each([
    [["sim", "--days", "1", "--hours", "2"], "use --days or --hours, not both"],
    [["sim", "--strategist", "greedy"], "unknown strategist: greedy"],
    [["sim", "--strategist", "balanced,none,none"], "needs 1 or 2 names"],
    [["sim", "--hours", "0"], "--hours must be an integer >= 1"],
    [["report"], "geo report takes one run directory"],
  ])("%j is a usage error (exit 2)", (argv, message) => {
    const io = capture();
    expect(run(argv, io)).toBe(2);
    expect(io.errors.join("\n")).toContain(message);
  });

  test("an existing run id is a usage error", () => {
    const io = capture();
    expect(
      run(
        [
          "sim",
          "--hours",
          "1",
          "--out",
          join(scratch, "runs"),
          "--id",
          "two-hours",
        ],
        io,
      ),
    ).toBe(2);
    expect(io.errors.join("\n")).toContain("run already exists");
  });
});
