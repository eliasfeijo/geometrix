import { describe, expect, test } from "vitest";
import { Store, type PlayerRow } from "../src/persistence.ts";
import { PresenceTracker } from "../src/presence.ts";
import { WorldHost } from "../src/world-host.ts";
import { FakeTimers, testBattleParams, testParams } from "./helpers.ts";

const SECOND = 1000;

/** Ana on team 0, dominating a creep, with her socket open. */
function setup() {
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
      seed: 42,
      params: testParams(),
      battleParams: testBattleParams(),
      multiplier: 1,
      botTeams: [1],
      createdAt: "2026-11-14T00:00:00.000Z",
    },
  );
  const id = store.addPlayer({
    worldId: host.id,
    team: 0,
    name: "Ana",
    tokenHash: "a",
    bot: false,
  });
  const ana: PlayerRow = {
    id,
    worldId: host.id,
    team: 0,
    name: "Ana",
    bot: false,
    difficulty: null,
  };
  host.submit(id, { type: "join", team: 0, bot: false });
  host.tick();
  const timers = new FakeTimers();
  const presence = new PresenceTracker(timers, {
    dominationTimeoutMs: 300 * SECOND,
    reconnectGraceMs: 15 * SECOND,
  });
  presence.connected(ana);
  const creep = host.state.creeps.find((c) => c.team === 0)!;
  presence.input(ana);
  host.submit(id, { type: "dominate", creepId: creep.id });
  host.tick();
  expect(creep.dominatedBy).toBe(id);
  /** Runs the check, then a tick; true if the creep is free after it. */
  const released = () => {
    presence.check(host);
    host.tick();
    return creep.dominatedBy === null;
  };
  return { host, store, timers, presence, ana, released };
}

describe("PresenceTracker", () => {
  test("a reconnect within 15 s keeps the domination", () => {
    const { timers, presence, ana, released } = setup();
    presence.disconnected(ana);
    timers.advance(14 * SECOND);
    expect(released()).toBe(false);
    presence.connected(ana);
    timers.advance(60 * SECOND);
    expect(released()).toBe(false);
  });

  test("15 s disconnected releases, as a logged command of the player", () => {
    const { host, store, timers, presence, ana, released } = setup();
    presence.disconnected(ana);
    timers.advance(15 * SECOND);
    expect(released()).toBe(true);
    const last = store.commandsFrom(host.id, 0).at(-1)!;
    expect(last).toMatchObject({
      playerId: ana.id,
      command: { type: "release" },
    });
  });

  test("a second socket keeps the player connected", () => {
    const { timers, presence, ana, released } = setup();
    presence.connected(ana);
    presence.disconnected(ana);
    timers.advance(60 * SECOND);
    expect(released()).toBe(false);
  });

  test("5 real minutes without input release, any input resets the clock", () => {
    const { timers, presence, ana, released } = setup();
    timers.advance(299 * SECOND);
    expect(released()).toBe(false);
    presence.input(ana);
    timers.advance(299 * SECOND);
    expect(released()).toBe(false);
    timers.advance(SECOND);
    expect(released()).toBe(true);
  });

  test("queues one release, not one per check", () => {
    const { host, timers, presence, ana } = setup();
    timers.advance(300 * SECOND);
    presence.check(host);
    presence.check(host);
    expect(host.queued(ana.id, "release")).toBe(true);
    host.tick();
    const releases = host.state.creeps.filter((c) => c.dominatedBy === ana.id);
    expect(releases).toEqual([]);
  });
});
