import {
  defaultGambits,
  parseBattleParams,
  replayLog,
  serializeBattle,
  type BattleLog,
  type BattleSetup,
  type Dna,
} from "@geometrix/battle";
import { describe, expect, test, vi } from "vitest";
import paramsJson from "../../../packages/battle/test/params.json?raw";
import { LAB_ARENAS } from "../src/lab/assets.ts";
import { LabHost, MAX_CATCH_UP_TICKS, webSha256 } from "../src/lab/host.ts";
import type { Frame, FromWorker, Speed } from "../src/lab/protocol.ts";
import { FakeClock } from "./fake-clock.ts";

// The battle tests' fixed params, so balancing does not change these tests.
const params = parseBattleParams(JSON.parse(paramsJson));

// Max HP and capacity fixed like the params (the world's numbers of D9).
const KITS: Record<Dna, { maxHp: number; capacity: number }> = {
  square: { maxHp: 300, capacity: 30 },
  triangle: { maxHp: 200, capacity: 20 },
  circle: { maxHp: 120, capacity: 10 },
};

const fighter = (dna: Dna) => ({
  name: dna,
  dna,
  hp: KITS[dna].maxHp,
  maxHp: KITS[dna].maxHp,
  carry: { materia: 0, cristal: 0 },
  capacity: KITS[dna].capacity,
  gambits: defaultGambits(dna),
  reaction: "normal" as const,
});

const setup: BattleSetup = {
  rule: "grid",
  arena: LAB_ARENAS.pedras,
  seed: 7,
  sides: [[fighter("square")], [fighter("circle")]],
};

// The worker's hash; the CLI's (node:crypto) is the same sha256, which
// `geo battle verify --log` checks on the fixture.
const sha256 = webSha256;

function host(speed: Speed = 1) {
  const clock = new FakeClock();
  const out: FromWorker[] = [];
  const lab = new LabHost((m) => out.push(m), clock, webSha256);
  lab.handle({ type: "start", battle: 1, setup, params, speed });
  const frames = () => out.filter((m): m is Frame => m.type === "frame");
  return { clock, out, lab, frames };
}

describe("the clock (plan P10)", () => {
  test("sends the view at tick 0, then one frame per tick at 20 per second", () => {
    const { clock, frames } = host();
    expect(frames()).toHaveLength(1);
    expect(frames()[0]!.view.tick).toBe(0);
    clock.advance(1000);
    expect(frames()).toHaveLength(21);
    expect(frames().at(-1)!.view.tick).toBe(20);
  });

  test("does not drift when the timers fire late", () => {
    const { clock, frames, lab } = host();
    // Timers that fire 30 ms late, every time: the ticks due by the clock
    // still come, two at once when needed.
    const set = clock.set;
    clock.set = (fn, ms) => set(fn, ms + 30);
    lab.handle({ type: "speed", speed: 1 });
    clock.advance(10_000);
    const ticks = frames().at(-1)!.view.tick;
    expect(ticks).toBeGreaterThanOrEqual(199);
    expect(ticks).toBeLessThanOrEqual(200);
  });

  test("×4 runs four times as many ticks", () => {
    const { clock, frames } = host(4);
    clock.advance(1000);
    expect(frames().at(-1)!.view.tick).toBe(80);
  });

  test("pauses, resumes and changes speed from now", () => {
    const { clock, frames, lab } = host();
    clock.advance(500);
    lab.handle({ type: "pause" });
    clock.advance(5000);
    expect(frames().at(-1)!.view.tick).toBe(10);
    lab.handle({ type: "resume" });
    clock.advance(500);
    expect(frames().at(-1)!.view.tick).toBe(20);
    lab.handle({ type: "speed", speed: 4 });
    clock.advance(500);
    expect(frames().at(-1)!.view.tick).toBe(60);
  });

  test(`catches up at most ${MAX_CATCH_UP_TICKS} ticks after a long stall`, () => {
    const { clock, frames } = host();
    const set = clock.set;
    let calls = 0;
    // The next timer (after tick 1) fires 10 s late; the rest on time.
    clock.set = (fn, ms) => set(fn, calls++ === 0 ? ms + 10_000 : ms);
    clock.advance(10_100);
    // Tick 1 came on time (its timer was set before the stall); then ~200
    // ticks were due at once, and only the cap ran.
    expect(frames().at(-1)!.view.tick).toBe(1 + MAX_CATCH_UP_TICKS);
    clock.advance(1000);
    expect(frames().at(-1)!.view.tick).toBe(1 + MAX_CATCH_UP_TICKS + 20);
  });
});

