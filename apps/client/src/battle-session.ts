// The world client's battle screen as data (junction spec D11, N-1, N-2; plan
// section 8): what a battleOpen and the battleFrames after it build (the
// view, the one before it for the glide, the events, the signals of the
// attack and the end), who is who in it (the roster: a world creep per
// participant, a team or the wanderers per side), and when the screen opens
// by itself: when the creep this player dominates enters a battle, or when it
// dominates a creep already in one.

import type {
  Arena,
  BattleEvent,
  BattleParams,
  BattleView,
} from "@geometrix/battle";
import type {
  BattleFrameMessage,
  BattleOpenMessage,
  BattleRoster,
} from "@geometrix/protocol";
import { applyBattleDelta } from "@geometrix/protocol/stream";
import { isOwnCreep, sideTeam, type TeamView } from "@geometrix/sim";
import type { SideStyle } from "./battle/arena-view.tsx";
import { effectsOf, liveEffects, type Effect } from "./battle/effects.ts";
import { teamName } from "./format.ts";
import { teamColor } from "./map/colors.ts";
import type { Hold } from "./store.ts";

export type EndedEvent = Extract<BattleEvent, { type: "ended" }>;

/** The screen keeps the last events of a battle. */
export const MAX_BATTLE_EVENTS = 400;

export type BattleScreen = {
  battleId: number;
  arena: Arena;
  params: BattleParams;
  roster: BattleRoster;
  /** The view before `current`, or null right after the opening. */
  previous: BattleView | null;
  current: BattleView;
  /** When `current` arrived (performance.now(), ms). */
  at: number;
  /** The battle's events since the screen opened, oldest first. */
  events: BattleEvent[];
  /** The signals of the attack still on the screen. */
  effects: Effect[];
  /** The battle's end, once its last frame came. */
  ended: EndedEvent | null;
};

/** The screen a battleOpen starts. */
export function openedScreen(
  message: BattleOpenMessage,
  now: number,
): BattleScreen {
  return {
    battleId: message.battleId,
    arena: message.arena,
    params: message.params,
    roster: message.roster,
    previous: null,
    current: message.view,
    at: now,
    events: [],
    effects: [],
    ended: null,
  };
}

/** The screen after one of its battle's frames. */
export function framedScreen(
  screen: BattleScreen,
  message: BattleFrameMessage,
  now: number,
): BattleScreen {
  const current = applyBattleDelta(screen.current, message.delta);
  const cells = new Map(screen.current.participants.map((p) => [p.id, p.cell]));
  const signals = effectsOf(message.events, now, screen.params, cells);
  const ended =
    message.events.find((e): e is EndedEvent => e.type === "ended") ??
    screen.ended;
  return {
    ...screen,
    roster: message.roster ?? screen.roster,
    previous: screen.current,
    current,
    at: now,
    events:
      message.events.length === 0
        ? screen.events
        : [...screen.events, ...message.events].slice(-MAX_BATTLE_EVENTS),
    effects:
      signals.length === 0
        ? screen.effects
        : [...liveEffects(screen.effects, now), ...signals],
    ended,
  };
}

/**
 * The sides of a world battle as the screen colors and names them: by the
 * team on each side (the wanderers in their sand).
 */
export function worldSides(roster: BattleRoster): SideStyle {
  const team = (side: number) => {
    const who = roster.sides[side];
    return who === undefined ? -1 : sideTeam(who);
  };
  return {
    color: (side) => teamColor(team(side)),
    wins: (side) => {
      const t = team(side);
      return t === null ? "os andarilhos vencem" : `${teamName(t)} vence`;
    },
    tag: (side) => teamName(team(side)),
  };
}

/** The battle participant of a world creep, or null. */
export function participantOfCreep(
  roster: BattleRoster,
  creepId: number,
): number | null {
  return roster.members.find((m) => m.creep === creepId)?.participant ?? null;
}

/** The world creep of a battle participant, or null. */
export function creepOfParticipant(
  roster: BattleRoster,
  participant: number,
): number | null {
  return (
    roster.members.find((m) => m.participant === participant)?.creep ?? null
  );
}

/**
 * The participant this player plays on the screen: the one of the creep it
 * dominates, while it is still in the arena and the battle goes on.
 */
export function playedParticipant(
  screen: BattleScreen,
  dominatedCreep: number | null,
): number | null {
  if (dominatedCreep === null || screen.current.ended !== null) return null;
  const id = participantOfCreep(screen.roster, dominatedCreep);
  if (id === null) return null;
  return screen.current.participants.some((p) => p.id === id) ? id : null;
}

/** The dominated creep and its battle, as the auto-open remembers them. */
export type Lock = { creep: number; battle: number };

/**
 * N-1: the battle to open by itself, given what the last check saw. Each
 * (creep, battle) pair opens once: going back to the map does not bring the
 * screen back while that creep stays in that battle, but dominating it
 * again, or its next battle, does.
 */
export function autoOpen(
  last: Lock | null,
  mine: { id: number; battle: number | null } | null,
): { lock: Lock | null; open: number | null } {
  if (mine === null || mine.battle === null) return { lock: null, open: null };
  const lock = { creep: mine.id, battle: mine.battle };
  const same =
    last !== null && last.creep === lock.creep && last.battle === lock.battle;
  return { lock, open: same ? null : lock.battle };
}

/** Whether the battle runs in real time: someone plays it (D13). */
export function realTime(view: BattleView): boolean {
  return view.participants.some((p) => p.controller === "human");
}

/**
 * "Entrar" (R spec D7): which creep to dominate to get into the battle, or
 * null when the player already dominates one of its participants, or every
 * one of the team is dominated by others (then only watching). Undefined
 * while the view does not have the battle yet.
 */
export function entrarCreep(
  state: TeamView,
  playerId: number,
  team: number,
  battleId: number,
): number | null | undefined {
  const battle = state.battles.find((b) => b.id === battleId);
  if (battle === undefined) return undefined;
  const own = battle.participants.flatMap((p) => {
    const creep = state.creeps.find((c) => c.id === p.id);
    return creep !== undefined && isOwnCreep(creep) && creep.team === team
      ? [creep]
      : [];
  });
  if (own.some((c) => c.dominatedBy === playerId)) return null;
  const free = own.filter((c) => c.dominatedBy === null);
  return free.length === 0 ? null : Math.min(...free.map((c) => c.id));
}

/** A hold as its countdown reads (R spec D6, D28); `now` in the hold's ms. */
export function holdText(hold: Hold, now: number): string {
  const seconds =
    hold.endsAt === null
      ? 0
      : Math.max(1, Math.ceil((hold.endsAt - now) / 1000));
  switch (hold.state) {
    case "opening":
      return `A batalha começa em ${seconds} s`;
    case "pausing":
      return `Pausando em ${seconds} s`;
    case "paused":
      return "Pausada · P retoma";
    case "resuming":
      return `Retomando em ${seconds} s`;
  }
}
