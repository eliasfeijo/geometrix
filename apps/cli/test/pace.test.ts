import { readFileSync } from "node:fs";
import {
  botsFor,
  parseParams,
  Terrain,
  type GameMap,
  type SimEvent,
} from "@geometrix/sim";
import { describe, expect, test } from "vitest";
import { BATTLE_RESULTS } from "../src/encounters.ts";
import { runBots } from "../src/harness.ts";
import {
  crossingSeconds,
  reachableMask,
  runTargets,
  seedTargets,
  TARGETS,
  type PaceFacts,
  type TeamPace,
} from "../src/pace.ts";
import { simulate } from "../src/sim.ts";

const params = parseParams(
  JSON.parse(
    readFileSync(
      // The sim tests' fixed params, so balancing does not change the bots.
      new URL("../../../packages/sim/test/params.json", import.meta.url),
      "utf8",
    ),
  ),
);

/** `.` jungle · `=` crossing · `~` river · `#` rock */
function textMap(rows: string[]): GameMap {
  const terrain = rows.flatMap((row) =>
    [...row].map(
      (c) =>
        ({
          ".": Terrain.jungle,
          "=": Terrain.crossing,
          "~": Terrain.river,
          "#": Terrain.rock,
        })[c]!,
    ),
  );
  return {
    width: rows[0]!.length,
    height: rows.length,
    terrain,
    road: terrain.map(() => 0),
  };
}

describe("the map", () => {
  test("the reachable cells are the passable ones connected to the core", () => {
    const map = textMap([
      "..#..", //
      ".....",
      "~~=~~",
      ".#...",
    ]);
    const mask = [...reachableMask(map, 0)];
    expect(mask).toEqual([
      1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0,
      // (0, 3) is walled off by the river and a rock.
      0, 0, 1, 1, 1,
    ]);
  });

  test("the crossing is the path cost at the DNA's speed, a crossing cell slower", () => {
    const map = textMap(["..=.."]);
    const jungle = Math.floor(1_000_000 / params.movementPermille.jungle);
    const crossing = Math.floor(1_000_000 / params.movementPermille.crossing);
    const seconds = crossingSeconds(
      map,
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      params,
      3,
    );
    // A plain cell at 3 cells per minute takes 20 s.
    expect(seconds).toBe(((3 * jungle + crossing) * 60) / (3 * 1000));
    expect(
      crossingSeconds(
        textMap([".#."]),
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        params,
        3,
      ),
    ).toBeNull();
  });
});

