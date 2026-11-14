import { describe, expect, it } from "vitest";
import {
  clearSession,
  loadName,
  loadSession,
  locationFor,
  parseLocation,
  replayWorldOf,
  saveName,
  saveSession,
  sessionFromHash,
  type Session,
} from "../src/session.ts";
import { memoryStorage } from "./helpers.ts";

const session: Session = {
  worldId: 3,
  playerId: 7,
  team: 1,
  name: "Ana",
  token: "abc",
};

describe("sessions", () => {
  it("keeps one session per world and slot", () => {
    const storage = memoryStorage();
    saveSession(storage, "", session);
    saveSession(storage, "2", { ...session, playerId: 8, token: "def" });
    expect(loadSession(storage, 3, "")).toEqual(session);
    expect(loadSession(storage, 3, "2")?.playerId).toBe(8);
    expect(loadSession(storage, 4, "")).toBeNull();
    clearSession(storage, 3, "");
    expect(loadSession(storage, 3, "")).toBeNull();
    expect(loadSession(storage, 3, "2")).not.toBeNull();
  });

  it("ignores corrupt entries and storage that throws", () => {
    const storage = memoryStorage();
    storage.setItem("geometrix:session::3", "{not json");
    expect(loadSession(storage, 3, "")).toBeNull();
    storage.setItem("geometrix:session::3", JSON.stringify({ worldId: 3 }));
    expect(loadSession(storage, 3, "")).toBeNull();

    const broken = {
      ...memoryStorage(),
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadSession(broken, 3, "")).toBeNull();
    expect(() => saveSession(broken, "", session)).not.toThrow();
    expect(loadName(broken)).toBe("");
  });

  it("remembers the last name", () => {
    const storage = memoryStorage();
    saveName(storage, "Bia");
    expect(loadName(storage)).toBe("Bia");
  });
});

describe("location", () => {
  it("reads world and slot from the URL", () => {
    expect(parseLocation("?world=3&slot=2")).toEqual({ worldId: 3, slot: "2" });
    expect(parseLocation("")).toEqual({ worldId: null, slot: "" });
    expect(parseLocation("?world=abc")).toEqual({ worldId: null, slot: "" });
    expect(parseLocation("?world=-1&slot=<x>")).toEqual({
      worldId: null,
      slot: "",
    });
  });

  it("writes it back", () => {
    expect(locationFor(3, "")).toBe("?world=3");
    expect(locationFor(3, "2")).toBe("?world=3&slot=2");
    expect(locationFor(null, "2")).toBe("?slot=2");
    expect(locationFor(null, "")).toBe("");
    expect(parseLocation(locationFor(5, "b"))).toEqual({
      worldId: 5,
      slot: "b",
    });
  });
});

describe("replayWorldOf", () => {
  it("reads ?replay=<world id>", () => {
    expect(replayWorldOf("?replay=3")).toBe(3);
    expect(replayWorldOf("?slot=2&replay=12")).toBe(12);
    expect(replayWorldOf("")).toBeNull();
    expect(replayWorldOf("?replay=")).toBeNull();
    expect(replayWorldOf("?replay=0")).toBeNull();
    expect(replayWorldOf("?replay=x")).toBeNull();
  });
});

describe("sessionFromHash", () => {
  const hash = "#token=a-b_c&player=5&team=1&name=Jogador+2";

  it("reads the session dev:multi puts in the fragment", () => {
    expect(sessionFromHash(hash, 3)).toEqual({
      worldId: 3,
      playerId: 5,
      team: 1,
      name: "Jogador 2",
      token: "a-b_c",
    });
  });

  it("needs a world and every field", () => {
    expect(sessionFromHash(hash, null)).toBeNull();
    expect(sessionFromHash("", 3)).toBeNull();
    expect(sessionFromHash("#token=x&team=1&name=a", 3)).toBeNull();
    expect(sessionFromHash("#player=1&team=1&name=a", 3)).toBeNull();
    expect(sessionFromHash("#token=x&player=1&team=1", 3)).toBeNull();
    expect(sessionFromHash("#token=x&player=1.5&team=1&name=a", 3)).toBeNull();
  });

  it("round-trips through saveSession and loadSession", () => {
    const storage = memoryStorage();
    saveSession(storage, "2", sessionFromHash(hash, 3)!);
    expect(loadSession(storage, 3, "2")?.token).toBe("a-b_c");
  });
});
