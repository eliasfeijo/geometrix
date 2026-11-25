#!/usr/bin/env node
// geometrix server (plan section 7): `npm run server`. Configuration comes
// from GEO_* environment variables (config.ts).

import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseBattleParams } from "@geometrix/battle";
import { parseParams } from "@geometrix/sim";
import { startApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { realTimers } from "./loop.ts";
import { Store } from "./persistence.ts";

const config = loadConfig(process.env);
if (config.dbFile !== ":memory:") {
  mkdirSync(dirname(config.dbFile), { recursive: true });
}
const store = new Store(config.dbFile);
const params = parseParams(JSON.parse(readFileSync(config.paramsFile, "utf8")));
const battleParams = parseBattleParams(
  JSON.parse(readFileSync(config.battleParamsFile, "utf8")),
);
const app = await startApp({
  store,
  config,
  timers: realTimers,
  params,
  battleParams,
  clock: () => new Date().toISOString(),
});
for (const { worldId, error } of app.recoveryFailures) {
  console.error(`world ${worldId} not hosted: ${error}`);
}
console.log(
  `geometrix server on http://localhost:${app.port} (db ${config.dbFile})`,
);

let stopping = false;
const shutdown = async (signal: string) => {
  if (stopping) return;
  stopping = true;
  console.log(`${signal}: snapshotting worlds and stopping`);
  await app.close();
  store.close();
  process.exit(0);
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
