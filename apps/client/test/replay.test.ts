import type { Replay } from "@geometrix/protocol";
import {
  createWorld,
  isOwnTeam,
  restore,
  serialize,
  type TeamEvent,
} from "@geometrix/sim";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { ReplayController } from "../src/replay/controller.ts";
import { stateHash } from "../src/replay/hash.ts";
import { sha256Hex } from "../src/hash.ts";
import { fogPaths } from "../src/map/fog.ts";
import { dueTicks, MAX_FRAME_MS, RateMeter } from "../src/replay/playback.ts";
import { ReplayPlayer } from "../src/replay/player.ts";
import { CHRONICLE_KEEP } from "../src/store.ts";
import { botReplay } from "./helpers.ts";

/**
 * 50 world minutes with bots (the first births come at 36 min: the chronicle
 * has events), checkpoints every 5 minutes in the tests.
 */
const TICKS = 3000;
const CHECKPOINT_SECONDS = 300;

let replay: Replay;
/** The straight run's events, without their audience. */
let events: TeamEvent[];
/** Serialized straight-run states, by tick, to compare seeks against. */
const straight = new Map<number, string>();

beforeAll(async () => {
  const run = botReplay(TICKS);
  replay = { ...run.replay, finalHash: await sha256Hex(run.finalJson) };
  events = run.events.map(({ teams, ...event }) => (void teams, event));
  const player = new ReplayPlayer(replay);
  for (const tick of [0, 299, 300, 777, 1200]) {
    player.runTo(tick);
    straight.set(tick, serialize(player.state));
  }
}, 30_000);

