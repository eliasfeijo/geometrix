import { dominate, join, orderRefusal, step } from "@geometrix/sim";
import { describe, expect, it } from "vitest";
import { orderAt } from "../src/map/pick.ts";
import { GameStore } from "../src/store.ts";
import { order, toggleRoadMode } from "../src/interaction.ts";
import { viewOf, testWorld, welcomeOf } from "./helpers.ts";

describe("orderAt", () => {
  const deposits = [{ id: 4, kind: "cristal" as const, amount: 0, x: 2, y: 2 }];
  const core = { x: 10, y: 10 };

  it("gathers at a deposit, delivers at the own core, moves elsewhere", () => {
    expect(orderAt({ x: 2.9, y: 2.1 }, deposits, core, false)).toEqual({
      type: "gather",
      depositId: 4,
    });
    expect(orderAt({ x: 11.2, y: 10.5 }, deposits, core, false)).toEqual({
      type: "deliver",
    });
    expect(orderAt({ x: 5.5, y: 7.2 }, deposits, core, false)).toEqual({
      type: "moveTo",
      x: 5,
      y: 7,
    });
  });

  it("builds road anywhere in road mode", () => {
    expect(orderAt({ x: 2.5, y: 2.5 }, deposits, core, true)).toEqual({
      type: "buildRoad",
      x: 2,
      y: 2,
    });
  });

  it("gives orders the sim accepts", () => {
    const world = testWorld();
    join(world, 50, 0, false);
    const creep = world.creeps.find((c) => c.team === 0)!;
    dominate(world, 50, creep.id);
    const core = world.teams[0]!.core;
    const deposit = world.deposits[0]!;
    for (const point of [
      { x: deposit.x + 0.5, y: deposit.y + 0.5 },
      { x: core.x + 0.5, y: core.y + 0.5 },
      { x: core.x + 3.5, y: core.y + 3.5 },
    ]) {
      for (const road of [false, true]) {
        const input = orderAt(point, world.deposits, core, road);
        expect(orderRefusal(world, 50, creep.id, input)).toBeNull();
      }
    }
  });
});

describe("right click", () => {
  function connected() {
    const world = testWorld();
    join(world, 7, 0, false);
    const store = new GameStore();
    store.receive(welcomeOf(world, 7, 0), 0);
    store.connection.value = "open";
    const sent: unknown[] = [];
    const send = async (command: unknown) => {
      sent.push(command);
      return true;
    };
    return { world, store, sent, send };
  }

  it("asks to dominate first", () => {
    const { store, sent, send } = connected();
    order(store, { x: 3, y: 3 }, send, 0);
    expect(sent).toEqual([]);
    expect(store.notices.value).toHaveLength(1);
  });

  it("orders the dominated creep, and road mode lasts one order", () => {
    const { world, store, sent, send } = connected();
    const creep = world.creeps.find((c) => c.team === 0)!;
    dominate(world, 7, creep.id);
    step(world, []);
    store.show(viewOf(world), 1);
    toggleRoadMode(store);
    expect(store.mode.value.type).toBe("road");
    order(store, { x: 3.5, y: 4.5 }, send, 1);
    order(store, { x: 3.5, y: 4.5 }, send, 2);
    expect(sent).toEqual([
      {
        type: "order",
        creepId: creep.id,
        order: { type: "buildRoad", x: 3, y: 4 },
      },
      {
        type: "order",
        creepId: creep.id,
        order: { type: "moveTo", x: 3, y: 4 },
      },
    ]);
    expect(store.mode.value.type).toBe("select");
    expect(store.ping.value?.cell).toEqual({ x: 3, y: 4 });
  });

  it("has no road mode without a dominated creep", () => {
    const { store } = connected();
    toggleRoadMode(store);
    expect(store.mode.value.type).toBe("select");
  });
});
