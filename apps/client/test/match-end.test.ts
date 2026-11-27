// "Desistir" and the result as the client reads them (E-min S-1, S-4, S-5;
// L-5 to L-7), and the read-only store of an ended world and of a team out.

import {
  endSummary,
  parseParams,
  step,
  view,
  createWorld,
  type TeamView,
  type WorldState,
} from "@geometrix/sim";
import { describe, expect, test } from "vitest";
import params from "../../../packages/sim/test/params.json" with { type: "json" };
import { BattleControl, type BattleLink } from "../src/battle-control.ts";
import {
  concession,
  endHow,
  lobbyResult,
  realSeconds,
  resultHeadline,
  teamList,
} from "../src/match-end.ts";
import { GameStore } from "../src/store.ts";
import { testWorld, viewOf, welcomeOf } from "./helpers.ts";

/** Concession after 100 world s, a 40 s vote, 60 s of wait; ×10. */
const timed = () => {
  const p = parseParams({
    ...params,
    end: {
      ...params.end,
      concedeAfterSeconds: 100,
      concedeVoteSeconds: 40,
      concedeRetrySeconds: 60,
    },
  });
  return createWorld(42, p);
};
const MULTIPLIER = 10;

/** A world with `humans` humans on team 0 and one on team 1. */
function joined(humans: number): WorldState {
  const world = timed();
  step(world, [
    ...Array.from({ length: humans }, (_, i) => ({
      playerId: 1 + i,
      command: { type: "join" as const, team: 0, bot: false },
    })),
    { playerId: 8, command: { type: "join", team: 1, bot: false } },
  ]);
  return world;
}

const statusOf = (world: WorldState, playerId = 1, seen = viewOf(world)) =>
  concession(seen, playerId, world.params, MULTIPLIER);

const run = (world: WorldState, ticks: number) => {
  for (let i = 0; i < ticks; i++) step(world, []);
};

describe("Desistir and the vote (L-5 to L-7, S-5)", () => {
  test("counts down in real seconds to the minimum time", () => {
    const world = joined(1);
    const status = statusOf(world);
    expect(status.kind).toBe("tooEarly");
    const seconds = 100 - (world.tick + 1) * world.params.world.tickSeconds;
    expect(status).toEqual({
      kind: "tooEarly",
      seconds: realSeconds(seconds, MULTIPLIER),
    });
    // The first tick the button is ready is one the sim accepts.
    while (statusOf(world).kind === "tooEarly") run(world, 1);
    step(world, [{ playerId: 1, command: { type: "concede" } }]);
    expect(world.teams[0]!.out).not.toBeNull();
  });

  test("a single human concedes at once, two or more open a vote", () => {
    const one = joined(1);
    run(one, 200);
    expect(statusOf(one)).toEqual({ kind: "ready", opensVote: false });
    const two = joined(2);
    run(two, 200);
    expect(statusOf(two)).toEqual({ kind: "ready", opensVote: true });
  });

  test("shows the vote, who said yes and the real time left", () => {
    const world = joined(2);
    run(world, 200);
    step(world, [{ playerId: 1, command: { type: "concede" } }]);
    const mine = statusOf(world, 1);
    expect(mine).toMatchObject({ kind: "vote", yes: [1], mine: true });
    expect(statusOf(world, 2)).toMatchObject({ kind: "vote", mine: false });
    // The team passes it at the end of the tick the countdown reaches 0.
    let last = mine;
    while (world.teams[0]!.out === null) {
      last = statusOf(world);
      run(world, 1);
    }
    expect(last).toMatchObject({ kind: "vote" });
    expect(last.kind === "vote" && last.seconds).toBeLessThanOrEqual(1);
  });

  test("a rejected vote waits before another", () => {
    const world = joined(2);
    run(world, 200);
    step(world, [{ playerId: 1, command: { type: "concede" } }]);
    step(world, [{ playerId: 2, command: { type: "rejectConcede" } }]);
    expect(statusOf(world)).toMatchObject({ kind: "cooldown" });
    while (statusOf(world).kind === "cooldown") run(world, 1);
    step(world, [{ playerId: 1, command: { type: "concede" } }]);
    expect(world.teams[0]!.vote).not.toBeNull();
  });

  test("is hidden for a spectator, a team out and an ended world", () => {
    const world = joined(1);
    run(world, 200);
    expect(statusOf(world, -1).kind).toBe("hidden");
    const out: TeamView = viewOf(world);
    Object.assign(out.teams[0]!, {
      out: { tick: 1, how: "conceded", bot: false },
    });
    expect(statusOf(world, 1, out).kind).toBe("hidden");
    const ended = viewOf(world);
    ended.result = { tick: 1, how: "clock", winner: null, teams: [0, 1] };
    expect(statusOf(world, 1, ended).kind).toBe("hidden");
  });
});

