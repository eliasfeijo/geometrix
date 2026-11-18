import type { BattleSetup, BattleView } from "@geometrix/battle";
import { describe, expect, test } from "vitest";
import { LabConnection, type WorkerLike } from "../src/lab/connection.ts";
import type { Frame, FromWorker, ToWorker } from "../src/lab/protocol.ts";
import { FakeClock } from "./fake-clock.ts";

/** A worker that only records what the page posts, and can answer. */
function fakeWorker() {
  const posted: ToWorker[] = [];
  const worker: WorkerLike = {
    postMessage: (m) => posted.push(m),
    onmessage: null,
    terminate: () => {},
  };
  const answer = (m: FromWorker) =>
    worker.onmessage!({ data: m } as MessageEvent<FromWorker>);
  return { worker, posted, answer };
}

const view = (tick: number): BattleView => ({
  tick,
  countdownTicks: 0,
  idleTicks: 0,
  participants: [],
  projectiles: [],
  piles: [],
  ended: null,
});

const frame = (battle: number, tick: number): Frame => ({
  type: "frame",
  battle,
  view: view(tick),
  events: [],
  applied: [],
});

describe("the connection numbers the battles (F5)", () => {
  test("a restart drops what is still on the network from the last battle", () => {
    const clock = new FakeClock();
    const { worker, posted, answer } = fakeWorker();
    const shown: [number, number][] = [];
    const ended: number[] = [];
    const conn = new LabConnection(worker, clock, {
      frame: (f) => shown.push([f.battle, f.view.tick]),
      ended: (e) => ended.push(e.battle),
      log: () => {},
      gambits: () => {},
      error: () => {},
    });
    conn.rttMs = 200;
    const setup = {} as BattleSetup;
    conn.start(setup, {} as never, 1);
    conn.send({ type: "face", id: 1, dir: "up" });
    answer(frame(1, 5));
    // R: battle 2 starts while battle 1's input and frame are still on the way.
    conn.start(setup, {} as never, 1);
    answer({ type: "ended", battle: 1, hash: "x", ticks: 6 });
    answer(frame(2, 0));
    clock.advance(1000);
    expect(shown).toEqual([[2, 0]]);
    expect(ended).toEqual([]);
    // The input of battle 1 carries its number, so the worker drops it.
    expect(
      posted.map((m) => [m.type, "battle" in m ? m.battle : null]),
    ).toEqual([
      ["start", 1],
      ["start", 2],
      ["input", 1],
    ]);
  });
});
