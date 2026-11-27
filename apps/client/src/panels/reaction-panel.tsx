// The reaction panel (M2 encontro spec C-5, plan section 9; junction D1):
// opens while the creep this player dominates is in an extortion's dialogue.
// As the victim: the demand, pay or refuse, and the world seconds left in the
// window (D6). As the aggressor: who it waits for. An attack has no dialogue:
// it opens the battle at once.

import { useGame } from "../context.ts";
import { canDrop, reactionOf } from "../encounter-actions.ts";
import { REPLY_TEXTS, stockText } from "../format.ts";
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
  const victim = side === "victim";
  const headline = victim
    ? `${otherName} exige carga de ${mine.name}`
    : `${mine.name} abordou ${otherName}`;
  return (
    <div
      class="reaction-panel panel is-dialogue"
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
        {victim
          ? `Exigência: ${stockText(encounter.demand)}. Pagar dá salvo-conduto contra o time dele; recusar abre a batalha. Largar a carga também recusa.`
          : `Esperando a resposta de ${otherName}.`}
        {victim && seconds !== null && (
          <span class="muted"> Sem resposta, valem as regras do piloto.</span>
        )}
      </p>
      {choices.length > 0 && (
        <div class="reaction-buttons">
          {choices.map((choice) => (
            <button
              key={choice}
              class={sent === choice ? "active" : "primary"}
              disabled={!canAct || sent !== null}
              onClick={() =>
                void send({ type: "react", creepId: mine.id, choice })
              }
            >
              {REPLY_TEXTS[choice]}
            </button>
          ))}
          <button
            disabled={!canAct || sent !== null || !canDrop(state, mine)}
            title="Recusa a exigência: a carga fica no chão e a batalha abre com você vazio"
            onClick={() =>
              void send({
                type: "order",
                creepId: mine.id,
                order: { type: "drop" },
              })
            }
          >
            Largar carga
          </button>
        </div>
      )}
      {sent !== null && (
        <p class="hint muted">Resposta enviada: {REPLY_TEXTS[sent]}.</p>
      )}
    </div>
  );
}
