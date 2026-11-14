// A headless client of the soak (M1.5 plan section 7): a WebSocket in Node
// that follows its team stream as the browser does (apps/client
// connection.ts and store.ts): resumes with &stream=…&seq=… after a drop,
// applies the deltas, checks the view hash and asks for a resync on a seq gap
// or a hash mismatch. It counts what the soak report needs (spec section 7).

import { createHash } from "node:crypto";
import type {
  ClientMessage,
  ResyncReason,
  ServerMessage,
} from "@geometrix/protocol";
import {
  applyDelta,
  PROTOCOL_VERSION,
  viewJson,
} from "@geometrix/protocol/stream";
import type { TeamView } from "@geometrix/sim";
import { WebSocket } from "ws";

/** Wait before a reconnect: the soak's restarts take seconds anyway. */
export const SOAK_RECONNECT_MS = 500;

export type WelcomeCause = "join" | "reconnect" | "resync";

export type SoakClientReport = {
  name: string;
  team: number;
  bytes: number;
  /** Bytes per real second while the client ran. */
  meanBytesPerSecond: number;
  /** The busiest real second. */
  peakBytesPerSecond: number;
  deltas: number;
  /** Open connections that dropped (its own drops or the server's). */
  drops: number;
  resumes: number;
  welcomes: Record<WelcomeCause, number>;
  resyncs: Record<ResyncReason, number>;
  hashes: { ok: number; mismatch: number };
  /** Messages it could not use: another protocol, or a delta before any view. */
  errors: string[];
};

export type SoakClientOptions = {
  /** ws://host:port */
  base: string;
  token: string;
  name: string;
  team: number;
  /** Real milliseconds (Date.now in the soak; tests pass their own). */
  now?: () => number;
};

export class SoakClient {
  private readonly options: SoakClientOptions;
  private readonly now: () => number;
  private socket: WebSocket | null = null;
  private stopped = false;
  private stream: string | null = null;
  private seq = 0;
  private synced = false;
  private resuming = false;
  private nextWelcome: WelcomeCause = "join";
  private readonly started: number;
  private readonly perSecond = new Map<number, number>();
  private current: TeamView | null = null;
  readonly report: SoakClientReport;

  constructor(options: SoakClientOptions) {
    this.options = options;
    this.now = options.now ?? Date.now;
    this.started = this.now();
    this.report = {
      name: options.name,
      team: options.team,
      bytes: 0,
      meanBytesPerSecond: 0,
      peakBytesPerSecond: 0,
      deltas: 0,
      drops: 0,
      resumes: 0,
      welcomes: { join: 0, reconnect: 0, resync: 0 },
      resyncs: { seqGap: 0, hashMismatch: 0 },
      hashes: { ok: 0, mismatch: 0 },
      errors: [],
    };
    this.connect();
  }

  /** The view rebuilt from the stream, or null before the first welcome. */
  get view(): TeamView | null {
    return this.current;
  }

  /** A short drop on the client's side: close and reconnect (spec C-4). */
  drop(): void {
    this.socket?.terminate();
  }

  /** Stops for good and fills in the per-second figures. */
  stop(): SoakClientReport {
    this.stopped = true;
    this.socket?.terminate();
    const seconds = Math.max(1, (this.now() - this.started) / 1000);
    this.report.meanBytesPerSecond = this.report.bytes / seconds;
    this.report.peakBytesPerSecond = Math.max(0, ...this.perSecond.values());
    return this.report;
  }

  private connect(): void {
    if (this.stopped) return;
    const { base, token } = this.options;
    this.resuming = this.stream !== null && this.synced;
    const resume = this.resuming
      ? `&stream=${encodeURIComponent(this.stream!)}&seq=${this.seq}`
      : "";
    const socket = new WebSocket(`${base}/ws?token=${token}${resume}`);
    this.socket = socket;
    let opened = false;
    socket.on("open", () => (opened = true));
    socket.on("message", (data) => {
      if (this.socket === socket) this.received(String(data));
    });
    socket.on("close", () => {
      if (this.socket !== socket) return;
      this.socket = null;
      if (this.stopped) return;
      // A refused attempt (the server is restarting) is not a drop.
      if (opened) this.report.drops++;
      setTimeout(() => this.connect(), SOAK_RECONNECT_MS);
    });
    socket.on("error", () => {});
  }

  private received(data: string): void {
    this.report.bytes += data.length;
    const second = Math.floor((this.now() - this.started) / 1000);
    this.perSecond.set(second, (this.perSecond.get(second) ?? 0) + data.length);
    const message = JSON.parse(data) as ServerMessage;
    switch (message.type) {
      case "welcome":
        if (message.protocol !== PROTOCOL_VERSION) {
          this.report.errors.push(`protocol ${message.protocol}`);
          this.stop();
          return;
        }
        this.report.welcomes[this.nextWelcome]++;
        this.nextWelcome = "reconnect";
        this.resuming = false;
        this.synced = true;
        this.stream = message.stream;
        this.seq = message.seq;
        this.current = message.view;
        break;
      case "delta": {
        if (!this.synced) return;
        if (this.current === null) {
          this.report.errors.push(`delta ${message.seq} before a view`);
          return;
        }
        if (message.seq !== this.seq + 1) {
          this.resync("seqGap");
          return;
        }
        if (this.resuming) this.report.resumes++;
        this.resuming = false;
        this.seq = message.seq;
        this.current = applyDelta(this.current, message.delta);
        this.report.deltas++;
        if (message.hash !== undefined) {
          const hash = createHash("sha256")
            .update(viewJson(this.current))
            .digest("hex");
          if (hash === message.hash) {
            this.report.hashes.ok++;
          } else {
            this.report.hashes.mismatch++;
            this.resync("hashMismatch");
          }
        }
        break;
      }
      case "ack":
      case "reject":
        break;
    }
  }

  private resync(reason: ResyncReason): void {
    if (!this.synced || this.socket === null) return;
    this.synced = false;
    this.nextWelcome = "resync";
    this.report.resyncs[reason]++;
    const message: ClientMessage = { type: "resync", reason, seq: this.seq };
    this.socket.send(JSON.stringify(message));
  }
}
