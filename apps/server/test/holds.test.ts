// The holds of a battle (M2 R spec D6, D28, OC-1..OC-6, BP-1..BP-4; plan
// section 6): the opening pause with a human connected, P and its countdowns,
// the release when no human is left, a restart during a hold, and the
// messages over the WebSocket. As in battle-screen.test.ts, on seed 42 of the
// test params with a bot on each team and a human each (Ana and Bia), each
// test recovers the world from a snapshot just before the first battle
// between the teams opens.

import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { replayLog } from "@geometrix/battle";
import type { BattleHoldMessage, ServerMessage } from "@geometrix/protocol";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { WebSocket } from "ws";
import { battleHash } from "../src/hash.ts";
import { Holds } from "../src/holds.ts";
import { hashToken } from "../src/http.ts";
import { Store } from "../src/persistence.ts";
import { WorldHost } from "../src/world-host.ts";
import {
  FakeTimers,
  firstTeamBattle,
  testApp,
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
const { openingMs, countdownMs } = testParams().battle.hold;

let saved = "";
let ana = 0;
let bia = 0;

beforeAll(() => {
  saved = join(mkdtempSync(join(tmpdir(), "geo-hold-")), "geo.db");
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
  const human = (team: number, name: string) =>
    store.addPlayer({
      worldId: host.id,
      team,
      name,
      tokenHash: hashToken(name),
      bot: false,
    });
  ana = human(0, "Ana");
  bia = human(1, "Bia");
  host.submit(ana, { type: "join", team: 0, bot: false });
  host.submit(bia, { type: "join", team: 1, bot: false });
  while (host.state.tick < first.openedTick) host.tick();
  host.snapshot();
  store.close();
}, 60_000);

const copyOfSaved = () => {
  const file = join(mkdtempSync(join(tmpdir(), "geo-hold-")), "geo.db");
  copyFileSync(saved, file);
  return file;
};

/**
 * The world just before the battle opens, with its holds; `connected` are
 * the players with a socket open (Ana, unless the test says otherwise).
 */
function world(connected: () => number[] = () => [ana]) {
  const file = copyOfSaved();
  const store = new Store(file);
  const host = WorldHost.recover(
    { store, config },
    store.world(1)!,
    testBattleParams(),
  );
  const timers = new FakeTimers();
  const holds = new Holds(host, timers, (id) => connected().includes(id));
  const told: BattleHoldMessage[] = [];
  holds.onChange((message) => {
    if (message.battleId === BATTLE) told.push(message);
  });
  const instance = () =>
    host.junction.instances.find((i) => i.battleId === BATTLE)!;
  return { file, store, host, timers, holds, told, instance };
}

const hold = (
  state: BattleHoldMessage["state"],
  remainingMs: number | null,
) => ({
  type: "battleHold",
  battleId: BATTLE,
  state,
  remainingMs,
});

/** The battle opened and Ana in it, in real time on its screen. */
function playing() {
  const w = world(() => []);
  w.host.tick();
  w.host.submit(ana, { type: "dominate", creepId: ARROW });
  w.host.tick();
  const viewer = {};
  w.host.openScreen(viewer, { id: ana, team: 0 }, BATTLE);
  w.host.tick();
  expect(w.instance().pace).toBe("real");
  return { ...w, viewer };
}

/** The stored battle's log, replayed, ends in its stored final hash. */
function logAgrees(store: Store) {
  const row = store.battle(1, BATTLE)!;
  expect(row.endedTick).not.toBeNull();
  const replayed = replayLog({
    battleVersion: row.battleVersion,
    setup: row.setup,
    params: row.params,
    ticks: row.reachedTick,
    commands: store.battleTicks(1, BATTLE),
    finalHash: null,
  });
  expect(battleHash(replayed)).toBe(row.finalHash);
}

/** Ticks until the battle ends, on the world clock and in real time. */
function toTheEnd(host: WorldHost) {
  for (
    let i = 0;
    i < 600 && host.state.battles.some((b) => b.id === BATTLE);
    i++
  ) {
    for (let j = 0; j < 20; j++) host.realtimeTick();
    host.tick();
  }
  expect(host.state.battles.some((b) => b.id === BATTLE)).toBe(false);
}

describe("the opening hold (D6, OC-1..OC-4)", () => {
  test("a battle with a connected human is held, then runs", () => {
    const { host, timers, told, instance } = world();
    host.tick();
    expect(told).toEqual([hold("opening", openingMs)]);
    expect(instance().pace).toBe("held");
    for (let i = 0; i < 3; i++) host.tick();
    host.realtimeTick();
    expect(instance().state.tick).toBe(0);
    timers.advance(openingMs - 1);
    expect(instance().pace).toBe("held");
    timers.advance(1);
    expect(told.at(-1)).toEqual(hold(null, null));
    expect(instance().pace).toBe("world");
    host.tick();
    expect(instance().state.tick).toBe(20);
  });

  test("with no human of a team in it connected, it does not wait", () => {
    const { host, told, instance } = world(() => [99]);
    host.tick();
    expect(told).toEqual([]);
    expect(instance().pace).toBe("world");
    host.tick();
    expect(instance().state.tick).toBe(20);
  });

  test("entering during the hold: the battle starts in real time with the latest intent, and both logs agree", () => {
    const { store, host, timers, instance } = world();
    host.tick();
    host.submit(ana, { type: "dominate", creepId: ARROW });
    const viewer = {};
    host.openScreen(viewer, { id: ana, team: 0 }, BATTLE);
    host.tick();
    expect(instance().pace).toBe("held");
    const me = instance().members.find((m) => m.creep === ARROW)!.participant;
    const intent = (move: "up" | "left" | null) =>
      ({ type: "intent", id: me, move, attack: false }) as const;
    for (const move of ["up", "left"] as const) {
      expect(host.battleInput(ana, BATTLE, intent(move))).toBeNull();
    }
    // A one-shot pressed in the pause is not kept.
    expect(
      host.battleInput(ana, BATTLE, { type: "attackOnce", id: me }),
    ).toBeNull();
    host.tick(); // the world tick keeps a held battle's inputs
    timers.advance(openingMs);
    expect(instance().pace).toBe("real");
    host.realtimeTick();
    const sent = instance().log.commands[0]!.commands as { type: string }[];
    // An ally who joined while it was held is placed on the same tick.
    expect(sent[0]!.type).toBe("control");
    expect(sent.filter((c) => c.type === "intent")).toHaveLength(1);
    expect(sent.some((c) => c.type === "attackOnce")).toBe(false);
    expect(
      instance().state.participants.find((p) => p.id === me)!.intent.move,
    ).toBe("left");
    host.closeScreen(viewer);
    toTheEnd(host);
    logAgrees(store);
  }, 30_000);

  test("only the opening holds: a join does not (OC-5)", () => {
    const store = new Store(":memory:");
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
    for (const team of [0, 1]) {
      const id = store.addPlayer({
        worldId: host.id,
        team,
        name: `h${team}`,
        tokenHash: `h${team}`,
        bot: false,
      });
      host.submit(id, { type: "join", team, bot: false });
    }
    const timers = new FakeTimers();
    const held: number[] = [];
    let opened: number[] = [];
    let joined: number[] = [];
    const holds = new Holds(host, timers, () => true);
    host.onTick((events) => {
      opened = events.flatMap((e) =>
        e.type === "battleOpened" ? [e.battle] : [],
      );
      joined = events.flatMap((e) =>
        e.type === "battleJoined" ? [e.battle] : [],
      );
    });
    holds.onChange((m) => {
      if (m.state === "opening") held.push(m.battleId);
    });
    let joins = 0;
    while (joins === 0 && host.state.tick < 20_000) {
      held.length = 0;
      host.tick();
      // Held: exactly the battles that opened on this tick.
      expect(held).toEqual(opened);
      joins += joined.filter((id) => !opened.includes(id)).length;
      timers.advance(openingMs);
    }
    expect(joins).toBeGreaterThan(0);
  }, 60_000);
});

describe("P (D28, BP-1..BP-3)", () => {
  test("pauses after the countdown and resumes after another", () => {
    const { host, holds, timers, told, instance } = playing();
    expect(holds.request(ana, BATTLE)).toBeNull();
    expect(told).toEqual([hold("pausing", countdownMs)]);
    expect(holds.request(ana, BATTLE)).toBe("countingDown");
    const before = instance().state.tick;
    host.realtimeTick(); // still running during the countdown
    expect(instance().state.tick).toBe(before + 1);
    timers.advance(countdownMs);
    expect(told.at(-1)).toEqual(hold("paused", null));
    host.realtimeTick();
    host.tick();
    expect(instance().state.tick).toBe(before + 1);
    expect(holds.current(1)).toEqual([hold("paused", null)]);

    expect(holds.request(ana, BATTLE)).toBeNull();
    expect(told.at(-1)).toEqual(hold("resuming", countdownMs));
    timers.advance(1_000);
    expect(holds.current(0)).toEqual([hold("resuming", countdownMs - 1_000)]);
    expect(holds.request(ana, BATTLE)).toBe("countingDown");
    host.realtimeTick();
    expect(instance().state.tick).toBe(before + 1);
    timers.advance(countdownMs - 1_000);
    expect(told.at(-1)).toEqual(hold(null, null));
    expect(holds.current(0)).toEqual([]);
    host.realtimeTick();
    expect(instance().state.tick).toBe(before + 2);
  });

  test("a player who controls nobody in it changes nothing", () => {
    const { holds, told, host, viewer } = playing();
    host.openScreen({}, { id: bia, team: 1 }, BATTLE); // a watcher
    expect(holds.request(bia, BATTLE)).toBe("notControlling");
    expect(holds.request(ana, 9_999)).toBe("unknownBattle");
    host.closeScreen(viewer); // dominating, but not on the screen
    expect(holds.request(ana, BATTLE)).toBe("notControlling");
    expect(told).toEqual([]);
  });

  test("P during the opening hold is a countdown", () => {
    const { host, holds, told } = world();
    host.tick();
    host.submit(ana, { type: "dominate", creepId: ARROW });
    host.openScreen({}, { id: ana, team: 0 }, BATTLE);
    host.tick();
    expect(holds.request(ana, BATTLE)).toBe("countingDown");
    expect(told).toEqual([hold("opening", openingMs)]);
  });

  test("when the human leaves a paused battle, it resumes by itself on the world clock (BP-4)", () => {
    const { holds, timers, told, host, viewer, instance } = playing();
    holds.request(ana, BATTLE);
    timers.advance(countdownMs);
    host.closeScreen(viewer);
    expect(told.at(-1)).toEqual(hold("resuming", countdownMs));
    expect(instance().pace).toBe("held");
    timers.advance(countdownMs);
    expect(instance().pace).toBe("world");
    const tick = instance().state.tick;
    host.tick();
    expect(instance().state.tick).toBe(tick + 20);
  });

  test("releasing the creep resumes a paused battle at the next world tick", () => {
    const { holds, timers, told, host } = playing();
    holds.request(ana, BATTLE);
    timers.advance(countdownMs);
    host.submit(ana, { type: "release" });
    host.tick();
    expect(told.at(-1)).toEqual(hold("resuming", countdownMs));
  });

  test("the human gone during the countdown: paused, then resumed", () => {
    const { holds, timers, told, host, viewer } = playing();
    holds.request(ana, BATTLE);
    host.closeScreen(viewer);
    timers.advance(countdownMs);
    expect(told.map((m) => m.state)).toEqual(["pausing", "paused", "resuming"]);
  });

  test("stop drops every countdown", () => {
    const { holds, timers, told, instance } = playing();
    holds.request(ana, BATTLE);
    holds.stop();
    timers.advance(countdownMs);
    expect(told).toHaveLength(1);
    expect(instance().pace).toBe("real");
  });
});

describe("a restart during a hold (OC-6, BP-4)", () => {
  test.each(["opening", "paused"] as const)(
    "from %s: the battle goes on with the world clock, and both logs agree",
    (state) => {
      const w = state === "opening" ? world() : playing();
      if (state === "opening") w.host.tick();
      else {
        w.holds.request(ana, BATTLE);
        w.timers.advance(countdownMs);
      }
      w.host.tick(); // stored while held
      const battleTick = w.instance().state.tick;
      w.holds.stop();
      w.store.close(); // the crash

      const again = new Store(w.file);
      const back = WorldHost.recover(
        { store: again, config },
        again.world(1)!,
        testBattleParams(),
      );
      const rebuilt = back.junction.instances.find(
        (i) => i.battleId === BATTLE,
      )!;
      expect(rebuilt.pace).toBe("world");
      expect(back.junction.holds).toEqual([]);
      expect(rebuilt.state.tick).toBe(battleTick);
      toTheEnd(back);
      logAgrees(again);
    },
    60_000,
  );
});

describe("over the WebSocket", () => {
  let close: (() => Promise<void>) | null = null;
  afterEach(async () => {
    await close?.();
    close = null;
  });

  async function connect(base: string, token: string) {
    const socket = new WebSocket(
      `${base.replace("http", "ws")}/ws?token=${token}`,
    );
    const messages: ServerMessage[] = [];
    const waiters: (() => void)[] = [];
    socket.on("message", (data) => {
      messages.push(JSON.parse(data.toString()) as ServerMessage);
      for (const w of waiters.splice(0)) w();
    });
    const next = async <T extends ServerMessage["type"]>(type: T, from = 0) => {
      for (;;) {
        const found = messages.slice(from).find((m) => m.type === type);
        if (found) return found as Extract<ServerMessage, { type: T }>;
        await new Promise<void>((done) => waiters.push(done));
      }
    };
    await next("welcome");
    const send = (body: unknown) => socket.send(JSON.stringify(body));
    return { socket, messages, next, send };
  }

  test("a connected human gets the opening hold, a late socket too; P from a watcher is rejected", async () => {
    const t = await testApp({}, new Store(copyOfSaved()));
    close = t.app.close;
    const host = t.app.worlds.get(1)!;
    const client = await connect(t.base, "Ana");
    host.tick();
    expect(await client.next("battleHold")).toEqual(hold("opening", openingMs));
    const late = await connect(t.base, "Bia");
    expect(await late.next("battleHold")).toEqual(hold("opening", openingMs));
    late.send({ type: "battlePause", ref: 3, battleId: BATTLE });
    expect(await late.next("reject")).toEqual({
      type: "reject",
      ref: 3,
      reason: "notControlling",
    });
    t.app.worlds.holds(1)!.stop();
    client.socket.close();
    late.socket.close();
  });
});
