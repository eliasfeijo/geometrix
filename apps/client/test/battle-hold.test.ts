import type { BattleStubView, CreepView } from "@geometrix/sim";
import { describe, expect, it } from "vitest";
import { BattleControl, type BattleLink } from "../src/battle-control.ts";
import { entrarCreep, holdText } from "../src/battle-session.ts";
import type { CommandResult } from "../src/connection.ts";
import { GameStore } from "../src/store.ts";
import { testWorld, viewOf } from "./helpers.ts";

const ok: CommandResult = { ok: true, tick: 1 };

function setup() {
  const store = new GameStore();
  const paused: number[] = [];
  const link: BattleLink = {
    battleScreen: () => Promise.resolve(ok),
    battleInput: () => Promise.resolve(ok),
    battlePause: (id) => {
      paused.push(id);
      return Promise.resolve({ ok: false, reason: "countingDown" });
    },
  };
  return { store, paused, control: new BattleControl(store, link, () => 0) };
}

describe("the holds (R spec D6, D28)", () => {
  it("keeps each battle's hold until it ends or the socket drops", () => {
    const { store, control } = setup();
    const hold = (state: "opening" | "paused" | null, ms: number | null) =>
      control.receive(
        { type: "battleHold", battleId: 7, state, remainingMs: ms },
        1000,
      );
    hold("opening", 5000);
    expect(store.holds.value.get(7)).toEqual({
      state: "opening",
      endsAt: 6000,
    });
    hold("paused", null);
    expect(store.holds.value.get(7)).toEqual({
      state: "paused",
      endsAt: null,
    });
    hold(null, null);
    expect(store.holds.value.size).toBe(0);
    hold("opening", 5000);
    control.dropped();
    expect(store.holds.value.size).toBe(0);
  });

  it("reads each countdown", () => {
    expect(holdText({ state: "opening", endsAt: 5000 }, 900)).toBe(
      "A batalha começa em 5 s",
    );
    expect(holdText({ state: "pausing", endsAt: 3000 }, 2500)).toBe(
      "Pausando em 1 s",
    );
    expect(holdText({ state: "paused", endsAt: null }, 0)).toBe(
      "Pausada · P retoma",
    );
    expect(holdText({ state: "resuming", endsAt: 3000 }, 0)).toBe(
      "Retomando em 3 s",
    );
  });

  it("asks to pause the battle shown, saying why when refused", async () => {
    const { store, paused, control } = setup();
    control.pause();
    expect(paused).toEqual([]);
    control.open(4);
    control.pause();
    expect(paused).toEqual([4]);
    await Promise.resolve();
    await Promise.resolve();
    expect(store.notices.value.map((n) => n.text)).toEqual([
      "Aguarde a contagem terminar.",
    ]);
  });
});

describe('"Entrar" (R spec D7)', () => {
  function state() {
    const view = viewOf(testWorld());
    const own = view.creeps.filter((c) => c.team === 0) as CreepView[];
    const battle: BattleStubView = {
      id: 9,
      x: 1,
      y: 1,
      window: { x: 0, y: 0, width: 9, height: 5 },
      sides: [{ kind: "team", team: 0 }, { kind: "wanderers" }],
      participants: [
        { id: own[1]!.id, side: 0 },
        { id: own[0]!.id, side: 0 },
      ],
      openedTick: 0,
    };
    view.battles = [battle];
    return { view, own };
  }

  it("takes the lowest participant no one dominates", () => {
    const { view, own } = state();
    expect(entrarCreep(view, 5, 0, 9)).toBe(own[0]!.id);
    own[0]!.dominatedBy = 6;
    expect(entrarCreep(view, 5, 0, 9)).toBe(own[1]!.id);
  });

  it("keeps the participant the player dominates, else watches", () => {
    const { view, own } = state();
    own[1]!.dominatedBy = 5;
    expect(entrarCreep(view, 5, 0, 9)).toBeNull();
    own[0]!.dominatedBy = 6;
    own[1]!.dominatedBy = 7;
    expect(entrarCreep(view, 5, 0, 9)).toBeNull();
    expect(entrarCreep(view, 5, 0, 8)).toBeUndefined();
  });
});
