// The page's side of the lab (plan section 13): the worker, the simulated
// network both ways (spec L-3: every input of the human crosses it, and the
// page draws only what comes back), the input numbering for the measured
// delay and the size of what crosses. The page reads the callbacks.

import type {
  BattleCommand,
  BattleLog,
  BattleParams,
  BattleSetup,
  Gambit,
} from "@geometrix/battle";
import { DelayedChannel, type Scheduler } from "./channel.ts";
import { LatencyMeter, SizeMeter } from "./latency.ts";
import {
  crossesChannel,
  type Ended,
  type Frame,
  type FromWorker,
  type Speed,
  type ToWorker,
} from "./protocol.ts";

export type LabCallbacks = {
  frame(frame: Frame, at: number): void;
  ended(ended: Ended): void;
  log(log: BattleLog): void;
  gambits(id: number, gambits: Gambit[] | null): void;
  error(message: string): void;
};

/** The worker as the connection uses it (a fake one in the tests). */
export type WorkerLike = {
  postMessage(message: ToWorker): void;
  onmessage: ((event: MessageEvent<FromWorker>) => void) | null;
  terminate(): void;
};

export class LabConnection {
  readonly latency = new LatencyMeter();
  readonly sizes = new SizeMeter();
  private readonly up: DelayedChannel<ToWorker>;
  private readonly down: DelayedChannel<Frame | Ended>;
  private nextSeq = 1;
  private readonly worker: WorkerLike;
  private readonly scheduler: Scheduler;
  private readonly callbacks: LabCallbacks;

  constructor(
    worker: WorkerLike,
    scheduler: Scheduler,
    callbacks: LabCallbacks,
  ) {
    this.worker = worker;
    this.scheduler = scheduler;
    this.callbacks = callbacks;
    this.up = new DelayedChannel((m) => worker.postMessage(m), scheduler);
    this.down = new DelayedChannel((m) => this.arrive(m), scheduler);
    worker.onmessage = (event) => {
      const message = event.data;
      if (crossesChannel(message)) {
        if (message.type === "frame") this.sizes.add(message);
        this.down.send(message);
        return;
      }
      if (message.type === "log") callbacks.log(message.log);
      else if (message.type === "gambits") {
        callbacks.gambits(message.id, message.gambits);
      } else callbacks.error(message.message);
    };
  }

  /** The RTT of the simulated network, both legs; it holds at once (L-4). */
  set rttMs(rtt: number) {
    this.up.rttMs = rtt;
    this.down.rttMs = rtt;
  }

  get rttMs(): number {
    return this.up.rttMs;
  }

  start(setup: BattleSetup, params: BattleParams, speed: Speed): void {
    this.latency.reset();
    this.sizes.reset();
    this.worker.postMessage({ type: "start", setup, params, speed });
  }

  /** A battle command of the human: it crosses the network (spec L-3). */
  send(command: BattleCommand): void {
    const seq = this.nextSeq++;
    this.latency.sent(seq, this.scheduler.now());
    this.up.send({ type: "input", seq, command });
  }

  pause(): void {
    this.worker.postMessage({ type: "pause" });
  }

  resume(): void {
    this.worker.postMessage({ type: "resume" });
  }

  speed(speed: Speed): void {
    this.worker.postMessage({ type: "speed", speed });
  }

  exportLog(): void {
    this.worker.postMessage({ type: "export" });
  }

  requestGambits(id: number): void {
    this.worker.postMessage({ type: "gambits", id });
  }

  close(): void {
    this.worker.terminate();
  }

  private arrive(message: Frame | Ended): void {
    if (message.type === "ended") {
      this.callbacks.ended(message);
      return;
    }
    const at = this.scheduler.now();
    this.callbacks.frame(message, at);
  }

  /**
   * The inputs of a frame are on the screen at `at`: when the frame is
   * drawn, or a tick later with the interpolation (the page says which).
   */
  shown(applied: readonly number[], at: number): void {
    this.latency.shown(applied, at);
  }
}
