import { readFileSync } from "node:fs";
import { parseParams, type Params } from "../src/params.ts";

const DEFAULT_PARAMS_URL = new URL(
  "../../../params/default.json",
  import.meta.url,
);

/** params/default.json as parsed JSON, before validation. */
export function readDefaultParamsJson(): unknown {
  return JSON.parse(readFileSync(DEFAULT_PARAMS_URL, "utf8"));
}

/** params/default.json, validated. */
export function loadDefaultParams(): Params {
  return parseParams(readDefaultParamsJson());
}
