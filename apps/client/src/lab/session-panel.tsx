// The session on the page (spec L-5, section 7; plan P14): how many battles
// it holds, the blind mode (start it with the form's setup, how many battles
// are left, end it), grade × RTT with the latency verdict, wins dominating ×
// the AI, the export and a clear. Grade × RTT stays hidden while a blind
// session is on, so the owner grades the game and not the table.

import { sideLetter } from "./labels.ts";
import {
  gradesByRtt,
  latencyVerdict,
  winsByMatchup,
  type LabSession,
  type Tally,
} from "./session.ts";

type Props = {
  session: LabSession;
  rtts: readonly number[];
  onExport(): void;
  onClear(): void;
  /** The form's setup has someone for the owner to play. */
  canStartBlind: boolean;
  onStartBlind(): void;
  onEndBlind(): void;
  /** No blind battle is on screen (e.g. after a reload): offer the next. */
  canNextBlind: boolean;
  onNextBlind(): void;
};

const ms = (n: number | null) => (n === null ? "—" : `${Math.round(n)} ms`);
const tally = (t: Tally) =>
  t.battles === 0
    ? "—"
    : `${t.wins}/${t.battles} (${Math.round((t.wins * 100) / t.battles)}%)`;

export function SessionPanel(props: Props) {
  const { records, blind } = props.session;
  const grades =
    blind === null
      ? gradesByRtt(records, props.rtts).filter((r) => r.grades.length > 0)
      : [];
  const verdict = latencyVerdict(grades);
  const wins = winsByMatchup(records);
  return (
    <section class="lab-panel lab-session">
      <h2>Sessão</h2>
      <p class="lab-hint">
        {records.length} batalha{records.length === 1 ? "" : "s"} no registro
        {grades.length > 0 &&
          ` · ${records.filter((r) => r.grade !== null).length} com nota`}
      </p>
      {blind === null ? (
        <div class="lab-row">
          <button
            type="button"
            disabled={!props.canStartBlind}
            onClick={props.onStartBlind}
          >
            Começar sessão às cegas
          </button>
          <span class="lab-hint">
            {props.canStartBlind
              ? `com o setup do formulário: ${props.rtts.length} RTTs × 5, em ordem sorteada`
              : "escolha com quem você joga no formulário"}
          </span>
        </div>
      ) : (
        <div class="lab-row">
          <span>
            Às cegas ({blind.matchup}): faltam {blind.bag.length} de{" "}
            {blind.total}
          </span>
          {props.canNextBlind && (
            <button
              type="button"
              class="lab-primary"
              onClick={props.onNextBlind}
            >
              Próxima batalha
            </button>
          )}
          <button type="button" onClick={props.onEndBlind}>
            Encerrar
          </button>
        </div>
      )}
      {grades.length > 0 && (
        <>
          <h3>Nota × RTT</h3>
          <div class="lab-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>RTT</th>
                  <th>notas</th>
                  <th>mediana</th>
                  <th>tecla → tela</th>
                </tr>
              </thead>
              <tbody>
                {grades.map((row) => (
                  <tr key={row.rttMs}>
                    <td class="lab-num">{row.rttMs} ms</td>
                    <td>{row.grades.join(" ")}</td>
                    <td class="lab-num">{row.median}</td>
                    <td class="lab-num">{ms(row.delayMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p class="lab-hint">
            nota mediana ≥ 4 até {ms(verdict.goodUpTo)} · abaixo de 3 a partir
            de {ms(verdict.badFrom)}
          </p>
        </>
      )}
      {wins.length > 0 && (
        <>
          <h3>Você × IA, no mesmo confronto</h3>
          <div class="lab-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>confronto</th>
                  <th>lado</th>
                  <th>você</th>
                  <th>IA</th>
                </tr>
              </thead>
              <tbody>
                {wins.map((row) => (
                  <tr key={`${row.matchup}/${row.side}`}>
                    <td>{row.matchup}</td>
                    <td>{sideLetter(row.side)}</td>
                    <td class="lab-num">{tally(row.owner)}</td>
                    <td class="lab-num">{tally(row.ai)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p class="lab-hint">
            IA: as batalhas em que você só assistiu. Trocar de domínio no meio
            tira a batalha das duas contas.
          </p>
        </>
      )}
      <div class="lab-row">
        <button
          type="button"
          disabled={records.length === 0}
          onClick={props.onExport}
        >
          Exportar sessão
        </button>
        <button
          type="button"
          disabled={records.length === 0 && props.session.blind === null}
          onClick={props.onClear}
        >
          Limpar
        </button>
      </div>
    </section>
  );
}
