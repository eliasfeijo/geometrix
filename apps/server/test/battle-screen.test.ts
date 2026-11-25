// The battle screen on the server (junction plan section 7, D13, C-2, N-2):
// a dominating player's open screen puts its battle on the real pace, the
// battle clock steps it, the inputs go only to the dominated participant,
// and the frames only to the open screens. On seed 42 of the test params,
// with a bot on each team, the first battle between the teams (found by
// firstTeamBattle: tick, id and a participant of each team); every test
// recovers the world from a snapshot just before it opens.

import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { battleView, replayLog, type BattleView } from "@geometrix/battle";
import {
  applyBattleDelta,
  type BattleFrameMessage,
  type BattleViewDelta,
} from "@geometrix/protocol";
import { beforeAll, describe, expect, test } from "vitest";
import { BattleClock } from "../src/battle-clock.ts";
import { replayResults } from "@geometrix/junction";
import { battleHash, stateHash } from "../src/hash.ts";
import { Store } from "../src/persistence.ts";
import { rebuild } from "../src/soak.ts";
import { WorldHost } from "../src/world-host.ts";
import {
  FakeTimers,
  firstTeamBattle,
  testBattleParams,
  testParams,
} from "./helpers.ts";

const config = {
  snapshotEveryTicks: 300,
  metricsEveryTicks: 60,
  chronicleWelcome: 100,
};
const first = firstTeamBattle();
const BATTLE = first.battle;
const ARROW = first.team0; // team 0's creep in it
const BLOCK = first.team1; // team 1's

let saved = "";
let ana = 0;
let bia = 0;

beforeAll(() => {
  saved = join(mkdtempSync(join(tmpdir(), "geo-screen-")), "geo.db");
  const store = new Store(saved);
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
  ana = store.addPlayer({
    worldId: host.id,
    team: 0,
    name: "Ana",
    tokenHash: "a",
    bot: false,
  });
  bia = store.addPlayer({
    worldId: host.id,
    team: 1,
    name: "Bia",
    tokenHash: "b",
    bot: false,
  });
  host.submit(ana, { type: "join", team: 0, bot: false });
  host.submit(bia, { type: "join", team: 1, bot: false });
  while (host.state.tick < first.openedTick) host.tick();
  host.snapshot();
  store.close();
}, 60_000);

/** The world one tick on, with the battle just opened. */
function opened() {
  const file = join(mkdtempSync(join(tmpdir(), "geo-screen-")), "geo.db");
  copyFileSync(saved, file);
  const store = new Store(file);
  const host = WorldHost.recover(
    { store, config },
    store.world(1)!,
    testBattleParams(),
  );
  const frames: BattleFrameMessage[] = [];
  host.onBattleFrame((frame) => frames.push(frame));
  host.tick();
  const instance = host.junction.instances.find((i) => i.battleId === BATTLE)!;
  expect(instance.state.tick).toBe(0);
  return { file, store, host, frames, instance };
}

/** Ana dominates team 0's creep in it, through the command path. */
function dominateArrow(host: WorldHost) {
  expect(host.submit(ana, { type: "dominate", creepId: ARROW })).toBeNull();
  host.tick();
  expect(host.state.creeps.find((c) => c.id === ARROW)!.dominatedBy).toBe(ana);
}

const participant = (host: WorldHost, creep: number) =>
  host.junction.instances
    .find((i) => i.battleId === BATTLE)!
    .members.find((m) => m.creep === creep)!.participant;

