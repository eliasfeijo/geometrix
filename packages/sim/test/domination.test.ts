import { createEventLog } from "../src/events.ts";
import { describe, expect, test } from "vitest";
import {
  dominate,
  dominateRefusal,
  giveOrder,
  join,
  joinRefusal,
  orderRefusal,
  release,
  releaseRefusal,
} from "../src/domination.ts";
import type { Params } from "../src/params.ts";
import { collectorRules } from "../src/presets.ts";
import { step } from "../src/step.ts";
import type { WorldState } from "../src/world.ts";
import { paramsWith, run, textWorld } from "./helpers.ts";

/** Core A, a materia deposit at x=2, core B. */
const ROW = ["A.m......B"];

/** Players 1 and 2 on team 0, player 3 on team 1. */
function world(params?: Params): WorldState {
  const w = textWorld(ROW, params);
  join(w, 1, 0, false);
  join(w, 2, 0, false);
  join(w, 3, 1, false);
  return w;
}

const teamCreep = (w: WorldState, team: number, n = 0) =>
  w.creeps.filter((c) => c.team === team)[n]!;

describe("join", () => {
  test("adds players by id with their team", () => {
    const w = textWorld(ROW);
    join(w, 5, 1, false);
    join(w, 2, 0, false);
    join(w, 7, 1, true);
    expect(w.players).toEqual([
      { id: 2, team: 0, bot: false, lastDominateTick: null },
      { id: 5, team: 1, bot: false, lastDominateTick: null },
      { id: 7, team: 1, bot: true, lastDominateTick: null },
    ]);
  });

  test("takes at most teams.maxHumans humans per team; bots do not count", () => {
    const w = textWorld(ROW);
    expect(w.params.teams.maxHumans).toBe(3);
    join(w, 1, 0, true);
    for (const id of [2, 3, 4]) {
      expect(joinRefusal(w, id, 0, false)).toBeNull();
      join(w, id, 0, false);
    }
    expect(joinRefusal(w, 5, 0, false)).toBe("teamFull");
    expect(joinRefusal(w, 5, 0, true)).toBeNull();
    expect(joinRefusal(w, 5, 1, false)).toBeNull();
  });

  test("refuses a player twice or an unknown team", () => {
    const w = world();
    expect(joinRefusal(w, 1, 1, false)).toBe("alreadyJoined");
    expect(joinRefusal(w, 9, 2, false)).toBe("unknownTeam");
    expect(joinRefusal(w, 9, 1, false)).toBeNull();
  });
});

describe("dominate", () => {
  test("D-1: the creep keeps its order, ignores its rules and obeys only its player", () => {
    const w = world();
    const creep = teamCreep(w, 0);
    creep.rules = collectorRules("materia");
    creep.order = { type: "moveTo", x: 5, y: 0 };
    expect(dominateRefusal(w, 1, creep.id)).toBeNull();
    dominate(w, 1, creep.id);
    expect(creep.dominatedBy).toBe(1);
    step(w, []);
    expect(creep.order).toEqual({ type: "moveTo", x: 5, y: 0 });

    expect(orderRefusal(w, 2, creep.id, { type: "stop" })).toBe(
      "notDominating",
    );
    expect(orderRefusal(w, 1, creep.id, { type: "deliver" })).toBeNull();
    giveOrder(w, creep.id, { type: "deliver" }, createEventLog(w.tick));
    run(w, 100);
    // Back on the core with the order done: it waits instead of gathering.
    expect(creep).toMatchObject({ x: 0, order: { type: "stop" } });
  });

  test("D-2: dominating a second creep releases the first", () => {
    const w = world();
    const [first, second] = [teamCreep(w, 0, 0), teamCreep(w, 0, 1)];
    dominate(w, 1, first.id);
    dominate(w, 1, second.id);
    expect([first.dominatedBy, second.dominatedBy]).toEqual([null, 1]);
  });

  test("D-3: a creep dominated by another player is refused", () => {
    const w = world();
    const creep = teamCreep(w, 0);
    dominate(w, 1, creep.id);
    expect(dominateRefusal(w, 2, creep.id)).toBe("dominatedByOther");
    expect(dominateRefusal(w, 1, creep.id)).toBe("alreadyDominating");
  });

  test.each([
    ["an unknown player", 9, () => 0, "unknownPlayer"],
    ["an unknown creep", 1, () => 9999, "unknownCreep"],
    [
      "a creep of the other team, as unknown (fog spec D6)",
      1,
      (w: WorldState) => teamCreep(w, 1).id,
      "unknownCreep",
    ],
  ] as const)("refuses %s", (_, player, creepId, reason) => {
    const w = world();
    expect(dominateRefusal(w, player, creepId(w))).toBe(reason);
  });

  test("the domination cost comes out of the team stock", () => {
    const w = world(
      paramsWith((p) => {
        p.domination.cost = { materia: 3, cristal: 1 };
      }),
    );
    const creep = teamCreep(w, 0);
    expect(dominateRefusal(w, 1, creep.id)).toBe("stock");
    w.teams[0]!.stock = { materia: 5, cristal: 1 };
    dominate(w, 1, creep.id);
    expect(w.teams[0]!.stock).toEqual({ materia: 2, cristal: 0 });
  });

  test("the cooldown counts from the player's last accepted dominate", () => {
    const w = world(
      paramsWith((p) => {
        p.domination.cooldownSeconds = 10;
      }),
    );
    const [first, second] = [teamCreep(w, 0, 0), teamCreep(w, 0, 1)];
    dominate(w, 1, first.id);
    run(w, 9);
    expect(dominateRefusal(w, 1, second.id)).toBe("cooldown");
    expect(dominateRefusal(w, 2, second.id)).toBeNull();
    run(w, 1);
    expect(dominateRefusal(w, 1, second.id)).toBeNull();
  });

  test("the distance limit is measured from the team core", () => {
    const w = world(
      paramsWith((p) => {
        p.domination.maxDistanceCells = 3;
      }),
    );
    const creep = teamCreep(w, 0);
    creep.x = 3;
    expect(dominateRefusal(w, 1, creep.id)).toBeNull();
    creep.x = 4;
    expect(dominateRefusal(w, 1, creep.id)).toBe("tooFar");
  });
});

