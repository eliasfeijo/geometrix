import { maxHp, step } from "@geometrix/sim";
import { describe, expect, it } from "vitest";
import {
  hpBand,
  hpPoints,
  hpShare,
  linksOf,
  spoilKind,
  windowSeconds,
} from "../src/map/combat-marks.ts";
import { encounterWorld, testWorld, viewOf } from "./helpers.ts";

describe("HP bar (spec C-1)", () => {
  const { params } = testWorld();

  it("is hidden at full HP and shows the share below it", () => {
    const full = maxHp(params, "square");
    expect(hpShare({ dna: "square", hp: full }, params)).toBeNull();
    expect(hpShare({ dna: "square", hp: full / 4 }, params)).toBe(0.25);
  });

  it("reads whole points and bands", () => {
    expect(hpPoints(149_999)).toBe(149);
    expect([hpBand(0.9), hpBand(0.5), hpBand(0.1)]).toEqual([
      "high",
      "mid",
      "low",
    ]);
  });

  it("shows the enemy in sight too (D18)", () => {
    const { world, prey } = encounterWorld("attack");
    prey.hp = 1000;
    const enemy = viewOf(world, 0).creeps.find((c) => c.id === prey.id)!;
    expect(hpShare(enemy, world.params)).toBeGreaterThan(0);
  });
});

describe("spoils (spec C-2)", () => {
  it("take the color of what they hold most, cristal on ties", () => {
    const spoil = (materia: number, cristal: number) => ({
      id: 1,
      x: 0,
      y: 0,
      cargo: { materia, cristal },
    });
    expect(spoilKind(spoil(5, 2))).toBe("materia");
    expect(spoilKind(spoil(2, 2))).toBe("cristal");
  });
});

describe("links between creeps (spec C-3)", () => {
  it("draws the chase of an own creep at an enemy in sight", () => {
    const world = testWorld();
    for (const creep of world.creeps) creep.rules = [];
    const hunter = world.creeps.find((c) => c.team === 0)!;
    const prey = world.creeps.find((c) => c.team === 1)!;
    hunter.order = { type: "approach", targetId: prey.id, intent: "extort" };
    // Out of sight: no line to a creep the team does not see.
    expect(linksOf(viewOf(world, 0), world.params)).toEqual([]);
    const seen = viewOf(world, 0);
    seen.creeps.push({ ...prey, cargo: { ...prey.cargo } });
    expect(linksOf(seen, world.params)).toEqual([
      { kind: "chase", from: hunter.id, to: prey.id, intent: "extort" },
    ]);
  });

  it("shows the dominated victim's window to both teams", () => {
    const { world, hunter, prey } = encounterWorld("extort", true);
    const [encounter] = world.encounters;
    for (const team of [0, 1]) {
      expect(linksOf(viewOf(world, team), world.params)).toEqual([
        {
          kind: "dialogue",
          encounter: encounter!.id,
          from: hunter.id,
          to: prey.id,
          intent: "extort",
          seconds: (encounter!.deadlineTick! - world.tick) * 1,
          rounds: null,
        },
      ]);
    }
  });

  it("shows the rounds of a fight", () => {
    const { world, prey } = encounterWorld("attack", true);
    step(world, [
      {
        playerId: 9,
        command: { type: "react", creepId: prey.id, choice: "fight" },
      },
    ]);
    const [link] = linksOf(viewOf(world, 0), world.params);
    expect(link).toMatchObject({ kind: "fight", seconds: null, rounds: 0 });
  });

  it("counts the window down to zero, none for a free victim", () => {
    const { params } = testWorld();
    expect(windowSeconds(null, 5, params)).toBeNull();
    expect(windowSeconds(10, 4, params)).toBe(6 * params.world.tickSeconds);
    expect(windowSeconds(10, 12, params)).toBe(0);
  });
});
