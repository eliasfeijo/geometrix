// npm run dev:multi (plan section 8, F8 details): the parts that do not touch
// processes or the network, so the tests can check them. The script itself is
// dev-multi-main.ts. Development only.

import { parseArgs } from "node:util";
import type { Difficulty } from "@geometrix/sim";

export const DEV_MULTI_USAGE = `usage: npm run dev:multi -- [options]

Builds the client, starts the server (GEO_PORT, GEO_DB, GEO_PARAMS), creates a
world, joins K players alternating Blue and Orange ("Jogador 1..K") and opens
one browser tab per player. Ctrl+C stops the server.

  --clients <k>   players (default 2)
  --seed <n>      world seed (default: the server picks one)
  --mult <n>      time multiplier (default: the params' world.multiplier)
  --no-build      serve the client build already in apps/client/dist
  --no-open       only print the URLs
  --net           open the tabs with the network panel (?net=1)
  --bot           a bot plays Orange; every player joins Blue (the
                  session against the bot, M2 encontro spec section 8)
  --bot-difficulty <easy|normal|hard>
                  the bot's difficulty, with --bot (default hard)
`;

export type DevMultiOptions = {
  clients: number;
  seed: number | undefined;
  /** Undefined: the params' world.multiplier (R plan P1). */
  multiplier: number | undefined;
  build: boolean;
  open: boolean;
  /** Tabs with ?net=1, the network panel (M1.5 spec D8). */
  net: boolean;
  /** A bot on Orange, the players on Blue. */
  bot: boolean;
  botDifficulty: Difficulty | undefined;
};

export class DevMultiError extends Error {}

function isDifficulty(raw: string): raw is Difficulty {
  return raw === "easy" || raw === "normal" || raw === "hard";
}

function integer(name: string, raw: string, min: number, max: number): number {
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new DevMultiError(`--${name} must be an integer in ${min}..${max}`);
  }
  return value;
}

export function parseDevMultiArgs(args: readonly string[]): DevMultiOptions {
  let values;
  try {
    ({ values } = parseArgs({
      args: [...args],
      options: {
        clients: { type: "string" },
        seed: { type: "string" },
        mult: { type: "string" },
        "no-build": { type: "boolean" },
        "no-open": { type: "boolean" },
        net: { type: "boolean" },
        bot: { type: "boolean" },
        "bot-difficulty": { type: "string" },
      },
      strict: true,
    }));
  } catch (error) {
    throw new DevMultiError((error as Error).message);
  }
  const difficulty = values["bot-difficulty"];
  if (difficulty !== undefined) {
    if (!isDifficulty(difficulty)) {
      throw new DevMultiError("--bot-difficulty must be easy, normal or hard");
    }
    if (values.bot !== true) {
      throw new DevMultiError("--bot-difficulty needs --bot");
    }
  }
  return {
    clients:
      values.clients === undefined
        ? 2
        : integer("clients", values.clients, 1, 64),
    seed:
      values.seed === undefined
        ? undefined
        : integer("seed", values.seed, 0, 2 ** 32 - 1),
    multiplier:
      values.mult === undefined
        ? undefined
        : integer("mult", values.mult, 1, 10_000),
    build: values["no-build"] !== true,
    open: values["no-open"] !== true,
    net: values.net === true,
    bot: values.bot === true,
    botDifficulty: difficulty,
  };
}

/**
 * Player i (1-based): name and team, alternating Blue (0) and Orange (1); all
 * Blue when a bot plays Orange.
 */
export function playerOf(
  i: number,
  bot = false,
): { name: string; team: number } {
  return { name: `Jogador ${i}`, team: bot ? 0 : (i - 1) % 2 };
}

/**
 * The tab of one player: the world and the session slot in the query, the
 * session in the fragment (never sent to the server). The client stores it
 * and clears the URL.
 */
export function tabUrl(
  base: string,
  worldId: number,
  slot: number,
  session: { playerId: number; team: number; name: string; token: string },
  net = false,
): string {
  const query = new URLSearchParams({
    world: String(worldId),
    slot: String(slot),
  });
  if (net) query.set("net", "1");
  const fragment = new URLSearchParams({
    token: session.token,
    player: String(session.playerId),
    team: String(session.team),
    name: session.name,
  });
  return `${base}/?${query.toString()}#${fragment.toString()}`;
}

/** Whether this Linux is WSL (its kernel says so). */
export function isWsl(procVersion: string): boolean {
  return /microsoft/i.test(procVersion);
}

/**
 * How to open `url` in the default browser: through cmd's `start` on WSL and
 * Windows (with the characters cmd reads escaped), xdg-open on Linux, open on
 * macOS. Null when there is no known way: the URL is printed anyway.
 */
export function openCommand(
  platform: NodeJS.Platform,
  wsl: boolean,
  url: string,
): { command: string; args: string[] } | null {
  if (wsl || platform === "win32") {
    const escaped = url.replace(/[\^&|<>()%]/g, (c) => `^${c}`);
    return {
      command: wsl ? "cmd.exe" : "cmd",
      args: ["/c", "start", escaped],
    };
  }
  if (platform === "darwin") return { command: "open", args: [url] };
  if (platform === "linux") return { command: "xdg-open", args: [url] };
  return null;
}