describe("a run's pace", () => {
  const ticks = 6 * 3600;
  const run = simulate({
    id: "pace",
    seed: 42,
    params,
    paramsSource: "packages/sim/test/params.json",
    ticks,
    multiplier: 6,
    strategists: ["balanced", "balanced"],
  });
  const { pace } = run;
  // The same world again, for its events.
  const events: SimEvent[] = [];
  runBots(42, params, ticks, botsFor(["balanced", "balanced"]), (_, e) =>
    events.push(...e),
  );

  test("the first extra creep is each team's first birth", () => {
    for (const team of pace.teams) {
      const born = events.find(
        (e) => e.type === "born" && e.creep.team === team.team,
      );
      expect(born).toBeDefined();
      expect(team.firstBornTick).toBe(born!.tick + 1);
    }
  });

  test("the battles per team agree with the encounter tracker's", () => {
    expect(run.encounters.battlesOpened).toBeGreaterThan(0);
    for (const team of pace.teams) {
      const tally = run.encounters.teams[team.team]!;
      expect(team.battles).toBe(
        BATTLE_RESULTS.reduce((sum, r) => sum + tally.battles[r], 0),
      );
      expect(team.battlesWithJoin).toBeLessThanOrEqual(team.battles);
      // Since R F3, the joins on a side the team already had.
      expect(team.helpJoins).toBe(tally.helpJoins);
      expect(team.helpJoins).toBeLessThanOrEqual(tally.joins);
    }
  });

  test("the explored share, the cap and the late delivery come from the samples", () => {
    const last = run.samples.at(-1)!;
    const window = (TARGETS.lateDelivery * 60 * 6) / params.world.tickSeconds;
    const from = run.samples.findLast((s) => s.tick <= last.tick - window)!;
    for (const team of pace.teams) {
      expect(team.exploredPermille).toBeGreaterThan(0);
      expect(team.exploredPermille).toBeLessThanOrEqual(1000);
      if (team.exploredTick !== null) {
        expect(team.exploredTick % 60).toBe(0);
        expect(team.exploredPermille).toBeGreaterThanOrEqual(
          TARGETS.exploredPermille,
        );
      }
      const t = team.team;
      expect(team.lateMateria).toBe(
        last.teams[t]!.delivered.materia - from.teams[t]!.delivered.materia,
      );
      const c = last.teams[t]!.creeps;
      expect(team.creepsAtEnd).toBe(c.square + c.triangle + c.circle);
    }
  });

  test("the wanderers: the first birth, and alive at most every tick after it", () => {
    const born = events.find((e) => e.type === "wandererBorn");
    const w = pace.wanderers;
    expect(w.firstBornTick).toBe(born === undefined ? null : born.tick + 1);
    expect(w.ticksWithOneAlive).toBeLessThanOrEqual(w.ticksAfterFirst);
    expect(w.maxAlive).toBe(run.encounters.wanderers.maxAlive);
  });

  test("the run's facts: its ×N, ticks, the crossing on its map", () => {
    expect(pace.multiplier).toBe(6);
    expect(pace.ticks).toBe(ticks);
    expect(pace.matchSeconds).toBe(params.world.durationSeconds);
    expect(pace.crossingSeconds).toBeGreaterThan(0);
    expect(pace.reachableCells).toBeLessThanOrEqual(
      params.map.width * params.map.height,
    );
    expect(pace.tickMicros).toBeGreaterThan(0);
  });
}, 60_000);

/** A team's pace in real minutes at ×6 (one tick of 1 s). */
function team(i: number, edit: Partial<TeamPace> = {}): TeamPace {
  const tick = (minutes: number) => minutes * 60 * 6;
  return {
    team: i,
    firstBornTick: tick(10),
    exploredTick: tick(30),
    exploredPermille: 900,
    battles: 6,
    battlesWithJoin: 2,
    helpJoins: null,
    capTick: null,
    creepsAtEnd: 15,
    lateMateria: 100,
    ...edit,
  };
}

/** A 2-hour match at ×6 that meets every target. */
function facts(edit: Partial<PaceFacts> = {}): PaceFacts {
  return {
    multiplier: 6,
    tickSeconds: 1,
    ticks: 120 * 60 * 6,
    matchSeconds: 120 * 60 * 6,
    reactionSeconds: 60,
    crossingSeconds: 2 * 60 * 6,
    reachableCells: 3000,
    teams: [team(0), team(1)],
    wanderers: {
      firstBornTick: 5 * 60 * 6,
      ticksAfterFirst: 1000,
      ticksWithOneAlive: 800,
      maxAlive: 4,
    },
    tickMicros: 40,
    recovery: null,
    ...edit,
  };
}

const verdict = (f: PaceFacts, criterion: string) =>
  runTargets(f).find((r) => r.criterion.startsWith(criterion))!;

