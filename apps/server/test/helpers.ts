import { readFileSync } from "node:fs";
import { parseParams, type Params } from "@geometrix/sim";

/** The sim tests' fixed params, so balancing does not change these tests. */
export function testParams(): Params {
  return parseParams(
    JSON.parse(
      readFileSync(
        new URL("../../../packages/sim/test/params.json", import.meta.url),
        "utf8",
      ),
    ),
  );
}
