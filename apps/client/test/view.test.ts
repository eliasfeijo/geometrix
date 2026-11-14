import { describe, expect, it } from "vitest";
import {
  cellAt,
  centerOn,
  clampView,
  fitView,
  MAX_SCALE,
  panBy,
  scaleLimits,
  toMap,
  viewBox,
  zoomAt,
} from "../src/map/view.ts";

const map = { width: 64, height: 64 };
const size = { width: 800, height: 600 };

describe("map view", () => {
  it("fits the whole map, centered", () => {
    const view = fitView(map, size);
    expect(view).toEqual({ cx: 32, cy: 32, scale: 600 / 66 });
    const box = viewBox(view, size);
    expect(box.y).toBeCloseTo(-1);
    expect(box.h).toBeCloseTo(66);
    expect(box.x + box.w / 2).toBeCloseTo(32);
  });

  it("maps pixels to cells", () => {
    const view = { cx: 10, cy: 20, scale: 20 };
    expect(toMap(view, size, { x: 400, y: 300 })).toEqual({ x: 10, y: 20 });
    expect(toMap(view, size, { x: 0, y: 0 })).toEqual({ x: -10, y: 5 });
    expect(cellAt(toMap(view, size, { x: 419, y: 319 }))).toEqual({
      x: 10,
      y: 20,
    });
    expect(cellAt({ x: -0.2, y: 3.99 })).toEqual({ x: -1, y: 3 });
  });

  it("zooms keeping the point under the pointer", () => {
    const view = { cx: 32, cy: 32, scale: 20 };
    const px = { x: 600, y: 150 };
    const before = toMap(view, size, px);
    const zoomed = zoomAt(view, size, px, 2, map);
    expect(zoomed.scale).toBe(40);
    const after = toMap(zoomed, size, px);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("keeps the zoom within limits", () => {
    const { min } = scaleLimits(map, size);
    const center = { x: 400, y: 300 };
    let view = { cx: 32, cy: 32, scale: 20 };
    for (let i = 0; i < 50; i++) view = zoomAt(view, size, center, 2, map);
    expect(view.scale).toBe(MAX_SCALE);
    for (let i = 0; i < 50; i++) view = zoomAt(view, size, center, 0.5, map);
    expect(view.scale).toBe(min);
  });

  it("pans with the drag and stays over the map", () => {
    const view = { cx: 32, cy: 32, scale: 20 };
    expect(panBy(view, size, 40, -20, map)).toEqual({
      cx: 30,
      cy: 33,
      scale: 20,
    });
    expect(panBy(view, size, 1e6, -1e6, map)).toEqual({
      cx: 0,
      cy: 64,
      scale: 20,
    });
    expect(clampView({ cx: -5, cy: 70, scale: 1e6 }, map, size)).toEqual({
      cx: 0,
      cy: 64,
      scale: MAX_SCALE,
    });
  });

  it("centers on a cell", () => {
    expect(
      centerOn({ cx: 0, cy: 0, scale: 20 }, { x: 5, y: 9 }, map, size),
    ).toEqual({ cx: 5.5, cy: 9.5, scale: 20 });
  });
});

describe("marker scale", () => {
  it("grows markers only when zoomed out, up to a limit", async () => {
    const { markerScale, MIN_MARKER_PX, MAX_MARKER_SCALE } =
      await import("../src/map/view.ts");
    expect(markerScale(40)).toBe(1);
    expect(markerScale(MIN_MARKER_PX)).toBe(1);
    expect(markerScale(MIN_MARKER_PX / 1.5)).toBeCloseTo(1.5);
    expect(markerScale(1)).toBe(MAX_MARKER_SCALE);
  });
});
