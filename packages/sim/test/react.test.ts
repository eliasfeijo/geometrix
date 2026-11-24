import { describe, expect, test } from "vitest";
import { validate, type Command } from "../src/commands.ts";
import { dominate, join } from "../src/domination.ts";
import { dropSpoil } from "../src/spoils.ts";
import { step } from "../src/step.ts";
import { updateVision } from "../src/vision.ts";
import type { Creep, WorldState } from "../src/world.ts";
import { creepOf, textWorld } from "./helpers.ts";

const ROW = ["A............................B"];

/** Player 1 dominates a team 0 circle at x=9; player 2 a team 1 square at x=10. */
function world(): { w: WorldState; hunter: Creep; prey: Creep } {
  const w = textWorld(ROW);
  const hunter = creepOf(w, 0, "circle");
  const prey = creepOf(w, 1, "square");
  Object.assign(hunter, { x: 9, y: 0 });
  Object.assign(prey, { x: 10, y: 0 });
  updateVision(w);
  join(w, 1, 0, false);
  join(w, 2, 1, false);
  dominate(w, 1, hunter.id);
  dominate(w, 2, prey.id);
  return { w, hunter, prey };
}

const order = (
  creepId: number,
  o: Extract<Command, { type: "order" }>["order"],
) => ({ type: "order", creepId, order: o }) as const;
const reactTo = (creepId: number, choice: string) =>
  ({ type: "react", creepId, choice }) as Command;

describe("encounter orders (spec E-1, D19)", () => {
  test("approach takes an enemy the team sees; one it does not see is refused as unknown", () => {
    const { w, hunter, prey } = world();
    const approach = (targetId: number) =>
      order(hunter.id, { type: "approach", targetId, intent: "attack" });
    expect(validate(w, approach(prey.id), 1)).toBeNull();
    const hidden = creepOf(w, 1, "circle");
    expect(validate(w, approach(hidden.id), 1)).toBe("unknownCreep");
    expect(validate(w, approach(9999), 1)).toBe("unknownCreep");
    const mate = creepOf(w, 0, "square");
    expect(validate(w, approach(mate.id), 1)).toBe("unknownCreep");
  });

  test("pickup takes a spoil the team remembers, else it is an invalid order", () => {
    const { w, hunter } = world();
    const seen = dropSpoil(w, { x: 8, y: 0 }, { materia: 1, cristal: 0 });
    const unseen = dropSpoil(w, { x: 20, y: 0 }, { materia: 1, cristal: 0 });
    updateVision(w);
    const pickup = (spoilId: number) =>
      order(hunter.id, { type: "pickup", spoilId });
    expect(validate(w, pickup(seen), 1)).toBeNull();
    expect(validate(w, pickup(unseen), 1)).toBe("invalidOrder");
    expect(validate(w, pickup(9999), 1)).toBe("invalidOrder");
  });

  test("a creep in an encounter, in a battle or fleeing takes no order", () => {
    const { w, hunter, prey } = world();
    prey.cargo.cristal = 5;
    const approach = (intent: "attack" | "extort") => ({
      playerId: 1,
      command: order(hunter.id, {
        type: "approach",
        targetId: prey.id,
        intent,
      }),
    });
    step(w, [approach("extort")]);
    expect(hunter.engagement).not.toBeNull();
    expect(validate(w, order(hunter.id, { type: "stop" }), 1)).toBe("engaged");
    expect(validate(w, order(prey.id, { type: "stop" }), 2)).toBe("engaged");
    // Refused, the battle locks both (junction O-5).
    step(w, [{ playerId: 2, command: reactTo(prey.id, "refuse") }]);
    expect(hunter.battle).not.toBeNull();
    expect(validate(w, order(hunter.id, { type: "stop" }), 1)).toBe("inBattle");
    expect(validate(w, order(prey.id, { type: "stop" }), 2)).toBe("inBattle");
    const other = creepOf(w, 1, "triangle");
    join(w, 3, 1, false);
    dominate(w, 3, other.id);
    other.order = { type: "flee", untilTick: 999 };
    expect(validate(w, order(other.id, { type: "stop" }), 3)).toBe("fleeing");
  });
});

describe("the react command (spec C-5, D6)", () => {
  function opened(intent: "attack" | "extort") {
    const s = world();
    s.prey.cargo.cristal = 5;
    step(s.w, [
      {
        playerId: 1,
        command: order(s.hunter.id, {
          type: "approach",
          targetId: s.prey.id,
          intent,
        }),
      },
    ]);
    return s;
  }

  test("is refused outside an encounter and for a creep not dominated", () => {
    const { w, hunter, prey } = world();
    expect(validate(w, reactTo(prey.id, "pay"), 2)).toBe("notEngaged");
    expect(validate(w, reactTo(hunter.id, "pay"), 2)).toBe("unknownCreep");
  });

  test("the victim answers an extortion with pay or refuse (junction D1)", () => {
    const { w, hunter, prey } = opened("extort");
    expect(validate(w, reactTo(prey.id, "fight"), 2)).toBe("invalidReaction");
    expect(validate(w, reactTo(prey.id, "flee"), 2)).toBe("invalidReaction");
    // The aggressor has nothing to answer in the dialogue.
    expect(validate(w, reactTo(hunter.id, "pay"), 1)).toBe("invalidReaction");
    expect(validate(w, reactTo(prey.id, "refuse"), 2)).toBeNull();
    expect(validate(w, reactTo(prey.id, "pay"), 2)).toBeNull();
    const events = step(w, [{ playerId: 2, command: reactTo(prey.id, "pay") }]);
    expect(events.find((e) => e.type === "reaction")).toMatchObject({
      choice: "pay",
      by: "player",
    });
    expect(hunter.cargo.cristal).toBe(5);
  });

  test("an attack opens the battle at once: nothing to answer", () => {
    const { w, prey } = opened("attack");
    expect(w.battles).toHaveLength(1);
    expect(validate(w, reactTo(prey.id, "refuse"), 2)).toBe("notEngaged");
  });
});
