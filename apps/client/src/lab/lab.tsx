// The battle lab (M2 laboratório, spec D2, section 4; plan section 13): a
// local page with no world and no game server. It builds a battle, runs it in
// a worker behind a simulated network, lets the owner dominate one
// participant at a time from the keyboard or just watch, and measures the
// delay. Everything the page draws came back over the network (spec L-3),
// except, with the "prever o meu creep" option (C11, a lab experiment), the
// dominated creep drawn ahead of the frames (motion.ts).

import {
  parseArena,
  type Arena,
  type BattleCommand,
  type BattleEvent,
  type BattleLog,
  type BattleSetup,
  type BattleView,
  type Carry,
  type Dna,
  type Gambit,
} from "@geometrix/battle";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  ArenaView,
  idleSecondsLeft,
  idleWarning,
  sideColor,
} from "./arena-view.tsx";
import { LAB_ARENAS, LAB_PARAMS } from "./assets.ts";
import { LabConnection, type WorkerLike } from "./connection.ts";
import { isSwitch, keepsDomination } from "./domination.ts";
import { effectsOf, liveEffects, type Effect } from "./effects.ts";
import {
  defaultDraft,
  idOfPlace,
  member,
  namesUsed,
  participantOf,
  setupOf,
  youOf,
  type MemberDraft,
} from "./draft.ts";
import { eventLines, EventsList } from "./events-list.tsx";
import { GambitsEditor } from "./gambits-editor.tsx";
import { KeyboardInput } from "./input.ts";
import { DNA_GLYPHS, REACTION_LABELS, sideLetter } from "./labels.ts";
import { LatencyPanel } from "./latency-panel.tsx";
import { Predictor, StepGlides, stepTicks, type MotionMode } from "./motion.ts";
import type { Ended, Speed } from "./protocol.ts";
import { ResultTable } from "./result-table.tsx";
import { RTT_CHOICES } from "./channel.ts";
import { GradePanel } from "./grade-panel.tsx";
import { SessionPanel } from "./session-panel.tsx";
import {
  BLIND_PER_RTT,
  loadLabSession,
  matchupOf,
  pageStorage,
  saveLabSession,
  sessionExport,
  shuffledBag,
  type BattleRecord,
  type Grade,
  type LabSession,
} from "./session.ts";
import { ReinforceForm, SetupForm } from "./setup-form.tsx";

const params = LAB_PARAMS;
const TPS = params.tick.ticksPerSecond;
/** The list keeps the last events of a battle. */
const MAX_EVENTS = 400;

type Frames = { previous: BattleView | null; current: BattleView; at: number };
type EndedEvent = Extract<BattleEvent, { type: "ended" }>;

const speedFactor = (speed: Speed) => (speed === "instant" ? 0 : speed);
const tickMsAt = (speed: Speed) =>
  speed === "instant" ? 0 : 1000 / (TPS * speed);

/**
 * Where the keys stay with the page's own controls: a text or number field,
 * a select, a text area. Anywhere else the battle has the keyboard (F5).
 */
function isFormField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) {
    return !["checkbox", "radio", "button", "submit", "range"].includes(
      target.type,
    );
  }
  return false;
}

