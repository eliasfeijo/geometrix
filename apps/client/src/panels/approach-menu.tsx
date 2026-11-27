// The right-click menu over an enemy in sight (M2 encontro spec C-6, plan
// section 9): attack, or extort with the demand shown before confirming.
// Opens at the click; one row per enemy hit (a stack can have several). A
// wanderer can only be attacked (junction W-4).

import { stockTotal, type Cell, type OrderInput } from "@geometrix/sim";
import { useGame } from "../context.ts";
import { approachOptions } from "../encounter-actions.ts";
import { DNA_NAMES, stockText, teamName } from "../format.ts";
import { hpPoints } from "../map/combat-marks.ts";
import { DnaIcon } from "./dna-icon.tsx";

const WIDTH = 300;

/** The button for the order a right click gives on the cell. */
export function cellOrderText(order: OrderInput): string {
  switch (order.type) {
    case "gather":
      return "Coletar aqui";
    case "pickup":
      return "Catar aqui";
    case "deliver":
      return "Entregar no Núcleo";
    default:
      return "Ir até aqui";
  }
}

export function ApproachMenu() {
  const { store, send } = useGame();
  const menu = store.approach.value;
  const state = store.current.value?.state;
  const params = store.info.value?.params;
  const mine = store.myCreep.value;
  if (menu === null || state === undefined || params === undefined) {
    return null;
  }
  const close = () => (store.approach.value = null);
  if (mine === null) return null;
  const options = approachOptions(state, params, mine, menu.ids);
  const allies = state.creeps.filter((c) => menu.allies.includes(c.id));
  if (options.length === 0 && allies.length === 0) return null;
  const size = store.mapSize.value;
  const left = Math.max(8, Math.min(menu.at.x + 12, size.width - WIDTH - 8));
  const top = Math.max(8, Math.min(menu.at.y - 12, size.height - 180));
  const canAct = store.canAct.value;
  const give = (order: OrderInput, ping: Cell | null) => {
    close();
    store.ping.value = ping === null ? null : { cell: ping, id: Date.now() };
    void send({ type: "order", creepId: mine.id, order });
  };
  const approach = (targetId: number, intent: "attack" | "extort") => {
    close();
    store.ping.value = null;
    void send({
      type: "order",
      creepId: mine.id,
      order: { type: "approach", targetId, intent },
    });
  };
  return (
    <div
      class="approach-menu panel"
      style={{ left: `${left}px`, top: `${top}px`, width: `${WIDTH}px` }}
      role="menu"
      aria-label="Ordens sobre creeps"
    >
      <div class="stack-head">
        <strong>
          {allies.length === 0 ? "Abordar" : "Ordens"} com {mine.name}
        </strong>
        <button class="ghost" title="Fechar (Esc)" onClick={close}>
          ×
        </button>
      </div>
      <ul>
        {options.map((option) => {
          if (option.kind === "wanderer") {
            const { target } = option;
            const load = stockTotal(target.cargo);
            return (
              <li key={target.id} class="approach-row wanderer">
                <div class="approach-target">
                  <DnaIcon dna={target.dna} team={null} size={16} />
                  <strong>{target.name}</strong>
                  <span class="muted small">
                    andarilho · HP {hpPoints(target.hp)} ·{" "}
                    {load === 0 ? "vazio" : `leva ${stockText(target.cargo)}`}
                    {target.battle !== null && " · em batalha"}
                  </span>
                </div>
                <div class="approach-buttons">
                  <button
                    class="danger"
                    role="menuitem"
                    disabled={!canAct}
                    onClick={() => approach(target.id, "attack")}
                  >
                    Atacar
                  </button>
                  <button
                    role="menuitem"
                    disabled
                    title="Um andarilho não paga: só se luta com ele."
                  >
                    Extorquir (não negocia)
                  </button>
                </div>
              </li>
            );
          }
          const { target, demand } = option;
          const total = stockTotal(demand);
          return (
            <li key={target.id} class={`approach-row team-${target.team}`}>
              <div class="approach-target">
                <DnaIcon dna={target.dna} team={target.team} size={16} />
                <strong>{target.name}</strong>
                <span class="muted small">
                  {DNA_NAMES[target.dna]} · {teamName(target.team)} · HP{" "}
                  {hpPoints(target.hp)}
                  {target.engagement !== null && " · num encontro"}
                </span>
              </div>
              <div class="approach-buttons">
                <button
                  class="danger"
                  role="menuitem"
                  disabled={!canAct}
                  onClick={() => approach(target.id, "attack")}
                >
                  Atacar
                </button>
                <button
                  role="menuitem"
                  disabled={!canAct || total === 0}
                  title={
                    total === 0
                      ? stockTotal(target.cargo) === 0
                        ? "Ele está vazio: não há o que exigir."
                        : "Sua carga está cheia: não cabe nada."
                      : undefined
                  }
                  onClick={() => approach(target.id, "extort")}
                >
                  {total === 0
                    ? "Extorquir (nada a exigir)"
                    : `Extorquir (exige ${stockText(demand)})`}
                </button>
              </div>
            </li>
          );
        })}
        {allies.map((ally) => (
          <li key={ally.id} class={`approach-row team-${ally.team}`}>
            <div class="approach-target">
              <DnaIcon dna={ally.dna} team={ally.team} size={16} />
              <strong>{ally.name}</strong>
              <span class="muted small">
                {DNA_NAMES[ally.dna]} · HP {hpPoints(ally.hp)}
              </span>
            </div>
            <div class="approach-buttons">
              <button
                class="primary"
                role="menuitem"
                disabled={!canAct}
                title="Andar junto e entrar nas lutas dele"
                onClick={() =>
                  give({ type: "follow", targetId: ally.id }, null)
                }
              >
                Seguir
              </button>
            </div>
          </li>
        ))}
      </ul>
      {menu.cell !== null && (
        <div class="approach-cell">
          <button
            role="menuitem"
            disabled={!canAct}
            onClick={() => give(menu.cell!.order, menu.cell!.cell)}
          >
            {cellOrderText(menu.cell.order)}
          </button>
        </div>
      )}
    </div>
  );
}
