// The world client's battle screen (junction spec D11, D12, N-1, N-2; plan
// section 8): in place of the map while a battle is shown, the lab's arena,
// signs and keyboard on the frames the server sends, with the 3 s countdown,
// the idle clock and the end table. Who plays a participant (the creep this
// player dominates) moves it from the keyboard; anyone else watches. Back to
// the map (the button or Esc) stops the frames; the dominated creep then plays
// by its gambits, and the map's battle sign brings the screen back.

import type { ViewParticipant } from "@geometrix/battle";
import { isOwnCreep, type CreepView, type TeamView } from "@geometrix/sim";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  creepOfParticipant,
  holdText,
  playedParticipant,
  realTime,
  worldSides,
  type BattleScreen as Screen,
} from "./battle-session.ts";
import {
  ArenaView,
  idleSecondsLeft,
  idleWarning,
} from "./battle/arena-view.tsx";
import { eventLines, EventsList } from "./battle/events-list.tsx";
import { KeyboardInput, type KeyLike } from "./battle/input.ts";
import { DNA_GLYPHS } from "./battle/labels.ts";
import { Predictor, StepGlides, stepTicks } from "./battle/motion.ts";
import { ResultTable } from "./battle/result-table.tsx";
import { ChroniclePanel } from "./chronicle/chronicle-panel.tsx";
import { useGame } from "./context.ts";
import { teamName } from "./format.ts";
import { teamColor } from "./map/colors.ts";
import type { Hold } from "./store.ts";

/**
 * Where the keys stay with the page's own controls: a text or number field,
 * a select, a text area. Anywhere else the battle has the keyboard.
 */
function isFormField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.closest("input, select, textarea") !== null;
}

