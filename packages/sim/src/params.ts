// Balancing parameters (spec section 6). Values live in params/*.json, never in
// code. Every leaf is a non-negative integer: durations in world seconds,
// multipliers in per mille (plan section 3).

export const DNAS = ["square", "triangle", "circle"] as const;
export type Dna = (typeof DNAS)[number];

export const RESOURCES = ["materia", "cristal"] as const;
export type Resource = (typeof RESOURCES)[number];

type Leaf = { readonly min: number };
type Schema = { readonly [key: string]: Leaf | Schema };

const nonNegative: Leaf = { min: 0 };
const positive: Leaf = { min: 1 };

const cost = { materia: nonNegative, cristal: nonNegative } as const;
const dna = { capacity: positive, cellsPerMinute: positive } as const;
const hpDna = { max: positive } as const;

const schema = {
  world: {
    durationSeconds: positive,
    tickSeconds: positive,
    /**
     * The time multiplier (×N) these params are tuned for (M2 R plan P1):
     * world seconds per real second. The sim never reads it; the lobby,
     * `dev:multi` and the harness's real time default to it. A world keeps
     * its own ×N.
     */
    multiplier: positive,
  },
  map: {
    width: positive,
    height: positive,
    riverRows: positive,
    crossings: positive,
    crossingWidth: positive,
    /** Core zone, in rows counted from the team's own map edge. */
    core: {
      minRow: nonNegative,
      maxRow: nonNegative,
      minCol: nonNegative,
      maxCol: nonNegative,
    },
    rocks: {
      clustersPerSide: nonNegative,
      minCells: positive,
      maxCells: positive,
      /** No rock within this Manhattan distance of a core. */
      coreClearance: nonNegative,
    },
  },
  population: {
    initial: {
      square: nonNegative,
      triangle: nonNegative,
      circle: nonNegative,
    },
    cap: positive,
  },
  teams: {
    initialStock: cost,
    /** Human players per team (spec D6); bots do not count. */
    maxHumans: positive,
  },
  dna: { square: dna, triangle: dna, circle: dna },
  movementPermille: {
    road: positive,
    jungle: positive,
    crossing: positive,
    loaded: positive,
  },
  deposits: {
    materia: {
      amount: positive,
      regen: { amount: nonNegative, everySeconds: positive },
      perSide: nonNegative,
      minCoreDistance: nonNegative,
      maxCoreDistance: nonNegative,
    },
    cristal: {
      amount: positive,
      perSide: nonNegative,
      minCoreDistance: nonNegative,
      /** Total across both sides; half on each side, near a crossing. */
      contested: nonNegative,
      contestedMaxCrossingDistance: positive,
      contestedMaxRiverDistance: positive,
    },
  },
  /**
   * The gather pace of each resource, the same for every DNA (fog F6, E2): a
   * creep at the deposit takes `units` on each world second that is a multiple
   * of `everySeconds`.
   */
  gather: {
    materia: { units: positive, everySeconds: positive },
    cristal: { units: positive, everySeconds: positive },
  },
  creep: { cost, productionSeconds: positive },
  road: { cost, buildSeconds: positive },
  upgrade: { capacity: { cost, bonusPermille: nonNegative } },
  autopilot: { maxRules: positive },
  domination: {
    cost,
    cooldownSeconds: nonNegative,
    /** 0 = no distance limit. */
    maxDistanceCells: nonNegative,
  },
  /**
   * Sight radii (M1.5 fog spec V-1), Manhattan, in cells: the core's and each
   * creep's by DNA. Rocks block the line of sight. A creep sees at least its
   * neighbors, so the next cell of its path is always known (fog plan §5).
   */
  vision: {
    core: nonNegative,
    dna: { square: positive, triangle: positive, circle: positive },
  },
  /**
   * Hit points (M2 encontro spec D2, D3; plan P1). The state keeps HP in
   * thousandths, so the per-mille rates below give integers; a battle takes
   * them in whole points (junction spec D9). Regeneration is per mille of the maximum per world minute, faster within
   * `coreZoneRadius` (Manhattan) of the team's own core; the same radius ends
   * a safe conduct (D9).
   */
  hp: {
    dna: { square: hpDna, triangle: hpDna, circle: hpDna },
    regenPermillePerMinute: { map: nonNegative, coreZone: nonNegative },
    coreZoneRadius: nonNegative,
  },
  /**
   * Fleeing (M2 encontro D10, junction D7): who escapes a battle by the
   * border runs to its core at `speedPermille` for `seconds`.
   */
  flee: {
    speedPermille: positive,
    seconds: positive,
  },
  /**
   * The battle as the world sees it (junction spec D5, D6): its bubble is a
   * `window` of world cells centered on the battle cell (odd sides), each
   * drawn as `cellBlock` × `cellBlock` arena cells by the junction host; a
   * side takes at most `sideCap` participants and a battle at most
   * `maxSides` sides. Each side spawns in a `zone` of `depth` × `breadth`
   * arena cells (the lab's arenas: 3 × 5), across the way it faces, its
   * center `insetPermille` of the way from the arena's edge to its center
   * (junction checkpoint C1-3; 500 is halfway).
   */
  battle: {
    window: { width: positive, height: positive, cellBlock: positive },
    sideCap: positive,
    maxSides: positive,
    zone: { depth: positive, breadth: positive, insetPermille: positive },
  },
  /**
   * The encounter (D5, D6): it opens within `radius` (Manhattan); a dominated
   * victim's player has `reactionSeconds` to answer.
   */
  encounter: { radius: nonNegative, reactionSeconds: nonNegative },
  /**
   * After paying (D9): immune to the extorting team for `seconds`; the same
   * aggressor cannot extort the same creep again for `blockSeconds`.
   */
  safeConduct: { seconds: nonNegative, blockSeconds: nonNegative },
  /**
   * The wanderers (junction spec D14, plan section 9): circles of their own
   * with `hp` and battle `damage` below the circle's; the rest of their kit,
   * their world speed, sight and capacity are the circle's. They are born in
   * the band of rows within `bandRows` of the river, outside the core zones:
   * the first at `firstSeconds`, then every `intervalSeconds`, shrinking
   * linearly from `start` to `end` over the world's duration, while fewer
   * than `cap` are alive (0: none). After a battle a wanderer leaves alone
   * the creeps that were in it with it for `spareSeconds` (W-7).
   */
  wanderers: {
    hp: positive,
    damage: positive,
    bandRows: nonNegative,
    firstSeconds: nonNegative,
    intervalSeconds: { start: positive, end: positive },
    cap: nonNegative,
    spareSeconds: nonNegative,
  },
} as const satisfies Schema;

