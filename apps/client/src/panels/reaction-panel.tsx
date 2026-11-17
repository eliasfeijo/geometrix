// The reaction panel (M2 encontro spec C-5, plan section 9): opens while the
// creep this player dominates is in an encounter. As the victim of a
// dialogue: the intent, the demand of an extortion, the answers and the world
// seconds left in the window (D6). In a fight: the rounds and "flee", for
// either side. As the aggressor of a dialogue: who it waits for.

import { useGame } from "../context.ts";
import { reactionOf } from "../encounter-actions.ts";
import { REPLY_TEXTS, stockText } from "../format.ts";
import { hpPoints } from "../map/combat-marks.ts";
import { DnaIcon } from "./dna-icon.tsx";

export function ReactionPanel() {
  const { store, send } = useGame();
  const state = store.current.value?.state;
  const params = store.info.value?.params;
  const mine = store.myCreep.value;
  if (state === undefined || params === undefined || mine === null) {
    return null;
  }
  const reaction = reactionOf(state, params, mine);
  if (reaction === null) return null;
  const { encounter, side, other, choices, sent, seconds } = reaction;
  const canAct = store.canAct.value;
  const otherName = other?.name ?? "o outro creep";
  const fight = encounter.stage === "fight";
  const headline = fight
    ? `${mine.name} luta contra ${otherName}`
    : side === "victim"
      ? encounter.intent === "attack"
        ? `${otherName} vai atacar ${mine.name}`
        : `${otherName} exige carga de ${mine.name}`
      : `${mine.name} abordou ${otherName}`;
  return (
    <div
      class={`reaction-panel panel ${fight ? "is-fight" : "is-dialogue"}`}
      role="alertdialog"
      aria-label="Encontro"
    >
      <div class="reaction-head">
        {other !== null && (
          <DnaIcon dna={other.dna} team={other.team} size={20} />
        )}
        <strong>{headline}</strong>
        {seconds !== null && (
          <span class="reaction-timer" title="Segundos de mundo para responder">
            {seconds} s
          </span>
        )}
      </div>
      <p class="reaction-detail">
        {fight
          ? `Rodada ${encounter.rounds}. HP: ${mine.name} ${hpPoints(mine.hp)}` +
            (other === null ? "" : ` · ${other.name} ${hpPoints(other.hp)}`)
          : side === "victim"
            ? encounter.intent === "extort" && encounter.demand !== null
              ? `Exigência: ${stockText(encounter.demand)}. Pagar dá salvo-conduto contra o time dele.`
              : "Lute ou tente fugir. Fugindo, ele larga parte da carga se escapar."
            : `Esperando a resposta de ${otherName}.`}
        {!fight && side === "victim" && seconds !== null && (
          <span class="muted"> Sem resposta, valem as regras do piloto.</span>
        )}
      </p>
      {choices.length > 0 && (
        <div class="reaction-buttons">
          {choices.map((choice) => (
            <button
              key={choice}
              class={
                sent === choice
                  ? "active"
                  : choice === "flee"
                    ? undefined
                    : "primary"
              }
              disabled={!canAct || sent !== null}
              onClick={() =>
                void send({ type: "react", creepId: mine.id, choice })
              }
            >
              {REPLY_TEXTS[choice]}
            </button>
          ))}
        </div>
      )}
      {sent !== null && (
        <p class="hint muted">Resposta enviada: {REPLY_TEXTS[sent]}.</p>
      )}
    </div>
  );
}
