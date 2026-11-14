import { diffView, emptySent, viewJson } from "@geometrix/protocol";
import { join, step, view, type WorldState } from "@geometrix/sim";
import { describe, expect, it } from "vitest";
import { duration, durationWords, worldClock } from "../src/format.ts";
import { GameStore, NOTICE_MS } from "../src/store.ts";
import { viewOf, testWorld, welcomeOf } from "./helpers.ts";

function run(world: WorldState, ticks: number): void {
  for (let i = 0; i < ticks; i++) step(world, []);
}

describe("GameStore", () => {
  it("applies deltas to the view, keeping the two latest", () => {
    const world = testWorld();
    const store = new GameStore();
    const sent = emptySent();
    diffView(sent, view(world, 0));
    store.receive(welcomeOf(world), 100);
    expect(store.previous.value).toBeNull();
    expect(store.current.value?.at).toBe(100);

    const delta = (seq: number) => ({
      type: "delta" as const,
      seq,
      delta: JSON.parse(JSON.stringify(diffView(sent, view(world, 0)))),
    });
    run(world, 3);
    store.receive(delta(1), 300);
    run(world, 2);
    store.receive({ ...delta(2), status: "ended" }, 500);
    expect(store.previous.value?.state.tick).toBe(3);
    expect(store.current.value?.state.tick).toBe(5);
    expect(viewJson(store.current.value!.state)).toBe(viewJson(view(world, 0)));
    expect(store.status.value).toBe("ended");

    // What did not change is shared with the previous view.
    const before = store.previous.value!.state;
    const after = store.current.value!.state;
    expect(after.deposits).toBe(before.deposits);
    expect(after).not.toBe(before);

    // A welcome after a reconnect starts over, without interpolation.
    store.receive(welcomeOf(world), 900);
    expect(store.previous.value).toBeNull();
  });

  it("knows the player once the join is in the state", () => {
    const world = testWorld();
    const store = new GameStore();
    store.receive(welcomeOf(world, 1, 0), 0);
    store.connection.value = "open";
    expect(store.me.value).toBeNull();
    expect(store.canAct.value).toBe(false);
    expect(store.missingNames()).toBe(false);

    join(world, 1, 0, false);
    store.show(viewOf(world), 1);
    expect(store.me.value?.team).toBe(0);
    expect(store.canAct.value).toBe(true);
    expect(store.missingNames()).toBe(true);
    store.names.value = new Map([[1, "Ana"]]);
    expect(store.missingNames()).toBe(false);
  });

  it("expires notices", () => {
    const store = new GameStore();
    store.notify("a", 0);
    store.notify("b", NOTICE_MS + 1);
    expect(store.notices.value.map((n) => n.text)).toEqual(["b"]);
  });
});

describe("format", () => {
  it("shows world time by day", () => {
    expect(worldClock(0, 1)).toBe("dia 1 · 00:00");
    expect(worldClock(3 * 3600 + 15 * 60 + 59, 1)).toBe("dia 1 · 03:15");
    expect(worldClock(86_400 + 60, 1)).toBe("dia 2 · 00:01");
  });

  it("shows durations", () => {
    expect(duration(545)).toBe("9:05");
    expect(duration(3723)).toBe("1:02:03");
    expect(duration(-3)).toBe("0:00");
    expect(durationWords(30)).toBe("30 s");
    expect(durationWords(60)).toBe("1 min");
    expect(durationWords(600)).toBe("10 min");
    expect(durationWords(90)).toBe("1:30");
    expect(durationWords(5400)).toBe("1 h 30 min");
    expect(durationWords(7200)).toBe("2 h");
  });
});
