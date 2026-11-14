import { useEffect } from "preact/hooks";
import { useGame } from "./context.ts";
import { teamName, worldClock } from "./format.ts";
import { NOTICE_MS } from "./store.ts";

const CONNECTION_TEXTS = {
  connecting: "conectando…",
  open: "conectado",
  reconnecting: "reconectando…",
  closed: "desconectado",
} as const;

export function TopBar({ onLeave }: { onLeave(): void }) {
  const { store, session } = useGame();
  const info = store.info.value;
  const state = store.current.value?.state;
  const connection = store.connection.value;
  const params = info?.params;
  return (
    <header class="top-bar">
      <button class="ghost" onClick={onLeave} title="Voltar ao lobby">
        ← Mundos
      </button>
      <strong>Mundo #{session.worldId}</strong>
      {params !== undefined && state !== undefined && (
        <span class="clock" title={`tick ${state.tick}`}>
          {worldClock(state.tick, params.world.tickSeconds)}
          <span class="muted">
            {" "}
            / {Math.floor(params.world.durationSeconds / 86_400)} dias · ×
            {info!.multiplier}
          </span>
        </span>
      )}
      {store.status.value === "ended" && (
        <span class="status status-ended">encerrado · só leitura</span>
      )}
      <span class="spacer" />
      <span class={`player team-${session.team}`}>
        {session.name} · {teamName(session.team)}
        {state !== undefined && store.me.value === null && (
          <span class="muted"> (entrando…)</span>
        )}
      </span>
      <span class={`connection connection-${connection}`}>
        {CONNECTION_TEXTS[connection]}
      </span>
    </header>
  );
}

export function Notices() {
  const { store } = useGame();
  const notices = store.notices.value;
  useEffect(() => {
    if (notices.length === 0) return;
    const oldest = Math.min(...notices.map((n) => n.at));
    const timer = window.setTimeout(
      () => {
        const now = performance.now();
        store.notices.value = store.notices.value.filter(
          (n) => now - n.at < NOTICE_MS,
        );
      },
      Math.max(0, oldest + NOTICE_MS - performance.now()),
    );
    return () => window.clearTimeout(timer);
  }, [notices]);
  return (
    <div class="notices" role="status">
      {notices.map((n) => (
        <div key={n.id} class="notice" onClick={() => store.dismiss(n.id)}>
          {n.text}
        </div>
      ))}
    </div>
  );
}
