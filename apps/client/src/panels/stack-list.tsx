// The creeps of a clicked stack, to choose one: each row says what tells
// them apart (DNA, team, status, cargo, who dominates it). Hovering a row
// highlights that creep on the map.

import { isOwnCreep } from "@geometrix/sim";
import { useGame } from "../context.ts";
import { creepStatus, STATUS_TEXTS, viewCapacity } from "../creep-status.ts";
import { DNA_NAMES, teamName } from "../format.ts";
import { creepName } from "../names.ts";
import { DnaIcon } from "./dna-icon.tsx";

const WIDTH = 280;

export function StackList() {
  const { store, viewer } = useGame();
  const stack = store.stack.value;
  const state = store.current.value?.state;
  const params = store.info.value?.params;
  if (stack === null || state === undefined || params === undefined) {
    return null;
  }
  const creeps = state.creeps.filter((c) => stack.ids.includes(c.id));
  const size = store.mapSize.value;
  const close = () => {
    store.stack.value = null;
    store.hovered.value = null;
  };
  const left = Math.max(8, Math.min(stack.at.x + 12, size.width - WIDTH - 8));
  const top = Math.max(8, Math.min(stack.at.y - 12, size.height - 220));
  return (
    <div
      class="stack-list panel"
      style={{ left: `${left}px`, top: `${top}px`, width: `${WIDTH}px` }}
      role="listbox"
      aria-label="Creeps nesta célula"
      onMouseLeave={() => (store.hovered.value = null)}
    >
      <div class="stack-head">
        <strong>{creeps.length} creeps nesta célula</strong>
        <button class="ghost" title="Fechar (Esc)" onClick={close}>
          ×
        </button>
      </div>
      <ul>
        {creeps.map((creep) => {
          const max = viewCapacity(creep, state.teams[creep.team], params);
          const status = creepStatus(creep, state.deposits);
          const dominatedBy = isOwnCreep(creep) ? creep.dominatedBy : null;
          return (
            <li key={creep.id}>
              <button
                class={`stack-row team-${creep.team}`}
                role="option"
                onMouseEnter={() => (store.hovered.value = creep.id)}
                onClick={() => {
                  store.selection.value = { kind: "creep", id: creep.id };
                  close();
                }}
              >
                <DnaIcon dna={creep.dna} team={creep.team} size={16} />
                <span class="stack-name">
                  <strong>{creepName(state.creeps, creep.id)}</strong>{" "}
                  <span class="muted small">
                    {DNA_NAMES[creep.dna]} · #{creep.id}
                  </span>
                  {creep.team !== viewer.team && (
                    <span class="team-name"> {teamName(creep.team)}</span>
                  )}
                </span>
                <span class="muted small">
                  {status === null ? "" : `${STATUS_TEXTS[status]} · `}
                  {creep.cargo.materia + creep.cargo.cristal}/{max}
                  {dominatedBy === viewer.playerId
                    ? " · você"
                    : dominatedBy !== null
                      ? " · dominado"
                      : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
