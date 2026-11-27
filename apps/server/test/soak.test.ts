import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  canonicalJson,
  createWorld,
  endSummary,
  eventsFor,
  step,
  type EndSummary,
  type SimEvent,
} from "@geometrix/sim";
import { describe, expect, test } from "vitest";
import {
  checkBattles,
  checkEnd,
  describeEnd,
  interruptions,
  parseSoakArgs,
  rebuild,
  samplesCsv,
  SoakError,
  summarize,
  type SoakSample,
} from "../src/soak.ts";
import { stateHash } from "../src/hash.ts";
import { WorldHost } from "../src/world-host.ts";
import { Store } from "../src/persistence.ts";
import { firstTeamBattle, testBattleParams, testParams } from "./helpers.ts";

/** The first battle between the teams of seed 42 (see helpers). */
const first = firstTeamBattle();

describe("parseSoakArgs", () => {
  test("defaults: ×360, 5 kills, seed 42, port 8089, 2 clients per team dropping every 60 s, temp db, runs/", () => {
    expect(parseSoakArgs([])).toEqual({
      multiplier: 360,
      kills: 5,
      seed: 42,
      port: 8089,
      clients: 2,
      dropEverySeconds: 60,
      db: undefined,
      out: "runs",
    });
  });

  test("reads every option", () => {
    expect(
      parseSoakArgs([
        "--mult=36",
        "--kills=0",
        "--seed=7",
        "--port=9000",
        "--clients=3",
        "--drop-every=20",
        "--db=x.db",
        "--out=o",
      ]),
    ).toEqual({
      multiplier: 36,
      kills: 0,
      seed: 7,
      port: 9000,
      clients: 3,
      dropEverySeconds: 20,
      db: "x.db",
      out: "o",
    });
  });

  test.each([
    [["--mult=0"]],
    [["--kills=-1"]],
    [["--port=70000"]],
    [["--clients=4"]],
    [["--drop-every=1"]],
    [["--x"]],
  ])("refuses %j", (args) => {
    expect(() => parseSoakArgs(args)).toThrow(SoakError);
  });
});

describe("interruptions", () => {
  test("kills plus one clean stop, sorted, inside 5%..95% of the world", () => {
    const plan = interruptions(42, 5, 259_200);
    expect(plan).toHaveLength(6);
    expect(plan.filter((p) => p.kind === "term")).toHaveLength(1);
    const ticks = plan.map((p) => p.tick);
    expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
    expect(new Set(ticks).size).toBe(6);
    for (const tick of ticks) {
      expect(tick).toBeGreaterThanOrEqual(12_960);
      expect(tick).toBeLessThan(246_240);
    }
  });

  test("the same seed gives the same plan; another seed another", () => {
    expect(interruptions(7, 3, 10_000)).toEqual(interruptions(7, 3, 10_000));
    expect(interruptions(8, 3, 10_000)).not.toEqual(
      interruptions(7, 3, 10_000),
    );
  });

  test("no kills still stops cleanly once", () => {
    expect(interruptions(1, 0, 1000).map((p) => p.kind)).toEqual(["term"]);
  });
});

describe("rebuild", () => {
  test("a hosted world's log rebuilds its state and its events", () => {
    const store = new Store(":memory:");
    const host = WorldHost.create(
      {
        store,
        config: {
          snapshotEveryTicks: 300,
          metricsEveryTicks: 60,
          chronicleWelcome: 100,
        },
      },
      {
        seed: 3,
        params: testParams(),
        battleParams: testBattleParams(),
        multiplier: 1,
        botTeams: [0, 1],
        createdAt: "2026-11-14T00:00:00.000Z",
      },
    );
    for (let i = 0; i < 400; i++) host.tick();
    while (host.chronicle(0).length < 2) host.tick();
    const ticks = host.state.tick;
    const events: SimEvent[] = [];
    const state = rebuild(
      {
        simVersion: 2,
        seed: 3,
        params: testParams(),
        ticks,
        finalHash: stateHash(host.state),
        commands: store.commandsFrom(host.id, 0),
      },
      (tick) => events.push(...tick),
    );
    expect(state.tick).toBe(ticks);
    expect(stateHash(state)).toBe(stateHash(host.state));
    for (const team of [0, 1]) {
      expect(eventsFor(events, team)).toEqual(
        store.recentChronicle(host.id, team, 1000),
      );
    }
    // ~0.7 s alone, past 5 s with the whole suite on a loaded machine.
  }, 30_000);
});

