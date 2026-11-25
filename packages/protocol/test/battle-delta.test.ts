import type { BattleView, ViewParticipant } from "@geometrix/battle";
import { describe, expect, test } from "vitest";
import {
  applyBattleDelta,
  diffBattleView,
  emptyBattleSent,
  sentBattleView,
} from "../src/battle-delta.ts";

const participant = (id: number, cell: number): ViewParticipant => ({
  id,
  side: id - 1,
  name: `p${id}`,
  dna: "circle",
  cell,
  facing: "up",
  hp: 60,
  maxHp: 60,
  carry: { materia: 0, cristal: 0 },
  capacity: 10,
  controller: "gambits",
  reaction: "normal",
  cooldownTicks: 0,
  exitTicks: 0,
});

const start: BattleView = {
  tick: 60,
  countdownTicks: 0,
  idleTicks: 0,
  participants: [participant(1, 100), participant(2, 140)],
  projectiles: [],
  piles: [],
  ended: null,
};

/** The delta through JSON, as on the network. */
const wire = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe("battle view deltas (junction F4)", () => {
  test("the first diff carries the whole view; an unchanged one only the tick", () => {
    const sent = emptyBattleSent();
    const first = diffBattleView(sent, start);
    expect(first.participants?.upsert).toEqual(start.participants);
    expect(sentBattleView(sent)).toEqual(start);
    expect(diffBattleView(sent, { ...start, tick: 61 })).toEqual({ tick: 61 });
  });

  test("changed fields, a new projectile, a death and the end rebuild the next view", () => {
    const sent = emptyBattleSent();
    diffBattleView(sent, start);
    const next: BattleView = {
      tick: 61,
      countdownTicks: 0,
      idleTicks: 0,
      participants: [
        { ...participant(1, 101), carry: { materia: 3, cristal: 0 } },
      ],
      projectiles: [
        { id: 5, owner: 1, side: 0, cell: 102, dir: "right", cellsLeft: 6 },
      ],
      piles: [{ id: 6, cell: 140, materia: 4, cristal: 1 }],
      ended: { tick: 61, winnerSide: 0 },
    };
    const delta = wire(diffBattleView(sent, next));
    expect(delta.participants).toEqual({
      upsert: [{ id: 1, cell: 101, carry: { materia: 3, cristal: 0 } }],
      remove: [2],
    });
    expect(delta.ended).toEqual({ tick: 61, winnerSide: 0 });
    expect(applyBattleDelta(start, delta)).toEqual(next);
    expect(sentBattleView(sent)).toEqual(next);
  });

  test("the previous view is left untouched", () => {
    const sent = emptyBattleSent();
    diffBattleView(sent, start);
    const before = wire(start);
    const delta = wire(
      diffBattleView(sent, {
        ...start,
        tick: 61,
        participants: [participant(1, 99), participant(2, 140)],
      }),
    );
    const after = applyBattleDelta(start, delta);
    expect(start).toEqual(before);
    expect(after.participants[1]).toBe(start.participants[1]);
  });
});
