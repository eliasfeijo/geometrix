import { createHash } from "node:crypto";
import { applyDelta, viewJson, type DeltaMessage } from "@geometrix/protocol";
import {
  botCommands,
  botsFor,
  createWorld,
  step,
  validate,
  view,
  type SimEvent,
  type TeamEvent,
  type TeamView,
  type WorldState,
} from "@geometrix/sim";
import { describe, expect, test } from "vitest";
import { TeamStream } from "../src/stream.ts";
import { testParams } from "./helpers.ts";

const bots = botsFor(["balanced", "balanced"]);

function world(): WorldState {
  return createWorld(42, testParams());
}

/** `ticks` ticks of a bot × bot world. */
function run(state: WorldState, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    const accepted = botCommands(state, bots).filter(
      ({ playerId, command }) => validate(state, command, playerId) === null,
    );
    step(state, accepted);
  }
}

const sha256 = (text: string) =>
  createHash("sha256").update(text).digest("hex");

function stream(
  state: WorldState,
  team = 0,
  hashEveryTicks = 60,
  chronicle: readonly TeamEvent[] = [],
  chronicleSize = 100,
) {
  return new TeamStream(
    state,
    team,
    "running",
    { hashEveryTicks, bufferMs: 30_000, chronicleSize },
    chronicle,
    "s",
  );
}

describe("TeamStream", () => {
  test("starts from the view now, then numbers each delta", () => {
    const state = world();
    const s = stream(state, 1);
    const base = s.lastView();
    expect(base.seq).toBe(0);
    expect(viewJson(base.view)).toBe(viewJson(view(state, 1)));
    let seen: TeamView = JSON.parse(JSON.stringify(base.view)) as TeamView;
    for (let seq = 1; seq <= 5; seq++) {
      run(state, 7);
      const message = JSON.parse(
        s.advance(state, "running", 0),
      ) as DeltaMessage;
      expect(message.seq).toBe(seq);
      seen = applyDelta(seen, message.delta);
      expect(viewJson(seen)).toBe(viewJson(view(state, 1)));
    }
    expect(s.seq).toBe(5);
    expect(viewJson(s.lastView().view)).toBe(viewJson(seen));
  });

  test("a view handed out is not changed by later sends", () => {
    const state = world();
    const s = stream(state);
    run(state, 61);
    s.advance(state, "running", 0);
    const handed = s.lastView().view;
    const json = viewJson(handed);
    run(state, 120);
    s.advance(state, "running", 0);
    expect(viewJson(handed)).toBe(json);
  });

  test("hashes the view every N ticks, and once per N when sends skip ticks", () => {
    const state = world();
    const every = stream(state, 0);
    const coarse = stream(state, 1);
    let seen: TeamView = every.lastView().view;
    const hashedAt: number[] = [];
    const coarseAt: number[] = [];
    while (state.tick < 200) {
      run(state, 1);
      const message = JSON.parse(
        every.advance(state, "running", 0),
      ) as DeltaMessage;
      seen = applyDelta(seen, message.delta);
      if (message.hash !== undefined) {
        hashedAt.push(state.tick);
        expect(message.hash).toBe(sha256(viewJson(seen)));
      }
      if (state.tick % 50 === 0) {
        const m = JSON.parse(
          coarse.advance(state, "running", 0),
        ) as DeltaMessage;
        if (m.hash !== undefined) coarseAt.push(state.tick);
      }
    }
    expect(hashedAt).toEqual([60, 120, 180]);
    expect(coarseAt).toEqual([100, 150, 200]);
  });

  test("tells the status only when it changes", () => {
    const state = world();
    const s = stream(state);
    run(state, 1);
    expect(JSON.parse(s.advance(state, "running", 0))).not.toHaveProperty(
      "status",
    );
    run(state, 1);
    expect(JSON.parse(s.advance(state, "ended", 0))).toMatchObject({
      status: "ended",
    });
    expect(s.lastView().status).toBe("ended");
    expect(JSON.parse(s.advance(state, "ended", 0))).not.toHaveProperty(
      "status",
    );
  });

  test("hands the missed deltas to a client resuming within the buffer", () => {
    const state = world();
    const s = stream(state);
    const sent: string[] = [];
    for (let i = 1; i <= 10; i++) {
      run(state, 1);
      sent.push(s.advance(state, "running", i * 10_000));
    }
    // At 100 s, the buffer keeps the deltas of 70 s on: seqs 7 to 10.
    expect(s.since("s", 6)).toEqual(sent.slice(6));
    expect(s.since("s", 9)).toEqual([sent[9]]);
    expect(s.since("s", 10)).toEqual([]);
    expect(s.since("s", 5)).toBeNull();
    expect(s.since("s", 11)).toBeNull();
    expect(s.since("other", 9)).toBeNull();
  });

  test("sends the team's events of the ticks a delta covers, once", () => {
    const state = world();
    const s = stream(state, 1);
    run(state, 1);
    s.record([born(0, 0, [0]), born(0, 1, [0, 1])]);
    run(state, 1);
    s.record([born(1, 0, [1])]);
    const first = JSON.parse(s.advance(state, "running", 0)) as DeltaMessage;
    expect(first.events).toEqual([
      teamEvent(born(0, 1)),
      teamEvent(born(1, 0)),
    ]);
    // The resume buffer holds the delta as sent, events and all.
    expect(s.since("s", 0)).toEqual([JSON.stringify(first)]);
    run(state, 1);
    s.record([born(2, 0, [0])]);
    const second = JSON.parse(s.advance(state, "running", 0)) as DeltaMessage;
    expect(second).not.toHaveProperty("events");
  });

  test("the welcome's chronicle runs up to the last view sent, capped", () => {
    const state = world();
    const before = [teamEvent(born(0, 0)), teamEvent(born(0, 1))];
    const s = stream(state, 0, 60, before, 3);
    expect(s.lastView().chronicle).toEqual(before);
    run(state, 1);
    s.record([born(1, 0, [0]), born(1, 1, [0])]);
    // Recorded but not sent: the next delta has them, the welcome not yet.
    expect(s.lastView().chronicle).toEqual(before);
    s.advance(state, "running", 0);
    expect(s.lastView().chronicle).toEqual([
      teamEvent(born(0, 1)),
      teamEvent(born(1, 0)),
      teamEvent(born(1, 1)),
    ]);
    // A chronicle longer than the cap keeps the newest.
    const long = stream(state, 0, 60, [...before, ...before], 3);
    expect(long.lastView().chronicle).toEqual([before[1], ...before]);
  });
});

/** A birth on tick `tick`, the `index`-th event of the tick. */
function born(tick: number, index: number, teams: number[] = [0]): SimEvent {
  return {
    type: "born",
    creep: {
      id: 100 + tick * 10 + index,
      team: 0,
      dna: "circle",
      name: "Ada",
    },
    x: 1,
    y: 2,
    tick,
    index,
    teams,
  };
}

function teamEvent(event: SimEvent): TeamEvent {
  const copy: Partial<SimEvent> = { ...event };
  delete copy.teams;
  return copy as TeamEvent;
}