describe("checkBattles (junction spec section 7)", () => {
  /** Seed 42 of the test params with two bots: firstTeamBattle opens the first battle. */
  function crashedInBattle() {
    const file = join(mkdtempSync(join(tmpdir(), "geo-soak-")), "geo.db");
    const config = {
      snapshotEveryTicks: 300,
      metricsEveryTicks: 60,
      chronicleWelcome: 100,
    };
    let store = new Store(file);
    const host = WorldHost.create(
      { store, config },
      {
        seed: 42,
        params: testParams(),
        battleParams: testBattleParams(),
        multiplier: 1,
        botTeams: [0, 1],
        createdAt: "2026-11-14T00:00:00.000Z",
      },
    );
    while (host.state.tick < first.openedTick + 11) host.tick();
    const cut = store
      .battles(host.id)
      .filter((b) => b.endedTick === null)
      .map((b) => b.battleId);
    store.close();
    store = new Store(file);
    const back = WorldHost.recover(
      { store, config },
      store.world(host.id)!,
      testBattleParams(),
    );
    while (back.state.tick < first.openedTick + 461) back.tick();
    return { store, id: host.id, cut, state: back.state };
  }

  test("after a crash mid-battle, every ended battle replays to its hash and to the world log's results; tampering shows", () => {
    const { store, id, cut, state } = crashedInBattle();
    expect(cut.length).toBeGreaterThan(0);
    const rows = store.battles(id);
    const ticksOf = (battleId: number) => store.battleTicks(id, battleId);
    // As the soak gets it: the exported replay, keys in another order.
    const log = store.commandsFrom(id, 0).map((c) => ({
      ...c,
      command: JSON.parse(canonicalJson(c.command)) as typeof c.command,
    }));
    const check = checkBattles(state, rows, ticksOf, log);
    expect(check).toEqual({
      battles: rows.length,
      ended: rows.length,
      open: [],
      hashMismatches: [],
      resultMismatches: [],
      lateJoins: [],
    });
    expect(rows.map((r) => r.battleId)).toEqual(expect.arrayContaining(cut));

    const battle = cut[0]!;
    const tampered = rows.map((r) =>
      r.battleId === battle ? { ...r, finalHash: "0".repeat(64) } : r,
    );
    expect(checkBattles(state, tampered, ticksOf, log).hashMismatches).toEqual([
      battle,
    ]);
    const lost = log.filter(
      (c) => !(c.command.type === "battleEnd" && c.command.battleId === battle),
    );
    expect(checkBattles(state, rows, ticksOf, lost).resultMismatches).toEqual([
      battle,
    ]);
    const open = rows.map((r) =>
      r.battleId === battle ? { ...r, endedTick: null } : r,
    );
    expect(checkBattles(state, open, ticksOf, log).open).toEqual([battle]);
    store.close();
  }, 60_000);
});

describe("checkEnd (E-min plan section 8)", () => {
  /** A world whose clock runs out after 20 ticks: a draw. */
  function ended() {
    const base = testParams();
    const params = {
      ...base,
      world: { ...base.world, durationSeconds: 20 * base.world.tickSeconds },
    };
    const state = createWorld(42, params);
    while (state.result === null) step(state, []);
    return state;
  }

  test("the lobby and the clients agree with the replay's end", () => {
    const state = ended();
    const end = endSummary(state)!;
    const listed = {
      how: end.result.how,
      winner: end.result.winner,
      teams: end.result.teams,
    };
    expect(checkEnd(state, listed, [end, end])).toEqual({
      end,
      lobbyOk: true,
      clientsOk: true,
      ok: true,
    });
    expect(checkEnd(state, null, [end]).lobbyOk).toBe(false);
    expect(checkEnd(state, { ...listed, winner: 0 }, [end]).lobbyOk).toBe(
      false,
    );
    expect(checkEnd(state, listed, [end, null]).clientsOk).toBe(false);
    const other = { ...end, durationSeconds: end.durationSeconds + 1 };
    expect(checkEnd(state, listed, [other]).ok).toBe(false);
  });

  test("a replay that never reaches an end fails", () => {
    const state = createWorld(42, testParams());
    expect(checkEnd(state, null, []).ok).toBe(false);
  });

  test("says when and how: the clock's draw, a bot's concession", () => {
    const clock: EndSummary = {
      result: {
        tick: 57_599,
        how: "clock",
        winner: null,
        teams: [0, 1],
      },
      durationSeconds: 57_600,
      teams: [],
      highlights: [],
    };
    expect(describeEnd(clock, 8)).toBe(
      "tick 57599 (world 16 h 0 min, 120.0 real min at ×8): " +
        "the clock ran out; a draw between teams 0 and 1",
    );
    const team = {
      born: 0,
      lost: 0,
      battlesWon: 0,
      battlesLost: 0,
      materiaDelivered: 0,
    };
    const conceded: EndSummary = {
      result: { tick: 7199, how: "lastTeam", winner: 0, teams: [0] },
      durationSeconds: 7200,
      teams: [
        { team: 0, out: null, ...team },
        {
          team: 1,
          out: { tick: 7199, how: "conceded", bot: true },
          ...team,
        },
      ],
      highlights: [],
    };
    expect(describeEnd(conceded, 8)).toBe(
      "tick 7199 (world 2 h 0 min, 15.0 real min at ×8): " +
        "team 1 conceded (its bot) at tick 7199; team 0 won",
    );
  });
});

describe("summarize", () => {
  const sample = (
    seconds: number,
    pid: number,
    tick: number,
    rssMb: number,
    ticksPerSecond: number | null,
  ): SoakSample => ({
    seconds,
    pid,
    tick,
    rssMb,
    dbMb: tick / 1000,
    ticksPerSecond,
  });

  test("memory per process, final database size and loop speed", () => {
    const samples = [
      sample(2, 10, 700, 80, null),
      sample(4, 10, 1420, 90, 360),
      sample(6, 11, 1500, 70, null),
      sample(8, 11, 2100, 75, 300),
      sample(10, 11, 2820, 76, 360),
    ];
    expect(summarize(samples, 360)).toEqual({
      samples: 5,
      maxRssMb: 90,
      rssByProcess: [
        { pid: 10, firstMb: 80, lastMb: 90 },
        { pid: 11, firstMb: 70, lastMb: 76 },
      ],
      finalDbMb: 2.82,
      minSpeedShare: 300 / 360,
      medianSpeedShare: 1,
    });
    expect(samplesCsv(samples).split("\n")[2]).toBe(
      "4.0,10,1420,90.0,1.42,360.0",
    );
  });
});
