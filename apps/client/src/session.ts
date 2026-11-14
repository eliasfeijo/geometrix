// The session token is the player's only credential (plan section 7): kept in
// localStorage so a reload or a reconnect is the same player. Sessions are
// keyed by world and by a "slot" from the URL (?slot=2), so several tabs of
// one browser can be different players of the same world (multi-client).

export type Session = {
  worldId: number;
  playerId: number;
  team: number;
  name: string;
  token: string;
};

/** The part of Storage this module needs; tests pass a Map-backed one. */
export type KeyValueStore = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem" | "key" | "length"
>;

const PREFIX = "geometrix:session:";
const NAME_KEY = "geometrix:name";

const keyOf = (worldId: number, slot: string) => `${PREFIX}${slot}:${worldId}`;

function isSession(value: unknown): value is Session {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    Number.isSafeInteger(s.worldId) &&
    Number.isSafeInteger(s.playerId) &&
    Number.isSafeInteger(s.team) &&
    typeof s.name === "string" &&
    typeof s.token === "string"
  );
}

// Storage can throw (private windows, blocked site data): treat it as empty.
function read(storage: KeyValueStore, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function write(storage: KeyValueStore, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // The session lasts until the tab closes.
  }
}

export function loadSession(
  storage: KeyValueStore,
  worldId: number,
  slot: string,
): Session | null {
  const raw = read(storage, keyOf(worldId, slot));
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isSession(value) && value.worldId === worldId ? value : null;
  } catch {
    return null;
  }
}

export function saveSession(
  storage: KeyValueStore,
  slot: string,
  session: Session,
): void {
  write(storage, keyOf(session.worldId, slot), JSON.stringify(session));
}

export function clearSession(
  storage: KeyValueStore,
  worldId: number,
  slot: string,
): void {
  try {
    storage.removeItem(keyOf(worldId, slot));
  } catch {
    // Nothing stored.
  }
}

/** The last name typed in the lobby, shared by every slot. */
export function loadName(storage: KeyValueStore): string {
  return read(storage, NAME_KEY) ?? "";
}

export function saveName(storage: KeyValueStore, name: string): void {
  write(storage, NAME_KEY, name);
}

/** World and slot from the page URL: ?world=3&slot=2. */
export function parseLocation(search: string): {
  worldId: number | null;
  slot: string;
} {
  const params = new URLSearchParams(search);
  const world = Number(params.get("world"));
  const slot = params.get("slot") ?? "";
  return {
    worldId:
      params.has("world") && Number.isSafeInteger(world) && world > 0
        ? world
        : null,
    slot: /^[\w-]{0,16}$/.test(slot) ? slot : "",
  };
}

/** The URL search for a world (null = lobby), keeping the slot. */
export function locationFor(worldId: number | null, slot: string): string {
  const params = new URLSearchParams();
  if (worldId !== null) params.set("world", String(worldId));
  if (slot !== "") params.set("slot", slot);
  const search = params.toString();
  return search === "" ? "" : `?${search}`;
}

/** The server world whose replay the URL asks for: ?replay=3. */
export function replayWorldOf(search: string): number | null {
  const value = new URLSearchParams(search).get("replay");
  const id = Number(value);
  return value !== null && Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * A session handed over in the URL fragment by `npm run dev:multi`
 * (#token=…&player=…&team=…&name=…), for the world in the query. The
 * fragment never reaches the server; the app stores it and clears the URL.
 */
export function sessionFromHash(
  hash: string,
  worldId: number | null,
): Session | null {
  if (worldId === null) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const session = {
    worldId,
    playerId: Number(params.get("player")),
    team: Number(params.get("team")),
    name: params.get("name") ?? "",
    token: params.get("token") ?? "",
  };
  return params.has("player") &&
    params.has("team") &&
    isSession(session) &&
    session.token !== "" &&
    session.name !== ""
    ? session
    : null;
}
