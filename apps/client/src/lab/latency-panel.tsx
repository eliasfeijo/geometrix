// The simulated network on the page (spec D17, L-4): the RTT selector, the
// measured delay from a key to its effect (median and p95 of the battle),
// what to expect, and the average size of a frame. In the blind mode the page
// draws the RTT: no selector, and the RTT, the delay and what to expect stay
// hidden until the grade (the delay would give the RTT away).

import { RTT_CHOICES } from "./channel.ts";
import type { LatencySummary } from "./latency.ts";

type Props = {
  rttMs: number;
  onRtt(rtt: number): void;
  measured: LatencySummary;
  tickMs: number;
  interpolate: boolean;
  onInterpolate(on: boolean): void;
  frameBytes: number;
  /** The blind mode's RTT of this battle, or null outside it. */
  blindRttMs: number | null;
  /** The blind battle has no grade yet: hide what gives the RTT away. */
  hidden: boolean;
};

const ms = (n: number) => (Number.isNaN(n) ? "—" : `${Math.round(n)} ms`);

export function LatencyPanel(props: Props) {
  const { measured, tickMs } = props;
  const glide = props.interpolate ? tickMs : 0;
  const rtt = props.blindRttMs ?? props.rttMs;
  return (
    <section class="lab-panel">
      <h2>Rede simulada</h2>
      <div class="lab-row">
        {props.blindRttMs !== null ? (
          <span>
            RTT{" "}
            {props.hidden ? (
              <span class="lab-hint">sorteado, escondido até a nota</span>
            ) : (
              `${props.blindRttMs} ms`
            )}
          </span>
        ) : (
          <label>
            RTT
            <select
              id="latency-rtt"
              value={String(props.rttMs)}
              onChange={(e) => props.onRtt(Number(e.currentTarget.value))}
            >
              {RTT_CHOICES.map((rtt) => (
                <option key={rtt} value={String(rtt)}>
                  {rtt} ms
                </option>
              ))}
            </select>
          </label>
        )}
        <label class="lab-check">
          <input
            id="latency-interpolate"
            type="checkbox"
            checked={props.interpolate}
            onChange={(e) => props.onInterpolate(e.currentTarget.checked)}
          />
          interpolar
        </label>
      </div>
      <dl class="lab-stats">
        <dt>tecla → tela</dt>
        {props.hidden ? (
          <dd class="lab-hint">escondido até a nota</dd>
        ) : (
          <dd>
            {ms(measured.medianMs)} <span class="lab-hint">mediana</span> ·{" "}
            {ms(measured.p95Ms)} <span class="lab-hint">p95</span> ·{" "}
            {measured.samples} <span class="lab-hint">teclas</span>
          </dd>
        )}
        <dt>esperado</dt>
        {props.hidden ? (
          <dd class="lab-hint">—</dd>
        ) : (
          <dd>
            {ms(rtt + glide)} a {ms(rtt + tickMs + glide)}{" "}
            <span class="lab-hint">± jitter de 20%</span>
          </dd>
        )}
        <dt>visão por tick</dt>
        <dd>
          {Number.isNaN(props.frameBytes)
            ? "—"
            : `${(props.frameBytes / 1024).toFixed(1)} KB`}
        </dd>
      </dl>
    </section>
  );
}
