import { join } from "@geometrix/sim";
import { describe, expect, it } from "vitest";
import { duration, worldClock } from "../src/format.ts";
import { GameStore, NOTICE_MS } from "../src/store.ts";
import { dynamicOf, testWorld, welcomeOf } from "./helpers.ts";

describe("GameStore", () => {
  it("keeps the two latest states, dropping late ones", () => {
    const world = testWorld();
    const store = new GameStore();
    store.receive(welcomeOf(world), 100);
    expect(store.previous.value).toBeNull();
    expect(store.current.value?.at).toBe(100);

    const at = (tick: number) => ({ ...dynamicOf(world), tick });
    store.receive({ type: "state", state: at(3), status: "running" }, 300);
    store.receive({ type: "state", state: at(5), status: "ended" }, 500);
    expect(store.previous.value?.state.tick).toBe(3);
    expect(store.current.value?.state.tick).toBe(5);
    expect(store.status.value).toBe("ended");

    store.receive({ type: "state", state: at(4), status: "running" }, 600);
    expect(store.current.value?.state.tick).toBe(5);

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
    store.receive(
      { type: "state", state: dynamicOf(world), status: "running" },
      1,
    );
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
  });
});
