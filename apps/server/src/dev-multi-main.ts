#!/usr/bin/env node
// npm run dev:multi -- --clients K (plan section 8, F8 details): one world
// with K local players, each in its own browser tab. Development only.

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { JoinResponse } from "@geometrix/protocol";
import { parseParams } from "@geometrix/sim";
import { loadConfig } from "./config.ts";
import {
  DEV_MULTI_USAGE,
  DevMultiError,
  isWsl,
  openCommand,
  parseDevMultiArgs,
  playerOf,
  tabUrl,
  withOverrides,
  type DevMultiOptions,
} from "./dev-multi.ts";

/** The server can take a while to start on /mnt/c (WSL): poll, do not sleep. */
const STARTUP_TIMEOUT_MS = 60_000;
const POLL_MS = 250;

const ROOT = new URL("../../../", import.meta.url);

let options: DevMultiOptions;
try {
  options = parseDevMultiArgs(process.argv.slice(2));
} catch (error) {
  if (!(error instanceof DevMultiError)) throw error;
  console.error(`${error.message}\n\n${DEV_MULTI_USAGE}`);
  process.exit(2);
}

const config = loadConfig(process.env);
const port = config.port;
// The same params file the server below reads, relative to the same root;
// with --set, a copy with the overrides that only this session uses.
let paramsFile = config.paramsFile;
let rawParams: unknown = JSON.parse(
  readFileSync(new URL(paramsFile, ROOT), "utf8"),
);
if (options.set.length > 0) {
  try {
    rawParams = withOverrides(rawParams, options.set);
  } catch (error) {
    if (!(error instanceof DevMultiError)) throw error;
    fail(error.message);
  }
  paramsFile = join(
    mkdtempSync(join(tmpdir(), "geo-dev-multi-")),
    "params.json",
  );
  writeFileSync(paramsFile, JSON.stringify(rawParams));
}
const multiplier =
  options.multiplier ?? parseParams(rawParams).world.multiplier;
const base = `http://localhost:${port}`;

if (await answers(`${base}/api/worlds`)) {
  fail(`a server already answers on port ${port}: stop it or set GEO_PORT`);
}

if (options.build) {
  const build = spawnSync("npm", ["run", "build"], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (build.status !== 0) fail("the client build failed");
}

const server = spawn(process.execPath, ["apps/server/src/main.ts"], {
  cwd: ROOT,
  stdio: "inherit",
  env: { ...process.env, GEO_PARAMS: paramsFile },
});
const stop = (signal: NodeJS.Signals) => {
  if (server.exitCode === null) server.kill(signal);
};
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
server.on("exit", (code) => process.exit(code ?? 0));

try {
  await waitForServer(server);
  const { id: worldId } = await post<{ id: number }>("/api/worlds", {
    ...(options.seed === undefined ? {} : { seed: options.seed }),
    multiplier,
    ...(options.bot ? { botTeams: [1] } : {}),
    ...(options.botDifficulty === undefined
      ? {}
      : { botDifficulty: { 1: options.botDifficulty } }),
  });
  console.log(
    `\nworld #${worldId} (×${multiplier}${
      options.bot ? `, ${options.botDifficulty ?? "hard"} bot on Orange` : ""
    })`,
  );
  const wsl = process.platform === "linux" && isWsl(readText("/proc/version"));
  for (let i = 1; i <= options.clients; i++) {
    const player = playerOf(i, options.bot);
    const joined = await post<JoinResponse>(
      `/api/worlds/${worldId}/join`,
      player,
    );
    const url = tabUrl(
      base,
      worldId,
      i,
      {
        playerId: joined.playerId,
        team: joined.team,
        name: player.name,
        token: joined.token,
      },
      options.net,
    );
    console.log(
      `${player.name} (${player.team === 0 ? "Azul" : "Laranja"}): ${url}`,
    );
    if (options.open) openTab(url, wsl);
  }
  console.log("\nCtrl+C stops the server.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  stop("SIGTERM");
}

function fail(message: string): never {
  console.error(`dev:multi: ${message}`);
  process.exit(1);
}

function readText(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

async function answers(url: string): Promise<boolean> {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

async function waitForServer(child: ChildProcess): Promise<void> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("the server exited");
    if (await answers(`${base}/api/worlds`)) return;
    await new Promise((done) => setTimeout(done, POLL_MS));
  }
  throw new Error(`the server did not answer on port ${port}`);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(`POST ${path}: ${res.status} ${json.error}`);
  return json;
}

/** Opens a tab without waiting; a missing launcher only costs a warning. */
function openTab(url: string, wsl: boolean): void {
  const how = openCommand(process.platform, wsl, url);
  if (how === null) return;
  const child = spawn(how.command, how.args, {
    stdio: "ignore",
    detached: true,
  });
  child.on("error", () =>
    console.error(`could not run ${how.command}: open the URL by hand`),
  );
  child.unref();
}
