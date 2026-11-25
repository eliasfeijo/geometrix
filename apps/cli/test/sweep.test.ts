import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseParams } from "@geometrix/sim";
import { afterAll, describe, expect, test } from "vitest";
import { run, type Output } from "../src/main.ts";
import { parseSeeds, parseSet, SweepError, withParam } from "../src/sweep.ts";

const params = parseParams(
  JSON.parse(
    readFileSync(
      // The sim tests' fixed params, so balancing does not change the bots.
      new URL("../../../packages/sim/test/params.json", import.meta.url),
      "utf8",
    ),
  ),
);

const scratch = mkdtempSync(join(tmpdir(), "geo-sweep-"));
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

describe("arguments", () => {
  test("--set takes one parameter path and its values", () => {
    expect(parseSet("creep.cost.materia=30,40,50")).toEqual({
      path: "creep.cost.materia",
      values: [30, 40, 50],
    });
    for (const bad of ["creep.cost.materia", "a=1.5", "a=", "=1", "a=-1"]) {
      expect(() => parseSet(bad)).toThrow(SweepError);
    }
  });

  test("--seeds takes ranges and lists", () => {
    expect(parseSeeds("1-5")).toEqual([1, 2, 3, 4, 5]);
    expect(parseSeeds("1-3,7")).toEqual([1, 2, 3, 7]);
    expect(parseSeeds("9")).toEqual([9]);
    for (const bad of ["5-1", "a", "1,,2", "-1"]) {
      expect(() => parseSeeds(bad)).toThrow(SweepError);
    }
  });

  test("withParam sets one leaf and validates the result", () => {
    const changed = withParam(params, "creep.cost.materia", 30);
    expect(changed.creep.cost.materia).toBe(30);
    expect(params.creep.cost.materia).toBe(40);
    expect(() => withParam(params, "creep.nope", 1)).toThrow(
      "unknown parameter: creep.nope",
    );
    expect(() => withParam(params, "creep.cost", 1)).toThrow(
      "unknown parameter: creep.cost",
    );
    expect(() => withParam(params, "map.width", 63)).toThrow(
      /map.width=63: .*must be even/s,
    );
  });
});

