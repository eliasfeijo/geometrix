import type { ServerMessage, WelcomeMessage } from "@geometrix/protocol";
import { afterEach, describe, expect, test } from "vitest";
import { WebSocket } from "ws";
import { CLOSE } from "../src/ws.ts";
import { testApp } from "./helpers.ts";

let close: (() => Promise<void>) | null = null;
afterEach(async () => {
  await close?.();
  close = null;
});

/** A client that keeps every message it gets. */
async function connect(base: string, token: string) {
  const socket = new WebSocket(
    `${base.replace("http", "ws")}/ws?token=${token}`,
  );
  const messages: ServerMessage[] = [];
  const waiters: (() => void)[] = [];
  socket.on("message", (data) => {
    messages.push(JSON.parse(data.toString()) as ServerMessage);
    for (const w of waiters.splice(0)) w();
  });
  const closed = new Promise<number>((done) =>
    socket.on("close", (code) => done(code)),
  );
  /** The next message matching `type` after `from`. */
  const next = async <T extends ServerMessage["type"]>(type: T, from = 0) => {
    for (;;) {
      const found = messages.slice(from).find((m) => m.type === type);
      if (found) return found as Extract<ServerMessage, { type: T }>;
      await new Promise<void>((done) => waiters.push(done));
    }
  };
  const send = (body: unknown) => socket.send(JSON.stringify(body));
  return { socket, messages, next, send, closed };
}

async function setup() {
  const t = await testApp();
  close = t.app.close;
  await t.post("/api/worlds", { seed: 3 });
  const joined = await t.post("/api/worlds/1/join", { name: "Ana", team: 0 });
  const { token, playerId } = joined.body as {
    token: string;
    playerId: number;
  };
  const host = t.app.worlds.get(1)!;
  host.tick();
  return { ...t, token, playerId, host };
}

describe("WebSocket", () => {
  test("welcomes with the static map once, then the dynamic state", async () => {
    const { base, token, playerId, host } = await setup();
    const client = await connect(base, token);
    const welcome: WelcomeMessage = await client.next("welcome");
    expect(welcome).toMatchObject({
      worldId: 1,
      playerId,
      team: 0,
      status: "running",
      multiplier: 1,
    });
    expect(welcome.map.terrain).toHaveLength(64 * 64);
    expect(welcome.cores).toEqual(host.state.teams.map((t) => t.core));
    expect(welcome.state.tick).toBe(1);
    expect(welcome.state.creeps[0]).not.toHaveProperty("path");
    host.tick();
    const state = await client.next("state");
    expect(state.state.tick).toBe(2);
    // The plan expects ~3-5 KB per message.
    expect(JSON.stringify(state).length).toBeLessThan(8_000);
    client.socket.close();
  });

  test("acks an accepted command with its tick, rejects the rest", async () => {
    const { base, token, host } = await setup();
    const client = await connect(base, token);
    await client.next("welcome");
    const creep = host.state.creeps.find((c) => c.team === 0)!;
    client.send({
      type: "command",
      ref: 1,
      command: { type: "dominate", creepId: creep.id },
    });
    expect(await client.next("ack")).toEqual({ type: "ack", ref: 1, tick: 1 });
    client.send({ type: "command", ref: 2, command: { type: "release" } });
    expect(await client.next("reject")).toEqual({
      type: "reject",
      ref: 2,
      reason: "notDominating",
    });
    const from = client.messages.length;
    client.send({
      type: "command",
      ref: 3,
      command: { type: "join", team: 1 },
    });
    expect(await client.next("reject", from)).toEqual({
      type: "reject",
      ref: 3,
      reason: "invalidMessage",
    });
    const from2 = client.messages.length;
    client.socket.send("not json");
    expect(await client.next("reject", from2)).toEqual({
      type: "reject",
      ref: -1,
      reason: "invalidMessage",
    });
    host.tick();
    expect(creep.dominatedBy).not.toBeNull();
    client.socket.close();
  });

  test("sends at most one state per interval, with the latest tick", async () => {
    const { base, token, host, timers } = await setup();
    const client = await connect(base, token);
    await client.next("welcome");
    host.tick();
    await client.next("state");
    const sent = () => client.messages.filter((m) => m.type === "state").length;
    host.tick();
    host.tick();
    host.tick();
    await new Promise((done) => setTimeout(done, 50));
    expect(sent()).toBe(1);
    timers.advance(200);
    const from = client.messages.length;
    const latest = await client.next("state", from);
    expect(latest.state.tick).toBe(5);
    expect(sent()).toBe(2);
    client.socket.close();
  });

  test("closes sockets with a bad token", async () => {
    const { base } = await setup();
    const client = await connect(base, "nope");
    expect(await client.closed).toBe(CLOSE.unauthorized);
  });
});
