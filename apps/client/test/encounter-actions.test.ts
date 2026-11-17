import {
  capacity,
  dominate,
  join,
  reactRefusal,
  step,
  updateVision,
} from "@geometrix/sim";
import { describe, expect, it } from "vitest";
import { approachOptions, reactionOf } from "../src/encounter-actions.ts";
import { handleKey, order } from "../src/interaction.ts";
import { GameStore } from "../src/store.ts";
import { encounterWorld, testWorld, viewOf, welcomeOf } from "./helpers.ts";

const PX = { x: 100, y: 100 };

/** Player 7 of team 0 dominates a circle next to a loaded enemy square. */
function facing() {
  const world = testWorld();
  for (const creep of world.creeps) creep.rules = [];
  join(world, 7, 0, false);
  const mine = world.creeps.find((c) => c.team === 0 && c.dna === "circle")!;
  dominate(world, 7, mine.id);
  const enemy = world.creeps.find((c) => c.team === 1 && c.dna === "square")!;
  const core = world.teams[0]!.core;
  Object.assign(enemy, { x: core.x + 4, y: core.y });
  enemy.cargo = { materia: 30, cristal: 5 };
  updateVision(world);
  step(world, []);
  const store = new GameStore();
  store.receive(welcomeOf(world, 7, 0), 0);
  store.connection.value = "open";
  store.view.value = { cx: 32, cy: 32, scale: 40 };
  const sent: unknown[] = [];
  const send = async (command: unknown) => {
    sent.push(command);
    return true;
  };
  return { world, store, mine, enemy, sent, send };
}

describe("the right-click menu over an enemy (spec C-6)", () => {
  it("opens on the enemy instead of moving there, and Esc closes it", () => {
    const { store, enemy, sent, send } = facing();
    order(store, { x: enemy.x + 0.5, y: enemy.y + 0.5 }, send, 1, PX);
    expect(sent).toEqual([]);
    expect(store.approach.value).toEqual({ ids: [enemy.id], at: PX });
    const key = { key: "Escape", target: null } as unknown as KeyboardEvent;
    expect(handleKey(store, 0, key)).toBe(true);
    expect(store.approach.value).toBeNull();
  });

  it("shows the demand the sim will make: cristal first, up to the room", () => {
    const { world, store, mine, enemy } = facing();
    const room = capacity(mine, world.teams[0]!, world.params);
    const [option] = approachOptions(
      store.current.value!.state,
      world.params,
      store.myCreep.value!,
      [enemy.id],
    );
    expect(option!.target.id).toBe(enemy.id);
    expect(option!.demand).toEqual({
      cristal: Math.min(5, room),
      materia: Math.min(30, Math.max(0, room - 5)),
    });
    // Full: nothing to demand, so the button is off.
    mine.cargo = { materia: room, cristal: 0 };
    step(world, []);
    store.show(viewOf(world), 2);
    const [full] = approachOptions(
      store.current.value!.state,
      world.params,
      store.myCreep.value!,
      [enemy.id],
    );
    expect(full!.demand).toEqual({ materia: 0, cristal: 0 });
  });

  it("leaves own creeps out of the menu", () => {
    const { world, store, mine, enemy } = facing();
    const options = approachOptions(
      store.current.value!.state,
      world.params,
      store.myCreep.value!,
      [mine.id, enemy.id],
    );
    expect(options.map((o) => o.target.id)).toEqual([enemy.id]);
  });
});

describe("the reaction panel (spec C-5)", () => {
  it("offers pay, refuse and flee to the dominated victim of an extortion", () => {
    const { world, prey } = encounterWorld("extort", true);
    const state = viewOf(world, 1);
    const mine = state.creeps.find((c) => c.id === prey.id)!;
    const reaction = reactionOf(state, world.params, mine as never)!;
    expect(reaction.side).toBe("victim");
    expect(reaction.choices).toEqual(["pay", "refuse", "flee"]);
    expect(reaction.encounter.demand).not.toBeNull();
    expect(reaction.seconds).toBeGreaterThan(0);
    // Every choice offered is one the sim accepts.
    for (const choice of reaction.choices) {
      expect(reactRefusal(world, 9, prey.id, choice)).toBeNull();
    }
  });

  it("offers fight or flee against an attack, then only flee in the fight", () => {
    const { world, prey } = encounterWorld("attack", true);
    const mineOf = () =>
      viewOf(world, 1).creeps.find((c) => c.id === prey.id)! as never;
    expect(
      reactionOf(viewOf(world, 1), world.params, mineOf())!.choices,
    ).toEqual(["fight", "flee"]);
    step(world, [
      {
        playerId: 9,
        command: { type: "react", creepId: prey.id, choice: "fight" },
      },
    ]);
    const fight = reactionOf(viewOf(world, 1), world.params, mineOf())!;
    expect(fight.encounter.stage).toBe("fight");
    expect(fight.choices).toEqual(["flee"]);
    expect(fight.seconds).toBeNull();
    expect(reactRefusal(world, 9, prey.id, "flee")).toBeNull();
    // The flee asked for waits for the next round.
    step(world, [
      {
        playerId: 9,
        command: { type: "react", creepId: prey.id, choice: "flee" },
      },
    ]);
    expect(reactionOf(viewOf(world, 1), world.params, mineOf())!.sent).toBe(
      "flee",
    );
  });

  it("has nothing to answer for the aggressor of a dialogue", () => {
    const { world, hunter } = encounterWorld("attack", true);
    const state = viewOf(world, 0);
    const mine = state.creeps.find((c) => c.id === hunter.id)! as never;
    const reaction = reactionOf(state, world.params, mine)!;
    expect(reaction).toMatchObject({
      side: "aggressor",
      choices: [],
      seconds: null,
    });
    // The victim's pending answer stays hidden from the aggressor's team.
    expect(reaction.encounter.reply).toBeNull();
  });
});