describe("the pace (D13, T-1, T-2)", () => {
  test("a dominating player's screen puts the battle in real time; closed, the world clock again", () => {
    const { host, frames, instance } = opened();
    dominateArrow(host);
    const viewer = {};
    expect(host.openScreen(viewer, { id: ana, team: 0 }, BATTLE)).toMatchObject(
      { type: "battleOpen", battleId: BATTLE },
    );
    expect(host.screenOf(viewer)).toBe(BATTLE);
    const tick = instance.state.tick;
    host.tick();
    expect(instance.pace).toBe("real");
    host.tick();
    expect(instance.state.tick).toBe(tick);
    host.realtimeTick();
    expect(instance.state.tick).toBe(tick + 1);
    const me = participant(host, ARROW);
    expect(
      instance.state.participants.find((p) => p.id === me)!.controller,
    ).toBe("human");
    expect(frames.at(-1)!.events).toContainEqual(
      expect.objectContaining({ type: "controlChanged", controller: "human" }),
    );
    host.closeScreen(viewer);
    expect(host.screenOf(viewer)).toBeNull();
    host.tick();
    expect(instance.pace).toBe("world");
    expect(instance.state.tick).toBe(tick + 1 + 20);
    expect(
      instance.state.participants.find((p) => p.id === me)!.controller,
    ).toBe("gambits");
  });

  test("a watcher who dominates nobody in it gets the frames, and the battle stays on the world clock", () => {
    const { host, frames, instance } = opened();
    const viewer = {};
    host.openScreen(viewer, { id: bia, team: 1 }, BATTLE);
    host.tick();
    host.tick();
    expect(instance.pace).toBe("world");
    expect(instance.state.tick).toBe(40);
    // One frame per world tick, with the view after its 20 battle ticks.
    expect(frames.map((f) => [f.battleId, f.delta.tick])).toEqual([
      [BATTLE, 20],
      [BATTLE, 40],
    ]);
    host.realtimeTick();
    expect(instance.state.tick).toBe(40);
  });

  test("the world tick drops the inputs of a battle on the world clock", () => {
    const { host, instance } = opened();
    dominateArrow(host);
    const me = participant(host, ARROW);
    const input = {
      type: "intent",
      id: me,
      move: "up",
      attack: false,
    } as const;
    expect(host.battleInput(ana, BATTLE, input)).toBeNull();
    host.tick(); // nobody shows the battle: still the world clock
    host.openScreen({}, { id: ana, team: 0 }, BATTLE);
    host.tick();
    expect(instance.pace).toBe("real");
    host.realtimeTick();
    const arrow = instance.state.participants.find((p) => p.id === me)!;
    expect(arrow.intent.move).toBeNull();
  });
});

describe("the screens (N-2)", () => {
  test("only a team with a side in the battle opens it; an unknown battle is refused", () => {
    const { host } = opened();
    expect(host.openScreen({}, { id: 99, team: 7 }, BATTLE)).toBe(
      "notYourBattle",
    );
    expect(host.openScreen({}, { id: ana, team: 0 }, 9_999)).toBe(
      "unknownBattle",
    );
  });

  test("the opening carries the arena, the params, the roster and the view now", () => {
    const { host, instance } = opened();
    const open = host.openScreen({}, { id: ana, team: 0 }, BATTLE);
    if (typeof open === "string") throw new Error(open);
    expect(open.arena).toEqual(instance.state.arena);
    expect(open.params).toEqual(instance.state.params);
    expect(open.roster.members.map((m) => m.creep).sort()).toEqual(
      [ARROW, BLOCK].sort(),
    );
    expect(open.roster.sides).toEqual(
      instance.sideOf.map(
        (side) => host.state.battles.find((b) => b.id === BATTLE)!.sides[side],
      ),
    );
    expect(open.view).toEqual(battleView(instance.state));
  });

  test("the frames' deltas rebuild the battle view, for a screen opened at the start and one opened later", () => {
    const { host, instance } = opened();
    const first = host.openScreen({}, { id: ana, team: 0 }, BATTLE);
    if (typeof first === "string") throw new Error(first);
    const screens: { view: BattleView }[] = [{ view: first.view }];
    let checked = 0;
    host.onBattleFrame((frame) => {
      const delta = JSON.parse(JSON.stringify(frame.delta)) as BattleViewDelta;
      for (const screen of screens) {
        screen.view = applyBattleDelta(screen.view, delta);
        expect(JSON.stringify(screen.view)).toBe(
          JSON.stringify(battleView(instance.state)),
        );
        checked++;
      }
    });
    for (let i = 0; i < 600 && instance.state.ended === null; i++) {
      if (i === 3) {
        const later = host.openScreen({}, { id: bia, team: 1 }, BATTLE);
        if (typeof later === "string") throw new Error(later);
        expect(later.view).toEqual(screens[0]!.view);
        screens.push({ view: later.view });
      }
      host.tick();
    }
    expect(instance.state.ended).not.toBeNull();
    expect(checked).toBeGreaterThan(4);
  }, 30_000);

  test("no frame is made for a battle nobody shows", () => {
    const { host, frames } = opened();
    for (let i = 0; i < 5; i++) host.tick();
    expect(frames).toEqual([]);
  });
});

