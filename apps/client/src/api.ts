// HTTP API of the server (plan section 7). Errors come back as {error}.

import type {
  CreateWorldRequest,
  JoinRequest,
  JoinResponse,
  ServerConfigResponse,
  WorldSummary,
} from "@geometrix/protocol";

export class ApiError extends Error {
  readonly status: number;
  /** The server's error code (e.g. "teamFull"), or "network". */
  readonly code: string;
  constructor(status: number, code: string) {
    super(`${status} ${code}`);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(
      path,
      body === undefined
        ? undefined
        : {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          },
    );
  } catch {
    throw new ApiError(0, "network");
  }
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const code =
      typeof json === "object" &&
      json !== null &&
      typeof (json as { error?: unknown }).error === "string"
        ? (json as { error: string }).error
        : "http";
    throw new ApiError(res.status, code);
  }
  return json as T;
}

export const listWorlds = () => request<WorldSummary[]>("/api/worlds");

export const serverConfig = () => request<ServerConfigResponse>("/api/config");

export const createWorld = (body: CreateWorldRequest) =>
  request<{ id: number }>("/api/worlds", body);

export const joinWorld = (worldId: number, body: JoinRequest) =>
  request<JoinResponse>(`/api/worlds/${worldId}/join`, body);
