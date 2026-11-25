// The result of a battle (spec F-3, L-8): how each participant ended, with
// its HP, the damage dealt and taken and the load it left with; and what
// stayed on the ground.

import type { BattleEvent } from "@geometrix/battle";
import { LAB_SIDES, type SideStyle } from "./arena-view.tsx";
import { DNA_GLYPHS, OUTCOME_LABELS } from "./labels.ts";

type EndedEvent = Extract<BattleEvent, { type: "ended" }>;

type Props = {
  ended: EndedEvent;
  seconds: number;
  hash: string | null;
  /** The sides' colors and names; the lab's by default. */
  sides?: SideStyle;
};

export function ResultTable({
  ended,
  seconds,
  hash,
  sides = LAB_SIDES,
}: Props) {
  const left = ended.piles.reduce((n, p) => n + p.materia + p.cristal, 0);
  return (
    <section class="battle-panel battle-result">
      <h2>
        {ended.winnerSide === null
          ? "Ninguém vence"
          : capitalized(`${sides.name(ended.winnerSide)} vence`)}
        <span class="battle-hint"> · {seconds.toFixed(1)} s</span>
      </h2>
      <div class="battle-table-wrap">
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
                <td style={{ color: sides.color(r.participant.side) }}>
                  {DNA_GLYPHS[r.participant.dna]} {r.participant.name} (
                  {sides.tag(r.participant.side)})
                </td>
                <td>{OUTCOME_LABELS[r.outcome]}</td>
                <td class="battle-num">
                  {r.hp} / {r.maxHp}
                </td>
                <td class="battle-num">{r.dealt}</td>
                <td class="battle-num">{r.taken}</td>
                <td class="battle-num">{r.carry.materia + r.carry.cristal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {left > 0 && <p class="battle-hint">Ficaram {left} no chão da arena.</p>}
      {hash !== null && (
        <p class="battle-hint battle-hash" title="sha256 do estado final">
          hash {hash.slice(0, 16)}…
        </p>
      )}
    </section>
  );
}

const capitalized = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);
