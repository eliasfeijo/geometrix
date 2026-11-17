// The end of a blind battle (spec D17, L-5; F5): the grade from 1 to 5
// first, with the RTT and the measured delay still hidden; then both are
// revealed and the next battle is one click (or Enter) away.

import type { LatencySummary } from "./latency.ts";
import { GRADES, type Grade } from "./session.ts";

type Props = {
  grade: Grade | null;
  rttMs: number;
  measured: LatencySummary;
  /** Blind battles left after this one. */
  left: number;
  total: number;
  onGrade(grade: Grade): void;
  onNext(): void;
};

const ms = (n: number) => (Number.isNaN(n) ? "—" : `${Math.round(n)} ms`);

export function GradePanel(props: Props) {
  const played = props.total - props.left;
  if (props.grade === null) {
    return (
      <section class="lab-panel lab-grade">
        <h2>Dá para jogar?</h2>
        <div class="lab-row" role="group" aria-label="Nota">
          {GRADES.map((g) => (
            <button
              key={g}
              type="button"
              class="lab-grade-button"
              title={`tecla ${g}`}
              onClick={() => props.onGrade(g)}
            >
              {g}
            </button>
          ))}
        </div>
        <p class="lab-hint">
          1 não dá para jogar · 5 nem senti atraso. Teclas 1 a 5. O RTT aparece
          depois da nota.
        </p>
      </section>
    );
  }
  return (
    <section class="lab-panel lab-grade">
      <h2>
        Nota {props.grade} · o RTT era {props.rttMs} ms
      </h2>
      <p class="lab-hint">
        tecla → tela: {ms(props.measured.medianMs)} de mediana,{" "}
        {ms(props.measured.p95Ms)} de p95 ({props.measured.samples} teclas).
        Batalha {played} de {props.total}.
      </p>
      {props.left > 0 ? (
        <button type="button" class="lab-primary" onClick={props.onNext}>
          Próxima batalha (Enter)
        </button>
      ) : (
        <p>Sessão às cegas concluída: encerre-a no painel da sessão.</p>
      )}
    </section>
  );
}
