import { readFileSync } from "node:fs";
import {
  parseBattleParams,
  type BattleParams,
  type Dna,
} from "../src/params.ts";
import { DIRS, type Dir } from "../src/arena.ts";
import { createRng, nextInt } from "../src/rng.ts";
import {
  createBattle,
  type BattleSetup,
  type ParticipantSetup,
} from "../src/setup.ts";
import type { BattleEvent } from "../src/events.ts";
import type { BattleState, Participant } from "../src/state.ts";
import { stepBattle } from "../src/step.ts";

const DEFAULT_PARAMS_URL = new URL(
  "../../../params/battle.json",
  import.meta.url,
);
const TEST_PARAMS_URL = new URL("./params.json", import.meta.url);

/** params/battle.json as parsed JSON, before validation. */
export function readDefaultParamsJson(): unknown {
  return JSON.parse(readFileSync(DEFAULT_PARAMS_URL, "utf8"));
}

/**
 * test/params.json as parsed JSON: the fixed params the tests run on (the
 * spec section 6 values). They do not follow balancing, so a new
 * params/battle.json does not break tests that spell out speeds and damage.
 */
export function readTestParamsJson(): unknown {
  return JSON.parse(readFileSync(TEST_PARAMS_URL, "utf8"));
}

/** test/params.json, validated. */
export function loadTestParams(): BattleParams {
  return parseBattleParams(readTestParamsJson());
}

export const ARENA_NAMES = ["aberta", "pedras", "corredor"] as const;

/** An arena of params/arenas, one string per row. */
export function readArenaRows(name: string): string[] {
  const url = new URL(`../../../params/arenas/${name}.txt`, import.meta.url);
  return readFileSync(url, "utf8").trimEnd().split("\n");
}

/** A participant of the setup, at full HP and with no carry unless given. */
export function member(
  dna: Dna,
  overrides: Partial<ParticipantSetup> = {},
): ParticipantSetup {
  // An unknown DNA (to test the refusal) gets HP 1.
  const hp = (loadTestParams().dna[dna] as { hp: number } | undefined)?.hp ?? 1;
  return {
    name: dna,
    dna,
    hp,
    carry: { materia: 0, cristal: 0 },
    gambits: [],
    reaction: "normal",
    ...overrides,
  };
}

export function setupOf(
  arena: string[],
  sides: ParticipantSetup[][],
  seed = 42,
): BattleSetup {
  return { rule: "grid", arena, seed, sides };
}

/**
 * A small arena for rule tests, 9 × 7: stretch 1 on the left lap, stretch 2
 * on the right, rows 2 to 4.
 */
export const FIELD = [
  ".........",
  ".........",
  ".1.....2.",
  ".1.....2.",
  ".1.....2.",
  ".........",
  ".........",
];

/** A battle on `rows` with one participant per entry of `dnas`, side by side. */
export function battleOn(
  rows: string[],
  sides: (Dna | ParticipantSetup)[][],
  seed = 42,
): BattleState {
  const setup = setupOf(
    rows,
    sides.map((list) =>
      list.map((m) => (typeof m === "string" ? member(m) : m)),
    ),
    seed,
  );
  return createBattle(setup, loadTestParams());
}

/** Moves participant `id` to (x, y), optionally facing `facing`. */
export function put(
  state: BattleState,
  id: number,
  x: number,
  y: number,
  facing?: Dir,
): Participant {
  const participant = state.participants.find((p) => p.id === id)!;
  participant.cell = y * state.arena.width + x;
  if (facing !== undefined) participant.facing = facing;
  return participant;
}

/** The (x, y) of participant `id`. */
export function xyOf(state: BattleState, id: number): [number, number] {
  const { cell } = state.participants.find((p) => p.id === id)!;
  return [cell % state.arena.width, Math.floor(cell / state.arena.width)];
}

/** Puts every participant under the human, so nothing moves on its own. */
export function humans(state: BattleState): BattleState {
  for (const p of state.participants) p.controller = "human";
  return state;
}

/**
 * Steps `ticks` times; the first step gets `commands`. Returns every event,
 * in order.
 */
export function run(
  state: BattleState,
  ticks: number,
  commands: unknown[] = [],
): BattleEvent[] {
  const events: BattleEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    events.push(...stepBattle(state, i === 0 ? commands : []));
  }
  return events;
}

/**
 * A 3 × 3 on `rows` (ids 1 to 6), wounded and with some carry. On the small
 * FIELD (the default) the sides meet fast, and random commands also kill.
 */
export function brawlSetup(seed: number, rows: string[] = FIELD): BattleSetup {
  const side = () => [
    member("square", { hp: 90, carry: { materia: 10, cristal: 5 } }),
    member("triangle", { hp: 60 }),
    member("circle", { hp: 48, carry: { materia: 0, cristal: 4 } }),
  ];
  return setupOf(rows, [side(), side()], seed);
}

/** The brawl of `brawlSetup`, every participant under the human. */
export function brawl(seed: number, rows: string[] = FIELD): BattleState {
  return humans(createBattle(brawlSetup(seed, rows), loadTestParams()));
}

/**
 * A seeded stream of human commands for participants 1 to `ids`, per tick:
 * intents (walk and attack), turns, latches, drops and pickups. Commands for
 * participants who left are refused by the battle, as they would be.
 */
export function plan(seed: number, ticks: number, ids = 6): unknown[][] {
  const input = createRng(seed);
  return Array.from({ length: ticks }, () => {
    const commands: unknown[] = [];
    for (let id = 1; id <= ids; id++) {
      if (nextInt(input, 5) !== 0) continue;
      const dir = DIRS[nextInt(input, 4)]!;
      switch (nextInt(input, 6)) {
        case 0:
          commands.push({ type: "intent", id, move: null, attack: false });
          break;
        case 1:
        case 2:
          commands.push({
            type: "intent",
            id,
            move: dir,
            attack: nextInt(input, 2) === 0,
          });
          break;
        case 3:
          commands.push({ type: "face", id, dir });
          commands.push({ type: "attackOnce", id });
          break;
        case 4:
          commands.push({ type: "drop", id });
          break;
        default:
          commands.push({ type: "pickup", id });
      }
    }
    return commands;
  });
}

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };

/** test/params.json changed by `edit`, then validated. */
export function paramsWith(
  edit: (params: Mutable<BattleParams>) => void,
): BattleParams {
  const params = readTestParamsJson() as Mutable<BattleParams>;
  edit(params);
  return parseBattleParams(params);
}