describe("geo sweep", () => {
  test("runs every value × seed and compares them", () => {
    const out = join(scratch, "runs");
    const io = capture();
    expect(
      run(
        [
          "sweep",
          "--set",
          "creep.cost.materia=30,60",
          "--seeds",
          "1-2",
          "--hours",
          "1",
          "--out",
          out,
          "--id",
          "sw",
        ],
        io,
      ),
    ).toBe(0);
    expect(io.lines[0]).toBe(
      "geo sweep creep.cost.materia=30,60 seeds 1,2: 4 runs of 3600 ticks",
    );
    const dir = join(out, "sw");
    expect(readdirSync(dir).sort()).toEqual([
      "creep.cost.materia=30-s1",
      "creep.cost.materia=30-s2",
      "creep.cost.materia=60-s1",
      "creep.cost.materia=60-s2",
      "report.md",
      "sweep.csv",
    ]);
    expect(readdirSync(join(dir, "creep.cost.materia=60-s2")).sort()).toEqual([
      "pace.json",
      "run.json",
    ]);
    const meta = JSON.parse(
      readFileSync(join(dir, "creep.cost.materia=60-s2", "run.json"), "utf8"),
    );
    expect(meta.params.creep.cost.materia).toBe(60);
    expect(meta.seed).toBe(2);

    const csv = readFileSync(join(dir, "sweep.csv"), "utf8")
      .trimEnd()
      .split("\n");
    expect(csv).toHaveLength(5);
    expect(csv[0]!.startsWith("value,seed,multiplier,finalHash,")).toBe(true);

    const report = readFileSync(join(dir, "report.md"), "utf8");
    expect(report).toContain(
      "| Métrica | creep.cost.materia=30 | creep.cost.materia=60 |",
    );
    expect(report).toContain("| Estoque de matéria no fim |");
    // The pace targets per value over its seeds (M2 R P13).
    expect(report).toContain("## Metas do ritmo (spec R §7)");
    expect(report).toMatch(
      /\| Janela da extorsão \(PA-3\) \| pelo menos 10 s reais \| 2\/2 seeds ✅ \|/,
    );
    for (const column of [
      "crossingRealMinutes",
      "firstCreepRealMinutesByTeam",
      "exploredRealMinutesByTeam",
      "firstWandererRealMinutes",
      "wandererAlivePercent",
      "battlesByTeam",
      "tickMicros",
    ]) {
      expect(csv[0]!.split(",")).toContain(column);
    }
    // Fog (fog spec §7): match start and fairness between the teams.
    for (const label of [
      "| 1ª entrega de matéria, time mais lento (min) |",
      "| Diferença entre os times na 1ª matéria (min) |",
      "| Diferença entre os times na matéria entregue |",
      "| Núcleo inimigo visto (h) |",
      "| Mapa explorado no fim (%) |",
      "| Valor | Seed | 1ª matéria (min) | Matéria entregue | Encontros | Mortes |",
      // Encounters (M2 encontro spec §7).
      "| Encontros abertos por time por hora |",
      "| Encontros pagos (%) |",
      "| Encontros que viraram batalha (%) |",
      "| Batalhas abertas por time por hora |",
      "| Encontros na zona do Núcleo da vítima (%) |",
      "| Mortes por time |",
      "| Diferença entre os times em creeps |",
      "| Cristal parado no estoque, do entregue (%) |",
    ]) {
      expect(report).toContain(label);
    }
    const header = csv[0]!.split(",");
    const perTeam =
      csv[1]!.split(",")[header.indexOf("deliveredMateriaByTeam")];
    expect(perTeam).toMatch(/^\d+;\d+$/);
    // Four 1 h worlds: ~0.8 s alone, past 5 s with other suites running.
  }, 30_000);

  test("a sweep of world.multiplier reads each run at its ×N; --mult overrides it", () => {
    const out = join(scratch, "mult");
    const argv = (id: string, ...more: string[]) => [
      "sweep",
      "--set",
      "world.multiplier=6,12",
      "--seeds",
      "1",
      "--hours",
      "1",
      "--out",
      out,
      "--id",
      id,
      ...more,
    ];
    expect(run(argv("each"), capture())).toBe(0);
    const each = readFileSync(join(out, "each", "report.md"), "utf8");
    expect(each).toContain(
      "| Duração de cada mundo | 1,0 h de mundo; 10 min reais a ×6 · 5,0 min reais a ×12 |",
    );
    // A moment's row in world time, then the same in real minutes per ×N.
    const rows = each.split("\n");
    const at = rows.findIndex((r) => r.startsWith("| 1ª entrega de matéria"));
    const world = rows[at]!.split(" | ");
    const real = rows[at + 1]!.split(" | ");
    expect(real[0]).toBe("| ↳ em minutos reais");
    expect(Number(real[1]!.replace(",", "."))).toBeCloseTo(
      Number(world[1]!.replace(",", ".")) / 6,
      0,
    );

    expect(run(argv("fixed", "--mult", "3"), capture())).toBe(0);
    const fixed = readFileSync(join(out, "fixed", "report.md"), "utf8");
    expect(fixed).toContain(
      "| Duração de cada mundo | 1,0 h de mundo; 20 min reais a ×3 |",
    );
  }, 30_000);

  test("--keep-runs writes each run in full", () => {
    const out = join(scratch, "keep");
    expect(
      run(
        [
          "sweep",
          "--set",
          "gather.materia.units=1,2",
          "--seeds",
          "3",
          "--hours",
          "1",
          "--out",
          out,
          "--id",
          "k",
          "--keep-runs",
        ],
        capture(),
      ),
    ).toBe(0);
    expect(
      readdirSync(join(out, "k", "gather.materia.units=2-s3")).sort(),
    ).toEqual([
      "encounters.json",
      "metrics.csv",
      "pace.json",
      "replay.json",
      "report.md",
      "run.json",
      "samples.jsonl",
    ]);
  });

  test.each([
    [["sweep", "--seeds", "1"], "geo sweep needs --set"],
    [
      ["sweep", "--set", "nope=1", "--out", join(scratch, "bad")],
      "unknown parameter: nope",
    ],
    [["sweep", "--set", "a.b", "--seeds", "1"], "--set must look like"],
    [
      ["sweep", "--set", "creep.cost.materia=1", "--seeds", "x"],
      "--seeds must look like",
    ],
  ])("%j is a usage error (exit 2)", (argv, message) => {
    const io = capture();
    expect(run(argv, io)).toBe(2);
    expect(io.errors.join("\n")).toContain(message);
    expect(existsSync(join(scratch, "bad"))).toBe(false);
  });
});
