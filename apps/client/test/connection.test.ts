import { describe, expect, it } from "vitest";
import {
  Connection,
  RECONNECT_MAX_MS,
  RECONNECT_MIN_MS,
  type ConnectionStatus,
  type FatalReason,
  type SocketHandlers,
  type WorldMessage,
} from "../src/connection.ts";
import { testWorld, welcomeOf } from "./helpers.ts";

class FakeSocket {
  readonly sent: unknown[] = [];
  closed = false;
  readonly url: string;
  readonly handlers: SocketHandlers;
  constructor(url: string, handlers: SocketHandlers) {
    this.url = url;
    this.handlers = handlers;
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.closed = true;
  }
  serverSends(message: unknown) {
    this.handlers.message(JSON.stringify(message));
  }
}

function setup() {
  const sockets: FakeSocket[] = [];
  const timers: { fn: () => void; ms: number; id: number }[] = [];
  let nextTimer = 1;
  const statuses: ConnectionStatus[] = [];
  const messages: WorldMessage[] = [];
  const fatal: FatalReason[] = [];
  const resyncs: [string, number][] = [];
  const connection = new Connection(
    "ws://test/ws?token=t",
    {
      message: (m) => messages.push(m),
      status: (s) => statuses.push(s),
      fatal: (r) => fatal.push(r),
      resync: (reason, seq) => resyncs.push([reason, seq]),
    },
    {
      openSocket: (url, handlers) => {
        const socket = new FakeSocket(url, handlers);
        sockets.push(socket);
        return socket;
      },
      setTimeout: (fn, ms) => {
        const id = nextTimer++;
        timers.push({ fn, ms, id });
        return id;
      },
      clearTimeout: (id) => {
        const i = timers.findIndex((t) => t.id === id);
        if (i >= 0) timers.splice(i, 1);
      },
      now: () => 0,
    },
  );
  const fireTimer = () => {
    const timer = timers.shift();
    if (timer === undefined) throw new Error("no timer");
    timer.fn();
    return timer.ms;
  };
  const last = () => sockets[sockets.length - 1]!;
  const welcome = welcomeOf(testWorld());
  const openWithWelcome = () => {
    last().handlers.open();
    last().serverSends(welcome);
  };
  return {
    connection,
    sockets,
    timers,
    statuses,
    messages,
    fatal,
    resyncs,
    fireTimer,
    last,
    openWithWelcome,
    welcome,
  };
}

