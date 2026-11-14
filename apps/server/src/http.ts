// HTTP (plan section 7): create and list worlds, join one (name + team ->
// session token), export an ended one as a replay (plan section 8, F8
// details; fog spec D10), and the built client as static files.

import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import {
  createWorldRequest,
  joinRequest,
  type JoinResponse,
  type Replay,
  type WorldSummary,
} from "@geometrix/protocol";
import { stateHash } from "./hash.ts";
import type { Store } from "./persistence.ts";
import type { Worlds } from "./worlds.ts";

const MAX_BODY_BYTES = 64 * 1024;

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/** sha256 of a session token; only the hash is stored (plan section 7). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

class HttpError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, body: unknown) {
    super(`HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

export type HttpContext = {
  store: Store;
  worlds: Worlds;
  /** Built client directory; static files are skipped if it is missing. */
  staticDir: string;
  /** ISO timestamp for new worlds. */
  clock: () => string;
};

type Reply =
  | { status: number; body: unknown }
  | { status: 200; file: Buffer; contentType: string };

export function createHttpHandler(context: HttpContext) {
  return (req: IncomingMessage, res: ServerResponse): void => {
    route(context, req)
      .then((reply) => {
        if ("file" in reply) {
          res.writeHead(200, { "content-type": reply.contentType });
          res.end(reply.file);
        } else {
          sendJson(res, reply.status, reply.body);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof HttpError) {
          sendJson(res, error.status, error.body);
        } else {
          console.error(error);
          sendJson(res, 500, { error: "internal" });
        }
      });
  };
}

async function route(
  context: HttpContext,
  req: IncomingMessage,
): Promise<Reply> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;
  if (path === "/api/worlds" && req.method === "POST") {
    const request = parse(createWorldRequest, await readJson(req));
    const host = context.worlds.create(request, context.clock());
    return { status: 201, body: { id: host.id } };
  }
  if (path === "/api/worlds" && req.method === "GET") {
    return { status: 200, body: listWorlds(context) };
  }
  const join = /^\/api\/worlds\/(\d+)\/join$/.exec(path);
  if (join !== null && req.method === "POST") {
    const request = parse(joinRequest, await readJson(req));
    return { status: 201, body: joinWorld(context, Number(join[1]), request) };
  }
  const replay = /^\/api\/worlds\/(\d+)\/replay$/.exec(path);
  if (replay !== null && req.method === "GET") {
    return { status: 200, body: exportReplay(context, Number(replay[1])) };
  }
  if (path.startsWith("/api/")) throw new HttpError(404, { error: "notFound" });
  if (req.method !== "GET") throw new HttpError(405, { error: "method" });
  const file = staticFile(context.staticDir, path);
  if (file === null) throw new HttpError(404, { error: "notFound" });
  return { status: 200, ...file };
}

function listWorlds(context: HttpContext): WorldSummary[] {
  return context.store.worlds().map((row) => {
    const host = context.worlds.get(row.id);
    const { durationSeconds, tickSeconds } = row.params.world;
    const status = host?.status ?? row.status;
    return {
      id: row.id,
      seed: status === "ended" ? row.seed : null,
      multiplier: row.multiplier,
      status,
      tick: host?.state.tick ?? row.tick,
      durationTicks: Math.floor(durationSeconds / tickSeconds),
      players: context.store
        .players(row.id)
        .map(({ id, team, name, bot }) => ({ id, team, name, bot })),
    };
  });
}

/**
 * An ended world as a replay, in the format of geo sim's replay.json: the
 * world's seed and params rebuild its initial snapshot, then the whole log up
 * to the tick it reached. Reading the state and the log in one synchronous
 * call keeps them in step (the commands of a tick are stored with it). A
 * running world is refused (fog spec D10): its log and seed show the whole
 * world, through the fog.
 */
function exportReplay(context: HttpContext, worldId: number): Replay {
  const host = context.worlds.get(worldId);
  const row = context.store.world(worldId);
  if (host === undefined || row === undefined) {
    throw new HttpError(404, { error: "unknownWorld" });
  }
  if (host.status !== "ended") {
    throw new HttpError(409, { error: "worldRunning" });
  }
  return {
    simVersion: row.simVersion,
    seed: row.seed,
    params: row.params,
    ticks: host.state.tick,
    finalHash: stateHash(host.state),
    commands: context.store.commandsFrom(worldId, 0),
  };
}

function joinWorld(
  context: HttpContext,
  worldId: number,
  request: { name: string; team: number },
): JoinResponse {
  const host = context.worlds.get(worldId);
  if (host === undefined) throw new HttpError(404, { error: "unknownWorld" });
  const token = randomBytes(32).toString("base64url");
  // The player row and the queued join stand or fall together.
  const playerId = context.store.transaction(() => {
    const id = context.store.addPlayer({
      worldId,
      team: request.team,
      name: request.name,
      tokenHash: hashToken(token),
      bot: false,
    });
    const refusal = host.submit(id, {
      type: "join",
      team: request.team,
      bot: false,
    });
    if (refusal !== null) throw new HttpError(409, { error: refusal });
    return id;
  });
  return { playerId, team: request.team, token };
}

function parse<T>(
  schema: {
    safeParse(
      v: unknown,
    ): { success: true; data: T } | { success: false; error: unknown };
  },
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(400, { error: "invalidRequest" });
  return result.data;
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, { error: "tooLarge" });
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new HttpError(400, { error: "invalidJson" });
  }
}

/** The file for `path` under `dir` (index.html for "/"), or null. */
function staticFile(
  dir: string,
  path: string,
): { file: Buffer; contentType: string } | null {
  if (!existsSync(dir)) return null;
  const root = resolve(dir);
  const file = resolve(join(root, path === "/" ? "index.html" : path));
  if (!file.startsWith(root + sep)) return null;
  if (!existsSync(file) || !statSync(file).isFile()) return null;
  return {
    file: readFileSync(file),
    contentType: CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
  };
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}