describe("inputs (plan P5)", () => {
  test("an input applies on the next tick, and its frame says so", () => {
    const { clock, frames, lab } = host();
    clock.advance(120); // ticks 0 and 1 stepped; the clock is mid tick 2
    lab.handle({
      type: "input",
      battle: 1,
      seq: 9,
      command: { type: "control", id: 1, controller: "human" },
    });
    expect(frames().at(-1)!.applied).toEqual([]);
    clock.advance(30);
    const frame = frames().at(-1)!;
    expect(frame.applied).toEqual([9]);
    expect(frame.view.participants[0]!.controller).toBe("human");
    expect(frame.events.map((e) => e.type)).toContain("controlChanged");
  });

  test("a paused battle keeps the input for the tick after it resumes", () => {
    const { clock, frames, lab } = host();
    lab.handle({ type: "pause" });
    lab.handle({
      type: "input",
      battle: 1,
      seq: 1,
      command: { type: "drop", id: 1 },
    });
    clock.advance(1000);
    expect(frames()).toHaveLength(1);
    lab.handle({ type: "resume" });
    clock.advance(50);
    expect(frames().at(-1)!.applied).toEqual([1]);
  });

  test("an input of the previous battle, still on the network, is dropped", () => {
    const { clock, frames, lab } = host();
    lab.handle({ type: "start", battle: 2, setup, params, speed: 1 });
    // A key held across the restart: sent in battle 1, arriving in battle 2.
    lab.handle({
      type: "input",
      battle: 1,
      seq: 4,
      command: { type: "control", id: 1, controller: "human" },
    });
    lab.handle({
      type: "input",
      battle: 2,
      seq: 5,
      command: { type: "face", id: 2, dir: "up" },
    });
    clock.advance(50);
    const frame = frames().at(-1)!;
    expect(frame.applied).toEqual([5]);
    expect(frame.view.participants[0]!.controller).toBe("gambits");
  });
});

describe("the end, the log and the hash (spec R-3)", () => {
  test("hashes the final state as geo battle verify does, and the log replays it", async () => {
    const { clock, out, lab } = host(4);
    lab.handle({
      type: "input",
      battle: 1,
      seq: 1,
      command: { type: "control", id: 2, controller: "human" },
    });
    clock.advance(400);
    lab.handle({
      type: "input",
      battle: 1,
      seq: 2,
      command: { type: "intent", id: 2, move: "left", attack: true },
    });
    clock.advance(120_000);
    await vi.waitFor(() =>
      expect(out.some((m) => m.type === "ended")).toBe(true),
    );
    const ended = out.find((m) => m.type === "ended")!;
    lab.handle({ type: "export" });
    await vi.waitFor(() =>
      expect(out.some((m) => m.type === "log")).toBe(true),
    );
    const { log } = out.find((m) => m.type === "log") as {
      log: BattleLog;
    };
    expect(log.finalHash).toBe(ended.hash);
    expect(log.ticks).toBe(ended.ticks);
    expect(log.commands.map((c) => c.commands.length)).toEqual([1, 1]);
    // The log crosses JSON (the file the page saves) and replays to the hash.
    const replayed = replayLog(JSON.parse(JSON.stringify(log)));
    expect(await sha256(serializeBattle(replayed))).toBe(ended.hash);
  });

  test("exports a battle still running, with the hash of the state now", async () => {
    const { clock, out, lab } = host();
    clock.advance(2000);
    lab.handle({ type: "export" });
    clock.advance(1000); // the battle goes on while the hash is computed
    await vi.waitFor(() =>
      expect(out.some((m) => m.type === "log")).toBe(true),
    );
    const { log } = out.find((m) => m.type === "log") as { log: BattleLog };
    expect(log.ticks).toBe(40);
    expect(await sha256(serializeBattle(replayLog(log)))).toBe(log.finalHash);
  });

  test("instant runs every tick at once, in one frame with all the events", async () => {
    const { out, frames } = host("instant");
    expect(frames()).toHaveLength(2);
    const last = frames()[1]!;
    expect(last.view.ended).not.toBeNull();
    expect(last.events.at(-1)!.type).toBe("ended");
    await vi.waitFor(() =>
      expect(out.some((m) => m.type === "ended")).toBe(true),
    );
  });

  test("an ended battle takes no input and sends no more frames", async () => {
    const { clock, frames, lab, out } = host("instant");
    await vi.waitFor(() =>
      expect(out.some((m) => m.type === "ended")).toBe(true),
    );
    lab.handle({
      type: "input",
      battle: 1,
      seq: 1,
      command: { type: "drop", id: 1 },
    });
    lab.handle({ type: "speed", speed: 1 });
    clock.advance(1000);
    expect(frames()).toHaveLength(2);
  });

  test("an invalid setup is refused with the reason", () => {
    const clock = new FakeClock();
    const out: FromWorker[] = [];
    const lab = new LabHost((m) => out.push(m), clock);
    lab.handle({
      type: "start",
      battle: 1,
      setup: { ...setup, sides: [[fighter("square")]] },
      params,
      speed: 1,
    });
    expect(out).toEqual([
      { type: "error", message: "needs at least two sides" },
    ]);
    expect(clock.pending).toBe(0);
  });

  test("answers the gambits of a participant, or null if it left", () => {
    const { lab, out } = host();
    lab.handle({ type: "gambits", id: 2 });
    lab.handle({ type: "gambits", id: 99 });
    expect(out.slice(-2)).toEqual([
      { type: "gambits", id: 2, gambits: defaultGambits("circle") },
      { type: "gambits", id: 99, gambits: null },
    ]);
  });
});
