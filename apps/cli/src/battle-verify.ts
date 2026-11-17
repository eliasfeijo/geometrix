// geo battle verify (M2 laboratório spec R-2, R-3; plan section 12): the same
// setup and commands reach the same hash in every way of getting there: two
// runs, a snapshot → restore halfway, and a replay of the log through JSON.
// With a log exported by the lab, the replay reaches the lab's hash.

import { createHash } from "node:crypto";
import {
  canonicalJson,
  createBattle,
  createLog,
  createRng,
  defaultGambits,
  DIRS,
  nextInt,
  presetGambits,
  replayLog,
  restoreBattle,
  serializeBattle,
  stepBattle,
  stepLogged,
  type BattleEvent,
  type BattleParams,
  type BattleSetup,
} from "@geometrix/battle";
import {
  ARENAS,
  battleHash,
  MAX_BATTLE_SECONDS,
  readArena,
  scenarios,
} from "./battle.ts";

/** sha256 of the events, one canonical JSON line each, however split. */
class EventHash {
  private readonly hash = createHash("sha256");
  count = 0;
  add(events: readonly BattleEvent[]): void {
    for (const event of events) {
      this.hash.update(`${canonicalJson(event)}\n`);
      this.count += 1;
    }
  }
  digest(): string {
    return this.hash.copy().digest("hex");
  }
}

/**
 * A scripted human for the verify sample, from its own rng: it dominates
 * participant 1 and presses keys at random, a reinforcement joins on a new
 * side, participant 2 gets another gambit list, and the domination is
 * released. It exercises every command kind of the log (spec R-2).
 */
export function scriptedCommands(seed: number, ticks: number): unknown[][] {
  const input = createRng(seed);
  return Array.from({ length: ticks }, (_, tick) => {
    const commands: unknown[] = [];
    if (tick === 0)
      commands.push({ type: "control", id: 1, controller: "human" });
    if (tick === 40) {
      commands.push({
        type: "join",
        side: 2,
        participant: {
          name: "reforço",
          dna: "triangle",
          hp: 200,
          carry: { materia: 0, cristal: 0 },
          gambits: defaultGambits("triangle"),
          reaction: "hard",
        },
      });
    }
    if (tick === 120) {
      commands.push({
        type: "setGambits",
        id: 2,
        gambits: presetGambits("skirmisher"),
      });
    }
    if (tick === 400)
      commands.push({ type: "control", id: 1, controller: "gambits" });
    if (tick < 400 && nextInt(input, 6) === 0) {
      const dir = DIRS[nextInt(input, 4)]!;
      switch (nextInt(input, 4)) {
        case 0:
          commands.push({ type: "intent", id: 1, move: dir, attack: false });
          break;
        case 1:
          commands.push({ type: "intent", id: 1, move: null, attack: true });
          break;
        case 2:
          commands.push({ type: "face", id: 1, dir });
          commands.push({ type: "attackOnce", id: 1 });
          break;
        default:
          commands.push({ type: "intent", id: 1, move: null, attack: false });
      }
    }
    return commands;
  });
}

export type VerifyCase = {
  name: string;
  ticks: number;
  /** Each way of reaching the end: its state hash (and events hash). */
  runs: { name: string; hash: string; eventsHash: string | null }[];
  ok: boolean;
};

type Sample = { name: string; setup: BattleSetup; scripted: boolean };