function downloadJson(data: unknown, name: string): void {
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function download(log: BattleLog): void {
  downloadJson(log, `batalha-seed${log.setup.seed}-t${log.ticks}.json`);
}

/** What the record of a battle needs from its start (plan P14). */
type BattleInfo = {
  setup: BattleSetup;
  arena: string;
  you: number | null;
  rttMs: number;
  blind: boolean;
  /** The owner took or let go of a participant during the battle. */
  switched: boolean;
  motion: MotionMode;
};

const storage = pageStorage();

export function Lab() {
  const [draft, setDraft] = useState(defaultDraft);
  const [arena, setArena] = useState<Arena | null>(null);
  const [frames, setFrames] = useState<Frames | null>(null);
  const [events, setEvents] = useState<BattleEvent[]>([]);
  const [effects, setEffects] = useState<Effect[]>([]);
  const [endedEvent, setEndedEvent] = useState<EndedEvent | null>(null);
  const [ended, setEnded] = useState<Ended | null>(null);
  const [speed, setSpeed] = useState<Speed>(1);
  const [paused, setPaused] = useState(false);
  const [rtt, setRtt] = useState(0);
  const [motion, setMotion] = useState<MotionMode>("tick");
  const [selected, setSelected] = useState<number | null>(null);
  const [gambitsDraft, setGambitsDraft] = useState<Gambit[] | null>(null);
  const [gambitsRunning, setGambitsRunning] = useState<Gambit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reinforcement, setReinforcement] = useState<MemberDraft>(() =>
    member("triangle"),
  );
  const [reinforceSide, setReinforceSide] = useState(0);
  const [dominated, setDominated] = useState<number | null>(null);
  const [, setMeasured] = useState(0);
  const [session, setSession] = useState<LabSession>(() =>
    loadLabSession(storage),
  );
  /** The blind mode's RTT of the battle on screen, or null outside it. */
  const [blindRtt, setBlindRtt] = useState<number | null>(null);
  /** A blind battle that ended: its record, waiting for the grade. */
  const [blindEnd, setBlindEnd] = useState<{
    record: BattleRecord;
    grade: Grade | null;
  } | null>(null);

  const conn = useRef<LabConnection | null>(null);
  const input = useRef(new KeyboardInput());
  const lastSetup = useRef<BattleSetup | null>(null);
  /** Whom the last start dominated (its place in the setup), for a restart. */
  const lastYou = useRef<number | null>(null);
  const lastArena = useRef("");
  const info = useRef<BattleInfo | null>(null);
  const lastEnded = useRef<EndedEvent | null>(null);
  const names = useRef(0);
  const sides = useRef(0);
  // The callbacks read these, not the state of the render that made them.
  const live = useRef({ motion, speed, selected, dominated, rtt, blindRtt });
  live.current = { motion, speed, selected, dominated, rtt, blindRtt };
  const arenaRef = useRef<Arena | null>(null);
  arenaRef.current = arena;
  const stepGlides = useRef(new StepGlides());
  const predictor = useRef(new Predictor());

  useEffect(() => {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    const connection = new LabConnection(
      worker as unknown as WorkerLike,
      { now: () => performance.now(), set: (fn, ms) => setTimeout(fn, ms) },
      {
        frame(frame, at) {
          setFrames((old) => ({
            previous: old?.current ?? null,
            current: frame.view,
            at,
          }));
          if (frame.events.length > 0) {
            setEvents((old) => [...old, ...frame.events].slice(-MAX_EVENTS));
            const signals = effectsOf(frame.events, at, params);
            if (signals.length > 0) {
              setEffects((old) => [...liveEffects(old, at), ...signals]);
            }
            for (const event of frame.events) {
              if (event.type === "ended") {
                setEndedEvent(event);
                lastEnded.current = event;
              }
              if (event.type === "joined") {
                sides.current = Math.max(
                  sides.current,
                  event.participant.side + 1,
                );
              }
            }
          }
          // The effect is on the screen now, or once the glide ends: one
          // tick, or the dominated creep's step with the step option (C11).
          const { motion: mode, speed: s, dominated: you } = live.current;
          const tickMs = tickMsAt(s);
          const width = arenaRef.current?.width ?? 0;
          const stepMs = (p: { dna: Dna; carry: Carry }) =>
            stepTicks(params, p) * tickMs;
          stepGlides.current.frame(width, frame.view, at, stepMs);
          const mine = frame.view.participants.find((p) => p.id === you);
          if (mode === "predict" && mine !== undefined) {
            const { rtt: r, blindRtt: b } = live.current;
            const lead = Math.ceil(((b ?? r) + 2 * tickMs) / stepMs(mine));
            predictor.current.frame(
              width,
              frame.view,
              mine.id,
              at,
              stepMs(mine),
              lead,
            );
          }
          const glide =
            mode === "instant"
              ? 0
              : mode === "step" && mine !== undefined
                ? stepMs(mine)
                : tickMs;
          connection.shown(frame.applied, at + glide);
          if (frame.applied.length > 0) setMeasured((n) => n + 1);
          // The domination ends when the creep leaves or the battle ends
          // (C7): instant is back, and "Na arena" offers no release.
          if (you !== null && !keepsDomination(frame.view, you)) {
            setDominated(null);
            predictor.current.reset();
          }
        },
        ended(message) {
          setEnded(message);
          endedHandler.current(message);
        },
        log: download,
        gambits(id, gambits) {
          if (id !== live.current.selected) return;
          setGambitsRunning(gambits);
          setGambitsDraft(gambits);
        },
        error: setError,
      },
    );
    conn.current = connection;
    return () => connection.close();
  }, []);

  const send = (command: BattleCommand) => conn.current?.send(command);

  function updateSession(change: (old: LabSession) => LabSession) {
    setSession((old) => {
      const next = change(old);
      saveLabSession(storage, next);
      return next;
    });
  }

  /** The record of the battle that just ended (spec L-5). */
  function recordOf(message: Ended): BattleRecord | null {
    const battle = info.current;
    const result = lastEnded.current;
    if (battle === null || result === null || conn.current === null) {
      return null;
    }
    let played: BattleRecord["played"] = null;
    if (battle.you !== null) {
      const id = idOfPlace(battle.you);
      const mine = result.results.find((r) => r.participant.id === id);
      if (mine !== undefined) {
        played = {
          name: mine.participant.name,
          side: mine.participant.side,
          outcome: mine.outcome,
        };
      }
    }
    return {
      at: new Date().toISOString(),
      blind: battle.blind,
      rttMs: battle.rttMs,
      arena: battle.arena,
      matchup: matchupOf(battle.setup, battle.arena, params),
      setup: battle.setup,
      played,
      switched: battle.switched,
      winnerSide: result.winnerSide,
      ticks: message.ticks,
      measured: conn.current.latency.summary(),
      motion: battle.motion,
      grade: null,
      hash: message.hash,
    };
  }

  function onEnded(message: Ended) {
    const record = recordOf(message);
    if (record === null) return;
    // A blind battle waits for its grade before it goes into the record.
    if (record.blind) {
      setBlindEnd({ record, grade: null });
      return;
    }
    updateSession((old) => ({ ...old, records: [...old.records, record] }));
  }

  /** The grade of the blind battle that ended: then the RTT shows (D17). */
  function grade(value: Grade) {
    if (blindEnd === null || blindEnd.grade !== null) return;
    const record = { ...blindEnd.record, grade: value };
    updateSession((old) => ({ ...old, records: [...old.records, record] }));
    setBlindEnd({ record, grade: value });
  }

  /** The blind mode's next battle: the same setup, the next RTT of the bag. */
  function nextBlind(blind = session.blind) {
    if (blind === null || blind.bag.length === 0) return;
    const [rttMs, ...rest] = blind.bag as [number, ...number[]];
    updateSession((old) => ({ ...old, blind: { ...blind, bag: rest } }));
    names.current = blind.setup.sides.flat().length;
    start(blind.setup, blind.you, blind.arena, rttMs);
  }

  /** One setup for the whole blind session (spec section 8): the form's. */
  function startBlind() {
    const you = youOf(draft);
    if (you === null || session.blind !== null) return;
    const setup = setupOf(draft, params, LAB_ARENAS[draft.arena]);
    const bag = shuffledBag(RTT_CHOICES, BLIND_PER_RTT, Math.random);
    const blind = {
      setup,
      arena: draft.arena,
      matchup: matchupOf(setup, draft.arena, params),
      you,
      bag,
      total: bag.length,
    };
    nextBlind(blind);
  }

  function endBlind() {
    updateSession((old) => ({ ...old, blind: null }));
    setBlindEnd(null);
    setBlindRtt(null);
    if (conn.current !== null) conn.current.rttMs = rtt;
  }
  const endedHandler = useRef(onEnded);
  endedHandler.current = onEnded;

  function exportSession() {
    const stamp = new Date().toISOString();
    downloadJson(
      sessionExport(session, RTT_CHOICES, stamp),
      `sessao-lab-${stamp.slice(0, 16).replace(/[:T]/g, "-")}.json`,
    );
  }

  function clearSession() {
    if (!window.confirm("Apagar o registro da sessão?")) return;
    updateSession(() => ({ records: [], blind: null }));
    setBlindEnd(null);
    setBlindRtt(null);
  }

  function start(
    setup: BattleSetup,
    you: number | null,
    arenaName: string,
    blindRttMs: number | null = null,
  ) {
    const connection = conn.current;
    if (connection === null) return;
    // The keys go to the battle, not to the button that started it.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setError(null);
    setFrames(null);
    setEvents([]);
    setEffects([]);
    setEndedEvent(null);
    setEnded(null);
    setPaused(false);
    setDominated(null);
    setSelected(null);
    setGambitsDraft(null);
    setGambitsRunning(null);
    input.current = new KeyboardInput();
    stepGlides.current.reset();
    predictor.current.reset();
    lastSetup.current = setup;
    lastYou.current = you;
    lastArena.current = arenaName;
    lastEnded.current = null;
    const rttMs = blindRttMs ?? rtt;
    info.current = {
      setup,
      arena: arenaName,
      you,
      rttMs,
      blind: blindRttMs !== null,
      switched: false,
      motion,
    };
    setBlindRtt(blindRttMs);
    setBlindEnd(null);
    sides.current = setup.sides.length;
    setArena(parseArena(setup.arena));
    connection.rttMs = rttMs;
    // Dominating someone plays in real time: instant goes back to ×1.
    const startSpeed = you !== null && speed === "instant" ? 1 : speed;
    if (startSpeed !== speed) setSpeed(startSpeed);
    connection.start(setup, params, startSpeed);
    // The owner takes the creep at once: the control crosses the network
    // during the start countdown (spec D21).
    if (you !== null) {
      const id = idOfPlace(you);
      send({ type: "control", id, controller: "human" });
      setDominated(id);
    }
  }

  function startDraft() {
    if (session.blind !== null) return;
    names.current = namesUsed(draft);
    start(
      setupOf(draft, params, LAB_ARENAS[draft.arena]),
      youOf(draft),
      draft.arena,
    );
  }

  function restart() {
    if (lastSetup.current === null) return;
    const battle = info.current;
    if (battle?.blind === true) {
      // A blind battle restarts on the same hidden RTT, but one that ended
      // waits for its grade and the next one.
      if (blindEnd !== null) return;
      start(
        lastSetup.current,
        lastYou.current,
        lastArena.current,
        battle.rttMs,
      );
      return;
    }
    start(lastSetup.current, lastYou.current, lastArena.current);
  }

  /** The owner took or let go of someone: the battle is neither's to count. */
  function switched() {
    if (info.current !== null) info.current.switched = true;
  }

  function togglePause() {
    if (frames === null || frames.current.ended !== null) return;
    if (paused) conn.current?.resume();
    else conn.current?.pause();
    setPaused(!paused);
  }

  function dominate(id: number) {
    // Taking the creep already taken changes nothing, not even the record.
    if (!isSwitch(dominated, id)) return;
    switched();
    send({ type: "control", id, controller: "human" });
    setDominated(id);
    predictor.current.reset();
    for (const command of input.current.retarget(id)) send(command);
    if (speed === "instant") {
      setSpeed(1);
      conn.current?.speed(1);
    }
  }

  function release() {
    if (dominated === null) return;
    switched();
    send({ type: "control", id: dominated, controller: "gambits" });
    setDominated(null);
  }

  function cycle() {
    const ids = frames?.current.participants.map((p) => p.id) ?? [];
    if (ids.length === 0) return;
    const next = ids.find((id) => id > (dominated ?? 0)) ?? ids[0]!;
    dominate(next);
  }

  function select(id: number) {
    setSelected(id);
    setGambitsDraft(null);
    setGambitsRunning(null);
    conn.current?.requestGambits(id);
  }

  function onKey(event: KeyboardEvent, down: boolean) {
    // The battle has the page's keyboard once there is one, except in a
    // field of the forms (F5: no click on the arena first).
    if (lastSetup.current === null || isFormField(event.target)) return;
    // The blind mode's grade (1 to 5), then the next battle (Enter or N).
    if (down && blindEnd !== null && !event.repeat) {
      const digit = /^(?:Digit|Numpad)([1-5])$/.exec(event.code);
      if (digit !== null && blindEnd.grade === null) {
        event.preventDefault();
        grade(Number(digit[1]) as Grade);
        return;
      }
      const next = ["Enter", "NumpadEnter", "KeyN"].includes(event.code);
      if (next && blindEnd.grade !== null) {
        event.preventDefault();
        nextBlind();
        return;
      }
    }
    const result = down
      ? input.current.down(event, dominated)
      : input.current.up(event, dominated);
    if (result.handled) event.preventDefault();
    for (const command of result.commands) send(command);
    holdPrediction();
    if (result.cycle) cycle();
    if (result.release) release();
    if (result.restart) restart();
    if (result.pause) togglePause();
  }

  /** The predict option follows the direction held (C11). */
  function holdPrediction() {
    const mine = frames?.current.participants.find((p) => p.id === dominated);
    if (motion !== "predict" || mine === undefined || arena === null) {
      predictor.current.reset();
      return;
    }
    const dir = input.current.moving;
    predictor.current.hold(dir, performance.now(), arena.width, mine.cell);
  }

  // The listeners are added once and call the handler of the latest render.
  const keyHandler = useRef(onKey);
  keyHandler.current = onKey;
  const blurHandler = useRef(() => {});
  blurHandler.current = () => {
    for (const c of input.current.releaseAll(dominated)) send(c);
    predictor.current.hold(null, performance.now(), 0, -1);
  };
  useEffect(() => {
    const down = (e: KeyboardEvent) => keyHandler.current(e, true);
    const up = (e: KeyboardEvent) => keyHandler.current(e, false);
    const blur = () => blurHandler.current();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  const current = frames?.current ?? null;
  const running = current !== null && current.ended === null;
  const yourCreep = frames?.current.participants.find(
    (p) => p.id === dominated,
  );
  const yourStepMs =
    yourCreep === undefined
      ? Number.NaN
      : stepTicks(params, yourCreep) * tickMsAt(speed);
  const measured = conn.current?.latency.summary() ?? {
    samples: 0,
    medianMs: Number.NaN,
    p95Ms: Number.NaN,
  };
  const lines = useMemo(() => eventLines(events, TPS), [events]);
  const inArena = useMemo(
    () => [...new Set(current?.participants.map((p) => p.side) ?? [])].sort(),
    [current],
  );
  const newSide =
    inArena.length < params.limits.maxSides ? sides.current : null;
  const selectedName =
    selected === null
      ? null
      : (current?.participants.find((p) => p.id === selected)?.name ?? null);
  const dirty =
    gambitsDraft !== null &&
    JSON.stringify(gambitsDraft) !== JSON.stringify(gambitsRunning);

  return (
    <div class="lab">
      <header class="lab-top">
        <h1>Laboratório de batalha</h1>
        <p class="lab-hint">
          Setas ou WASD andam · Shift + seta vira · espaço ataca · Q larga a
          bolsa · E cata · Tab domina o próximo · 0 solta · R reinicia · P ou
          Esc pausa.
        </p>
      </header>
      {/* The battle first, as wide as the page allows (plan C6); the build
          and the tools below it. */}
      <div class="lab-play">
        <main class="lab-main">
          <div class="lab-controls">
            <button
              type="button"
              disabled={lastSetup.current === null}
              title="R"
              onClick={restart}
            >
              Reiniciar
            </button>
            <button
              type="button"
              disabled={!running}
              title="P ou Esc"
              onClick={togglePause}
            >
              {paused ? "Continuar" : "Pausar"}
            </button>
            <span class="lab-segmented" role="group" aria-label="Velocidade">
              {([1, 4, "instant"] as const).map((s) => (
                <button
                  key={String(s)}
                  type="button"
                  aria-pressed={speed === s}
                  disabled={s === "instant" && dominated !== null}
                  title={
                    s === "instant"
                      ? "Todos os ticks de uma vez, só com a IA"
                      : undefined
                  }
                  onClick={() => {
                    setSpeed(s);
                    conn.current?.speed(s);
                  }}
                >
                  {s === "instant" ? "instantâneo" : `×${speedFactor(s)}`}
                </button>
              ))}
            </span>
            <button
              type="button"
              disabled={current === null}
              onClick={() => conn.current?.exportLog()}
            >
              Exportar log
            </button>
            {running && current.countdownTicks === 0 && (
              <span
                class={
                  idleWarning(current, params)
                    ? "lab-idle-meter lab-idle-meter-warn"
                    : "lab-idle-meter"
                }
                title="Sem dano em ninguém por esse tempo, todos fogem (D9)"
              >
                sem dano: {(current.idleTicks / TPS).toFixed(0)} s · fogem em{" "}
                {idleSecondsLeft(current, params)} s
              </span>
            )}
            <span class="lab-clock">
              {current === null ? "—" : `${(current.tick / TPS).toFixed(1)} s`}
            </span>
          </div>
          {error !== null && <p class="lab-error">Setup recusado: {error}</p>}
          <div
            class={current === null ? "lab-stage lab-stage-empty" : "lab-stage"}
          >
            {arena !== null && current !== null ? (
              <ArenaView
                arena={arena}
                params={params}
                previous={frames!.previous}
                current={current}
                arrivedAt={frames!.at}
                glideMs={tickMsAt(speed)}
                motion={motion}
                stepGlides={stepGlides.current}
                predictor={predictor.current}
                effects={effects}
                dominated={dominated}
                selected={selected}
                onSelect={select}
              />
            ) : (
              <p class="lab-empty">
                Monte a batalha abaixo e clique em Começar.
              </p>
            )}
          </div>
        </main>
        <aside class="lab-side-col lab-play-side">
          {blindEnd !== null && (
            <GradePanel
              grade={blindEnd.grade}
              rttMs={blindEnd.record.rttMs}
              measured={blindEnd.record.measured}
              left={session.blind?.bag.length ?? 0}
              total={session.blind?.total ?? 0}
              onGrade={grade}
              onNext={() => nextBlind()}
            />
          )}
          <section class="lab-panel">
            <h2>Na arena</h2>
            {current === null || current.participants.length === 0 ? (
              <p class="lab-hint">Ninguém.</p>
            ) : (
              <ul class="lab-roster">
                {current.participants.map((p) => (
                  <li
                    key={p.id}
                    class={p.id === selected ? "lab-selected" : undefined}
                  >
                    <span class="lab-who-cell">
                      <button
                        type="button"
                        class="lab-who"
                        style={{ color: sideColor(p.side) }}
                        onClick={() => select(p.id)}
                      >
                        {DNA_GLYPHS[p.dna]} {p.name} ({sideLetter(p.side)})
                      </button>
                      <span class="lab-hint">
                        {p.controller === "human"
                          ? "você"
                          : `IA ${REACTION_LABELS[p.reaction]}`}
                      </span>
                    </span>
                    <span class="lab-num">
                      {p.hp}/{params.dna[p.dna].hp}
                    </span>
                    {p.id === dominated ? (
                      <button type="button" onClick={release}>
                        soltar
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!running}
                        onClick={() => dominate(p.id)}
                      >
                        dominar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <EventsList lines={lines} />
        </aside>
      </div>
      {endedEvent !== null && current !== null && (
        <ResultTable
          ended={endedEvent}
          params={params}
          seconds={(endedEvent.tick + 1) / TPS}
          hash={ended?.hash ?? null}
        />
      )}
      <div class="lab-tools">
        <div class="lab-side-col">
          <SetupForm
            draft={draft}
            params={params}
            onChange={setDraft}
            onStart={startDraft}
            locked={session.blind !== null}
          />
          {running && (
            <ReinforceForm
              sides={inArena}
              newSide={newSide}
              side={reinforceSide}
              onSide={setReinforceSide}
              value={reinforcement}
              params={params}
              onChange={setReinforcement}
              onSend={(side) =>
                send({
                  type: "join",
                  side,
                  participant: participantOf(
                    reinforcement,
                    params,
                    names.current++,
                  ),
                })
              }
            />
          )}
        </div>
        <div class="lab-side-col">
          <LatencyPanel
            rttMs={rtt}
            onRtt={(value) => {
              setRtt(value);
              if (conn.current !== null) conn.current.rttMs = value;
            }}
            measured={measured}
            tickMs={1000 / TPS}
            motion={motion}
            stepMs={yourStepMs}
            onMotion={(mode) => {
              setMotion(mode);
              predictor.current.reset();
            }}
            frameBytes={conn.current?.sizes.averageBytes ?? Number.NaN}
            blindRttMs={blindRtt}
            hidden={blindRtt !== null && blindEnd?.grade == null}
          />
          <SessionPanel
            session={session}
            rtts={RTT_CHOICES}
            onExport={exportSession}
            onClear={clearSession}
            canStartBlind={youOf(draft) !== null}
            onStartBlind={startBlind}
            onEndBlind={endBlind}
            canNextBlind={
              session.blind !== null &&
              session.blind.bag.length > 0 &&
              (blindRtt === null || blindEnd?.grade != null)
            }
            onNextBlind={() => nextBlind()}
          />
        </div>
        <div class="lab-side-col">
          <GambitsEditor
            name={selectedName}
            draft={gambitsDraft}
            maxRules={params.gambits.maxRules}
            dirty={dirty && running}
            onChange={setGambitsDraft}
            onApply={() => {
              if (selected === null || gambitsDraft === null) return;
              send({ type: "setGambits", id: selected, gambits: gambitsDraft });
              setGambitsRunning(gambitsDraft);
            }}
          />
        </div>
      </div>
    </div>
  );
}
