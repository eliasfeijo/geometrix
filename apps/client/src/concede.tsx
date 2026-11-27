// "Desistir" and the team's vote (E-min spec D3, L-5 to L-7, S-5; plan
// section 7). The button counts down to the minimum time; only the
// confirmation sends `concede`. In a team with two or more humans it opens the
// vote, shown to the whole team with who said yes and the time left.

import { isOwnTeam } from "@geometrix/sim";
import { useEffect, useRef, useState } from "preact/hooks";
import { useGame } from "./context.ts";
import { duration, teamName } from "./format.ts";
import { concession, type Concession } from "./match-end.ts";

function useConcession(): Concession {
  const { store, viewer } = useGame();
  const state = store.current.value?.state;
  const info = store.info.value;
  if (state === undefined || info === null) return { kind: "hidden" };
  return concession(state, viewer.playerId, info.params, info.multiplier);
}

export function ConcedeButton() {
  const { store, viewer } = useGame();
  const [asking, setAsking] = useState(false);
  const status = useConcession();
  // The vote has its own panel; the button comes back when it closes.
  if (status.kind === "hidden" || status.kind === "vote") return null;
  const waiting = status.kind !== "ready";
  const state = store.current.value?.state;
  const others = state?.teams.filter(
    (t) => t.id !== viewer.team && t.out === null,
  ).length;
  return (
    <>
      <button
        class="concede"
        disabled={waiting || !store.canAct.value}
        title={
          status.kind === "tooEarly"
            ? "Só dá para desistir depois de um tempo mínimo de partida."
            : status.kind === "cooldown"
              ? "A última votação foi rejeitada: espere para abrir outra."
              : "Desistir da partida"
        }
        onClick={() => setAsking(true)}
      >
        {waiting ? `Desistir em ${duration(status.seconds)}` : "Desistir"}
      </button>
      {asking && status.kind === "ready" && (
        <ConfirmConcede
          team={viewer.team}
          othersLeft={others ?? 0}
          opensVote={status.opensVote}
          onClose={() => setAsking(false)}
        />
      )}
    </>
  );
}

function ConfirmConcede(props: {
  team: number;
  /** The other teams still in the match. */
  othersLeft: number;
  opensVote: boolean;
  onClose(): void;
}) {
  const { send } = useGame();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    // The safe answer has the focus.
    cancel.current?.focus();
  }, []);
  const loses = `o time ${teamName(props.team)} perde`;
  const after =
    props.othersLeft > 1
      ? `${loses} e o mundo continua para os outros.`
      : `${loses} e a partida acaba.`;
  return (
    <dialog
      ref={dialog}
      class="concede-dialog panel"
      onCancel={props.onClose}
      // The map's and the battle's keys stay out of the dialog.
      onKeyDown={(e) => e.stopPropagation()}
    >
      <h2>Desistir da partida?</h2>
      <p>
        {props.opensVote
          ? `Isto abre uma votação no seu time. Se ela passar, ${after} Quem não votar até o fim do prazo conta como sim.`
          : `Se confirmar, ${after}`}
      </p>
      <div class="dialog-actions">
        <button ref={cancel} type="button" onClick={props.onClose}>
          Cancelar
        </button>
        <button
          type="button"
          class="danger"
          onClick={() => {
            props.onClose();
            void send({ type: "concede" });
          }}
        >
          Desistir
        </button>
      </div>
    </dialog>
  );
}

/** The team's open vote, over the map and the battle screen (S-5). */
export function ConcedeVotePanel() {
  const { store, viewer, send } = useGame();
  const status = useConcession();
  if (status.kind !== "vote") return null;
  const names = store.names.value;
  const state = store.current.value?.state;
  const team = state?.teams[viewer.team];
  if (team === undefined || !isOwnTeam(team)) return null;
  const canAct = store.canAct.value;
  return (
    <section class="concede-vote panel" aria-label="Votação para desistir">
      <strong>Votação para desistir · {duration(status.seconds)}</strong>
      <span>
        Sim:{" "}
        {status.yes.map((id) => names.get(id) ?? `Jogador ${id}`).join(", ")}
      </span>
      <span class="muted small">
        Quem não votar até o fim do prazo conta como sim.
      </span>
      <div class="dialog-actions">
        {status.mine ? (
          <button
            disabled={!canAct}
            title="Encerra a votação"
            onClick={() => void send({ type: "rejectConcede" })}
          >
            Retirar o meu sim
          </button>
        ) : (
          <>
            <button
              class="danger"
              disabled={!canAct}
              onClick={() => void send({ type: "concede" })}
            >
              Sim
            </button>
            <button
              disabled={!canAct}
              title="Um não encerra a votação"
              onClick={() => void send({ type: "rejectConcede" })}
            >
              Não
            </button>
          </>
        )}
      </div>
    </section>
  );
}
