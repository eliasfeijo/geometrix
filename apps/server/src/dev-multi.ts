// npm run dev:multi (plan section 8, F8 details): the parts that do not touch
// processes or the network, so the tests can check them. The script itself is
// dev-multi-main.ts. Development only.

import { parseArgs } from "node:util";

export const DEV_MULTI_USAGE = `usage: npm run dev:multi -- [options]

Builds the client, starts the server (GEO_PORT, GEO_DB, GEO_PARAMS), creates a
world, joins K players alternating Blue and Orange ("Jogador 1..K") and opens
one browser tab per player. Ctrl+C stops the server.

  --clients <k>   players (default 2)
  --seed <n>      world seed (default: the server picks one)
  --mult <n>      time multiplier (default 36)
  --no-build      serve the client build already in apps/client/dist
  --no-open       only print the URLs
`;

export type DevMultiOptions = {
  clients: number;
  seed: number | undefined;
  multiplier: number;
  build: boolean;
  open: boolean;
};

export class DevMultiError extends Error {}

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
      },
      strict: true,
    }));
  } catch (error) {
    throw new DevMultiError((error as Error).message);
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
      values.mult === undefined ? 36 : integer("mult", values.mult, 1, 10_000),
    build: values["no-build"] !== true,
    open: values["no-open"] !== true,
  };
}

/** Player i (1-based): name and team, alternating Blue (0) and Orange (1). */
export function playerOf(i: number): { name: string; team: number } {
  return { name: `Jogador ${i}`, team: (i - 1) % 2 };
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
): string {
  const query = new URLSearchParams({
    world: String(worldId),
    slot: String(slot),
  });
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
