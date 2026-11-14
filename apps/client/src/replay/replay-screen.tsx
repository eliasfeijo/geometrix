// Replay screen (plan section 8, F8 details): the game layout as a spectator,
// with play, pause, speed, a timeline to jump anywhere and the hash check on
// the last tick. The replay comes from a file or from a server world.

import { parseReplay, type Replay } from "@geometrix/protocol";
import { SIM_VERSION } from "@geometrix/sim";
import { useEffect, useMemo, useState } from "preact/hooks";
import type { Game } from "../context.ts";
import { teamName, worldClock } from "../format.ts";
import { fetchNamesWhenMissing } from "../game.tsx";
import { GameLayout } from "../game-layout.tsx";
import { ReplayController, SPECTATOR_ID } from "./controller.ts";
import { SPEEDS, type Speed } from "./playback.ts";

export type ReplaySource =
  { kind: "file"; file: File } | { kind: "world"; worldId: number };

type Props = { source: ReplaySource; onLeave(): void };

/** Loads the replay (a file or a server world's export), then shows it. */
export function ReplayScreen({ source, onLeave }: Props) {
  const [loaded, setLoaded] = useState<Replay | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const load =
      source.kind === "file"
        ? readReplayFile(source.file)
        : fetchReplay(source.worldId);
    load.then(setLoaded, (e: unknown) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
  }, []);

  if (loaded === null) {
    return (
      <main class="replay-loading">
        <button class="ghost" onClick={onLeave}>
          ← Mundos
        </button>
        {error === null ? (
          <p class="muted">Carregando o replay…</p>
        ) : (
          <p class="error">Não deu para abrir o replay: {error}</p>
        )}
      </main>
    );
  }
  return (
    <ReplayView
      replay={loaded}
      title={
        source.kind === "file" ? source.file.name : `Mundo #${source.worldId}`
      }
      worldId={source.kind === "world" ? source.worldId : 0}
      onLeave={onLeave}
    />
  );
}

async function fetchReplay(worldId: number): Promise<Replay> {
  const res = await fetch(`/api/worlds/${worldId}/replay`);
  if (res.status === 409) {
    throw new Error(
      "o mundo ainda está rodando; o replay abre quando ele acabar",
    );
  }
  if (!res.ok) throw new Error(`o servidor respondeu ${res.status}`);
  return parseReplay(await res.json());
}

/** Reads a replay.json chosen in the lobby. */
async function readReplayFile(file: File): Promise<Replay> {
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch (cause) {
    throw new Error("o arquivo não é JSON", { cause });
  }
  return parseReplay(json);
}

function ReplayView(props: {
  replay: Replay;
  title: string;
  worldId: number;
  onLeave(): void;
}) {
  const controller = useMemo(
    () => new ReplayController(props.replay, props.worldId),
    [],
  );
  const [team, setTeam] = useState(0);
  const game = useMemo<Game>(
    () => ({
      store: controller.store,
      viewer: { playerId: SPECTATOR_ID, team },
      send: () => Promise.resolve(false),
    }),
    [team],
  );

  useEffect(() => {
    let frame = 0;
    const loop = (now: number) => {
      controller.frame(now);
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(
    () =>
      props.worldId === 0
        ? undefined
        : fetchNamesWhenMissing(controller.store, props.worldId),
    [],
  );

  return (
    <GameLayout
      game={game}
      orders={false}
      header={
        <ReplayBar
          controller={controller}
          title={props.title}
          team={team}
          onTeam={setTeam}
          onLeave={props.onLeave}
        />
      }
    />
  );
}

const SPEED_LABELS: Record<string, string> = { max: "máx" };

function ReplayBar(props: {
  controller: ReplayController;
  title: string;
  team: number;
  onTeam(team: number): void;
  onLeave(): void;
}) {
  const { controller } = props;
  const { replay } = controller;
  const tickSeconds = replay.params.world.tickSeconds;
  const tick = controller.tick.value;
  const seeking = controller.seeking.value;
  const playing = controller.playing.value;
  const rate = controller.rate.value;
  // The thumb follows the pointer while dragging; the seek happens on release.
  const [dragging, setDragging] = useState<number | null>(null);
  const shown = dragging ?? seeking ?? tick;

  return (
    <header class="top-bar replay-bar">
      <button class="ghost" onClick={props.onLeave} title="Voltar ao lobby">
        ← Mundos
      </button>
      <strong>Replay · {props.title}</strong>
      <span class="muted">seed {replay.seed}</span>
      {controller.otherVersion && (
        <span
          class="warning"
          title={`Este cliente roda a versão ${SIM_VERSION} do sim`}
        >
          versão {replay.simVersion} do sim
        </span>
      )}
      <button
        class="primary play"
        onClick={() => (playing ? controller.pause() : controller.play())}
        title={playing ? "Pausar" : "Reproduzir"}
      >
        {playing ? "⏸" : "▶"}
      </button>
      <span class="speeds" role="group" aria-label="Velocidade">
        {SPEEDS.map((speed: Speed) => (
          <button
            key={speed}
            class={controller.speed.value === speed ? "active" : ""}
            onClick={() => controller.setSpeed(speed)}
            title={
              speed === "max"
                ? "O mais rápido que o navegador simula"
                : `${speed} segundos de mundo por segundo`
            }
          >
            {SPEED_LABELS[speed] ?? `×${speed}`}
          </button>
        ))}
      </span>
      <input
        class="timeline"
        type="range"
        min={0}
        max={replay.ticks}
        value={shown}
        aria-label="Linha do tempo"
        onInput={(e) => setDragging(Number(e.currentTarget.value))}
        onChange={(e) => {
          setDragging(null);
          controller.seekTo(Number(e.currentTarget.value));
        }}
      />
      <span class="clock" title={`tick ${shown} de ${replay.ticks}`}>
        {worldClock(shown, tickSeconds)}
        <span class="muted"> / {worldClock(replay.ticks, tickSeconds)}</span>
      </span>
      <span class="muted rate">
        {seeking !== null
          ? "re-simulando…"
          : rate !== null && playing
            ? `${formatRate(rate)} ticks/s`
            : ""}
      </span>
      <HashBadge controller={controller} />
      <span class="spacer" />
      <span class="viewer-team" role="group" aria-label="Ver como">
        {[0, 1].map((t) => (
          <button
            key={t}
            class={`team-${t} ${props.team === t ? "active" : ""}`}
            onClick={() => props.onTeam(t)}
            title="Painel do Núcleo deste time"
          >
            <span class="team-name">{teamName(t)}</span>
          </button>
        ))}
      </span>
    </header>
  );
}

function HashBadge({ controller }: { controller: ReplayController }) {
  const check = controller.hash.value;
  const expected = controller.replay.finalHash;
  switch (check.status) {
    case "waiting":
      return (
        <span class="hash muted" title={`hash esperado ${expected}`}>
          hash no fim
        </span>
      );
    case "computing":
      return <span class="hash muted">calculando o hash…</span>;
    case "match":
      return (
        <span class="hash hash-ok" title={`sha256 ${check.hash}`}>
          ✓ hash confere
        </span>
      );
    case "mismatch":
      return (
        <span
          class="hash hash-bad"
          title={`esperado ${expected}\nobtido ${check.hash}`}
        >
          ✗ hash diferente
        </span>
      );
  }
}

function formatRate(rate: number): string {
  return Math.round(rate).toLocaleString("pt-BR");
}
