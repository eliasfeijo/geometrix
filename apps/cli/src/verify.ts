// Determinism check (plan section 9). The same seed, params and bots must reach
// the same state hash in every way of getting there:
//   1. a straight run with the bots;
//   2. a second straight run;
//   3. a run interrupted halfway by serialize -> restore, the bots going on
//      from the restored state;
//   4. a replay of run 1's command log, through JSON, without the bots.

import {
  canonicalJson,
  createWorld,
  restore,
  serialize,
  step,
  type Params,
  type StrategistId,
  type WorldState,
} from "@geometrix/sim";
import {
  botsFor,
  logCursor,
  runBots,
  stepWithBots,
  type Bot,
  type LoggedCommand,
} from "./harness.ts";
import { stateHash } from "./hash.ts";

export type VerifyRun = { name: string; hash: string };
export type VerifyResult = { ok: boolean; runs: VerifyRun[] };

function continueWithBots(
  state: WorldState,
  ticks: number,
  bots: readonly Bot[],
): WorldState {
  const log: LoggedCommand[] = [];
  for (let i = 0; i < ticks; i++) stepWithBots(state, bots, log);
  return state;
}

function replay(
  seed: number,
  params: Params,
  ticks: number,
  log: readonly LoggedCommand[],
): WorldState {
  const state = createWorld(seed, params);
  const commandsAt = logCursor(log);
  for (let i = 0; i < ticks; i++) step(state, commandsAt(state.tick));
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
  const first = runBots(seed, params, ticks, bots);
  const second = runBots(seed, params, ticks, bots);
  const restored = continueWithBots(
    restore(serialize(runBots(seed, params, half, bots).state)),
    ticks - half,
    bots,
  );
  const log = JSON.parse(canonicalJson(first.log)) as LoggedCommand[];
  const runs: VerifyRun[] = [
    { name: "run 1", hash: stateHash(first.state) },
    { name: "run 2", hash: stateHash(second.state) },
    {
      name: `snapshot at tick ${half} -> restore`,
      hash: stateHash(restored),
    },
    {
      name: `replay of the log (${first.log.length} commands)`,
      hash: stateHash(replay(seed, params, ticks, log)),
    },
  ];
  return { ok: runs.every((r) => r.hash === runs[0]!.hash), runs };
}
