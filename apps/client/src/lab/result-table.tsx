// The result of a battle (spec F-3, L-8): how each participant ended, with
// its HP, the damage dealt and taken and the load it left with; and what
// stayed on the ground.

import type { BattleEvent } from "@geometrix/battle";
import { sideColor } from "./arena-view.tsx";
import { DNA_GLYPHS, OUTCOME_LABELS, sideLetter } from "./labels.ts";

type EndedEvent = Extract<BattleEvent, { type: "ended" }>;

type Props = {
  ended: EndedEvent;
  seconds: number;
  hash: string | null;
};

export function ResultTable({ ended, seconds, hash }: Props) {
  const left = ended.piles.reduce((n, p) => n + p.materia + p.cristal, 0);
  return (
    <section class="lab-panel lab-result">
      <h2>
        {ended.winnerSide === null
          ? "Ninguém vence"
          : `O lado ${sideLetter(ended.winnerSide)} vence`}
        <span class="lab-hint"> · {seconds.toFixed(1)} s</span>
      </h2>
      <div class="lab-table-wrap">
        <table>
          <thead>
            <tr>
              <th>participante</th>
              <th>desfecho</th>
              <th>HP</th>
              <th>dano dado</th>
              <th>recebido</th>
              <th>carga</th>
            </tr>
          </thead>
          <tbody>
            {ended.results.map((r) => (
              <tr key={r.participant.id}>
                <td style={{ color: sideColor(r.participant.side) }}>
                  {DNA_GLYPHS[r.participant.dna]} {r.participant.name} (
                  {sideLetter(r.participant.side)})
                </td>
                <td>{OUTCOME_LABELS[r.outcome]}</td>
                <td class="lab-num">
                  {r.hp} / {r.maxHp}
                </td>
                <td class="lab-num">{r.dealt}</td>
                <td class="lab-num">{r.taken}</td>
                <td class="lab-num">{r.carry.materia + r.carry.cristal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {left > 0 && <p class="lab-hint">Ficaram {left} no chão da arena.</p>}
      {hash !== null && (
        <p class="lab-hint lab-hash" title="sha256 do estado final">
          hash {hash.slice(0, 16)}…
        </p>
      )}
    </section>
  );
}
