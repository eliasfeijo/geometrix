// The setup and the creation of a battle (spec S-1, S-2; plan sections 5, 8).
// The setup is the battle side of the internal contract v0 (ADR-0008 rule 8):
// what the lab (and, at the junction, the world) hands to the battle.

import { ArenaError, parseArena, type Arena } from "./arena.ts";
import { copyGambits, type Gambit } from "./gambits.ts";
import {
  CELL_COST,
  DNAS,
  REACTIONS,
  type BattleParams,
  type Dna,
  type Reaction,
} from "./params.ts";
import { createRng, nextInt } from "./rng.ts";
import {
  BATTLE_VERSION,
  carryTotal,
  type BattleState,
  type Carry,
  type Participant,
} from "./state.ts";

export type ParticipantSetup = {
  name: string;
  dna: Dna;
  /** HP to start with, 1..maxHp: the wounded fight wounded (D6). */
  hp: number;
  /**
   * The participant's max HP and capacity (junction spec D9): the world owns
   * them (capacity has the world's upgrade), so the setup carries them.
   */
  maxHp: number;
  carry: Carry;
  capacity: number;
  /**
   * A damage of its own instead of its DNA's (the junction's wanderers,
   * D14); absent, the DNA's.
   */
  damage?: number;
  /**
   * The participant's gambits, copied field by field (spec D14). The setup
   * carries the list itself, so a log replays the same whatever the presets
   * become; the presets are only what the lab and the CLI start from (G-3).
   */
  gambits: Gambit[];
  /** How fast the gambits react for this participant (spec D20). */
  reaction: Reaction;
};

export type BattleSetup = {
  /** The combat rule (ADR-0008 rule 7); the grid is the only one so far. */
  rule: "grid";
  /** The arena drawn in text, one string per row (plan section 4). */
  arena: string[];
  seed: number;
  /** Side i spawns on the arena's entry stretch i. */
  sides: ParticipantSetup[][];
};

export class BattleSetupError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(`invalid battle setup: ${reason}`);
    this.name = "BattleSetupError";
    this.reason = reason;
  }
}

const UINT32_RANGE = 0x1_0000_0000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

/** Checks one participant against its DNA's kit; returns why it is invalid. */
export function participantIssue(
  input: unknown,
  params: BattleParams,
): string | null {
  if (!isRecord(input)) return "expected an object";
  const { name, dna, hp, maxHp, carry, capacity, damage, gambits, reaction } =
    input;
  if (typeof name !== "string" || name.length === 0) {
    return "name must be a non-empty string";
  }
  if (!DNAS.includes(dna as Dna)) return `unknown DNA ${String(dna)}`;
  if (!Number.isSafeInteger(maxHp) || (maxHp as number) < 1) {
    return `${name}: max HP must be a positive integer`;
  }
  if (
    !Number.isSafeInteger(hp) ||
    (hp as number) < 1 ||
    (hp as number) > (maxHp as number)
  ) {
    return `${name}: HP must be an integer in 1..${String(maxHp)}`;
  }
  if (!Number.isSafeInteger(capacity) || (capacity as number) < 1) {
    return `${name}: capacity must be a positive integer`;
  }
  if (!isRecord(carry) || !isCount(carry.materia) || !isCount(carry.cristal)) {
    return `${name}: carry must have non-negative integer materia and cristal`;
  }
  if (carryTotal(carry as Carry) > (capacity as number)) {
    return `${name}: carry above the capacity of ${capacity}`;
  }
  if (
    damage !== undefined &&
    (!Number.isSafeInteger(damage) || (damage as number) < 1)
  ) {
    return `${name}: damage must be a positive integer`;
  }
  const list = copyGambits(gambits, params.gambits.maxRules);
  if (typeof list === "string") return `${name}: ${list}`;
  if (!REACTIONS.includes(reaction as Reaction)) {
    return `${name}: reaction must be ${REACTIONS.join(", ")}`;
  }
  return null;
}

/**
 * Why a setup is invalid (spec S-2), or null. It parses the arena, so it also
 * reports what is wrong with it.
 */
