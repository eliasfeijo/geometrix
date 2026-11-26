// Determinism check (plan section 9). The same seed, params and bots must reach
// the same state hash, and emit the same events (M2 encontro plan section 10),
// in every way of getting there:
//   1. a straight run with the bots;
//   2. a second straight run;
//   3. a run interrupted halfway by serialize -> restore of the world and
//      the junction host, the bots going on from the restored state;
//   4. a replay of run 1's command log, through JSON, without the bots and
//      without the host (the battles' results are in it);
// and the two logs agree (junction plan section 4, ADR-0010 rule 4):
//   5. each battle of run 1, its log replayed alone through JSON, gives the
//      system commands the world log has for it, in order.

import {
  botsFor,
  canonicalJson,
  createWorld,
  restore,
  serialize,
  step,
  type Bot,
  type Command,
  type Params,
  type Difficulty,
  type StrategistId,
  type WorldState,
} from "@geometrix/sim";
import {
  replayResults,
  restoreHost,
  serializeHost,
  type FinishedBattle,
  type JunctionHost,
} from "@geometrix/junction";
import {
  logCursor,
  runBots,
  stepWithBots,
  type LoggedCommand,
} from "./harness.ts";
import { EventHash, stateHash } from "./hash.ts";

/** A way of reaching the end: its state hash and the hash of its events. */
export type VerifyRun = {
  name: string;
  hash: string;
  eventsHash: string;
  events: number;
};
/** Path 5: how many battles replayed to their logged results. */
export type VerifyBattles = {
  battles: number;
  /** Battles whose replay gave other commands than the world log's. */
  mismatches: number[];
};
export type VerifyResult = {
  ok: boolean;
  runs: VerifyRun[];
  battles: VerifyBattles;
};

function withBots(
  seed: number,
  params: Params,
  ticks: number,
  bots: readonly Bot[],
  events: EventHash,
) {
  return runBots(seed, params, ticks, bots, (_, tick) => events.add(tick));
}

function continueWithBots(
  state: WorldState,
  host: JunctionHost,
  ticks: number,
  bots: readonly Bot[],
  events: EventHash,
): WorldState {
  const log: LoggedCommand[] = [];
  for (let i = 0; i < ticks; i++) {
    events.add(stepWithBots(state, host, bots, log).events);
  }
  return state;
}

/** The system commands of the world log, by battle id, in log order. */
function loggedResults(log: readonly LoggedCommand[]): Map<number, Command[]> {
  const byBattle = new Map<number, Command[]>();
  for (const { command } of log) {
    if (command.type !== "battleExit" && command.type !== "battleEnd") {
      continue;
    }
    const list = byBattle.get(command.battleId) ?? [];
    list.push(command);
    byBattle.set(command.battleId, list);
  }
  return byBattle;
}

function verifyBattles(
  world: WorldState,
  finished: readonly FinishedBattle[],
  log: readonly LoggedCommand[],
): VerifyBattles {
  const logged = loggedResults(log);
  const mismatches: number[] = [];
  for (const battle of finished) {
    const copy = JSON.parse(canonicalJson(battle)) as FinishedBattle;
    const replayed = canonicalJson(replayResults(world, copy));
    if (replayed !== canonicalJson(logged.get(battle.battleId) ?? [])) {
      mismatches.push(battle.battleId);
    }
  }
  return { battles: finished.length, mismatches };
}

function replay(
  seed: number,
  params: Params,
  ticks: number,
  log: readonly LoggedCommand[],
  events: EventHash,
): WorldState {
  const state = createWorld(seed, params);
  const commandsAt = logCursor(log);
  for (let i = 0; i < ticks; i++) {
    events.add(step(state, commandsAt(state.tick)));
  }
  return state;
}

export function verify(
  seed: number,
  ticks: number,
  params: Params,
  strategists: readonly StrategistId[] = ["balanced", "balanced"],
  difficulties: readonly Difficulty[] = [],
): VerifyResult {
  const bots = botsFor(strategists, difficulties);
  const half = Math.floor(ticks / 2);
  const events = [0, 1, 2, 3].map(() => new EventHash());
  const finished: FinishedBattle[] = [];
  // The snapshot falls in the middle of a battle when one is open from the
  // halfway tick on (junction plan section 4), else at the halfway tick.
  let at = -1;
  const first = runBots(seed, params, ticks, bots, (state, tick, done) => {
    events[0]!.add(tick);
    finished.push(...done);
    if (at < 0 && state.tick >= half && state.tick < ticks) {
      if (state.battles.length > 0) at = state.tick;
    }
  });
  const cutTick = at < 0 ? half : at;
  const second = withBots(seed, params, ticks, bots, events[1]!);
  const cut = withBots(seed, params, cutTick, bots, events[2]!);
  const restored = continueWithBots(
    restore(serialize(cut.state)),
    restoreHost(serializeHost(cut.host)),
    ticks - cutTick,
    bots,
    events[2]!,
  );
  const log = JSON.parse(canonicalJson(first.log)) as LoggedCommand[];
  const ends: [string, WorldState][] = [
    ["run 1", first.state],
    ["run 2", second.state],
    [
      `snapshot at tick ${cutTick}${at < 0 ? "" : " (mid-battle)"} -> restore`,
      restored,
    ],
    [
      `replay of the log (${first.log.length} commands)`,
      replay(seed, params, ticks, log, events[3]!),
    ],
  ];
  const runs = ends.map(([name, state], i): VerifyRun => ({
    name,
    hash: stateHash(state),
    eventsHash: events[i]!.digest(),
    events: events[i]!.count,
  }));
  const [base] = runs;
  const battles = verifyBattles(first.state, finished, first.log);
  return {
    ok:
      runs.every(
        (r) => r.hash === base!.hash && r.eventsHash === base!.eventsHash,
      ) && battles.mismatches.length === 0,
    runs,
    battles,
  };
}