describe("release", () => {
  test("D-4: the creep goes back to its rules", () => {
    const w = world();
    const creep = teamCreep(w, 0);
    creep.rules = collectorRules("materia");
    dominate(w, 1, creep.id);
    step(w, []);
    expect(creep.order).toEqual({ type: "stop" });
    expect(releaseRefusal(w, 1)).toBeNull();
    release(w, 1);
    expect(creep.dominatedBy).toBeNull();
    step(w, []);
    expect(creep.order).toMatchObject({ type: "gather" });
  });

  test("is refused when the player dominates nothing", () => {
    const w = world();
    expect(releaseRefusal(w, 1)).toBe("notDominating");
    expect(releaseRefusal(w, 9)).toBe("unknownPlayer");
  });
});

describe("orders from the dominating player", () => {
  test.each([
    ["gather at an unknown deposit", { type: "gather", depositId: 9999 }],
    ["moveTo outside the map", { type: "moveTo", x: 10, y: 0 }],
    ["buildRoad at a fractional cell", { type: "buildRoad", x: 1.5, y: 0 }],
  ] as const)("refuses %s", (_, order) => {
    const w = world();
    const creep = teamCreep(w, 0);
    dominate(w, 1, creep.id);
    expect(orderRefusal(w, 1, creep.id, order)).toBe("invalidOrder");
  });

  test("refuses another team's creep as unknown (fog spec D6)", () => {
    const w = world();
    const enemy = teamCreep(w, 1);
    expect(orderRefusal(w, 1, enemy.id, { type: "stop" })).toBe("unknownCreep");
    expect(orderRefusal(w, 1, 9999, { type: "stop" })).toBe("unknownCreep");
  });

  test("gather at a deposit the team does not remember is refused as unknown", () => {
    const w = textWorld(["A..........c......m....B"]);
    join(w, 1, 0, false);
    const creep = teamCreep(w, 0);
    dominate(w, 1, creep.id);
    // The core sees 8 cells: the cristal at x = 11 exists but was never seen.
    const cristal = w.deposits.find((d) => d.kind === "cristal")!;
    const gather = { type: "gather", depositId: cristal.id } as const;
    expect(orderRefusal(w, 1, creep.id, gather)).toBe("invalidOrder");
    w.memory[0]!.deposits.push({ ...cristal });
    expect(orderRefusal(w, 1, creep.id, gather)).toBeNull();
  });

  test("buildRoad becomes a road order with its segment still to choose", () => {
    const w = world();
    const creep = teamCreep(w, 0);
    dominate(w, 1, creep.id);
    giveOrder(
      w,
      creep.id,
      { type: "buildRoad", x: 3, y: 0 },
      createEventLog(w.tick),
    );
    expect(creep.order).toEqual({ type: "buildRoad", x: 3, y: 0, segment: -1 });
  });
});
