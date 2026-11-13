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

const schema = {
  world: { durationSeconds: positive, tickSeconds: positive },
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
  creep: { cost, productionSeconds: positive },
  road: { cost, buildSeconds: positive },
  upgrade: { capacity: { cost, bonusPermille: nonNegative } },
  domination: {
    cost,
    timeoutSeconds: positive,
    cooldownSeconds: nonNegative,
    /** 0 = no distance limit. */
    maxDistanceCells: nonNegative,
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
    ["creep.productionSeconds", p.creep.productionSeconds],
    ["road.buildSeconds", p.road.buildSeconds],
    ["domination.timeoutSeconds", p.domination.timeoutSeconds],
    ["domination.cooldownSeconds", p.domination.cooldownSeconds],
  ];
  for (const [path, seconds] of durations) {
    if (seconds % tickSeconds !== 0) {
      issues.push(`${path}: must be a multiple of world.tickSeconds`);
    }
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
