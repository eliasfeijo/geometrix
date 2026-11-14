// The replay screen and the sim it runs load only when a replay opens: the
// live game does not need them (the server runs the sim).

import { useEffect, useState } from "preact/hooks";
import type { ReplayScreen, ReplaySource } from "./replay-screen.tsx";

export type { ReplaySource };

type Props = { source: ReplaySource; onLeave(): void };

export function LazyReplayScreen(props: Props) {
  const [Screen, setScreen] = useState<typeof ReplayScreen | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    import("./replay-screen.tsx").then(
      (module) => setScreen(() => module.ReplayScreen),
      () => setFailed(true),
    );
  }, []);
  if (Screen !== null) return <Screen {...props} />;
  return (
    <main class="replay-loading">
      <button class="ghost" onClick={props.onLeave}>
        ← Mundos
      </button>
      <p class={failed ? "error" : "muted"}>
        {failed ? "Não deu para carregar o replay." : "Carregando o replay…"}
      </p>
    </main>
  );
}
