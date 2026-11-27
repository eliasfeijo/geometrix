import {
  battleView,
  createBattle,
  parseBattleParams,
  stepBattle,
  type BattleState,
} from "@geometrix/battle";
import type {
  BattleFrameMessage,
  BattleInputCommand,
  BattleOpenMessage,
  BattleRoster,
} from "@geometrix/protocol";
import {
  diffBattleView,
  emptyBattleSent,
  type BattleSent,
} from "@geometrix/protocol/stream";
import { describe, expect, test } from "vitest";
import paramsJson from "../../../packages/battle/test/params.json?raw";
import { BattleControl, type BattleLink } from "../src/battle-control.ts";
import {
  autoOpen,
  creepOfParticipant,
  framedScreen,
  openedScreen,
  participantOfCreep,
  playedParticipant,
  realTime,
  worldSides,
  type Lock,
} from "../src/battle-session.ts";
import type { CommandResult } from "../src/connection.ts";
import { LAB_ARENAS, LAB_KITS } from "../src/lab/assets.ts";
import { defaultDraft, setupOf } from "../src/lab/draft.ts";
import { COLORS } from "../src/map/colors.ts";
import { GameStore } from "../src/store.ts";

const params = parseBattleParams(JSON.parse(paramsJson));

/** The default lab battle (a 1 × 1 on the rocks) as the server's host has it. */
function battle(): BattleState {
  return createBattle(
    setupOf(defaultDraft(), LAB_KITS, LAB_ARENAS.pedras),
    params,
  );
}

/** Participant 1 is world creep 11 (Orange), participant 2 is creep 12. */
const ROSTER: BattleRoster = {
  members: [
    { participant: 1, creep: 11 },
    { participant: 2, creep: 12 },
  ],
  sides: [
    { kind: "team", team: 1 },
    { kind: "team", team: 0 },
  ],
};

/** The server's side of a screen: the opening, then a frame per step. */
class FakeServer {
  readonly state = battle();
  private readonly sent: BattleSent = emptyBattleSent();

  readonly battleId: number;

  constructor(battleId = 7) {
    this.battleId = battleId;
  }

  open(): BattleOpenMessage {
    const view = battleView(this.state);
    diffBattleView(this.sent, view);
    return {
      type: "battleOpen",
      battleId: this.battleId,
      arena: this.state.arena,
      params,
      roster: ROSTER,
      view,
    };
  }

  frame(roster?: BattleRoster): BattleFrameMessage {
    const events = stepBattle(this.state, []);
    return {
      type: "battleFrame",
      battleId: this.battleId,
      delta: diffBattleView(this.sent, battleView(this.state)),
      events,
      ...(roster === undefined ? {} : { roster }),
    };
  }
}

