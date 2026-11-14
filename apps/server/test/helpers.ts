import { readFileSync } from "node:fs";
import { parseParams, type Params } from "@geometrix/sim";

/** The sim tests' fixed params, so balancing does not change these tests. */
export function testParams(): Params {
  return parseParams(
    JSON.parse(
      readFileSync(
        new URL("../../../packages/sim/test/params.json", import.meta.url),
        "utf8",
      ),
    ),
  );
}

/** A clock and setTimeout the test moves by hand. */
export class FakeTimers {
  private time = 0;
  private nextId = 1;
  private queue: { id: number; at: number; fn: () => void }[] = [];

  now = (): number => this.time;

  setTimeout = (fn: () => void, ms: number): unknown => {
    const id = this.nextId++;
    this.queue.push({ id, at: this.time + ms, fn });
    return id;
  };

  clearTimeout = (handle: unknown): void => {
    this.queue = this.queue.filter((t) => t.id !== handle);
  };

  /** Moves the clock by `ms`, firing each due timer at its own time. */
  advance(ms: number): void {
    const end = this.time + ms;
    for (;;) {
      this.queue.sort((a, b) => a.at - b.at || a.id - b.id);
      const next = this.queue[0];
      if (next === undefined || next.at > end) break;
      this.queue.shift();
      this.time = Math.max(this.time, next.at);
      next.fn();
    }
    this.time = end;
  }

  /** Moves the clock without firing anything (a blocked event loop). */
  stall(ms: number): void {
    this.time += ms;
  }
}
