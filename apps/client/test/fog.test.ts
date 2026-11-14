import { fullView, step, view } from "@geometrix/sim";
import { describe, expect, it } from "vitest";
import { fogPaths, inSight, Sight, sightOf } from "../src/map/fog.ts";
import { testWorld } from "./helpers.ts";

/** The cells a fog path covers, from its row runs. */
function cells(path: string, width: number): number[] {
  const out: number[] = [];
  for (const [, x, y, length] of path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    for (let i = 0; i < Number(length); i++) {
      out.push(Number(y) * width + Number(x) + i);
    }
  }
  return out;
}

describe("fog", () => {
  it("tells never seen, remembered and visible cells apart", () => {
    // 3 x 2: row 0 never seen, seen, in sight; row 1 in sight, seen, seen.
    const known = [-1, 0, 3, 0, 1, 1];
    const visible = [2, 3];
    const { unseen, remembered, visible: V } = Sight;
    expect(sightOf(known, visible)).toEqual([
      unseen,
      remembered,
      V,
      V,
      remembered,
      remembered,
    ]);
    expect(fogPaths(known, visible, 3)).toEqual({
      unseen: "M0 0h1v1h-1z",
      remembered: "M1 0h1v1h-1zM1 1h2v1h-2z",
    });
  });

  it("covers each cell of a team's view once, by what the team knows", () => {
    const world = testWorld();
    for (let i = 0; i < 600; i++) step(world, []);
    const seen = view(world, 0);
    const { width } = world.map;
    const paths = fogPaths(seen.known, seen.visible, width);
    const unseen = cells(paths.unseen, width);
    const remembered = cells(paths.remembered, width);
    const visible = new Set(seen.visible);
    expect(new Set([...unseen, ...remembered]).size).toBe(
      unseen.length + remembered.length,
    );
    expect(unseen.length + remembered.length + visible.size).toBe(
      seen.known.length,
    );
    for (const i of unseen) expect(seen.known[i]).toBe(-1);
    for (const i of remembered) {
      expect(seen.known[i]).toBeGreaterThanOrEqual(0);
      expect(visible.has(i)).toBe(false);
    }
    // At the start the team has explored little: most of the map is dark.
    expect(unseen.length).toBeGreaterThan(seen.known.length / 2);
  });

  it("tells whether a cell is in sight now", () => {
    const world = testWorld();
    const seen = view(world, 0);
    const { width } = world.map;
    const at = (i: number) => ({ x: i % width, y: Math.floor(i / width) });
    expect(inSight(seen, at(seen.visible[0]!), width)).toBe(true);
    expect(inSight(seen, at(seen.known.indexOf(-1)), width)).toBe(false);
    expect(inSight(fullView(world), at(seen.known.indexOf(-1)), width)).toBe(
      true,
    );
  });

  it("leaves the replay's full view clear (spec C-5)", () => {
    const world = testWorld();
    const all = fullView(world);
    expect(fogPaths(all.known, all.visible, world.map.width)).toEqual({
      unseen: "",
      remembered: "",
    });
  });
});