describe("the battle screen's data (junction D11, N-2)", () => {
  test("the frames' deltas rebuild the server's view, tick by tick", () => {
    const server = new FakeServer();
    let screen = openedScreen(server.open(), 0);
    expect(screen.previous).toBeNull();
    let events = 0;
    for (let t = 1; server.state.ended === null; t++) {
      const before = screen.current;
      const frame = server.frame();
      events += frame.events.length;
      screen = framedScreen(screen, frame, t * 50);
      expect(screen.current).toEqual(battleView(server.state));
      expect(screen.previous).toBe(before);
      expect(screen.at).toBe(t * 50);
    }
    expect(screen.events).toHaveLength(Math.min(events, 400));
    expect(screen.ended).not.toBeNull();
    expect(screen.ended!.winnerSide).toBe(server.state.ended!.winnerSide);
    // Somebody struck somebody: the signals of the attack came with it.
    expect(screen.events.some((e) => e.type === "hit")).toBe(true);
  });

  test("a frame with a roster replaces it; one without keeps it", () => {
    const server = new FakeServer();
    let screen = openedScreen(server.open(), 0);
    screen = framedScreen(screen, server.frame(), 50);
    expect(screen.roster).toBe(ROSTER);
    const joined: BattleRoster = {
      ...ROSTER,
      members: [...ROSTER.members, { participant: 3, creep: 30 }],
    };
    screen = framedScreen(screen, server.frame(joined), 100);
    expect(screen.roster).toBe(joined);
    expect(creepOfParticipant(screen.roster, 3)).toBe(30);
    expect(participantOfCreep(screen.roster, 30)).toBe(3);
    expect(participantOfCreep(screen.roster, 99)).toBeNull();
  });

  test("the sides take their team's color and name; the wanderers theirs", () => {
    const sides = worldSides({
      members: [],
      sides: [{ kind: "team", team: 1 }, { kind: "wanderers" }],
    });
    expect(sides.color(0)).toBe(COLORS.teams[1]);
    expect(sides.color(1)).toBe(COLORS.wanderer);
    expect(sides.wins(0)).toBe("Laranja vence");
    expect(sides.wins(1)).toBe("os andarilhos vencem");
    expect(sides.tag(1)).toBe("Andarilhos");
  });

  test("the player plays its dominated creep's participant while it is in the arena", () => {
    const server = new FakeServer();
    const screen = openedScreen(server.open(), 0);
    expect(playedParticipant(screen, 12)).toBe(2);
    expect(playedParticipant(screen, 11)).toBe(1);
    expect(playedParticipant(screen, null)).toBeNull();
    expect(playedParticipant(screen, 99)).toBeNull();
    const gone = {
      ...screen,
      current: {
        ...screen.current,
        participants: screen.current.participants.filter((p) => p.id !== 2),
      },
    };
    expect(playedParticipant(gone, 12)).toBeNull();
    const over = {
      ...screen,
      current: { ...screen.current, ended: { tick: 9, winnerSide: 0 } },
    };
    expect(playedParticipant(over, 12)).toBeNull();
  });

  test("real time once somebody plays a participant (D13)", () => {
    const view = battleView(battle());
    expect(realTime(view)).toBe(false);
    const played = {
      ...view,
      participants: view.participants.map((p, i) =>
        i === 0 ? { ...p, controller: "human" as const } : p,
      ),
    };
    expect(realTime(played)).toBe(true);
  });
});

describe("the screen opens by itself (N-1)", () => {
  test("once per creep and battle; again for the next battle or a new domination", () => {
    let lock: Lock | null = null;
    const see = (mine: { id: number; battle: number | null } | null) => {
      const result = autoOpen(lock, mine);
      lock = result.lock;
      return result.open;
    };
    expect(see(null)).toBeNull();
    expect(see({ id: 5, battle: null })).toBeNull();
    expect(see({ id: 5, battle: 9 })).toBe(9);
    // The player went back to the map: the same battle does not reopen.
    expect(see({ id: 5, battle: 9 })).toBeNull();
    // Out of it, then into another one.
    expect(see({ id: 5, battle: null })).toBeNull();
    expect(see({ id: 5, battle: 10 })).toBe(10);
    // Dominating a creep already in a battle (D12).
    expect(see({ id: 6, battle: 10 })).toBe(10);
    // Released, then dominated again in the same battle.
    expect(see(null)).toBeNull();
    expect(see({ id: 6, battle: 10 })).toBe(10);
  });
});

type Call =
  | { kind: "screen"; battleId: number | null }
  | { kind: "input"; battleId: number; command: BattleInputCommand }
  | { kind: "pause"; battleId: number };

/** A link whose answers the test hands out. */
class FakeLink implements BattleLink {
  readonly calls: Call[] = [];
  private readonly answers: ((r: CommandResult) => void)[] = [];

  battleScreen(battleId: number | null): Promise<CommandResult> {
    this.calls.push({ kind: "screen", battleId });
    return new Promise((resolve) => this.answers.push(resolve));
  }

  battleInput(
    battleId: number,
    command: BattleInputCommand,
  ): Promise<CommandResult> {
    this.calls.push({ kind: "input", battleId, command });
    return new Promise((resolve) => this.answers.push(resolve));
  }

  battlePause(battleId: number): Promise<CommandResult> {
    this.calls.push({ kind: "pause", battleId });
    return new Promise((resolve) => this.answers.push(resolve));
  }

  /** Answers the oldest call still waiting. */
  async answer(result: CommandResult): Promise<void> {
    this.answers.shift()!(result);
    await Promise.resolve();
    await Promise.resolve();
  }
}

function setup() {
  const store = new GameStore();
  const link = new FakeLink();
  let now = 0;
  const control = new BattleControl(store, link, () => now);
  return { store, link, control, tick: (ms: number) => (now += ms) };
}

