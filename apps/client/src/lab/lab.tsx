// The battle lab (M2 laboratório, spec D2, section 4; plan section 13): a
// local page with no world and no game server. It builds a battle, runs it in
// a worker behind a simulated network, lets the owner dominate one
// participant at a time from the keyboard or just watch, and measures the
// delay. Everything the page draws came back over the network (spec L-3).

import {
  parseArena,
  type Arena,
  type BattleCommand,
  type BattleEvent,
  type BattleLog,
  type BattleSetup,
  type BattleView,
  type Gambit,
} from "@geometrix/battle";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { ArenaView, sideColor } from "./arena-view.tsx";
import { LAB_ARENAS, LAB_PARAMS } from "./assets.ts";
import { LabConnection, type WorkerLike } from "./connection.ts";
import {
  defaultDraft,
  member,
  namesUsed,
  participantOf,
  setupOf,
  type MemberDraft,
} from "./draft.ts";
import { eventLines, EventsList } from "./events-list.tsx";
import { GambitsEditor } from "./gambits-editor.tsx";
import { KeyboardInput } from "./input.ts";
import { DNA_GLYPHS, REACTION_LABELS, sideLetter } from "./labels.ts";
import { LatencyPanel } from "./latency-panel.tsx";
import type { Ended, Speed } from "./protocol.ts";
import { ResultTable } from "./result-table.tsx";
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

function download(log: BattleLog): void {
  const blob = new Blob([JSON.stringify(log)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `batalha-seed${log.setup.seed}-t${log.ticks}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Lab() {
  const [draft, setDraft] = useState(defaultDraft);
  const [arena, setArena] = useState<Arena | null>(null);
  const [frames, setFrames] = useState<Frames | null>(null);
  const [events, setEvents] = useState<BattleEvent[]>([]);
  const [endedEvent, setEndedEvent] = useState<EndedEvent | null>(null);
  const [ended, setEnded] = useState<Ended | null>(null);
  const [speed, setSpeed] = useState<Speed>(1);
  const [paused, setPaused] = useState(false);
  const [rtt, setRtt] = useState(0);
  const [interpolate, setInterpolate] = useState(true);
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

  const conn = useRef<LabConnection | null>(null);
  const input = useRef(new KeyboardInput());
  const lastSetup = useRef<BattleSetup | null>(null);
  const names = useRef(0);
  const sides = useRef(0);
  // The callbacks read these, not the state of the render that made them.
  const live = useRef({ interpolate, speed, selected, dominated });
  live.current = { interpolate, speed, selected, dominated };

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
            for (const event of frame.events) {
              if (event.type === "ended") setEndedEvent(event);
              if (event.type === "joined") {
                sides.current = Math.max(
                  sides.current,
                  event.participant.side + 1,
                );
              }
            }
          }
          // The effect is on the screen now, or once the glide ends.
          const { interpolate: glide, speed: s } = live.current;
          connection.shown(frame.applied, at + (glide ? tickMsAt(s) : 0));
          if (frame.applied.length > 0) setMeasured((n) => n + 1);
          const mine = live.current.dominated;
          if (
            mine !== null &&
            !frame.view.participants.some((p) => p.id === mine)
          ) {
            setDominated(null);
          }
        },
        ended: setEnded,
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

  function start(setup: BattleSetup) {
    const connection = conn.current;
    if (connection === null) return;
    setError(null);
    setFrames(null);
    setEvents([]);
    setEndedEvent(null);
    setEnded(null);
    setPaused(false);
    setDominated(null);
    setSelected(null);
    setGambitsDraft(null);
    setGambitsRunning(null);
    input.current = new KeyboardInput();
    lastSetup.current = setup;
    sides.current = setup.sides.length;
    setArena(parseArena(setup.arena));
    connection.rttMs = rtt;
    connection.start(setup, params, speed);
  }

  function startDraft() {
    names.current = namesUsed(draft);
    start(setupOf(draft, params, LAB_ARENAS[draft.arena]));
  }

  function dominate(id: number) {
    send({ type: "control", id, controller: "human" });
    setDominated(id);
    for (const command of input.current.retarget(id)) send(command);
    if (speed === "instant") {
      setSpeed(1);
      conn.current?.speed(1);
    }
  }

  function release() {
    if (dominated === null) return;
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
    const result = down
      ? input.current.down(event, dominated)
      : input.current.up(event, dominated);
    if (result.handled) event.preventDefault();
    for (const command of result.commands) send(command);
    if (result.cycle) cycle();
    if (result.release) release();
  }

  const current = frames?.current ?? null;
  const running = current !== null && current.ended === null;
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
          bolsa · E cata · Tab domina o próximo · 0 solta. Clique na arena para
          jogar.
        </p>
      </header>
      <div class="lab-columns">
        <aside class="lab-side-col">
          <SetupForm
            draft={draft}
            params={params}
            onChange={setDraft}
            onStart={startDraft}
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
        </aside>
        <main class="lab-main">
          <div class="lab-controls">
            <button
              type="button"
              disabled={lastSetup.current === null}
              onClick={() => lastSetup.current && start(lastSetup.current)}
            >
              Reiniciar
            </button>
            <button
              type="button"
              disabled={!running}
              onClick={() => {
                if (paused) conn.current?.resume();
                else conn.current?.pause();
                setPaused(!paused);
              }}
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
            <span class="lab-clock">
              {current === null ? "—" : `${(current.tick / TPS).toFixed(1)} s`}
            </span>
          </div>
          {error !== null && <p class="lab-error">Setup recusado: {error}</p>}
          <div
            class="lab-stage"
            tabIndex={0}
            onKeyDown={(e) => onKey(e, true)}
            onKeyUp={(e) => onKey(e, false)}
            onBlur={() => {
              for (const c of input.current.releaseAll(dominated)) send(c);
            }}
          >
            {arena !== null && current !== null ? (
              <ArenaView
                arena={arena}
                params={params}
                previous={frames!.previous}
                current={current}
                arrivedAt={frames!.at}
                glideMs={tickMsAt(speed)}
                interpolate={interpolate}
                dominated={dominated}
                selected={selected}
                onSelect={select}
              />
            ) : (
              <p class="lab-empty">
                Monte a batalha ao lado e clique em Começar.
              </p>
            )}
          </div>
          {endedEvent !== null && current !== null && (
            <ResultTable
              ended={endedEvent}
              params={params}
              seconds={(endedEvent.tick + 1) / TPS}
              hash={ended?.hash ?? null}
            />
          )}
        </main>
        <aside class="lab-side-col">
          <LatencyPanel
            rttMs={rtt}
            onRtt={(value) => {
              setRtt(value);
              if (conn.current !== null) conn.current.rttMs = value;
            }}
            measured={measured}
            tickMs={1000 / TPS}
            interpolate={interpolate}
            onInterpolate={setInterpolate}
            frameBytes={conn.current?.sizes.averageBytes ?? Number.NaN}
          />
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
                    <button
                      type="button"
                      class="lab-who"
                      style={{ color: sideColor(p.side) }}
                      onClick={() => select(p.id)}
                    >
                      {DNA_GLYPHS[p.dna]} {p.name} ({sideLetter(p.side)})
                    </button>
                    <span class="lab-num">
                      {p.hp}/{params.dna[p.dna].hp}
                    </span>
                    <span class="lab-hint">
                      {p.controller === "human"
                        ? "você"
                        : `IA ${REACTION_LABELS[p.reaction]}`}
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
          <EventsList lines={lines} />
        </aside>
      </div>
    </div>
  );
}
