import {
  applyDelta,
  PROTOCOL_VERSION,
  viewJson,
  type ServerMessage,
  type WelcomeMessage,
} from "@geometrix/protocol";
import { view, type TeamView } from "@geometrix/sim";
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
  /** The delta with this seq, once it arrives. */
  const delta = async (seq: number) => {
    for (;;) {
      const found = messages.find((m) => m.type === "delta" && m.seq === seq);
      if (found) return found as Extract<ServerMessage, { type: "delta" }>;
      await new Promise<void>((done) => waiters.push(done));
    }
  };
  const send = (body: unknown) => socket.send(JSON.stringify(body));
  return { socket, messages, next, delta, send, closed };
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
  test("welcomes with the static map and the team's view, then deltas", async () => {
    const { base, token, playerId, host } = await setup();
    const client = await connect(base, token);
    const welcome: WelcomeMessage = await client.next("welcome");
    expect(welcome).toMatchObject({
      protocol: PROTOCOL_VERSION,
      worldId: 1,
      playerId,
      team: 0,
      status: "running",
      multiplier: 1,
      seq: 0,
    });
    expect(welcome.stream).toMatch(/^[0-9a-f-]{36}$/);
    expect(welcome.map.terrain).toHaveLength(64 * 64);
    expect(welcome.cores).toEqual(host.state.teams.map((t) => t.core));
    expect(welcome.view.tick).toBe(1);
    expect(welcome.view.team).toBe(0);
    expect(welcome.view.creeps[0]).not.toHaveProperty("path");
    expect(viewJson(welcome.view)).toBe(viewJson(view(host.state, 0)));
    host.tick();
    const delta = await client.next("delta");
    expect(delta.seq).toBe(1);
    expect(delta.delta.tick).toBe(2);
    expect(delta).not.toHaveProperty("status");
    expect(viewJson(applyDelta(welcome.view, delta.delta))).toBe(
      viewJson(view(host.state, 0)),
    );
    expect(JSON.stringify(delta).length).toBeLessThan(2_000);
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

  test("sends at most one delta per interval, up to the latest tick", async () => {
    const { base, token, host, timers } = await setup();
    const client = await connect(base, token);
    const welcome = await client.next("welcome");
    host.tick();
    const first = await client.next("delta");
    const sent = () => client.messages.filter((m) => m.type === "delta").length;
    host.tick();
    host.tick();
    host.tick();
    await new Promise((done) => setTimeout(done, 50));
    expect(sent()).toBe(1);
    timers.advance(200);
    const from = client.messages.length;
    const latest = await client.next("delta", from);
    expect(latest).toMatchObject({ seq: 2, delta: { tick: 5 } });
    expect(sent()).toBe(2);
    const seen = applyDelta(
      applyDelta(welcome.view, first.delta),
      latest.delta,
    );
    expect(viewJson(seen)).toBe(viewJson(view(host.state, 0)));
    client.socket.close();
  });

  test("a welcome carries the last view sent, not the state now", async () => {
    const { base, token, host, timers, post } = await setup();
    const ana = await connect(base, token);
    await ana.next("welcome");
    host.tick();
    await ana.delta(1);
    host.tick();
    // Tick 3 waits for the interval; a player joining now starts at tick 2.
    const joined = await post("/api/worlds/1/join", { name: "Caio", team: 0 });
    const caio = await connect(base, (joined.body as { token: string }).token);
    const welcome = await caio.next("welcome");
    expect(welcome).toMatchObject({ seq: 1, view: { tick: 2 } });
    timers.advance(200);
    const next = await caio.delta(2);
    expect(next.delta.tick).toBe(3);
    expect(viewJson(applyDelta(welcome.view, next.delta))).toBe(
      viewJson(view(host.state, 0)),
    );
    ana.socket.close();
    caio.socket.close();
  });

  test("each team has its own stream, advancing even with no socket", async () => {
    const { base, token, host, timers, post } = await setup();
    const ana = await connect(base, token);
    await ana.next("welcome");
    for (let seq = 1; seq <= 3; seq++) {
      host.tick();
      timers.advance(200);
      await ana.delta(seq);
    }
    const joined = await post("/api/worlds/1/join", { name: "Bia", team: 1 });
    const bia = await connect(base, (joined.body as { token: string }).token);
    const welcome = await bia.next("welcome");
    // Team 1's stream sent its 3 deltas to nobody: its base is seq 3.
    expect(welcome).toMatchObject({ team: 1, seq: 3, view: { team: 1 } });
    expect(welcome.stream).not.toBe((ana.messages[0] as WelcomeMessage).stream);
    let seen: TeamView = welcome.view;
    host.tick();
    timers.advance(200);
    const delta = await bia.next("delta");
    expect(delta.seq).toBe(4);
    seen = applyDelta(seen, delta.delta);
    expect(viewJson(seen)).toBe(viewJson(view(host.state, 1)));
    await ana.delta(4);
    const anaDeltas = ana.messages.filter((m) => m.type === "delta");
    expect(anaDeltas.map((m) => m.seq)).toEqual([1, 2, 3, 4]);
    ana.socket.close();
    bia.socket.close();
  });

  test("a socket closed for 15 s releases the domination", async () => {
    const { base, token, host, timers } = await setup();
    const client = await connect(base, token);
    await client.next("welcome");
    const creep = host.state.creeps.find((c) => c.team === 0)!;
    client.send({
      type: "command",
      ref: 1,
      command: { type: "dominate", creepId: creep.id },
    });
    await client.next("ack");
    // setup() already ran tick 0 by hand, so the loop owes its 1st tick at 2 s.
    timers.advance(2_000);
    expect(creep.dominatedBy).not.toBeNull();
    client.socket.close();
    await client.closed;
    await new Promise((done) => setTimeout(done, 20));
    timers.advance(14_000);
    expect(creep.dominatedBy).not.toBeNull();
    timers.advance(2_000);
    expect(creep.dominatedBy).toBeNull();
  });

  test("closes sockets with a bad token", async () => {
    const { base } = await setup();
    const client = await connect(base, "nope");
    expect(await client.closed).toBe(CLOSE.unauthorized);
  });
});
