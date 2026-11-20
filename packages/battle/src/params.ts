// Battle parameters (M2 laboratório spec section 6, plan section 3). Values
// live in params/battle.json, never in code. Every leaf is a non-negative
// integer: durations in milliseconds, multiples of one tick; speeds in cells
// per second; modifiers in per mille. Same format as the sim's params
// (ADR-0008 rule 3), but its own schema: the battle does not import the sim.

export const DNAS = ["square", "triangle", "circle"] as const;
export type Dna = (typeof DNAS)[number];

/**
 * How fast a participant under the gambits reacts (spec D20): the difficulty
 * of the AI, chosen per participant in the setup.
 */
export const REACTIONS = ["easy", "normal", "hard"] as const;
export type Reaction = (typeof REACTIONS)[number];

/**
 * Movement points per cell (plan P2), as the sim's CELL_COST: a creep gains
 * `cellsPerSecond × CELL_COST ÷ ticksPerSecond` points per tick, so it has to
 * be divisible by the tick rate.
 */
export const CELL_COST = 6000;

type Leaf = { readonly min: number };
type Schema = { readonly [key: string]: Leaf | Schema };

const nonNegative: Leaf = { min: 0 };
const positive: Leaf = { min: 1 };

/**
 * The combat kit of a DNA (spec D6). `projectileCellsPerSecond` 0 is a melee
 * attack: it hits the cell in front (plan section 3).
 */
const dna = {
  hp: positive,
  damage: positive,
  range: positive,
  cooldownMs: positive,
  cellsPerSecond: positive,
  projectileCellsPerSecond: nonNegative,
  capacity: positive,
} as const;

/** One level of the AI's reaction time (spec D20, plan P12). */
const reaction = {
  decisionMs: positive,
  decisionJitterMs: nonNegative,
} as const;

const schema = {
  tick: { ticksPerSecond: positive },
  /**
   * The countdown at the start of a battle (spec D21, S-4): everyone stands
   * still and may only turn. 0 starts the fight at once.
   */
  start: { countdownMs: nonNegative },
  dna: { square: dna, triangle: dna, circle: dna },
  /** A full bag slows the creep by this much (spec D8), linearly with the load. */
  carry: { fullBrakePermille: nonNegative },
  /** Time on an exit cell, without being hit, to escape (spec D7). */
  exit: { dwellMs: positive },
  /** Time without dealing or taking damage before fleeing (spec D9). */
  inactivity: { timeoutMs: positive },
  /**
   * The gambits decide every `decisionMs` ± `decisionJitterMs` (plan P12),
   * by the participant's reaction (spec D20).
   */
  ai: { easy: reaction, normal: reaction, hard: reaction },
  /**
   * `meleeBerthSteps`: a ranged action's way keeps this many steps (around
   * rock) from a melee enemy when it can (checkpoint C12: the corner bait);
   * 0 turns it off.
   */
  gambits: { maxRules: positive, meleeBerthSteps: nonNegative },
  limits: { maxSides: positive, maxPerSide: positive },
} as const satisfies Schema;

type FromSchema<S> = {
  readonly [K in keyof S]: S[K] extends Leaf ? number : FromSchema<S[K]>;
};

export type BattleParams = FromSchema<typeof schema>;
export type DnaParams = BattleParams["dna"]["square"];

/** Arenas mark entry stretches with the digits 1 to 4 (plan section 4). */
const MAX_ARENA_SIDES = 4;

export class BattleParamsError extends Error {
  readonly issues: readonly string[];
  constructor(issues: readonly string[]) {
    super(`invalid battle params:\n- ${issues.join("\n- ")}`);
    this.name = "BattleParamsError";
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

function checkConsistency(p: BattleParams, issues: string[]): void {
  const { ticksPerSecond } = p.tick;
  if (1000 % ticksPerSecond !== 0) {
    issues.push("tick.ticksPerSecond: must divide 1000 (durations are in ms)");
    return;
  }
  if (CELL_COST % ticksPerSecond !== 0) {
    issues.push(`tick.ticksPerSecond: must divide CELL_COST (${CELL_COST})`);
  }
  const tickMs = 1000 / ticksPerSecond;
  const durations: [string, number][] = [
    ...DNAS.map((d): [string, number] => [
      `dna.${d}.cooldownMs`,
      p.dna[d].cooldownMs,
    ]),
    ["start.countdownMs", p.start.countdownMs],
    ["exit.dwellMs", p.exit.dwellMs],
    ["inactivity.timeoutMs", p.inactivity.timeoutMs],
    ...REACTIONS.flatMap((r): [string, number][] => [
      [`ai.${r}.decisionMs`, p.ai[r].decisionMs],
      [`ai.${r}.decisionJitterMs`, p.ai[r].decisionJitterMs],
    ]),
  ];
  for (const [path, ms] of durations) {
    if (ms % tickMs !== 0) {
      issues.push(`${path}: must be a multiple of one tick (${tickMs} ms)`);
    }
  }
  // The next decision is at least one tick away.
  for (const r of REACTIONS) {
    if (p.ai[r].decisionJitterMs >= p.ai[r].decisionMs) {
      issues.push(
        `ai.${r}.decisionJitterMs: must be smaller than ai.${r}.decisionMs`,
      );
    }
  }
  // A full bag slows, it never stops the creep (spec D8).
  if (p.carry.fullBrakePermille >= 1000) {
    issues.push("carry.fullBrakePermille: must be < 1000");
  }
  if (p.limits.maxSides < 2 || p.limits.maxSides > MAX_ARENA_SIDES) {
    issues.push(`limits.maxSides: must be between 2 and ${MAX_ARENA_SIDES}`);
  }
}

/** Validates untrusted input (e.g. parsed JSON) and returns typed params. */
export function parseBattleParams(input: unknown): BattleParams {
  const issues: string[] = [];
  checkNode(schema, input, "", issues);
  if (issues.length === 0) checkConsistency(input as BattleParams, issues);
  if (issues.length > 0) throw new BattleParamsError(issues);
  return input as BattleParams;
}

/** A duration from the params in ticks (exact: checkConsistency). */
export function msToTicks(params: BattleParams, ms: number): number {
  return (ms * params.tick.ticksPerSecond) / 1000;
}

/** Movement points a creep or projectile gains per tick at full speed. */
export function pointsPerTick(
  params: BattleParams,
  cellsPerSecond: number,
): number {
  return (cellsPerSecond * CELL_COST) / params.tick.ticksPerSecond;
}

/** Ticks of the countdown at the start of a battle (spec D21, S-4). */
export function countdownTicks(params: BattleParams): number {
  return msToTicks(params, params.start.countdownMs);
}