export function BattleScreen() {
  const { store, viewer, send, battles } = useGame();
  const screen = store.battleScreen.value;
  const shown = store.shownBattle.value;
  const mine = store.myCreep.value;
  const played =
    screen === null ? null : playedParticipant(screen, mine?.id ?? null);

  const input = useRef(new KeyboardInput());
  const stepGlides = useRef(new StepGlides());
  const predictor = useRef(new Predictor());
  const live = useRef({ played, screen });
  live.current = { played, screen };

  // Another movement drawing starts its own glides (D19).
  const motion = store.motion.value;
  useEffect(() => {
    stepGlides.current.reset();
    predictor.current.reset();
  }, [motion]);

  // A new battle on the screen starts from nothing held.
  useEffect(() => {
    input.current = new KeyboardInput();
    stepGlides.current.reset();
    predictor.current.reset();
  }, [shown]);

  const tickMs =
    screen === null ? 50 : 1000 / screen.params.tick.ticksPerSecond;
  const stepMsOf = (p: ViewParticipant) =>
    screen === null ? tickMs : stepTicks(screen.params, p) * tickMs;

  // Each frame feeds the motion options (the lab does the same).
  useEffect(() => {
    if (screen === null) return;
    const { current, at, arena } = screen;
    stepGlides.current.frame(arena.width, current, at, stepMsOf);
    const you = current.participants.find((p) => p.id === played);
    if (store.motion.value === "predict" && you !== undefined) {
      const lead = Math.ceil(
        ((battles?.rttMs ?? 0) + 2 * tickMs) / stepMsOf(you),
      );
      predictor.current.frame(
        arena.width,
        current,
        you.id,
        at,
        stepMsOf(you),
        lead,
      );
    }
  }, [screen?.at]);

  // Whoever plays starts still (D12): what is held goes again when the
  // participant comes to this player, and again once it is under human
  // control, since inputs on the world clock are dropped (F4).
  const controller =
    screen?.current.participants.find((p) => p.id === played)?.controller ??
    null;
  useEffect(() => {
    if (played === null) {
      predictor.current.reset();
      return;
    }
    for (const command of input.current.retarget(played)) {
      battles?.input(command);
    }
  }, [played, controller]);

  const onKey = (event: KeyboardEvent, down: boolean) => {
    if (isFormField(event.target)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (down && event.code === "Escape") {
      event.preventDefault();
      if (!event.repeat) battles?.close();
      return;
    }
    const { played: id } = live.current;
    const key: KeyLike = event;
    // P pauses and resumes, for who plays a participant (R spec D28, BP-3).
    if (down && event.code === "KeyP") {
      event.preventDefault();
      if (!event.repeat && live.current.played !== null) battles?.pause();
      return;
    }
    const result = down
      ? input.current.down(key, id)
      : input.current.up(key, id);
    // Tab, 0 and R are the lab's: nothing to do in the world.
    if (result.handled) event.preventDefault();
    for (const command of result.commands) battles?.input(command);
    holdPrediction();
  };

  /** The predict option follows the direction held (D19). */
  const holdPrediction = () => {
    const { played: id, screen: s } = live.current;
    const you = s?.current.participants.find((p) => p.id === id);
    // A held battle stands still: nothing to predict.
    const held = shown === null ? undefined : store.holds.value.get(shown);
    if (
      store.motion.value !== "predict" ||
      you === undefined ||
      s === null ||
      (held !== undefined && held.state !== "pausing")
    ) {
      predictor.current.reset();
      return;
    }
    predictor.current.hold(
      input.current.moving,
      performance.now(),
      s.arena.width,
      you.cell,
      (battles?.rttMs ?? 0) + 2 * tickMs,
    );
  };

  const keyHandler = useRef(onKey);
  keyHandler.current = onKey;
  useEffect(() => {
    const down = (e: KeyboardEvent) => keyHandler.current(e, true);
    const up = (e: KeyboardEvent) => keyHandler.current(e, false);
    const blur = () => {
      for (const c of input.current.releaseAll(live.current.played)) {
        battles?.input(c);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      blur();
    };
  }, []);

  const sides = useMemo(
    () => (screen === null ? null : worldSides(screen.roster)),
    [screen?.roster],
  );
  const lines = useMemo(
    () =>
      screen === null || sides === null
        ? []
        : eventLines(
            screen.events,
            screen.params.tick.ticksPerSecond,
            sides,
            played,
          ),
    [screen?.events, sides, played],
  );

  const back = (
    <button type="button" onClick={() => battles?.close()} title="Esc">
      Voltar ao mapa
    </button>
  );

  if (screen === null || sides === null) {
    return (
      <div class="battle-screen" role="region" aria-label="Batalha">
        <div class="battle-main">
          <div class="battle-bar">
            <strong class="battle-title">Batalha</strong>
            <span class="muted">abrindo…</span>
            <span class="battle-bar-end">{back}</span>
          </div>
        </div>
      </div>
    );
  }

  const { current, params, arena, roster } = screen;
  const tps = params.tick.ticksPerSecond;
  const state = store.current.value?.state;
  const running = current.ended === null;
  const you = current.participants.find((p) => p.id === played);
  const hold = running ? store.holds.value.get(screen.battleId) : undefined;

  return (
    <div
      class={running ? "battle-screen" : "battle-screen is-ended"}
      role="region"
      aria-label="Batalha"
    >
      <div class="battle-main">
        <div class="battle-bar">
          <strong class="battle-title">Batalha</strong>
          <span class="battle-sides">
            {roster.sides.map((side, i) => {
              const team = side.kind === "team" ? side.team : null;
              return (
                <span key={i} style={{ color: teamColor(team) }}>
                  {i > 0 && <span class="muted"> × </span>}
                  {teamName(team)}
                </span>
              );
            })}
          </span>
          <span class="battle-clock">{(current.tick / tps).toFixed(1)} s</span>
          <span
            class="muted"
            title="Em tempo real enquanto alguém joga um participante com a tela aberta; senão, no relógio do mundo (D13)"
          >
            {hold?.state === "paused" || hold?.state === "resuming"
              ? "pausada"
              : realTime(current)
                ? "tempo real"
                : "relógio do mundo"}
          </span>
          <span class="battle-bar-end">{back}</span>
        </div>
        <p class="battle-hint battle-who">
          {you !== undefined
            ? `Você joga com ${you.name}. Setas ou WASD andam · Shift + seta vira · espaço ataca · Q larga a bolsa · E cata · P pausa para todos · Esc volta ao mapa.`
            : running
              ? "Assistindo. Esc volta ao mapa."
              : "A batalha acabou. Esc volta ao mapa."}
        </p>
        <p class="battle-hint battle-idle-meter">
          {running &&
            current.countdownTicks === 0 &&
            !idleWarning(current, params) &&
            `sem dano há ${(current.idleTicks / tps).toFixed(0)} s · todos fogem em ${idleSecondsLeft(current, params)} s`}
        </p>
        {hold !== undefined && <HoldBanner hold={hold} />}
        <div class="battle-stage">
          <ArenaView
            arena={arena}
            params={params}
            previous={screen.previous}
            current={current}
            arrivedAt={screen.at}
            glideMs={tickMs}
            motion={store.motion.value}
            stepGlides={stepGlides.current}
            predictor={predictor.current}
            effects={screen.effects}
            dominated={played}
            selected={null}
            onSelect={() => {}}
            sides={sides}
          />
        </div>
        {screen.ended !== null && (
          <ResultTable
            ended={screen.ended}
            seconds={(screen.ended.tick + 1) / tps}
            hash={null}
            sides={sides}
          />
        )}
      </div>
      <aside class="battle-side">
        <section class="battle-panel">
          <h2>Na arena</h2>
          {current.participants.length === 0 ? (
            <p class="battle-hint">Ninguém.</p>
          ) : (
            <ul class="battle-roster">
              {current.participants.map((p) => (
                <RosterRow
                  key={p.id}
                  p={p}
                  screen={screen}
                  state={state}
                  played={played}
                  team={viewer.team}
                  canAct={store.canAct.value && running}
                  color={sides.color(p.side)}
                  tag={sides.tag(p.side)}
                  onDominate={(creepId) =>
                    void send({ type: "dominate", creepId })
                  }
                  onRelease={() => void send({ type: "release" })}
                />
              ))}
            </ul>
          )}
        </section>
        <EventsList lines={lines} />
        <ChroniclePanel />
      </aside>
    </div>
  );
}

/** The countdown of a hold, ticking while it has one. */
function HoldBanner({ hold }: { hold: Hold }) {
  const now = useNow(hold.endsAt !== null);
  return (
    <p class="battle-hold" role="status">
      {holdText(hold, now)}
    </p>
  );
}

/** performance.now(), again every 200 ms while `ticking`. */
export function useNow(ticking: boolean): number {
  const [, setCount] = useState(0);
  useEffect(() => {
    if (!ticking) return;
    const timer = window.setInterval(() => setCount((n) => n + 1), 200);
    return () => window.clearInterval(timer);
  }, [ticking]);
  return performance.now();
}

/**
 * A participant in the roster: its HP, who plays it, and for the team's own
 * creeps, dominating it (D12) or letting it go.
 */
function RosterRow(props: {
  p: ViewParticipant;
  screen: Screen;
  state: TeamView | undefined;
  played: number | null;
  team: number;
  canAct: boolean;
  color: string;
  tag: string;
  onDominate(creepId: number): void;
  onRelease(): void;
}) {
  const { p, screen, state, played } = props;
  const creepId = creepOfParticipant(screen.roster, p.id);
  const creep = state?.creeps.find((c) => c.id === creepId);
  const own: CreepView | null =
    creep !== undefined && isOwnCreep(creep) && creep.team === props.team
      ? creep
      : null;
  const who =
    p.id === played ? "você" : p.controller === "human" ? "jogador" : "IA";
  return (
    <li class={p.id === played ? "battle-played" : undefined}>
      <span class="battle-who-cell">
        <span style={{ color: props.color }}>
          {DNA_GLYPHS[p.dna]} {p.name} ({props.tag})
        </span>
        <span class="battle-hint">{who}</span>
      </span>
      <span class="battle-num">
        {p.hp}/{p.maxHp}
      </span>
      {own !== null &&
        (p.id === played ? (
          <button type="button" onClick={props.onRelease}>
            soltar
          </button>
        ) : (
          <button
            type="button"
            disabled={!props.canAct || own.dominatedBy !== null}
            title="Dominar este creep na batalha (D12)"
            onClick={() => props.onDominate(own.id)}
          >
            dominar
          </button>
        ))}
    </li>
  );
}

/**
 * On the map, while the dominated creep is in a battle whose screen is
 * closed (D11): the creep plays by its gambits, and this brings it back.
 */
export function BattleReturn() {
  const { store, battles } = useGame();
  const mine = store.myCreep.value;
  if (battles === undefined || mine === null || mine.battle === null) {
    return null;
  }
  if (store.shownBattle.value !== null) return null;
  const battle = mine.battle;
  return (
    <div class="battle-return" role="status">
      <span>{mine.name} está numa batalha, jogando pelos gambits.</span>
      <button class="primary" onClick={() => battles.open(battle)}>
        Voltar à batalha
      </button>
    </div>
  );
}