describe("the inputs (C-2)", () => {
  test("only for the participant of the creep the player dominates", () => {
    const { host, instance } = opened();
    dominateArrow(host);
    const me = participant(host, ARROW);
    const other = participant(host, BLOCK);
    const intent = (id: number) =>
      ({ type: "intent", id, move: "left", attack: true }) as const;
    expect(host.battleInput(ana, BATTLE, intent(other))).toBe(
      "notYourParticipant",
    );
    expect(host.battleInput(bia, BATTLE, intent(other))).toBe(
      "notYourParticipant",
    );
    expect(host.battleInput(ana, 9_999, intent(me))).toBe("unknownBattle");
    host.openScreen({}, { id: ana, team: 0 }, BATTLE);
    host.tick();
    host.realtimeTick(); // control goes to the human
    expect(host.battleInput(ana, BATTLE, intent(me))).toBeNull();
    host.realtimeTick();
    const arrow = instance.state.participants.find((p) => p.id === me)!;
    expect(arrow.intent).toMatchObject({ move: "left", attack: true });
  });
});

describe("a battle played by a human to its end (spec section 7: two logs agree)", () => {
  test("the screen closes, the world applies the results, and the stored log replays to them", () => {
    const { store, host, frames, instance } = opened();
    dominateArrow(host);
    const viewer = {};
    host.openScreen(viewer, { id: ana, team: 0 }, BATTLE);
    host.tick();
    const me = participant(host, ARROW);
    const moves = ["up", "right", "down", "left"] as const;
    // At ×1: 20 battle ticks per world tick; Ana walks and shoots.
    for (let i = 0; i < 20 * 600 && instance.state.ended === null; i++) {
      if (i % 40 === 0) {
        host.battleInput(ana, BATTLE, {
          type: "intent",
          id: me,
          move: moves[(i / 40) % 4]!,
          attack: true,
        });
      }
      host.realtimeTick();
      if (i % 20 === 19) host.tick();
    }
    expect(instance.state.ended).not.toBeNull();
    expect(frames.at(-1)!.delta.ended).not.toBeNull();
    expect(frames.at(-1)!.events.map((e) => e.type)).toContain("ended");
    expect(host.screenOf(viewer)).toBeNull();
    host.tick();
    expect(host.state.battles.some((b) => b.id === BATTLE)).toBe(false);
    const row = store.battle(1, BATTLE)!;
    expect(row.endedTick).not.toBeNull();
    const log = {
      battleVersion: row.battleVersion,
      setup: row.setup,
      params: row.params,
      ticks: row.reachedTick,
      commands: store.battleTicks(1, BATTLE),
      finalHash: null,
    };
    expect(log.commands.some((t) => t.commands.length > 0)).toBe(true);
    expect(battleHash(replayLog(log))).toBe(row.finalHash);
    const applied = store
      .commandsFrom(1, 0)
      .map((c) => c.command)
      .filter(
        (c) =>
          (c.type === "battleExit" || c.type === "battleEnd") &&
          c.battleId === BATTLE,
      );
    expect(applied.at(-1)?.type).toBe("battleEnd");
    expect(row.record.sent).toEqual(applied);
  }, 30_000);
});

