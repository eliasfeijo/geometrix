// Lobby: the worlds on the server, creating one (seed, multiplier, bots),
// joining a team with a guest name (spec section 4: no real login in M1) and
// watching replays: of a server world, or of a replay.json from geo sim.

import type { CreateWorldRequest, WorldSummary } from "@geometrix/protocol";
import { DIFFICULTIES, type Difficulty } from "@geometrix/sim";
import { useEffect, useState } from "preact/hooks";
import {
  ApiError,
  createWorld,
  joinWorld,
  listWorlds,
  serverConfig,
} from "./api.ts";
import { REJECT_TEXTS, teamName } from "./format.ts";
import { lobbyResult } from "./match-end.ts";
import { loadName, loadSession, saveName, saveSession } from "./session.ts";

const REFRESH_MS = 5000;
const TEAMS = [0, 1];

type Props = {
  slot: string;
  highlight: number | null;
  message: string | null;
  onEnter(worldId: number): void;
  onWatch(worldId: number): void;
  onReplayFile(file: File): void;
};

export function Lobby(props: Props) {
  const { slot, highlight, message, onEnter } = props;
  const storage = window.localStorage;
  const [worlds, setWorlds] = useState<WorldSummary[] | null>(null);
  const [error, setError] = useState<string | null>(message);
  const [name, setName] = useState(() => loadName(storage));
  const [busy, setBusy] = useState(false);

  const refresh = () =>
    listWorlds()
      .then((list) => setWorlds([...list].sort((a, b) => b.id - a.id)))
      .catch(() => setError("Servidor indisponível."));

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  const join = async (worldId: number, team: number) => {
    const trimmed = name.trim();
    if (trimmed === "") {
      setError("Escolha um nome antes de entrar.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      saveName(storage, trimmed);
      const res = await joinWorld(worldId, { name: trimmed, team });
      saveSession(storage, slot, {
        worldId,
        playerId: res.playerId,
        team: res.team,
        name: trimmed,
        token: res.token,
      });
      onEnter(worldId);
    } catch (e) {
      setError(apiErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main class="lobby">
      <header class="lobby-header">
        <h1>
          <span class="logo" aria-hidden="true">
            <svg viewBox="0 0 30 10" width="60" height="20">
              <rect x="1" y="1" width="8" height="8" class="logo-square" />
              <polygon points="15,1 19.5,9 10.5,9" class="logo-triangle" />
              <circle cx="25" cy="5" r="4" class="logo-circle" />
            </svg>
          </span>
          geometrix
        </h1>
        <p class="muted">M1 · o ciclo da riqueza</p>
      </header>

      <section class="panel">
        <label class="field">
          <span>Seu nome</span>
          <input
            value={name}
            maxLength={32}
            placeholder="convidado"
            onInput={(e) => setName(e.currentTarget.value)}
          />
        </label>
        {slot !== "" && <p class="muted">Slot de sessão: {slot}</p>}
        {error !== null && <p class="error">{error}</p>}
      </section>

      <CreateWorld
        disabled={busy}
        onCreated={(id) => {
          void refresh();
          setError(null);
          document.getElementById(`world-${id}`)?.scrollIntoView();
        }}
        onError={setError}
      />

      <ReplayFile onOpen={props.onReplayFile} />

      <section class="worlds">
        <h2>Mundos</h2>
        {worlds === null && <p class="muted">Carregando…</p>}
        {worlds?.length === 0 && <p class="muted">Nenhum mundo ainda.</p>}
        {worlds?.map((world) => {
          const session = loadSession(storage, world.id, slot);
          return (
            <article
              key={world.id}
              id={`world-${world.id}`}
              class={`panel world ${world.id === highlight ? "highlight" : ""}`}
            >
              <div class="world-head">
                <strong>Mundo #{world.id}</strong>
                <span class="muted">
                  {world.seed !== null && `seed ${world.seed} · `}×
                  {world.multiplier} · tick {world.tick} (
                  {Math.floor((100 * world.tick) / world.durationTicks)}%)
                </span>
                <span class={`status status-${world.status}`}>
                  {world.status === "running" ? "rodando" : "encerrado"}
                </span>
                {world.result !== null && (
                  <strong
                    class={
                      world.result.winner === null
                        ? ""
                        : `team-name team-${world.result.winner}`
                    }
                  >
                    {lobbyResult(world.result)}
                  </strong>
                )}
              </div>
              <div class="world-teams">
                {TEAMS.map((team) => (
                  <div key={team} class={`world-team team-${team}`}>
                    <span class="team-name">{teamName(team)}</span>
                    <span class="muted">
                      {world.players
                        .filter((p) => p.team === team)
                        .map((p) => (p.bot ? `🤖 ${p.name}` : p.name))
                        .join(", ") || "ninguém"}
                    </span>
                    {session === null && (
                      <button
                        disabled={busy}
                        onClick={() => void join(world.id, team)}
                      >
                        Entrar
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div class="world-actions">
                {session !== null && (
                  <button class="primary" onClick={() => onEnter(world.id)}>
                    Continuar como {session.name} ({teamName(session.team)})
                  </button>
                )}
                {world.status === "ended" && (
                  <button
                    onClick={() => props.onWatch(world.id)}
                    title="Rodar o mundo desde o início, no navegador"
                  >
                    Assistir replay
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

const DIFFICULTY_NAMES: Record<Difficulty, string> = {
  easy: "fácil",
  normal: "normal",
  hard: "difícil",
};

/** The request of the "Novo mundo" form; only bot teams have a difficulty. */
export function worldRequest(form: {
  seed: string;
  multiplier: string;
  bots: readonly boolean[];
  difficulties: readonly Difficulty[];
}): CreateWorldRequest {
  const botTeams = TEAMS.filter((t) => form.bots[t]);
  return {
    ...(form.seed.trim() === "" ? {} : { seed: Number(form.seed) }),
    multiplier: Number(form.multiplier),
    botTeams,
    botDifficulty: Object.fromEntries(
      botTeams.map((t) => [String(t), form.difficulties[t]!]),
    ),
  };
}

function CreateWorld(props: {
  disabled: boolean;
  onCreated(id: number): void;
  onError(text: string): void;
}) {
  const [seed, setSeed] = useState("");
  // Empty until the server says what its params are tuned for (R plan P1).
  const [multiplier, setMultiplier] = useState("");
  const [bots, setBots] = useState<boolean[]>([false, true]);
  const [difficulties, setDifficulties] = useState<Difficulty[]>([
    "hard",
    "hard",
  ]);
  useEffect(() => {
    serverConfig()
      .then((config) =>
        setMultiplier((typed) =>
          typed === "" ? String(config.multiplier) : typed,
        ),
      )
      .catch((err) => props.onError(apiErrorText(err)));
  }, []);
  const [busy, setBusy] = useState(false);

  const submit = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { id } = await createWorld(
        worldRequest({ seed, multiplier, bots, difficulties }),
      );
      props.onCreated(id);
    } catch (err) {
      props.onError(apiErrorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form class="panel create" onSubmit={(e) => void submit(e)}>
      <h2>Novo mundo</h2>
      <div class="create-fields">
        <label class="field">
          <span>Seed</span>
          <input
            inputMode="numeric"
            placeholder="sorteada"
            value={seed}
            onInput={(e) => setSeed(e.currentTarget.value)}
          />
        </label>
        <label class="field">
          <span>Multiplicador</span>
          <input
            type="number"
            min={1}
            max={10000}
            value={multiplier}
            onInput={(e) => setMultiplier(e.currentTarget.value)}
          />
        </label>
        {TEAMS.map((team) => (
          <label key={team} class="check">
            <input
              type="checkbox"
              checked={bots[team]}
              onChange={(e) => {
                const next = [...bots];
                next[team] = e.currentTarget.checked;
                setBots(next);
              }}
            />
            Bot no {teamName(team)}
            <select
              aria-label={`Dificuldade do bot no ${teamName(team)}`}
              value={difficulties[team]}
              disabled={!bots[team]}
              onChange={(e) => {
                const next = [...difficulties];
                next[team] = e.currentTarget.value as Difficulty;
                setDifficulties(next);
              }}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_NAMES[d]}
                </option>
              ))}
            </select>
          </label>
        ))}
        <button
          class="primary"
          disabled={busy || props.disabled || multiplier === ""}
        >
          Criar
        </button>
      </div>
    </form>
  );
}

function ReplayFile(props: { onOpen(file: File): void }) {
  return (
    <section class="panel replay-file">
      <label class="field">
        <span>Assistir replay (o replay.json de um geo sim)</span>
        <input
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = "";
            if (file !== undefined) props.onOpen(file);
          }}
        />
      </label>
    </section>
  );
}

function apiErrorText(error: unknown): string {
  if (!(error instanceof ApiError)) return "Erro inesperado.";
  if (error.code === "network") return "Servidor indisponível.";
  if (error.code === "invalidRequest") return "Dados inválidos.";
  if (error.code === "unknownWorld") return "Esse mundo não está hospedado.";
  return (
    (REJECT_TEXTS as Record<string, string>)[error.code] ??
    `Erro do servidor (${error.code}).`
  );
}
