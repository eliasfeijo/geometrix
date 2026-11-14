// The fog over the map (M1.5 fog spec C-1): never seen in black, seen before
// but out of sight under a veil, in sight clear. Built from the view's known
// and visible arrays as two SVG paths of row runs, so the whole fog is two
// elements however the sight is shaped.

/** What the team knows of a cell. */
export const Sight = { unseen: 0, remembered: 1, visible: 2 } as const;
export type Sight = (typeof Sight)[keyof typeof Sight];

/** Path data of the never seen cells and of the remembered ones. */
export type FogPaths = { unseen: string; remembered: string };

/** Each cell's Sight, from known (-1 never seen) and visible (cell indices). */
export function sightOf(
  known: readonly number[],
  visible: readonly number[],
): Sight[] {
  const sight = known.map<Sight>((t) =>
    t < 0 ? Sight.unseen : Sight.remembered,
  );
  for (const i of visible) sight[i] = Sight.visible;
  return sight;
}

/** Runs of equal sight along each row, as path data per kind of fog. */
export function fogPaths(
  known: readonly number[],
  visible: readonly number[],
  width: number,
): FogPaths {
  const sight = sightOf(known, visible);
  const unseen: string[] = [];
  const remembered: string[] = [];
  const height = Math.floor(sight.length / width);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width;) {
      const kind = sight[y * width + x]!;
      let end = x + 1;
      while (end < width && sight[y * width + end] === kind) end++;
      const run = `M${x} ${y}h${end - x}v1h${x - end}z`;
      if (kind === Sight.unseen) unseen.push(run);
      else if (kind === Sight.remembered) remembered.push(run);
      x = end;
    }
  }
  return { unseen: unseen.join(""), remembered: remembered.join("") };
}

/** Whether the cell is in the team's sight now; fullView (team -1) sees all. */
export function inSight(
  seen: { team: number; visible: readonly number[] },
  cell: { x: number; y: number },
  width: number,
): boolean {
  return seen.team < 0 || seen.visible.includes(cell.y * width + cell.x);
}
