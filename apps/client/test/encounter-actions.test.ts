import {
  capacity,
  dominate,
  join,
  orderRefusal,
  reactRefusal,
  step,
  updateVision,
  type Wanderer,
} from "@geometrix/sim";
import { describe, expect, it } from "vitest";
import {
  approachOptions,
  engagementText,
  reactionOf,
  safeConductLeft,
} from "../src/encounter-actions.ts";
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
    expect(option!.kind === "creep" && option!.demand).toEqual({
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
    expect(full!.kind === "creep" && full!.demand).toEqual({
      materia: 0,
      cristal: 0,
    });
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

describe("the right-click menu over a wanderer (junction W-4)", () => {
  /** `facing`, with a loaded wanderer in sight next to the enemy. */
  function withWanderer() {
    const f = facing();
    const { world, enemy } = f;
    const wanderer: Wanderer = {
      id: world.nextId++,
      dna: "circle",
      name: "Errante",
      hp: world.params.wanderers.hp * 1000,
      cargo: { materia: 12, cristal: 0 },
      battle: null,
      order: { type: "stop" },
      movePoints: 0,
      path: null,
      spared: [],
      x: enemy.x,
      y: enemy.y + 2,
    };
    world.wanderers.push(wanderer);
    updateVision(world);
    step(world, []);
    f.store.show(viewOf(world), 2);
    return { ...f, wanderer };
  }

  it("opens on a wanderer, attack only, and the attack is an order the sim accepts", () => {
    const { world, store, mine, wanderer, sent, send } = withWanderer();
    order(store, { x: wanderer.x + 0.5, y: wanderer.y + 0.4 }, send, 3, PX);
    expect(sent).toEqual([]);
    expect(store.approach.value).toEqual({ ids: [wanderer.id], at: PX });
    const options = approachOptions(
      store.current.value!.state,
      world.params,
      store.myCreep.value!,
      store.approach.value!.ids,
    );
    expect(options).toEqual([
      {
        kind: "wanderer",
        target: expect.objectContaining({ id: wanderer.id }),
      },
    ]);
    const attack = {
      type: "approach",
      targetId: wanderer.id,
      intent: "attack",
    } as const;
    expect(orderRefusal(world, 7, mine.id, attack)).toBeNull();
    expect(
      orderRefusal(world, 7, mine.id, { ...attack, intent: "extort" }),
    ).toBe("invalidOrder");
  });

  it("a click away from it moves there instead", () => {
    const { store, mine, wanderer, sent, send } = withWanderer();
    order(store, { x: wanderer.x + 1.5, y: wanderer.y + 0.5 }, send, 3, PX);
    expect(store.approach.value).toBeNull();
    expect(sent).toEqual([
      {
        type: "order",
        creepId: mine.id,
        order: { type: "moveTo", x: wanderer.x + 1, y: wanderer.y },
      },
    ]);
  });
});

describe("the reaction panel (spec C-5)", () => {
  it("offers pay and refuse to the dominated victim of an extortion", () => {
    const { world, prey } = encounterWorld("extort", true);
    const state = viewOf(world, 1);
    const mine = state.creeps.find((c) => c.id === prey.id)!;
    const reaction = reactionOf(state, world.params, mine as never)!;
    expect(reaction.side).toBe("victim");
    expect(reaction.choices).toEqual(["pay", "refuse"]);
    expect(reaction.encounter.demand).not.toBeNull();
    expect(reaction.seconds).toBeGreaterThan(0);
    // Every choice offered is one the sim accepts.
    for (const choice of reaction.choices) {
      expect(reactRefusal(world, 9, prey.id, choice)).toBeNull();
    }
    step(world, [
      {
        playerId: 9,
        command: { type: "react", creepId: prey.id, choice: "refuse" },
      },
    ]);
    // Refused, the battle opens: no dialogue left to answer.
    const after = viewOf(world, 1);
    const locked = after.creeps.find((c) => c.id === prey.id)!;
    expect(reactionOf(after, world.params, locked as never)).toBeNull();
  });

  it("opens nothing to answer against an attack: the battle starts", () => {
    const { world, prey } = encounterWorld("attack", true);
    const state = viewOf(world, 1);
    const mine = state.creeps.find((c) => c.id === prey.id)!;
    expect(reactionOf(state, world.params, mine as never)).toBeNull();
    expect(world.battles).toHaveLength(1);
  });

  it("has nothing to answer for the aggressor of a dialogue", () => {
    const { world, hunter } = encounterWorld("extort", true);
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

describe("the inspector's encounter and safe conduct (spec C-7)", () => {
  it("says who is in the encounter, from both sides", () => {
    // Dominated, so the dialogue waits for the answer (a free victim pays in
    // the tick it opens).
    const { world, hunter, prey } = encounterWorld("extort", true);
    const own = viewOf(world, 0);
    const enemy = viewOf(world, 1);
    const creep = (state: typeof own, id: number) =>
      state.creeps.find((c) => c.id === id)!;
    expect(engagementText(own, creep(own, hunter.id))).toBe(
      `abordou ${prey.name} para extorquir`,
    );
    expect(engagementText(enemy, creep(enemy, prey.id))).toBe(
      `abordado por ${hunter.name}, que quer extorquir`,
    );
  });

  it("says a creep in a battle is in one", () => {
    const { world, hunter, prey } = encounterWorld("attack", true);
    for (const team of [0, 1]) {
      const seen = viewOf(world, team);
      for (const id of [hunter.id, prey.id]) {
        expect(
          engagementText(
            seen,
            seen.creeps.find((c) => c.id === id)!,
          ),
        ).toBe("em batalha");
      }
    }
  });

  it("gives the safe conduct after paying, until it runs out", () => {
    const { world, prey } = encounterWorld("extort", true);
    step(world, [
      {
        playerId: 9,
        command: { type: "react", creepId: prey.id, choice: "pay" },
      },
    ]);
    const conduct = prey.safeConduct!;
    expect(conduct.team).toBe(0);
    const left = safeConductLeft(conduct, world.tick, world.params)!;
    expect(left).toEqual({
      team: 0,
      seconds:
        (conduct.untilTick - world.tick) * world.params.world.tickSeconds,
    });
    expect(
      safeConductLeft(conduct, conduct.untilTick, world.params),
    ).toBeNull();
    expect(safeConductLeft(null, 0, world.params)).toBeNull();
  });
});
