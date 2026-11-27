// Test helpers of the junction: the sim's text worlds and the battle's fixed
// params, so the tests do not follow balancing.
import { parseBattleParams, type BattleParams } from "@geometrix/battle";
import { readFileSync } from "node:fs";

export {
  addTeam,
  creepOf,
  loadTestParams,
  paramsWith,
  textWorld,
} from "../../sim/test/helpers.ts";

export function loadBattleParams(): BattleParams {
  return parseBattleParams(
    JSON.parse(
      readFileSync(
        new URL("../../battle/test/params.json", import.meta.url),
        "utf8",
      ),
    ),
  );
}
