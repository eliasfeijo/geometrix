// Determinism check (plan section 9). The same seed, params and bots must reach
// the same state hash, and emit the same events (M2 encontro plan section 10),
// in every way of getting there:
//   1. a straight run with the bots;
//   2. a second straight run;
//   3. a run interrupted halfway by serialize -> restore, the bots going on
//      from the restored state;
//   4. a replay of run 1's command log, through JSON, without the bots.

import {
  botsFor,
  canonicalJson,
  createWorld,
  restore,
  serialize,
  step,
  type Bot,
  type Params,
  type StrategistId,
  type WorldState,
} from "@geometrix/sim";
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
export type VerifyResult = { ok: boolean; runs: VerifyRun[] };

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
  ticks: number,
  bots: readonly Bot[],
  events: EventHash,
): WorldState {
  const log: LoggedCommand[] = [];
  for (let i = 0; i < ticks; i++) events.add(stepWithBots(state, bots, log));
  return state;
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
): VerifyResult {
  const bots = botsFor(strategists);
  const half = Math.floor(ticks / 2);
  const events = [0, 1, 2, 3].map(() => new EventHash());
  const first = withBots(seed, params, ticks, bots, events[0]!);
  const second = withBots(seed, params, ticks, bots, events[1]!);
  const restored = continueWithBots(
    restore(serialize(withBots(seed, params, half, bots, events[2]!).state)),
    ticks - half,
    bots,
    events[2]!,
  );
  const log = JSON.parse(canonicalJson(first.log)) as LoggedCommand[];
  const ends: [string, WorldState][] = [
    ["run 1", first.state],
    ["run 2", second.state],
    [`snapshot at tick ${half} -> restore`, restored],
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
  return {
    ok: runs.every(
      (r) => r.hash === base!.hash && r.eventsHash === base!.eventsHash,
    ),
    runs,
  };
}