describe("sha256Hex", () => {
  test("matches the standard test vectors", async () => {
    expect(await sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("ReplayPlayer", () => {
  test("reaches the logged run's final state", async () => {
    const player = new ReplayPlayer(replay);
    expect(player.runTo(TICKS + 50)).toBe(TICKS);
    expect(player.ended).toBe(true);
    expect(await stateHash(player.state)).toBe(replay.finalHash);
  });

  test("keeps a checkpoint every interval, and stops when told", () => {
    const player = new ReplayPlayer(replay, CHECKPOINT_SECONDS);
    let budget = 700;
    expect(player.runTo(TICKS, () => budget-- > 0)).toBe(700);
    expect(player.tick).toBe(700);
    expect(player.checkpointTicks).toEqual([0, 300, 600]);
  });

  test.each([0, 299, 300, 777])(
    "seeking back to tick %i gives the straight run's state",
    (tick) => {
      const player = new ReplayPlayer(replay, CHECKPOINT_SECONDS);
      player.runTo(1200);
      expect(player.seek(tick)).toBe(true);
      expect(player.tick).toBe(tick - (tick % 300));
      player.runTo(tick);
      expect(serialize(player.state)).toBe(straight.get(tick));
    },
  );

  test("seeking ahead jumps to a checkpoint only when it is closer", () => {
    const player = new ReplayPlayer(replay, CHECKPOINT_SECONDS);
    player.runTo(1200);
    player.seek(100);
    expect(player.tick).toBe(0);
    expect(player.seek(1000)).toBe(true);
    expect(player.tick).toBe(900);
    expect(player.seek(1100)).toBe(false);
    expect(player.tick).toBe(900);
    player.runTo(1200);
    expect(serialize(player.state)).toBe(straight.get(1200));
    // Past the last checkpoint taken, it simulates from where it is.
    expect(player.seek(TICKS)).toBe(false);
  });

  test("a checkpoint is a full copy: the state goes on independently", () => {
    const player = new ReplayPlayer(replay, CHECKPOINT_SECONDS);
    player.runTo(300);
    const first = player.state;
    player.runTo(400);
    player.seek(300);
    expect(player.state).not.toBe(first);
    expect(serialize(player.state)).toBe(straight.get(300));
    expect(serialize(restore(serialize(player.state)))).toBe(straight.get(300));
  });
});

describe("dueTicks", () => {
  test("turns real time into ticks and carries the fraction", () => {
    expect(dueTicks(1, 200, 1, 0)).toEqual({ ticks: 0, carry: 0.2 });
    const next = dueTicks(1, 200, 1, 0.9);
    expect(next.ticks).toBe(1);
    expect(next.carry).toBeCloseTo(0.1);
    expect(dueTicks(60, 1000 / 60, 1, 0).ticks).toBe(1);
    expect(dueTicks(3600, 16, 1, 0).ticks).toBe(57);
    expect(dueTicks(600, 100, 2, 0).ticks).toBe(30);
  });

  test("a stalled frame counts at most MAX_FRAME_MS", () => {
    expect(dueTicks(60, 10_000, 1, 0).ticks).toBe((60 * MAX_FRAME_MS) / 1000);
  });

  test("max has no bound of its own", () => {
    expect(dueTicks("max", 16, 1, 0.5)).toEqual({ ticks: Infinity, carry: 0 });
  });
});

describe("RateMeter", () => {
  test("measures ticks per second over the window", () => {
    const meter = new RateMeter();
    expect(meter.rate(0)).toBeNull();
    for (let at = 0; at <= 500; at += 100) meter.add(at, 50);
    expect(meter.rate(500)).toBe(500);
    meter.reset();
    expect(meter.rate(500)).toBeNull();
  });
});

describe("ReplayController", () => {
  /** Waits for the asynchronous hash (Web Crypto) to settle. */
  const hashed = (controller: ReplayController) =>
    vi.waitFor(() => {
      expect(controller.hash.value.status).not.toBe("computing");
    });

  test("starts with a welcome as a spectator, at tick 0", () => {
    const controller = new ReplayController(replay, 0, () => 0);
    const { store } = controller;
    expect(store.info.value).toMatchObject({ playerId: -1 });
    expect(store.current.value?.state.tick).toBe(0);
    expect(store.canAct.value).toBe(false);
  });

  test("shows the whole world, with no fog (fog spec C-5)", () => {
    const controller = new ReplayController(replay, 0, () => 0);
    const { store } = controller;
    const state = store.current.value!.state;
    expect(state.team).toBe(-1);
    expect(state.known).not.toContain(-1);
    // Both teams whole, cores included, and the map as it is.
    expect(state.teams.every(isOwnTeam)).toBe(true);
    expect(store.cores.value.every((core) => core !== null)).toBe(true);
    const world = createWorld(replay.seed, replay.params);
    expect(store.map.value!.terrain).toEqual(world.map.terrain);
    expect(fogPaths(state.known, state.visible, world.map.width)).toEqual({
      unseen: "",
      remembered: "",
    });
  });

  test("plays at a speed, frame by frame", () => {
    const controller = new ReplayController(replay, 0, () => 0);
    controller.setSpeed(60);
    controller.play();
    controller.frame(1000);
    expect(controller.tick.value).toBe(0);
    controller.frame(1100);
    expect(controller.tick.value).toBe(6);
    expect(controller.store.current.value?.state.tick).toBe(6);
    expect(controller.store.previous.value?.state.tick).toBe(0);
    controller.pause();
    controller.frame(1200);
    expect(controller.tick.value).toBe(6);
  });

  test("at max speed reaches the end and checks the hash", async () => {
    const controller = new ReplayController(replay, 0, () => 0);
    controller.setSpeed("max");
    controller.play();
    controller.frame(0);
    expect(controller.tick.value).toBe(TICKS);
    expect(controller.playing.value).toBe(false);
    expect(controller.hash.value.status).toBe("computing");
    await hashed(controller);
    expect(controller.hash.value).toEqual({
      status: "match",
      hash: replay.finalHash,
    });
  });

  test("a different final hash shows as a mismatch", async () => {
    const controller = new ReplayController(
      { ...replay, finalHash: "0".repeat(64) },
      0,
      () => 0,
    );
    controller.seekTo(TICKS);
    controller.frame(0);
    expect(controller.tick.value).toBe(TICKS);
    await hashed(controller);
    expect(controller.hash.value.status).toBe("mismatch");
  });

  test("seeks back with a fresh welcome; play at the end starts over", async () => {
    const controller = new ReplayController(replay, 0, () => 0);
    controller.seekTo(TICKS);
    expect(controller.seeking.value).toBe(TICKS);
    controller.frame(0);
    await hashed(controller);
    expect(controller.hash.value.status).toBe("match");

    controller.seekTo(777);
    expect(controller.hash.value.status).toBe("waiting");
    controller.frame(16);
    expect(controller.tick.value).toBe(777);
    expect(controller.seeking.value).toBeNull();
    expect(controller.store.previous.value).toBeNull();
    expect(controller.store.current.value?.state.tick).toBe(777);

    controller.seekTo(TICKS);
    controller.frame(32);
    controller.play();
    expect(controller.tick.value).toBe(0);
    expect(controller.playing.value).toBe(true);
  });

  test("keeps every event once, through a seek back (plan section 9)", () => {
    expect(events.length).toBeGreaterThan(0);
    const player = new ReplayPlayer(replay, CHECKPOINT_SECONDS);
    player.runTo(900);
    player.seek(400);
    player.runTo(TICKS);
    expect(player.eventsBetween(0, TICKS)).toEqual(events);
    expect(player.eventsBetween(300, 600)).toEqual(
      events.filter((e) => e.tick >= 300 && e.tick < 600),
    );
  });

  test("shows the chronicle of the whole world as it plays and seeks", () => {
    const controller = new ReplayController(replay, 0, () => 0);
    expect(controller.store.chronicle.value).toEqual([]);
    controller.setSpeed(60);
    controller.play();
    controller.frame(1000);
    controller.frame(1000 + 100_000);
    const tick = controller.tick.value;
    expect(controller.store.chronicle.value).toEqual(
      events.filter((e) => e.tick < tick),
    );
    controller.seekTo(TICKS);
    controller.frame(0);
    expect(controller.store.chronicle.value).toEqual(
      events.slice(-CHRONICLE_KEEP),
    );
    controller.seekTo(777);
    controller.frame(16);
    expect(controller.store.chronicle.value).toEqual(
      events.filter((e) => e.tick < 777).slice(-CHRONICLE_KEEP),
    );
  });

  test("a seek longer than a frame's budget goes on over frames", () => {
    let now = 0;
    // Each check of the clock moves it 1 ms: about 12 ticks per frame.
    const controller = new ReplayController(replay, 0, () => now++);
    controller.seekTo(100);
    controller.frame(now);
    expect(controller.tick.value).toBeGreaterThan(0);
    expect(controller.tick.value).toBeLessThan(100);
    expect(controller.seeking.value).toBe(100);
    for (let i = 0; i < 20 && controller.seeking.value !== null; i++) {
      controller.frame(now);
    }
    expect(controller.tick.value).toBe(100);
  });
});
