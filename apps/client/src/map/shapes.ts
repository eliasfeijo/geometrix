// SVG point lists for the geometric shapes. Coordinates in cells.

const points = (list: [number, number][]) =>
  list.map(([x, y]) => `${round(x)},${round(y)}`).join(" ");

const round = (v: number) => Math.round(v * 1000) / 1000;

/** Triangle pointing up, inscribed in a circle of radius r. */
export function trianglePoints(cx: number, cy: number, r: number): string {
  const h = (r * Math.sqrt(3)) / 2;
  return points([
    [cx, cy - r],
    [cx + h, cy + r / 2],
    [cx - h, cy + r / 2],
  ]);
}

/** Flat-top hexagon of radius r. */
export function hexagonPoints(cx: number, cy: number, r: number): string {
  const h = (r * Math.sqrt(3)) / 2;
  return points([
    [cx - r, cy],
    [cx - r / 2, cy - h],
    [cx + r / 2, cy - h],
    [cx + r, cy],
    [cx + r / 2, cy + h],
    [cx - r / 2, cy + h],
  ]);
}

export function diamondPoints(cx: number, cy: number, r: number): string {
  return points([
    [cx, cy - r],
    [cx + r, cy],
    [cx, cy + r],
    [cx - r, cy],
  ]);
}

/** Regular octagon of radius r (the cores). */
export function octagonPoints(cx: number, cy: number, r: number): string {
  const list: [number, number][] = [];
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 8) * (2 * i + 1);
    list.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return points(list);
}

/**
 * Stroke dash for an arc covering `fraction` of a circle of radius r, from
 * 12 o'clock clockwise (with the circle rotated -90°).
 */
export function arcDash(r: number, fraction: number): string {
  const length = 2 * Math.PI * r;
  const f = Math.min(Math.max(fraction, 0), 1);
  return `${round(length * f)} ${round(length)}`;
}