describe("a crash in the middle of a real-time battle (junction spec section 7, N-3)", () => {
  test("the battle comes back as the last world tick stored it, on the world clock, and both logs still agree", () => {
    const { file, store, host, instance } = opened();
    dominateArrow(host);
    const viewer = {};
    host.openScreen(viewer, { id: ana, team: 0 }, BATTLE);
    host.tick();
    expect(instance.pace).toBe("real");
    const me = participant(host, ARROW);
    const moves = ["up", "right", "down", "left"] as const;
    const walk = (i: number) => {
      if (i % 10 === 0) {
        host.battleInput(ana, BATTLE, {
          type: "intent",
          id: me,
          move: moves[(i / 10) % 4]!,
          attack: i % 20 === 0,
        });
      }
      host.realtimeTick();
    };
    // Three world seconds of Ana's inputs, each stored with its world tick.
    for (let i = 0; i < 60; i++) {
      walk(i);
      if (i % 20 === 19) host.tick();
    }
    expect(instance.state.ended).toBeNull();
    const stored = {
      tick: host.state.tick,
      world: stateHash(host.state),
      battle: battleHash(instance.state),
      battleTick: instance.state.tick,
      inputs: instance.log.commands.length,
    };
    expect(stored.inputs).toBeGreaterThan(0);
    // Battle ticks after the last world tick: never stored, so never applied.
    for (let i = 60; i < 75; i++) walk(i);
    expect(instance.state.tick).toBe(stored.battleTick + 15);
    store.close(); // the crash: nothing written after the last world tick

    const again = new Store(file);
    const back = WorldHost.recover(
      { store: again, config },
      again.world(1)!,
      testBattleParams(),
    );
    expect(back.state.tick).toBe(stored.tick);
    expect(stateHash(back.state)).toBe(stored.world);
    const rebuilt = back.junction.instances.find((i) => i.battleId === BATTLE)!;
    expect(rebuilt.pace).toBe("world");
    expect(rebuilt.state.tick).toBe(stored.battleTick);
    expect(battleHash(rebuilt.state)).toBe(stored.battle);
    expect(rebuilt.log.commands.length).toBe(stored.inputs);

    // Nobody comes back to the screen: the world clock ends it.
    for (
      let i = 0;
      i < 600 && back.state.battles.some((b) => b.id === BATTLE);
      i++
    ) {
      back.tick();
    }
    expect(back.state.battles.some((b) => b.id === BATTLE)).toBe(false);
    const row = again.battle(1, BATTLE)!;
    const log = {
      battleVersion: row.battleVersion,
      setup: row.setup,
      params: row.params,
      ticks: row.reachedTick,
      commands: again.battleTicks(1, BATTLE),
      finalHash: null,
    };
    expect(battleHash(replayLog(log))).toBe(row.finalHash);
    const worldLog = again.commandsFrom(1, 0);
    const applied = worldLog
      .map((c) => c.command)
      .filter(
        (c) =>
          (c.type === "battleExit" || c.type === "battleEnd") &&
          c.battleId === BATTLE,
      );
    expect(applied.at(-1)?.type).toBe("battleEnd");
    expect(row.record.sent).toEqual(applied);
    expect(row.record.pending).toEqual([]);
    expect(
      replayResults(back.state, {
        ...row.record,
        log,
        late: [],
        results: row.record.sent,
      }),
    ).toEqual(applied);
    // The world log replays alone to the recovered world.
    const world = again.world(1)!;
    const replayed = rebuild({
      simVersion: world.simVersion,
      seed: world.seed,
      params: world.params,
      ticks: back.state.tick,
      finalHash: stateHash(back.state),
      commands: worldLog,
    });
    expect(stateHash(replayed)).toBe(stateHash(back.state));
    again.close();
  }, 60_000);
});

describe("the battle clock (junction plan section 7)", () => {
  function clocked(status: "running" | "ended" = "running") {
    const timers = new FakeTimers();
    const world = { status, ticks: 0, realtimeTick: () => world.ticks++ };
    const clock = new BattleClock(world, timers, 50, 40);
    return { timers, world, clock };
  }

  test("one battle tick every 50 ms", () => {
    const { timers, world, clock } = clocked();
    clock.start();
    timers.advance(49);
    expect(world.ticks).toBe(0);
    timers.advance(1);
    expect(world.ticks).toBe(1);
    timers.advance(1_000);
    expect(world.ticks).toBe(21);
    clock.stop();
    timers.advance(1_000);
    expect(world.ticks).toBe(21);
  });

  test("after a stall it runs at most 40 at once, then goes on from now", () => {
    const { timers, world, clock } = clocked();
    clock.start();
    timers.stall(10_000);
    timers.advance(0);
    expect(world.ticks).toBe(40);
    timers.advance(50);
    expect(world.ticks).toBe(41);
  });

  test("does not run for an ended world", () => {
    const { timers, world, clock } = clocked("ended");
    clock.start();
    timers.advance(1_000);
    expect(world.ticks).toBe(0);
    expect(clock.running).toBe(false);
  });
});
