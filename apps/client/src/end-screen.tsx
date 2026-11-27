// The end screen (E-min spec D9, S-1, S-2; plan section 7): in place of the
// map or the battle screen once the world has a result, with the numbers of
// the state's summary. "Ver o mapa" hides it over the frozen world.

import type { EndSummary } from "@geometrix/sim";
import { useGame } from "./context.ts";
import { narrate, plainText } from "./chronicle/narrate.ts";
import { durationWords, teamName, worldClock } from "./format.ts";
import { endHow, realSeconds, resultHeadline } from "./match-end.ts";

export function EndOverlay({ onReplay }: { onReplay?: () => void }) {
  const game = useGame();
  const { store } = game;
  const summary = store.current.value?.state.summary ?? null;
  const info = store.info.value;
  if (summary === null || info === null) return null;
  if (store.endHidden.value) {
    return (
      <button
        class="primary end-return"
        onClick={() => (store.endHidden.value = false)}
      >
        Ver o resultado
      </button>
    );
  }
  return (
    <EndScreen
      summary={summary}
      tickSeconds={info.params.world.tickSeconds}
      multiplier={game.multiplier ?? info.multiplier}
      onMap={() => (store.endHidden.value = true)}
      onReplay={onReplay}
    />
  );
}

function EndScreen(props: {
  summary: EndSummary;
  tickSeconds: number;
  multiplier: number;
  onMap(): void;
  onReplay?: () => void;
}) {
  const { summary, tickSeconds, multiplier } = props;
  const { result, durationSeconds, teams, highlights } = summary;
  const clock = (tick: number) => worldClock(tick, tickSeconds).split(" · ")[1];
  return (
    <section class="end-screen" aria-label="Fim da partida">
      <div class="end-card panel">
        <h1
          class={
            result.winner === null ? "" : `team-name team-${result.winner}`
          }
        >
          {resultHeadline(result)}
        </h1>
        <p class="end-how">{capitalize(endHow(summary))}</p>
        <p class="muted">
          Duração: {durationWords(durationSeconds)} de mundo ·{" "}
          {durationWords(realSeconds(durationSeconds, multiplier))} reais
        </p>
        <table class="end-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Nasceram</th>
              <th>Perdidos</th>
              <th>Batalhas vencidas</th>
              <th>Batalhas perdidas</th>
              <th>Matéria entregue</th>
              <th>Saiu</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t.team}>
                <th class={`team-name team-${t.team}`}>{teamName(t.team)}</th>
                <td>{t.born}</td>
                <td>{t.lost}</td>
                <td>{t.battlesWon}</td>
                <td>{t.battlesLost}</td>
                <td>{t.materiaDelivered}</td>
                <td>{t.out === null ? "—" : clock(t.out.tick)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {highlights.length > 0 && (
          <>
            <h3>Melhores momentos</h3>
            <ul class="end-highlights">
              {highlights.map((event) => (
                <li key={`${event.tick}.${event.index}`}>
                  <span class="muted small">{clock(event.tick)}</span>{" "}
                  {plainText(narrate(event))}
                </li>
              ))}
            </ul>
          </>
        )}
        <div class="dialog-actions">
          <button onClick={props.onMap}>Ver o mapa</button>
          {props.onReplay !== undefined && (
            <button class="primary" onClick={props.onReplay}>
              Ver o replay
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);