/** A world in which `team`'s player conceded and the other team won. */
function conceded(team = 1, bot = false): WorldState {
  const world = testWorld();
  step(world, [{ playerId: 5, command: { type: "join", team, bot } }]);
  step(world, [{ playerId: 5, command: { type: "concede" } }]);
  expect(world.result).not.toBeNull();
  return world;
}

describe("the result's texts (D9, S-4)", () => {
  test("names the winner or the draw, for any number of teams", () => {
    expect(resultHeadline({ winner: 0, teams: [0] })).toBe("Azul venceu");
    expect(resultHeadline({ winner: null, teams: [0, 1] })).toBe(
      "Empate entre Azul e Laranja",
    );
    expect(teamList([0, 1, 2])).toBe("Azul, Laranja e Time 2");
    expect(lobbyResult({ winner: 1 })).toBe("Laranja venceu");
    expect(lobbyResult({ winner: null })).toBe("Empate");
  });

  test("says how the world ended", () => {
    expect(endHow(endSummary(conceded())!)).toBe("Laranja desistiu");
    expect(endHow(endSummary(conceded(1, true))!)).toBe(
      "o bot de Laranja desistiu",
    );
    const clock = endSummary(conceded())!;
    clock.result = { ...clock.result, how: "clock" };
    expect(endHow(clock)).toBe("o tempo acabou");
  });
});

class Link implements BattleLink {
  calls: (number | null)[] = [];
  battleScreen(battleId: number | null) {
    this.calls.push(battleId);
    return Promise.resolve({ ok: true as const, tick: 0 });
  }
  battleInput() {
    return Promise.resolve({ ok: true as const, tick: 0 });
  }
  battlePause() {
    return Promise.resolve({ ok: true as const, tick: 0 });
  }
}

describe("an ended world and a team out are read-only (D6, D7)", () => {
  const storeOf = (world: WorldState, team = 0) => {
    const store = new GameStore();
    store.connection.value = "open";
    store.receive(welcomeOf(world, 1, team), 0);
    return store;
  };

  test("a team out is a spectator: it cannot act", () => {
    const world = joined(1);
    const store = storeOf(world);
    expect(store.canAct.value).toBe(true);
    const seen = viewOf(world);
    Object.assign(seen.teams[0]!, {
      out: { tick: 1, how: "conceded", bot: false },
    });
    store.show(seen, 1);
    expect(store.teamOut.value).toBe(true);
    expect(store.canAct.value).toBe(false);
  });

  test("the summary reaches the client with the result", () => {
    const world = conceded();
    const store = storeOf(world);
    expect(store.result.value).toEqual(world.result);
    expect(store.canAct.value).toBe(false);
    expect(view(world, 0).summary).toEqual(endSummary(world));
  });

  test("the battle screen closes and does not open again", () => {
    const store = new GameStore();
    const link = new Link();
    const control = new BattleControl(store, link, () => 0);
    control.open(7);
    store.receive(welcomeOf(conceded()), 0);
    control.worldEnded();
    expect(store.shownBattle.value).toBeNull();
    control.follow({ id: 1, battle: 7 });
    control.open(7);
    expect(store.shownBattle.value).toBeNull();
    expect(link.calls).toEqual([7, null]);
    expect(store.notices.value).toHaveLength(1);
  });
});