/** The verify sample: a slice of the matrix on every arena, plus a human. */
function sample(params: BattleParams, seed: number): Sample[] {
  const all = scenarios(params);
  const pick = (id: string) => all.find((s) => s.id === id)!;
  const list: Sample[] = [];
  for (const arena of ARENAS) {
    list.push({
      name: `3x3 ${arena}`,
      setup: {
        rule: "grid",
        arena: readArena(arena),
        seed,
        sides: pick("3x3").sides,
      },
      scripted: false,
    });
  }
  list.push({
    name: "1x1x1 corredor",
    setup: {
      rule: "grid",
      arena: readArena("corredor"),
      seed,
      sides: pick("1x1x1").sides,
    },
    scripted: false,
  });
  list.push({
    name: "carry drop pedras",
    setup: {
      rule: "grid",
      arena: readArena("pedras"),
      seed,
      sides: pick("carry drop").sides,
    },
    scripted: false,
  });
  list.push({
    name: "1x1 square-circle pedras, human + lab commands",
    setup: {
      rule: "grid",
      arena: readArena("pedras"),
      seed,
      sides: pick("1x1 square-circle").sides,
    },
    scripted: true,
  });
  return list;
}

function verifyCase(params: BattleParams, s: Sample, seed: number): VerifyCase {
  const maxTicks = MAX_BATTLE_SECONDS * params.tick.ticksPerSecond;
  const script = s.scripted ? scriptedCommands(seed + 1, maxTicks) : [];
  const commandsAt = (tick: number) => script[tick] ?? [];

  // 1. Straight, logged.
  const first = createBattle(s.setup, params);
  const log = createLog(s.setup, params);
  const firstEvents = new EventHash();
  while (first.ended === null && first.tick < maxTicks) {
    firstEvents.add(stepLogged(first, log, commandsAt(first.tick)));
  }
  const ticks = first.tick;
  log.finalHash = battleHash(first);

  // 2. Straight again.
  const second = createBattle(s.setup, params);
  const secondEvents = new EventHash();
  while (second.tick < ticks && second.ended === null) {
    secondEvents.add(stepBattle(second, commandsAt(second.tick)));
  }

  // 3. Snapshot → restore halfway.
  let split = createBattle(s.setup, params);
  const splitEvents = new EventHash();
  const half = Math.floor(ticks / 2);
  while (split.tick < half && split.ended === null) {
    splitEvents.add(stepBattle(split, commandsAt(split.tick)));
  }
  split = restoreBattle(serializeBattle(split));
  while (split.tick < ticks && split.ended === null) {
    splitEvents.add(stepBattle(split, commandsAt(split.tick)));
  }

  // 4. The log, through JSON, replayed.
  let replayHash: string;
  try {
    replayHash = battleHash(replayLog(JSON.parse(JSON.stringify(log))));
  } catch (error) {
    replayHash = `error: ${(error as Error).message}`;
  }

  const runs = [
    { name: "run", hash: log.finalHash, eventsHash: firstEvents.digest() },
    {
      name: "run again",
      hash: battleHash(second),
      eventsHash: secondEvents.digest(),
    },
    {
      name: "snapshot → restore",
      hash: battleHash(split),
      eventsHash: splitEvents.digest(),
    },
    { name: "log replay", hash: replayHash, eventsHash: null },
  ];
  const ok =
    runs.every((r) => r.hash === runs[0]!.hash) &&
    runs.every(
      (r) => r.eventsHash === null || r.eventsHash === runs[0]!.eventsHash,
    );
  return { name: s.name, ticks, runs, ok };
}

/** Determinism over the sample, for every seed (spec R-2). */
export function battleVerify(
  params: BattleParams,
  seeds: readonly number[],
): { ok: boolean; cases: (VerifyCase & { seed: number })[] } {
  const cases = seeds.flatMap((seed) =>
    sample(params, seed).map((s) => ({ seed, ...verifyCase(params, s, seed) })),
  );
  return { ok: cases.every((c) => c.ok), cases };
}

/** Replays a log exported by the lab and compares with its hash (spec R-3). */
export function verifyLogFile(json: string): {
  ok: boolean;
  expected: string | null;
  actual: string;
  ticks: number;
} {
  const log: unknown = JSON.parse(json);
  const state = replayLog(log);
  const expected = (log as { finalHash: string | null }).finalHash;
  const actual = battleHash(state);
  return { ok: expected === actual, expected, actual, ticks: state.tick };
}