describe("the battle screen's control (D11, N-1, N-2)", () => {
  test("opening asks the server and shows what it sends for that battle", async () => {
    const { store, link, control } = setup();
    control.open(7);
    expect(store.shownBattle.value).toBe(7);
    expect(link.calls).toEqual([{ kind: "screen", battleId: 7 }]);
    await link.answer({ ok: true, tick: 3 });
    const server = new FakeServer(7);
    // Another battle's messages are not this screen's.
    control.receive({ ...new FakeServer(8).open() }, 0);
    expect(store.battleScreen.value).toBeNull();
    control.receive(server.open(), 10);
    expect(store.battleScreen.value?.battleId).toBe(7);
    control.receive(server.frame(), 60);
    expect(store.battleScreen.value?.current).toEqual(battleView(server.state));
    // Opening it again changes nothing.
    control.open(7);
    expect(link.calls).toHaveLength(1);
  });

  test("a refusal goes back to the map with why", async () => {
    const { store, link, control } = setup();
    control.open(7);
    await link.answer({ ok: false, reason: "notYourBattle" });
    expect(store.shownBattle.value).toBeNull();
    expect(store.notices.value.map((n) => n.text)).toEqual([
      "Seu time não está nessa batalha.",
    ]);
  });

  test("back to the map tells the server and drops the screen", () => {
    const { store, link, control } = setup();
    control.open(7);
    control.receive(new FakeServer(7).open(), 0);
    control.close();
    expect(store.shownBattle.value).toBeNull();
    expect(store.battleScreen.value).toBeNull();
    expect(link.calls.at(-1)).toEqual({ kind: "screen", battleId: null });
    // A late frame of it is not shown.
    control.receive(new FakeServer(7).open(), 0);
    expect(store.battleScreen.value).toBeNull();
  });

  test("the dominated creep's battle opens by itself, once", () => {
    const { store, control } = setup();
    control.follow({ id: 5, battle: 9 });
    expect(store.shownBattle.value).toBe(9);
    control.close();
    control.follow({ id: 5, battle: 9 });
    expect(store.shownBattle.value).toBeNull();
    // Watching another battle when the creep enters a new one: it wins.
    control.open(3);
    control.follow({ id: 5, battle: 12 });
    expect(store.shownBattle.value).toBe(12);
  });

  test("a reconnect asks for the screen again, unless its battle ended", async () => {
    const { link, control } = setup();
    control.open(7);
    await link.answer({ ok: true, tick: 1 });
    const server = new FakeServer(7);
    control.receive(server.open(), 0);
    control.reconnected();
    expect(link.calls.at(-1)).toEqual({ kind: "screen", battleId: 7 });
    await link.answer({ ok: true, tick: 2 });
    while (server.state.ended === null) control.receive(server.frame(), 0);
    const calls = link.calls.length;
    control.reconnected();
    expect(link.calls).toHaveLength(calls);
  });

  test("an ended battle's screen stays when the server no longer knows it", async () => {
    const { store, link, control } = setup();
    control.open(7);
    await link.answer({ ok: true, tick: 1 });
    const server = new FakeServer(7);
    control.receive(server.open(), 0);
    while (server.state.ended === null) control.receive(server.frame(), 0);
    expect(store.battleScreen.value?.ended).not.toBeNull();
    // Say the socket came back before the last frame was applied.
    (control as unknown as { ask(id: number): void }).ask(7);
    await link.answer({ ok: false, reason: "unknownBattle" });
    expect(store.shownBattle.value).toBe(7);
    expect(store.notices.value).toEqual([]);
  });

  test("the keyboard's commands go to the shown battle, and their round trip is kept", async () => {
    const { link, control, tick } = setup();
    control.input({ type: "attackOnce", id: 2 });
    expect(link.calls).toEqual([]);
    control.open(7);
    await link.answer({ ok: true, tick: 1 });
    control.input({ type: "attackOnce", id: 2 });
    expect(link.calls.at(-1)).toEqual({
      kind: "input",
      battleId: 7,
      command: { type: "attackOnce", id: 2 },
    });
    tick(80);
    await link.answer({ ok: true, tick: 1 });
    expect(control.rttMs).toBe(80);
    control.input({ type: "attackOnce", id: 2 });
    tick(180);
    await link.answer({ ok: true, tick: 1 });
    expect(control.rttMs).toBe(100);
  });
});
