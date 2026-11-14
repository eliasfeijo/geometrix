import { describe, expect, it } from "vitest";
import {
  creepPositions,
  crowdOffsets,
  glide,
  glideProgress,
  MAX_GLIDE_CELLS,
  MAX_GLIDE_MS,
} from "../src/map/interpolate.ts";
import { drawnCenters } from "../src/map/creep-layer.tsx";
import { dynamicOf, testWorld } from "./helpers.ts";

describe("interpolation", () => {
  const state = dynamicOf(testWorld());

  it("glides over the time between the two messages", () => {
    const previous = { state, at: 1000 };
    const current = { state, at: 1200 };
    expect(glideProgress(previous, current, 1200)).toBe(0);
    expect(glideProgress(previous, current, 1300)).toBe(0.5);
    expect(glideProgress(previous, current, 1500)).toBe(1);
    expect(glideProgress(null, current, 1200)).toBe(1);
    // A long gap glides for at most MAX_GLIDE_MS.
    expect(
      glideProgress({ state, at: 0 }, { state, at: 60_000 }, 60_000 + 500),
    ).toBe(500 / MAX_GLIDE_MS);
  });

  it("moves between cells, and jumps when the move is too long", () => {
    expect(glide({ x: 2, y: 3 }, { x: 4, y: 3 }, 0.25)).toEqual({
      x: 2.5,
      y: 3,
    });
    expect(glide(undefined, { x: 4, y: 3 }, 0.25)).toEqual({ x: 4, y: 3 });
    expect(glide({ x: 0, y: 0 }, { x: MAX_GLIDE_CELLS, y: 1 }, 0.5)).toEqual({
      x: MAX_GLIDE_CELLS,
      y: 1,
    });
  });

  it("places new creeps at their cell", () => {
    const previous = structuredClone(state);
    previous.creeps = previous.creeps.slice(1);
    for (const c of previous.creeps) c.x -= 1;
    const positions = creepPositions(previous, state, 0.5);
    const [first, second] = state.creeps;
    expect(positions.get(first!.id)).toEqual({ x: first!.x, y: first!.y });
    expect(positions.get(second!.id)).toEqual({
      x: second!.x - 0.5,
      y: second!.y,
    });
  });

  it("spreads creeps that share a cell", () => {
    expect(crowdOffsets(1)).toEqual([{ x: 0, y: 0 }]);
    const four = crowdOffsets(4);
    expect(four).toHaveLength(4);
    const distinct = new Set(
      four.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`),
    );
    expect(distinct.size).toBe(4);

    // All 6 creeps of a team start on its core.
    const team0 = state.creeps.filter((c) => c.team === 0);
    const centers = drawnCenters(team0, creepPositions(null, state, 1));
    const drawn = new Set(
      [...centers.values()].map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`),
    );
    expect(drawn.size).toBe(team0.length);
    for (const p of centers.values()) expect(p.scale).toBeLessThan(1);
  });
});