describe("the targets", () => {
  test("a match on every target passes them all; the unmeasured have no verdict", () => {
    const rows = runTargets(facts());
    expect(rows.filter((r) => r.verdict === false)).toEqual([]);
    expect(
      rows.filter((r) => r.verdict === null).map((r) => r.criterion),
    ).toEqual([
      "Lutas: batalhas por time a cada 10 min reais (com entrada depois da abertura)",
      'Lutas: entradas por ajuda ou "seguir", por time a cada 30 min reais',
      "Recuperação: o time do choque volta à sua contagem",
      "Custo do tick (pelo host)",
    ]);
  });

  test.each([
    // [criterion, the facts, verdict]
    ["Duração", { matchSeconds: 126 * 360 }, false],
    ["Duração", { matchSeconds: 115 * 360 }, true],
    ["Janela", { reactionSeconds: 59 }, false],
    ["Travessia", { crossingSeconds: 1.5 * 360 }, true],
    ["Travessia", { crossingSeconds: 2.6 * 360 }, false],
    ["Travessia", { crossingSeconds: null }, false],
    ["Abertura", { teams: [team(0), team(1, { firstBornTick: null })] }, false],
    [
      "Abertura",
      { teams: [team(0), team(1, { firstBornTick: 7 * 360 })] },
      false,
    ],
    [
      "Exploração",
      { teams: [team(0, { exploredTick: 61 * 360 }), team(1)] },
      false,
    ],
    [
      "Andarilhos: o 1º",
      { wanderers: { ...facts().wanderers, firstBornTick: 7 * 360 } },
      false,
    ],
    [
      "Andarilhos: algum",
      { wanderers: { ...facts().wanderers, ticksWithOneAlive: 699 } },
      false,
    ],
    [
      "Andarilhos vivos",
      { wanderers: { ...facts().wanderers, maxAlive: 5 } },
      false,
    ],
    [
      "Sem bola de neve: os dois",
      { teams: [team(0), team(1, { lateMateria: 0 })] },
      false,
    ],
    [
      "Sem bola de neve: diferença",
      { teams: [team(0, { creepsAtEnd: 19 }), team(1)] },
      false,
    ],
    [
      "População: creeps",
      { teams: [team(0, { creepsAtEnd: 25 }), team(1)] },
      false,
    ],
    [
      "População: teto",
      { teams: [team(0, { capTick: 89 * 360 }), team(1)] },
      false,
    ],
    [
      "População: teto",
      { teams: [team(0, { capTick: 90 * 360 }), team(1)] },
      true,
    ],
  ] as const)("%s with %j: %s", (criterion, edit, expected) => {
    expect(verdict(facts(edit as Partial<PaceFacts>), criterion).verdict).toBe(
      expected,
    );
  });

  test("help joins, once measured, need one per team per 30 real minutes", () => {
    // 120 real minutes: 4 joins are one per 30 minutes.
    const enough = facts({
      teams: [team(0, { helpJoins: 4 }), team(1, { helpJoins: 4 })],
    });
    expect(verdict(enough, "Lutas: entradas").verdict).toBe(true);
    const short = facts({
      teams: [team(0, { helpJoins: 4 }), team(1, { helpJoins: 3 })],
    });
    expect(verdict(short, "Lutas: entradas").verdict).toBe(false);
  });

  test("battles per team per 10 real minutes", () => {
    // 6 battles in 120 real minutes.
    expect(verdict(facts(), "Lutas: batalhas").measured).toBe(
      "time 0: 0,5 (6 batalhas, 2 com entrada) · time 1: 0,5 (6 batalhas, 2 com entrada)",
    );
  });

  test("over the seeds: met on every seed, the gap by its median", () => {
    const late = facts({
      teams: [team(0, { firstBornTick: 16 * 360 }), team(1)],
    });
    const gap = (n: number) =>
      facts({ teams: [team(0, { creepsAtEnd: 15 + n }), team(1)] });
    const rows = seedTargets([facts(), late, gap(4), gap(4)]);
    const row = (c: string) => rows.find((r) => r.criterion.startsWith(c))!;
    expect(row("Abertura")).toMatchObject({
      measured: "3/4 seeds; média 11,5 (10–16)",
      verdict: false,
    });
    // Gaps 0, 0, 4, 4: the median is 2.
    expect(row("Sem bola de neve: diferença")).toMatchObject({
      measured: "mediana 2 (0, 0, 4, 4)",
      verdict: true,
    });
    expect(row("Lutas: entradas")).toMatchObject({
      measured: "— (medido a partir da F2/F3 do slice R)",
      verdict: null,
    });
  });
});
