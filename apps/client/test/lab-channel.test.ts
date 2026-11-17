import { describe, expect, test } from "vitest";
import { DelayedChannel, JITTER_PERMILLE } from "../src/lab/channel.ts";
import { LatencyMeter, SizeMeter } from "../src/lab/latency.ts";
import { FakeClock } from "./fake-clock.ts";

/** A channel over a fake clock that records when each message arrived. */
function channel(rttMs: number, random: () => number = () => 0.5) {
  const clock = new FakeClock();
  const arrived: { message: number; at: number }[] = [];
  const ch = new DelayedChannel<number>(
    (message) => arrived.push({ message, at: clock.now() }),
    clock,
    random,
  );
  ch.rttMs = rttMs;
  return { clock, ch, arrived };
}

describe("the delayed channel (spec D17, L-3; plan P7)", () => {
  test("each leg takes half the RTT", () => {
    const { clock, ch, arrived } = channel(200);
    ch.send(1);
    clock.advance(99);
    expect(arrived).toEqual([]);
    clock.advance(1);
    expect(arrived).toEqual([{ message: 1, at: 100 }]);
  });

  test("with RTT 0 a message arrives at once", () => {
    const { ch, arrived } = channel(0);
    ch.send(1);
    expect(arrived).toEqual([{ message: 1, at: 0 }]);
  });

  test(`the jitter stays within ±${JITTER_PERMILLE / 10}% of the leg`, () => {
    for (const [random, at] of [
      [0, 80],
      [0.999_999, 120],
    ] as const) {
      const { clock, ch, arrived } = channel(200, () => random);
      ch.send(1);
      clock.advance(200);
      expect(arrived[0]!.at).toBeCloseTo(at, 3);
    }
  });

  test("keeps the order: a quick message waits behind a slow one", () => {
    const draws = [0.999_999, 0];
    const { clock, ch, arrived } = channel(200, () => draws.shift() ?? 0.5);
    ch.send(1); // 120 ms
    clock.advance(10);
    ch.send(2); // would be 10 + 80 = 90 ms, but waits for the first
    clock.advance(300);
    expect(arrived.map((a) => a.message)).toEqual([1, 2]);
    expect(arrived[1]!.at).toBeCloseTo(arrived[0]!.at, 6);
  });

  test("keeps the order over many messages with random jitter", () => {
    let seed = 1;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    const { clock, ch, arrived } = channel(150, random);
    for (let i = 0; i < 200; i++) {
      ch.send(i);
      clock.advance(7);
    }
    clock.advance(1000);
    expect(arrived.map((a) => a.message)).toEqual(
      Array.from({ length: 200 }, (_, i) => i),
    );
    expect(ch.inFlight).toBe(0);
  });

  test("a new RTT holds from the next message (L-4)", () => {
    const { clock, ch, arrived } = channel(300);
    ch.send(1);
    ch.rttMs = 0;
    ch.send(2); // no delay of its own, but behind the first
    clock.advance(150);
    expect(arrived.map((a) => [a.message, a.at])).toEqual([
      [1, 150],
      [2, 150],
    ]);
    ch.send(3);
    expect(arrived.at(-1)).toEqual({ message: 3, at: 150 });
  });
});

describe("the measured delay (spec L-4)", () => {
  test("from the key to the frame that shows it, with median and p95", () => {
    const meter = new LatencyMeter();
    for (let seq = 1; seq <= 20; seq++) meter.sent(seq, seq * 1000);
    for (let seq = 1; seq <= 20; seq++)
      meter.shown([seq], seq * 1000 + seq * 10);
    meter.shown([1], 99_999); // already measured: not counted twice
    expect(meter.summary()).toEqual({ samples: 20, medianMs: 100, p95Ms: 190 });
    meter.reset();
    expect(meter.summary().samples).toBe(0);
  });

  test("the average size of the frames, in bytes", () => {
    const sizes = new SizeMeter();
    expect(Number.isNaN(sizes.averageBytes)).toBe(true);
    sizes.add({ a: 1 }); // {"a":1}: 7 bytes
    sizes.add({ a: "é" }); // {"a":"é"}: 10 bytes
    expect(sizes.averageBytes).toBe(8.5);
  });
});