describe("Connection", () => {
  it("connects with the url and reports the welcome and deltas", () => {
    const t = setup();
    expect(t.sockets).toHaveLength(1);
    expect(t.last().url).toBe("ws://test/ws?token=t");
    expect(t.statuses).toEqual(["connecting"]);
    t.openWithWelcome();
    expect(t.statuses).toEqual(["connecting", "open"]);
    t.last().serverSends({ type: "delta", seq: 1, delta: { tick: 5 } });
    expect(t.messages.map((m) => m.type)).toEqual(["welcome", "delta"]);
  });

  it("resolves commands with their ack or reject, by ref", async () => {
    const t = setup();
    t.openWithWelcome();
    const first = t.connection.send({ type: "release" });
    const second = t.connection.send({ type: "stopRepeat" });
    expect(t.last().sent).toEqual([
      { type: "command", ref: 1, command: { type: "release" } },
      { type: "command", ref: 2, command: { type: "stopRepeat" } },
    ]);
    t.last().serverSends({ type: "reject", ref: 2, reason: "unknownPlayer" });
    t.last().serverSends({ type: "ack", ref: 1, tick: 9 });
    expect(await first).toEqual({ ok: true, tick: 9 });
    expect(await second).toEqual({ ok: false, reason: "unknownPlayer" });
  });

  it("refuses to send while not connected", async () => {
    const t = setup();
    expect(await t.connection.send({ type: "release" })).toEqual({
      ok: false,
      reason: "disconnected",
    });
    expect(t.last().sent).toEqual([]);
  });

  it("fails pending commands and reconnects with backoff on a drop", async () => {
    const t = setup();
    t.openWithWelcome();
    const pending = t.connection.send({ type: "release" });
    t.last().handlers.close(1006);
    expect(await pending).toEqual({ ok: false, reason: "disconnected" });
    expect(t.statuses.at(-1)).toBe("reconnecting");

    const delays: number[] = [];
    for (let i = 0; i < 6; i++) {
      delays.push(t.fireTimer());
      t.last().handlers.close(1006);
    }
    expect(delays).toEqual([
      RECONNECT_MIN_MS,
      RECONNECT_MIN_MS * 2,
      RECONNECT_MIN_MS * 4,
      RECONNECT_MIN_MS * 8,
      RECONNECT_MAX_MS,
      RECONNECT_MAX_MS,
    ]);
    expect(t.sockets).toHaveLength(7);
    expect(t.sockets[0]!.url).toBe("ws://test/ws?token=t");
    expect(
      t.sockets
        .slice(1)
        .every((s) => s.url === "ws://test/ws?token=t&stream=test&seq=0"),
    ).toBe(true);

    // A welcome resets the backoff.
    t.fireTimer();
    t.openWithWelcome();
    expect(t.statuses.at(-1)).toBe("open");
    t.last().handlers.close(1006);
    expect(t.fireTimer()).toBe(RECONNECT_MIN_MS);
  });

  it("resumes the stream on a reconnect, without a welcome", () => {
    const t = setup();
    t.openWithWelcome();
    t.last().serverSends({ type: "delta", seq: 1, delta: { tick: 2 } });
    t.last().serverSends({ type: "delta", seq: 2, delta: { tick: 3 } });
    t.last().handlers.close(1006);
    t.fireTimer();
    expect(t.last().url).toBe("ws://test/ws?token=t&stream=test&seq=2");
    expect(t.statuses.at(-1)).toBe("reconnecting");
    t.last().handlers.open();
    expect(t.statuses.at(-1)).toBe("open");
    t.last().serverSends({ type: "delta", seq: 3, delta: { tick: 4 } });
    expect(t.messages.map((m) => m.type)).toEqual([
      "welcome",
      "delta",
      "delta",
      "delta",
    ]);
    // The backoff starts over once resumed.
    t.last().handlers.close(1006);
    expect(t.fireTimer()).toBe(RECONNECT_MIN_MS);
    // A server that cannot resume sends a welcome: a new base.
    t.last().handlers.open();
    t.last().serverSends({ ...t.welcome, stream: "new", seq: 0 });
    t.last().handlers.close(1006);
    t.fireTimer();
    expect(t.last().url).toBe("ws://test/ws?token=t&stream=new&seq=0");
  });

  it("asks for a resync on a gap in the seqs and drops deltas until the welcome", () => {
    const t = setup();
    t.openWithWelcome();
    t.last().serverSends({ type: "delta", seq: 1, delta: { tick: 2 } });
    t.last().serverSends({ type: "delta", seq: 3, delta: { tick: 4 } });
    t.last().serverSends({ type: "delta", seq: 4, delta: { tick: 5 } });
    expect(t.last().sent).toEqual([
      { type: "resync", reason: "seqGap", seq: 1 },
    ]);
    expect(t.resyncs).toEqual([["seqGap", 1]]);
    // Asked once: a hash mismatch now changes nothing.
    t.connection.resync("hashMismatch");
    expect(t.last().sent).toHaveLength(1);
    // A drop now asks for a welcome, not a resume.
    t.last().handlers.close(1006);
    t.fireTimer();
    expect(t.last().url).toBe("ws://test/ws?token=t");
    t.last().handlers.open();
    t.last().serverSends({ ...t.welcome, seq: 4 });
    t.last().serverSends({ type: "delta", seq: 5, delta: { tick: 6 } });
    expect(t.messages.map((m) => m.type)).toEqual([
      "welcome",
      "delta",
      "welcome",
      "delta",
    ]);
    t.connection.resync("hashMismatch");
    expect(t.last().sent).toEqual([
      { type: "resync", reason: "hashMismatch", seq: 5 },
    ]);
  });

  it("counts what the network panel shows", () => {
    const t = setup();
    const { stats } = t.connection;
    t.openWithWelcome();
    t.last().serverSends({ type: "delta", seq: 1, delta: { tick: 2 } });
    t.last().handlers.close(1006);
    t.fireTimer();
    t.last().handlers.open();
    t.last().serverSends({ type: "delta", seq: 2, delta: { tick: 3 } });
    t.last().serverSends({ type: "delta", seq: 9, delta: { tick: 9 } });
    t.last().serverSends({ ...t.welcome, seq: 9 });
    t.last().handlers.close(1006);
    t.fireTimer();
    t.last().handlers.open();
    t.last().serverSends({ ...t.welcome, stream: "new", seq: 0 });
    // That resume was refused (a restart): only the first one counts.
    expect(stats).toMatchObject({
      seq: 0,
      deltas: 2,
      resumes: 1,
      welcomes: { join: 1, reconnect: 1, resync: 1 },
      resyncs: { seqGap: 1, hashMismatch: 0 },
    });
    expect(stats.totalBytes).toBeGreaterThan(0);
  });

  it("stops for good on another protocol version", () => {
    const t = setup();
    t.last().handlers.open();
    t.last().serverSends({ ...t.welcome, protocol: 1 });
    expect(t.fatal).toEqual(["outdated"]);
    expect(t.messages).toEqual([]);
    expect(t.last().closed).toBe(true);
    expect(t.statuses.at(-1)).toBe("closed");
    expect(t.timers).toEqual([]);
  });

  it.each([
    [4401, "unauthorized"],
    [4404, "worldNotHosted"],
  ] as const)("stops on close code %i", (code, reason) => {
    const t = setup();
    t.last().handlers.close(code);
    expect(t.fatal).toEqual([reason]);
    expect(t.statuses.at(-1)).toBe("closed");
    expect(t.timers).toEqual([]);
  });

  it("closes for good and ignores the old socket's events", () => {
    const t = setup();
    t.openWithWelcome();
    const socket = t.last();
    t.connection.close();
    expect(socket.closed).toBe(true);
    socket.handlers.close(1000);
    socket.serverSends({ type: "delta", seq: 1, delta: { tick: 5 } });
    expect(t.timers).toEqual([]);
    expect(t.messages).toHaveLength(1);
    expect(t.statuses.at(-1)).toBe("closed");
  });
});