type FromSchema<S> = {
  readonly [K in keyof S]: S[K] extends Leaf ? number : FromSchema<S[K]>;
};

export type Params = FromSchema<typeof schema>;
export type Cost = Params["creep"]["cost"];

export class ParamsError extends Error {
  readonly issues: readonly string[];
  constructor(issues: readonly string[]) {
    super(`invalid params:\n- ${issues.join("\n- ")}`);
    this.name = "ParamsError";
    this.issues = issues;
  }
}

function isLeaf(node: Leaf | Schema): node is Leaf {
  return typeof node.min === "number";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkNode(
  node: Schema,
  value: unknown,
  path: string,
  issues: string[],
): void {
  if (!isRecord(value)) {
    issues.push(`${path || "params"}: expected an object`);
    return;
  }
  for (const key of Object.keys(node).sort()) {
    const child = node[key]!;
    const childPath = path ? `${path}.${key}` : key;
    const childValue = value[key];
    if (childValue === undefined) {
      issues.push(`${childPath}: missing`);
    } else if (isLeaf(child)) {
      if (!Number.isSafeInteger(childValue)) {
        issues.push(`${childPath}: expected an integer`);
      } else if ((childValue as number) < child.min) {
        issues.push(`${childPath}: must be >= ${child.min}`);
      }
    } else {
      checkNode(child, childValue, childPath, issues);
    }
  }
  for (const key of Object.keys(value).sort()) {
    if (!(key in node)) issues.push(`${path ? `${path}.` : ""}${key}: unknown`);
  }
}

function checkConsistency(p: Params, issues: string[]): void {
  const { tickSeconds } = p.world;
  const durations: [string, number][] = [
    ["world.durationSeconds", p.world.durationSeconds],
    [
      "deposits.materia.regen.everySeconds",
      p.deposits.materia.regen.everySeconds,
    ],
    ["gather.materia.everySeconds", p.gather.materia.everySeconds],
    ["gather.cristal.everySeconds", p.gather.cristal.everySeconds],
    ["creep.productionSeconds", p.creep.productionSeconds],
    ["road.buildSeconds", p.road.buildSeconds],
    ["domination.cooldownSeconds", p.domination.cooldownSeconds],
    ["flee.seconds", p.flee.seconds],
    ["encounter.reactionSeconds", p.encounter.reactionSeconds],
    ["safeConduct.seconds", p.safeConduct.seconds],
    ["safeConduct.blockSeconds", p.safeConduct.blockSeconds],
    ["wanderers.firstSeconds", p.wanderers.firstSeconds],
    ["wanderers.intervalSeconds.start", p.wanderers.intervalSeconds.start],
    ["wanderers.intervalSeconds.end", p.wanderers.intervalSeconds.end],
    ["wanderers.spareSeconds", p.wanderers.spareSeconds],
  ];
  for (const [path, seconds] of durations) {
    if (seconds % tickSeconds !== 0) {
      issues.push(`${path}: must be a multiple of world.tickSeconds`);
    }
  }
  // HP regenerates once per world minute (M2 encontro plan P1).
  if (60 % tickSeconds !== 0) {
    issues.push(
      "world.tickSeconds: must divide 60 (HP regenerates per minute)",
    );
  }
  // The window is centered on the battle cell and fits in the map (D5).
  const { window } = p.battle;
  if (window.width % 2 === 0) issues.push("battle.window.width: must be odd");
  if (window.height % 2 === 0) {
    issues.push("battle.window.height: must be odd");
  }
  if (window.width > p.map.width) {
    issues.push("battle.window.width: must be <= map.width");
  }
  if (window.height > p.map.height) {
    issues.push("battle.window.height: must be <= map.height");
  }
  if (p.battle.maxSides < 2) issues.push("battle.maxSides: must be >= 2");
  // The arena has a center cell and four spawn zones centered on their row
  // or column, each with room for a full side (junction plan P7).
  if (window.cellBlock % 2 === 0) {
    issues.push("battle.window.cellBlock: must be odd");
  }
  if (p.battle.maxSides > 4) issues.push("battle.maxSides: must be <= 4");
  const { zone } = p.battle;
  if (zone.depth % 2 === 0) issues.push("battle.zone.depth: must be odd");
  if (zone.breadth % 2 === 0) issues.push("battle.zone.breadth: must be odd");
  if (p.battle.sideCap > zone.depth * zone.breadth) {
    issues.push("battle.sideCap: must fit in a zone (depth × breadth)");
  }
  if (zone.insetPermille >= 1000) {
    issues.push("battle.zone.insetPermille: must be < 1000");
  }
  const { intervalSeconds } = p.wanderers;
  if (intervalSeconds.end > intervalSeconds.start) {
    issues.push("wanderers.intervalSeconds.end: must be <= start");
  }
  // Point symmetry (plan section 6) needs even sides and a centered river.
  if (p.map.width % 2 !== 0) issues.push("map.width: must be even");
  if (p.map.height % 2 !== 0) issues.push("map.height: must be even");
  if (p.map.riverRows % 2 !== 0) issues.push("map.riverRows: must be even");
  if (p.map.riverRows >= p.map.height) {
    issues.push("map.riverRows: must be smaller than map.height");
    return;
  }
  // An odd crossing count puts one crossing on the center line, which is only
  // symmetric with an even width.
  if (p.map.crossingWidth % 2 !== 0) {
    issues.push("map.crossingWidth: must be even");
  }
  if (p.deposits.cristal.contested % 2 !== 0) {
    issues.push("deposits.cristal.contested: must be even (half per side)");
  }
  const sideRows = (p.map.height - p.map.riverRows) / 2;
  const { core, rocks } = p.map;
  if (core.minRow > core.maxRow || core.maxRow >= sideRows) {
    issues.push("map.core: rows must satisfy minRow <= maxRow < side height");
  }
  if (core.minCol > core.maxCol || core.maxCol >= p.map.width) {
    issues.push("map.core: cols must satisfy minCol <= maxCol < map.width");
  }
  if (rocks.minCells > rocks.maxCells) {
    issues.push("map.rocks: minCells must be <= maxCells");
  }
  const { materia } = p.deposits;
  if (materia.minCoreDistance > materia.maxCoreDistance) {
    issues.push("deposits.materia: minCoreDistance must be <= maxCoreDistance");
  }
}

/** Validates untrusted input (e.g. parsed JSON) and returns typed params. */
export function parseParams(input: unknown): Params {
  const issues: string[] = [];
  checkNode(schema, input, "", issues);
  if (issues.length === 0) checkConsistency(input as Params, issues);
  if (issues.length > 0) throw new ParamsError(issues);
  return input as Params;
}
