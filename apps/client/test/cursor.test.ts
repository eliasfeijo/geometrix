import { dominate, join, step, updateVision } from "@geometrix/sim";
import { describe, expect, it } from "vitest";
import {
  cursorAt,
  cursorStyle,
  roadShortAt,
  toggleRoadMode,
} from "../src/interaction.ts";
import { CURSORS, cursorKind, type CursorInput } from "../src/map/cursor.ts";
import { GameStore } from "../src/store.ts";
import { testWorld, viewOf, welcomeOf } from "./helpers.ts";

describe("cursorKind", () => {
  const base: CursorInput = {
    mode: "select",
    pick: null,
    order: null,
    roadShort: false,
  };

  it.each([
    [{}, "default"],
    [{ pick: "other" }, "select"],
    [{ pick: "creep" }, "select"],
    [{ order: "gather" }, "gather"],
    [{ order: "deliver" }, "deliver"],
    [{ order: "moveTo" }, "move"],
    // The order wins over selecting a deposit or a core, not over a creep.
    [{ order: "gather", pick: "other" }, "gather"],
    [{ order: "moveTo", pick: "creep" }, "select"],
    [{ mode: "road", pick: "creep" }, "road"],
    // An enemy in sight: approach with a dominated creep, else select.
    [{ order: "moveTo", pick: "enemy" }, "approach"],
    [{ pick: "enemy" }, "select"],
    [{ mode: "road", pick: "enemy" }, "road"],
    [{ order: "pickup" }, "pickup"],
    [{ mode: "road", roadShort: true }, "roadShort"],
    [{ mode: "pickCell", order: "moveTo" }, "pick"],
  ] as const)("%o shows %s", (input, kind) => {
    expect(cursorKind({ ...base, ...input })).toBe(kind);
  });

  it("draws each icon as an SVG with a native fallback", () => {
    for (const [kind, css] of Object.entries(CURSORS)) {
      const url = /^url\("data:image\/svg\+xml,([^"]+)"\) 2 2, [a-z-]+$/.exec(
        css,
      );
      if (url === null) {
        expect(css, kind).toMatch(/^(default|pointer|crosshair)$/);
        continue;
      }
      expect(decodeURIComponent(url[1]!), kind).toMatch(/^<svg .*<\/svg>$/);
    }
    expect(CURSORS.road).not.toBe(CURSORS.roadShort);
    expect(cursorStyle("select")).toBe("cursor: pointer");
  });
});

describe("cursorAt", () => {
  function connected() {
    const world = testWorld();
    join(world, 7, 0, false);
    const store = new GameStore();
    store.receive(welcomeOf(world, 7, 0), 0);
    // 40 px per cell: markers a cell wide, hits half a cell.
    store.view.value = { cx: 32, cy: 32, scale: 40 };
    const creep = world.creeps.find((c) => c.team === 0)!;
    const core = world.teams[0]!.core;
    const at = (x: number, y: number, orders = true) => {
      store.pointer.value = { x, y };
      store.pointerCell.value = { x: Math.floor(x), y: Math.floor(y) };
      return cursorAt(store, orders, 0, roadShortAt(store, 0), 0);
    };
    return { world, store, creep, core, at };
  }

  it("selects without a dominated creep, and nothing over empty ground", () => {
    const { world, store, core, at } = connected();
    const deposit = viewOf(world).deposits[0]!;
    expect(at(deposit.x + 0.5, deposit.y + 0.5)).toBe("select");
    expect(at(core.x + 0.5, core.y + 0.5)).toBe("select");
    expect(at(core.x + 4.5, core.y + 4.5)).toBe("default");
    store.pointer.value = null;
    expect(cursorAt(store, true, 0, false, 0)).toBe("default");
  });

  it("shows the dominated creep's order, and select over a creep", () => {
    const { world, store, creep, core, at } = connected();
    dominate(world, 7, creep.id);
    step(world, []);
    store.show(viewOf(world), 1);
    const deposit = viewOf(world).deposits[0]!;
    expect(at(deposit.x + 0.5, deposit.y + 0.5)).toBe("gather");
    expect(at(core.x + 4.5, core.y + 4.5)).toBe("move");
    // The core's edge, off the creeps drawn on it.
    expect(at(core.x + 1.3, core.y + 0.5)).toBe("deliver");
    expect(at(core.x + 0.5, core.y + 0.5)).toBe("select");
    // A replay gives no orders.
    expect(at(deposit.x + 0.5, deposit.y + 0.5, false)).toBe("select");
  });

  it("approaches an enemy in sight and picks up a spoil (M2 encontro)", () => {
    const { world, store, creep, core, at } = connected();
    dominate(world, 7, creep.id);
    const enemy = world.creeps.find((c) => c.team === 1)!;
    Object.assign(enemy, { x: core.x + 4, y: core.y });
    updateVision(world);
    step(world, []);
    const seen = viewOf(world);
    seen.spoils.push({
      id: 999,
      x: core.x,
      y: core.y + 4,
      cargo: { materia: 3, cristal: 0 },
    });
    store.show(seen, 1);
    expect(at(enemy.x + 0.5, enemy.y + 0.5)).toBe("approach");
    expect(at(core.x + 0.5, core.y + 4.5)).toBe("pickup");
    // Without orders (a replay), the enemy is just selectable.
    expect(at(enemy.x + 0.5, enemy.y + 0.5, false)).toBe("select");
  });

  it("turns the road icon red when the stock is short", () => {
    const { world, store, creep, core, at } = connected();
    dominate(world, 7, creep.id);
    world.teams[0]!.stock = { materia: 0, cristal: 0 };
    step(world, []);
    store.show(viewOf(world), 1);
    toggleRoadMode(store);
    expect(at(core.x + 3.5, core.y + 0.5)).toBe("roadShort");
    world.teams[0]!.stock = { materia: 1e6, cristal: 1e6 };
    step(world, []);
    store.show(viewOf(world), 2);
    expect(at(core.x + 3.5, core.y + 0.5)).toBe("road");
  });

  it("shows the crosshair while picking a cell", () => {
    const { store, core, at } = connected();
    store.mode.value = { type: "pickCell", prompt: "", pick: () => {} };
    expect(at(core.x + 0.5, core.y + 0.5)).toBe("pick");
  });
});
