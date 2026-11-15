import { describe, expect, it } from "vitest";
import {
  HIT_RADIUS,
  layoutCreeps,
  markerAt,
  markerOf,
  markersAt,
  MIN_HIT_PX,
  MIN_SLOT_PX,
  slotGrid,
  slotSize,
  type Marker,
} from "../src/map/layout.ts";
import { markerScale } from "../src/map/view.ts";

const first = (ids: number[]) => ids[0]!;
const noGlide = new Map<number, { x: number; y: number }>();

/** n creeps on cell (4, 4), plus one alone on (9, 9). */
function creeps(n: number) {
  const list = Array.from({ length: n }, (_, i) => ({ id: i + 1, x: 4, y: 4 }));
  return [...list, { id: 100, x: 9, y: 9 }];
}

describe("slots", () => {
  it("grows a near-square grid", () => {
    expect(slotGrid(2)).toEqual({ cols: 2, rows: 1 });
    expect(slotGrid(3)).toEqual({ cols: 2, rows: 2 });
    expect(slotGrid(5)).toEqual({ cols: 3, rows: 2 });
    expect(slotGrid(9)).toEqual({ cols: 3, rows: 3 });
    expect(slotSize(2)).toBe(0.5);
    expect(slotSize(9)).toBe(1 / 3);
  });
});

describe("layoutCreeps", () => {
  it("keeps every creep its own marker when zoomed in", () => {
    for (const n of [2, 3, 4, 7, 9]) {
      const scale = MIN_SLOT_PX / slotSize(n);
      const markers = layoutCreeps(creeps(n), noGlide, scale, first);
      expect(markers.every((m) => m.kind === "creep")).toBe(true);
      const ids = markers.map((m) => (m.kind === "creep" ? m.id : -1));
      expect(ids.sort((a, b) => a - b)).toEqual([
        ...Array.from({ length: n }, (_, i) => i + 1),
        100,
      ]);
      // Slots stay inside the cell and do not overlap.
      const crowd = markers.filter((m) => m.kind === "creep" && m.id !== 100);
      for (const m of crowd) {
        const r = HIT_RADIUS * m.scale;
        expect(m.x - r).toBeGreaterThanOrEqual(4 - 1e-9);
        expect(m.x + r).toBeLessThanOrEqual(5 + 1e-9);
        expect(m.y - r).toBeGreaterThanOrEqual(4 - 1e-9);
        expect(m.y + r).toBeLessThanOrEqual(5 + 1e-9);
      }
      for (const a of crowd) {
        for (const b of crowd) {
          if (a === b) continue;
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(
            HIT_RADIUS * (a.scale + b.scale) - 1e-9,
          );
        }
      }
      // Each click on a slot picks that creep.
      for (const m of crowd) expect(markerAt(m, markers, scale)).toBe(m);
    }
  });

  it("draws one stack when the slots would be too small", () => {
    const scale = MIN_SLOT_PX / slotSize(2) - 1;
    const markers = layoutCreeps(creeps(2), noGlide, scale, (ids) => ids[1]!);
    const stack = markers.find((m) => m.kind === "stack");
    expect(stack).toEqual({
      kind: "stack",
      ids: [1, 2],
      lead: 2,
      x: 4.5,
      y: 4.5,
      scale: markerScale(scale),
    });
    expect(markerOf(markers, 1)).toBe(stack);
    // A lone creep is never a stack.
    expect(markerOf(markers, 100)?.kind).toBe("creep");
  });

  it("places markers where the creeps glide", () => {
    const glide = new Map([[100, { x: 8.5, y: 9 }]]);
    const markers = layoutCreeps(creeps(1), glide, 40, first);
    expect(markerOf(markers, 100)).toMatchObject({ x: 9, y: 9.5 });
  });

  it("picks the nearest marker under the point", () => {
    const markers: Marker[] = [
      { kind: "creep", id: 1, x: 1, y: 1, scale: 1 },
      { kind: "creep", id: 2, x: 1.6, y: 1, scale: 1 },
    ];
    expect(markerAt({ x: 1.4, y: 1 }, markers, 100)).toBe(markers[1]);
    expect(markerAt({ x: 3, y: 3 }, markers, 100)).toBeNull();
  });

  it("reaches a small marker within MIN_HIT_PX on screen", () => {
    const markers: Marker[] = [{ kind: "creep", id: 1, x: 1, y: 1, scale: 1 }];
    // 10 px per cell: 1.5 cells is 15 px, past the drawn radius of 0.5.
    expect(markerAt({ x: 2.5, y: 1 }, markers, 10)).toBe(markers[0]);
    expect(markerAt({ x: 2.5, y: 1 }, markers, 100)).toBeNull();
    expect(MIN_HIT_PX).toBe(20);
  });

  it("hits every overlapping marker, and none clearly between them", () => {
    const markers: Marker[] = [
      { kind: "creep", id: 1, x: 1.5, y: 1.5, scale: 2 },
      { kind: "creep", id: 2, x: 2.5, y: 1.5, scale: 2 },
    ];
    const between = { x: 2, y: 1.5 };
    expect(markersAt(between, markers, 11).map((h) => h.marker)).toHaveLength(
      2,
    );
    expect(markerAt(between, markers, 11)).toBeNull();
    // Within half the drawn radius of one, that one.
    expect(markerAt({ x: 2.9, y: 1.5 }, markers, 11)).toBe(markers[1]);
  });
});
