import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { parseReplay } from "@geometrix/protocol";
import {
  createWorld,
  SIM_VERSION,
  step,
  type CommandInput,
} from "@geometrix/sim";
import { stateHash } from "../src/hash.ts";
import { hashToken } from "../src/http.ts";
import { testApp } from "./helpers.ts";

let close: (() => Promise<void>) | null = null;
afterEach(async () => {
  await close?.();
  close = null;
});

async function setup(config = {}) {
  const t = await testApp(config);
  close = t.app.close;
  return t;
}

describe("HTTP", () => {
  test("creates a world with bots and lists it", async () => {
    const { post, get } = await setup();
    const created = await post("/api/worlds", {
      seed: 7,
      multiplier: 36,
      botTeams: [1],
    });
    expect(created).toEqual({ status: 201, body: { id: 1 } });
    const list = await (await get("/api/worlds")).res.json();
    expect(list).toEqual([
      {
        id: 1,
        seed: 7,
        multiplier: 36,
        status: "running",
        tick: 0,
        durationTicks: 259_200,
        players: [{ id: 1, team: 1, name: "bot", bot: true }],
      },
    ]);
  });

  test("join hands out a token whose hash is stored, and queues the join", async () => {
    const { post, store, app } = await setup();
    await post("/api/worlds", { seed: 1 });
    const joined = await post("/api/worlds/1/join", { name: " Ana ", team: 0 });
    expect(joined.status).toBe(201);
    const { playerId, team, token } = joined.body as {
      playerId: number;
      team: number;
      token: string;
    };
    expect(team).toBe(0);
    expect(token).toMatch(/^[\w-]{43}$/);
    expect(store.playerByTokenHash(hashToken(token))).toMatchObject({
      id: playerId,
      name: "Ana",
      bot: false,
    });
    const host = app.worlds.get(1)!;
    host.tick();
    expect(host.state.players.map((p) => p.id)).toEqual([playerId]);
  });

  test("refuses a 4th human on a team without keeping the player", async () => {
    const { post, store } = await setup();
    await post("/api/worlds", { seed: 1 });
    for (const name of ["a", "b", "c"]) {
      expect((await post("/api/worlds/1/join", { name, team: 0 })).status).toBe(
        201,
      );
    }
    expect(await post("/api/worlds/1/join", { name: "d", team: 0 })).toEqual({
      status: 409,
      body: { error: "teamFull" },
    });
    expect(await post("/api/worlds/1/join", { name: "e", team: 5 })).toEqual({
      status: 409,
      body: { error: "unknownTeam" },
    });
    expect(store.players(1).map((p) => p.name)).toEqual(["a", "b", "c"]);
  });

  test.each([
    ["/api/worlds", { multiplier: 0 }, 400],
    ["/api/worlds", { seed: -1 }, 400],
    ["/api/worlds/1/join", { name: "", team: 0 }, 400],
    ["/api/worlds/9/join", { name: "x", team: 0 }, 404],
  ])("POST %s %j answers %i", async (path, body, status) => {
    const { post } = await setup();
    await post("/api/worlds", { seed: 1 });
    expect((await post(path, body)).status).toBe(status);
  });

  test("serves the built client and nothing outside it", async () => {
    const dir = mkdtempSync(join(tmpdir(), "geo-static-"));
    writeFileSync(join(dir, "index.html"), "<p>geo</p>");
    writeFileSync(join(dir, "app.js"), "1");
    const { get } = await setup({ staticDir: dir });
    const index = await get("/");
    expect(index.status).toBe(200);
    expect(index.res.headers.get("content-type")).toContain("text/html");
    expect(await index.res.text()).toBe("<p>geo</p>");
    expect((await get("/app.js")).res.headers.get("content-type")).toContain(
      "javascript",
    );
    expect((await get("/missing.js")).status).toBe(404);
    expect((await get("/..%2f..%2fpackage.json")).status).toBe(404);
    expect((await get("/api/nothing")).status).toBe(404);
  });

  test("exports a world as a replay that rebuilds its state", async () => {
    const { post, get, app } = await setup();
    await post("/api/worlds", { seed: 5, botTeams: [0, 1] });
    const joined = await post("/api/worlds/1/join", { name: "Ana", team: 0 });
    const { playerId } = joined.body as { playerId: number };
    const host = app.worlds.get(1)!;
    for (let i = 0; i < 200; i++) host.tick();
    const creep = host.state.creeps.find((c) => c.team === 0)!;
    expect(
      host.submit(playerId, { type: "dominate", creepId: creep.id }),
    ).toBeNull();
    for (let i = 0; i < 50; i++) host.tick();

    const res = await get("/api/worlds/1/replay");
    expect(res.status).toBe(200);
    const replay = parseReplay(await res.res.json());
    expect(replay).toMatchObject({
      simVersion: SIM_VERSION,
      seed: 5,
      ticks: 250,
    });
    expect(replay.finalHash).toBe(stateHash(host.state));
    expect(replay.commands.map((c) => c.command.type)).toContain("dominate");

    const state = createWorld(replay.seed, replay.params);
    let at = 0;
    while (state.tick < replay.ticks) {
      const commands: CommandInput[] = [];
      while (replay.commands[at]?.tick === state.tick) {
        const { playerId: id, command } = replay.commands[at++]!;
        commands.push({ playerId: id, command });
      }
      step(state, commands);
    }
    expect(stateHash(state)).toBe(replay.finalHash);
    expect((await get("/api/worlds/9/replay")).status).toBe(404);
  });
});
