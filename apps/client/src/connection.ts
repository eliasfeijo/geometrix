// WebSocket session with the server (plan section 7): welcome, then the
// deltas of the team's view at most 5 times per second (M1.5 plan section 6); commands go out with a ref and come back as ack or
// reject. A dropped connection reconnects with the same token (backoff),
// telling the stream and the last seq it got so the server can send just the
// deltas it missed (spec C-4, plan R5); a refused token or an unhosted world
// is final.

import type {
  ClientCommand,
  ClientMessage,
  RejectReason,
  ServerMessage,
} from "@geometrix/protocol";

export type ConnectionStatus =
  "connecting" | "open" | "reconnecting" | "closed";

/** Close codes the server uses (apps/server ws.ts): no point retrying. */
const FATAL_CODES: Record<number, FatalReason> = {
  4401: "unauthorized",
  4404: "worldNotHosted",
};
export type FatalReason = "unauthorized" | "worldNotHosted";

export type CommandResult =
  | { ok: true; tick: number }
  | { ok: false; reason: RejectReason | "disconnected" };

export type WorldMessage = Extract<
  ServerMessage,
  { type: "welcome" | "delta" }
>;

export type ConnectionEvents = {
  message(message: WorldMessage): void;
  status(status: ConnectionStatus): void;
  fatal(reason: FatalReason): void;
};

export type SocketHandlers = {
  open(): void;
  message(data: string): void;
  close(code: number): void;
};

/** An open socket; the browser one is browserSocket, tests pass a fake. */
export type SocketHandle = { send(data: string): void; close(): void };

export type ConnectionDeps = {
  openSocket(url: string, handlers: SocketHandlers): SocketHandle;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

export const RECONNECT_MIN_MS = 500;
export const RECONNECT_MAX_MS = 8000;

export class Connection {
  private readonly url: string;
  private readonly events: ConnectionEvents;
  private readonly deps: ConnectionDeps;
  private socket: SocketHandle | null = null;
  private isOpen = false;
  private stopped = false;
  private attempts = 0;
  private timer: unknown = null;
  private nextRef = 1;
  private readonly pending = new Map<number, (r: CommandResult) => void>();
  /** The team stream of the last welcome, and the last seq received in it. */
  private stream: string | null = null;
  private seq = 0;
  /** Whether the current socket asked to resume instead of a welcome. */
  private resuming = false;

  constructor(url: string, events: ConnectionEvents, deps: ConnectionDeps) {
    this.url = url;
    this.events = events;
    this.deps = deps;
    this.connect();
  }

  /** Sends a command; resolves with the ack or the reject. */
  send(command: ClientCommand): Promise<CommandResult> {
    if (this.socket === null || !this.isOpen) {
      return Promise.resolve({ ok: false, reason: "disconnected" });
    }
    const ref = this.nextRef++;
    const message: ClientMessage = { type: "command", ref, command };
    return new Promise((resolve) => {
      this.pending.set(ref, resolve);
      this.socket!.send(JSON.stringify(message));
    });
  }

  close(): void {
    this.stopped = true;
    if (this.timer !== null) this.deps.clearTimeout(this.timer);
    this.timer = null;
    this.socket?.close();
    this.dropped();
    this.events.status("closed");
  }

  private connect(): void {
    this.timer = null;
    this.events.status(this.attempts === 0 ? "connecting" : "reconnecting");
    // Only a reconnect on this page has a stream to resume.
    this.resuming = this.stream !== null;
    const url = this.resuming
      ? `${this.url}&stream=${encodeURIComponent(this.stream!)}&seq=${this.seq}`
      : this.url;
    const socket = this.deps.openSocket(url, {
      open: () => {
        if (this.socket !== socket) return;
        this.isOpen = true;
        // A resumed stream goes on without a welcome.
        if (this.resuming) this.opened();
      },
      message: (data) => {
        if (this.socket === socket) this.received(data);
      },
      close: (code) => {
        if (this.socket === socket) this.closed(code);
      },
    });
    this.socket = socket;
  }

  private received(data: string): void {
    let message: ServerMessage;
    try {
      message = JSON.parse(data) as ServerMessage;
    } catch {
      return;
    }
    switch (message.type) {
      case "welcome":
        this.stream = message.stream;
        this.seq = message.seq;
        this.resuming = false;
        this.opened();
        this.events.message(message);
        break;
      case "delta":
        this.seq = message.seq;
        this.events.message(message);
        break;
      case "ack":
      case "reject": {
        const resolve = this.pending.get(message.ref);
        if (resolve === undefined) return;
        this.pending.delete(message.ref);
        resolve(
          message.type === "ack"
            ? { ok: true, tick: message.tick }
            : { ok: false, reason: message.reason },
        );
        break;
      }
    }
  }

  private opened(): void {
    this.attempts = 0;
    this.events.status("open");
  }

  private closed(code: number): void {
    this.dropped();
    if (this.stopped) return;
    const fatal = FATAL_CODES[code];
    if (fatal !== undefined) {
      this.stopped = true;
      this.events.status("closed");
      this.events.fatal(fatal);
      return;
    }
    const delay = Math.min(
      RECONNECT_MIN_MS * 2 ** this.attempts,
      RECONNECT_MAX_MS,
    );
    this.attempts++;
    this.events.status("reconnecting");
    this.timer = this.deps.setTimeout(() => this.connect(), delay);
  }

  /** Forgets the socket and fails the commands still waiting for an answer. */
  private dropped(): void {
    this.socket = null;
    this.isOpen = false;
    for (const resolve of this.pending.values()) {
      resolve({ ok: false, reason: "disconnected" });
    }
    this.pending.clear();
  }
}

export function browserSocket(
  url: string,
  handlers: SocketHandlers,
): SocketHandle {
  const ws = new WebSocket(url);
  ws.onopen = () => handlers.open();
  ws.onmessage = (event) => {
    if (typeof event.data === "string") handlers.message(event.data);
  };
  ws.onclose = (event) => handlers.close(event.code);
  return { send: (data) => ws.send(data), close: () => ws.close() };
}

export const browserDeps: ConnectionDeps = {
  openSocket: browserSocket,
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (handle) => window.clearTimeout(handle as number),
};

/** The WebSocket URL on the page's own host (the Vite dev server proxies it). */
export function socketUrl(location: Location, token: string): string {
  const scheme = location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${location.host}/ws?token=${encodeURIComponent(token)}`;
}
