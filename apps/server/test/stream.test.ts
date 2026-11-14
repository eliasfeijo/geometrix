import { createHash } from "node:crypto";
import { applyDelta, viewJson, type DeltaMessage } from "@geometrix/protocol";
import {
  botCommands,
  botsFor,
  createWorld,
  step,
  validate,
  view,
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

function stream(state: WorldState, team = 0, hashEveryTicks = 60) {
  return new TeamStream(state, team, "running", { hashEveryTicks }, "s");
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
      const message = JSON.parse(s.advance(state, "running")) as DeltaMessage;
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
    s.advance(state, "running");
    const handed = s.lastView().view;
    const json = viewJson(handed);
    run(state, 120);
    s.advance(state, "running");
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
        every.advance(state, "running"),
      ) as DeltaMessage;
      seen = applyDelta(seen, message.delta);
      if (message.hash !== undefined) {
        hashedAt.push(state.tick);
        expect(message.hash).toBe(sha256(viewJson(seen)));
      }
      if (state.tick % 50 === 0) {
        const m = JSON.parse(coarse.advance(state, "running")) as DeltaMessage;
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
    expect(JSON.parse(s.advance(state, "running"))).not.toHaveProperty(
      "status",
    );
    run(state, 1);
    expect(JSON.parse(s.advance(state, "ended"))).toMatchObject({
      status: "ended",
    });
    expect(s.lastView().status).toBe("ended");
    expect(JSON.parse(s.advance(state, "ended"))).not.toHaveProperty("status");
  });
});
