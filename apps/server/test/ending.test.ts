// The end of the world on the server (E-min plan section 6): the sim decides
// it, the host stops on it, the lobby and the replay show it and a restart
// keeps it frozen. The vote of a team with two humans goes through the host.

import { parseReplay, type WorldSummary } from "@geometrix/protocol";
import {
  createWorld,
  endSummary,
  eventsFor,
  serialize,
  step,
  type CommandInput,
  type SimEvent,
} from "@geometrix/sim";
import { afterEach, describe, expect, test } from "vitest";
import { stateHash } from "../src/hash.ts";
import { Store } from "../src/persistence.ts";
import { WorldHost, type HostContext } from "../src/world-host.ts";
import {
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

let close: (() => Promise<void>) | null = null;
afterEach(async () => {
  await close?.();
  close = null;
});

function newWorld(store: Store, botTeams: number[], params = testParams()) {
  const context: HostContext = { store, config };
  return WorldHost.create(context, {
    seed: 42,
    params,
    battleParams: testBattleParams(),
    multiplier: 1,
    botTeams,
    createdAt: "2026-11-27T00:00:00.000Z",
  });
}

/** A human player stored and joined on `team`. */
function human(store: Store, host: WorldHost, team: number, name: string) {
  const id = store.addPlayer({
    worldId: host.id,
    team,
    name,
    tokenHash: name,
    bot: false,
  });
  expect(host.submit(id, { type: "join", team, bot: false })).toBeNull();
  return id;
}

const botOf = (store: Store, host: WorldHost, team: number) =>
  store.players(host.id).find((p) => p.bot && p.team === team)!.id;

describe("the world ends by the sim (E-min P1, P8)", () => {
  // A concession while a battle is open: its instance is left as it is.
  const first = firstTeamBattle();

  function concedeInBattle(store: Store) {
    const host = newWorld(store, [0, 1]);
    while (host.state.tick < first.openedTick + 2) host.tick();
    expect(host.junction.instances.length).toBeGreaterThan(0);
    expect(host.submit(botOf(store, host, 1), { type: "concede" })).toBeNull();
    host.tick();
    return host;
  }

  test("the host stops there; the world is frozen on both clocks", () => {
    const store = new Store(":memory:");
    const host = concedeInBattle(store);
    expect(host.state.result).toMatchObject({ how: "lastTeam", winner: 0 });
    expect(host.status).toBe("ended");
    expect(store.world(host.id)!.status).toBe("ended");
    expect(store.latestSnapshot(host.id)!.tick).toBe(host.state.tick);
    const frozen = serialize(host.state);
    const battles = host.junction.instances.map((i) => i.state.tick);
    expect(battles.length).toBeGreaterThan(0);
    // Even a battle on the real pace is not stepped.
    for (const instance of host.junction.instances) instance.pace = "real";
    host.tick();
    host.realtimeTick();
    expect(serialize(host.state)).toBe(frozen);
    expect(host.junction.instances.map((i) => i.state.tick)).toEqual(battles);
    expect(host.submit(botOf(store, host, 0), { type: "stopRepeat" })).toBe(
      "worldEnded",
    );
  }, 30_000);

  test("a restart keeps it ended, with the same result and no instances", () => {
    const store = new Store(":memory:");
    const host = concedeInBattle(store);
    const recovered = WorldHost.recover(
      { store, config },
      store.world(host.id)!,
      testBattleParams(),
    );
    expect(recovered.status).toBe("ended");
    expect(recovered.state.battles.length).toBeGreaterThan(0);
    expect(recovered.junction.instances).toEqual([]);
    expect(endSummary(recovered.state)).toEqual(endSummary(host.state));
    expect(stateHash(recovered.state)).toBe(stateHash(host.state));
    expect(() => recovered.tick()).not.toThrow();
  }, 30_000);

  test("the lobby has the result and the export reaches it", async () => {
    const t = await testApp({}, undefined, testParams());
    close = t.app.close;
    await t.post("/api/worlds", { seed: 42, botTeams: [0] });
    const joined = await t.post("/api/worlds/1/join", { name: "Ana", team: 1 });
    const { playerId } = joined.body as { playerId: number };
    const host = t.app.worlds.get(1)!;
    for (let i = 0; i < 200; i++) host.tick();
    const list = async () =>
      (await (await t.get("/api/worlds")).res.json()) as WorldSummary[];
    expect((await list())[0]!.result).toBeNull();
    expect(host.submit(playerId, { type: "concede" })).toBeNull();
    host.tick();
    expect((await list())[0]!).toMatchObject({
      status: "ended",
      result: { how: "lastTeam", winner: 0, teams: [0] },
    });

    const res = await t.get("/api/worlds/1/replay");
    const replay = parseReplay(await res.res.json());
    const state = createWorld(replay.seed, replay.params);
    let at = 0;
    while (state.tick < replay.ticks) {
      const commands: CommandInput[] = [];
      while (replay.commands[at]?.tick === state.tick) {
        const { playerId: id, command } = replay.commands[at++]!;
        commands.push({ playerId: id, command });
      }
      step(state, commands);
    }
    expect(stateHash(state)).toBe(replay.finalHash);
    expect(state.result).toEqual(host.state.result);
    expect(endSummary(state)).toEqual(endSummary(host.state));
  });
});

describe("the vote to concede through the host (L-6, L-7)", () => {
  test("opens, is rejected, waits, opens again and passes", () => {
    const store = new Store(":memory:");
    const host = newWorld(store, [1]);
    const ana = human(store, host, 0, "ana");
    const bia = human(store, host, 0, "bia");
    host.tick();
    const events: SimEvent[] = [];
    host.onTick((tick) => events.push(...tick));
    expect(host.submit(bia, { type: "rejectConcede" })).toBe("noVote");
    expect(host.submit(ana, { type: "concede" })).toBeNull();
    host.tick();
    expect(host.state.teams[0]!.vote).toMatchObject({ yes: [ana] });
    expect(host.submit(ana, { type: "concede" })).toBe("alreadyVoted");
    expect(host.submit(bia, { type: "rejectConcede" })).toBeNull();
    host.tick();
    expect(host.state.teams[0]!.vote).toBeNull();
    expect(host.submit(ana, { type: "concede" })).toBe("voteCooldown");

    const { concedeRetrySeconds } = host.state.params.end;
    const wait = concedeRetrySeconds / host.state.params.world.tickSeconds;
    for (let i = 0; i < wait; i++) host.tick();
    expect(host.submit(ana, { type: "concede" })).toBeNull();
    host.tick();
    expect(host.submit(bia, { type: "concede" })).toBeNull();
    host.tick();
    expect(host.status).toBe("ended");
    expect(host.state.result).toMatchObject({ winner: 1 });

    const seen = (team: number) =>
      eventsFor(events, team)
        .map((e) => e.type)
        .filter((type) => type.startsWith("concedeVote"));
    expect(seen(0)).toEqual([
      "concedeVoteOpened",
      "concedeVoteClosed",
      "concedeVoteOpened",
      "concedeVoteClosed",
    ]);
    expect(seen(1)).toEqual([]);
  });
});
