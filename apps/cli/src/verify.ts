// Determinism check (plan section 9). The same seed and params must reach the
// same state hash in every way of getting there:
//   1. a straight run;
//   2. a second straight run;
//   3. a run interrupted halfway by serialize -> restore.
// Replay from the command log joins in F5, once commands exist.

import {
  createWorld,
  restore,
  serialize,
  step,
  type Params,
  type WorldState,
} from "@geometrix/sim";
import { stateHash } from "./hash.ts";

export type VerifyRun = { name: string; hash: string };
export type VerifyResult = { ok: boolean; runs: VerifyRun[] };

function advance(state: WorldState, ticks: number): WorldState {
  for (let i = 0; i < ticks; i++) step(state, []);
  return state;
}

export function verify(
  seed: number,
  ticks: number,
  params: Params,
): VerifyResult {
  const half = Math.floor(ticks / 2);
  const runs: VerifyRun[] = [
    {
      name: "run 1",
      hash: stateHash(advance(createWorld(seed, params), ticks)),
    },
    {
      name: "run 2",
      hash: stateHash(advance(createWorld(seed, params), ticks)),
    },
    {
      name: `snapshot at tick ${half} -> restore`,
      hash: stateHash(
        advance(
          restore(serialize(advance(createWorld(seed, params), half))),
          ticks - half,
        ),
      ),
    },
  ];
  return { ok: runs.every((r) => r.hash === runs[0]!.hash), runs };
}