export function setupIssue(
  input: unknown,
  params: BattleParams,
): string | null {
  if (!isRecord(input)) return "expected an object";
  const { rule, arena: rows, seed, sides } = input;
  if (rule !== "grid") return `unknown rule ${String(rule)}`;
  if (
    !Number.isSafeInteger(seed) ||
    (seed as number) < 0 ||
    (seed as number) >= UINT32_RANGE
  ) {
    return "seed must be an integer in [0, 2^32)";
  }
  if (!Array.isArray(rows) || !rows.every((row) => typeof row === "string")) {
    return "arena must be a list of rows";
  }
  let arena: Arena;
  try {
    arena = parseArena(rows as string[]);
  } catch (error) {
    if (error instanceof ArenaError) return error.message;
    throw error;
  }
  if (!Array.isArray(sides) || sides.length < 2) {
    return "needs at least two sides";
  }
  if (sides.length > params.limits.maxSides) {
    return `at most ${params.limits.maxSides} sides`;
  }
  for (let side = 0; side < sides.length; side++) {
    const members: unknown = sides[side];
    const entry = arena.entries[side];
    if (entry === undefined) return `side ${side} has no entry stretch`;
    if (!Array.isArray(members) || members.length === 0) {
      return `side ${side} has no participants`;
    }
    if (members.length > params.limits.maxPerSide) {
      return `side ${side}: at most ${params.limits.maxPerSide} participants`;
    }
    if (members.length > entry.cells.length) {
      return `side ${side}: ${members.length} participants for ${entry.cells.length} entry cells`;
    }
    for (const member of members) {
      const issue = participantIssue(member, params);
      if (issue !== null) return `side ${side}: ${issue}`;
    }
  }
  return null;
}

/** The cells of an entry stretch nobody stands on, in index order. */
export function freeEntryCells(state: BattleState, entry: number): number[] {
  const taken = new Set(state.participants.map((p) => p.cell));
  return state.arena.entries[entry]!.cells.filter((c) => !taken.has(c));
}

/**
 * A free cell of an entry stretch, drawn by the rng (plan section 8), or null
 * when every cell is taken. One rng call whenever a cell is free.
 */
export function drawEntryCell(
  state: BattleState,
  entry: number,
): number | null {
  const free = freeEntryCells(state, entry);
  if (free.length === 0) return null;
  return free[nextInt(state.rng, free.length)]!;
}

/**
 * The stretch a new side enters by (spec E-1, plan section 8): the first one
 * no side with participants in the arena is using, or null.
 */
export function freeStretch(state: BattleState): number | null {
  const used = new Set(
    state.participants.map(
      (p) => state.sides.find((s) => s.id === p.side)!.entry,
    ),
  );
  const entry = state.arena.entries.findIndex((_, i) => !used.has(i));
  return entry < 0 ? null : entry;
}

/**
 * A participant entering on `side` (spec S-1): a free cell of the side's
 * stretch, facing inward, idle clock at zero, under its gambits. Returns null
 * when the stretch is full.
 */
export function placeParticipant(
  state: BattleState,
  side: number,
  setup: ParticipantSetup,
): Participant | null {
  const entry = state.sides.find((s) => s.id === side)!.entry;
  const cell = drawEntryCell(state, entry);
  if (cell === null) return null;
  const participant: Participant = {
    id: state.nextId++,
    side,
    name: setup.name,
    dna: setup.dna,
    cell,
    facing: state.arena.entries[entry]!.facing,
    hp: setup.hp,
    maxHp: setup.maxHp,
    carry: { materia: setup.carry.materia, cristal: setup.carry.cristal },
    capacity: setup.capacity,
    ...(setup.damage === undefined ? {} : { damage: setup.damage }),
    controller: "gambits",
    gambits: copyGambits(
      setup.gambits,
      state.params.gambits.maxRules,
    ) as Gambit[],
    reaction: setup.reaction,
    intent: {
      move: null,
      attack: false,
      attackLatch: false,
      drop: false,
      pickup: false,
      bag: null,
    },
    // Whoever is born or joins has stood still: its first step is ready (D22).
    movePoints: CELL_COST,
    cooldownTicks: 0,
    exitTicks: 0,
    ai: { nextDecisionTick: state.tick, target: null },
  };
  state.participants.push(participant);
  state.totals.push({ id: participant.id, dealt: 0, taken: 0 });
  return participant;
}

/**
 * Creates a battle from a valid setup (spec S-1), or throws BattleSetupError
 * with the reason (S-2). Participants spawn side by side, in setup order.
 */
export function createBattle(
  setup: BattleSetup,
  params: BattleParams,
): BattleState {
  const issue = setupIssue(setup, params);
  if (issue !== null) throw new BattleSetupError(issue);
  const state: BattleState = {
    battleVersion: BATTLE_VERSION,
    params,
    arena: parseArena(setup.arena),
    rng: createRng(setup.seed),
    tick: 0,
    nextId: 1,
    sides: setup.sides.map((_, id) => ({ id, entry: id })),
    participants: [],
    projectiles: [],
    piles: [],
    departed: [],
    totals: [],
    idleTicks: 0,
    ended: null,
  };
  setup.sides.forEach((members, side) => {
    for (const member of members) placeParticipant(state, side, member);
  });
  return state;
}
