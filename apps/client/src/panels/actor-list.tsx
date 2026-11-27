// The list of the actors under a click (R spec D23, plan P15): creeps,
// wanderers, deposits, cores, spoils and battles, each with its icon and its
// key reading; choosing a line selects it. Hovering a creep or a wanderer
// rings it on the map.

import {
  isOwnCreep,
  isOwnTeam,
  sideTeam,
  type Params,
  type TeamView,
} from "@geometrix/sim";
import type { ComponentChildren } from "preact";
import { useGame } from "../context.ts";
import { creepStatus, STATUS_TEXTS, viewCapacity } from "../creep-status.ts";
import { DNA_NAMES, RESOURCE_NAMES, stockText, teamName } from "../format.ts";
import { COLORS, teamColor } from "../map/colors.ts";
import { hpPoints } from "../map/combat-marks.ts";
import { inSight } from "../map/fog.ts";
import type { Selection } from "../map/pick.ts";
import { DnaIcon } from "./dna-icon.tsx";

const WIDTH = 300;

/** A line of the list: what the actor is, and its key reading. */
export type ActorLine = { name: string; kind: string; reading: string };

/** Null for an actor the view no longer has. */
export function actorLine(
  actor: Selection,
  state: TeamView,
  params: Params,
  viewer: { playerId: number; team: number },
  mapWidth: number,
): ActorLine | null {
  switch (actor.kind) {
    case "creep": {
      const creep = state.creeps.find((c) => c.id === actor.id);
      if (creep === undefined) return null;
      const max = viewCapacity(creep, state.teams[creep.team], params);
      const status = creepStatus(creep, state.deposits);
      const dominatedBy = isOwnCreep(creep) ? creep.dominatedBy : null;
      const team =
        creep.team === viewer.team ? "" : ` · ${teamName(creep.team)}`;
      const who =
        dominatedBy === viewer.playerId
          ? " · você"
          : dominatedBy !== null
            ? " · dominado"
            : "";
      return {
        name: creep.name,
        kind: `${DNA_NAMES[creep.dna]} · #${creep.id}${team}`,
        reading:
          `${status === null ? "" : `${STATUS_TEXTS[status]} · `}` +
          `HP ${hpPoints(creep.hp)} · carga ` +
          `${creep.cargo.materia + creep.cargo.cristal}/${max}${who}`,
      };
    }
    case "wanderer": {
      const w = state.wanderers.find((w) => w.id === actor.id);
      if (w === undefined) return null;
      const load = w.cargo.materia + w.cargo.cristal;
      return {
        name: w.name,
        kind: "andarilho",
        reading:
          `HP ${hpPoints(w.hp)} · ` +
          (load === 0 ? "vazio" : `leva ${stockText(w.cargo)}`) +
          (w.battle === null ? "" : " · em batalha"),
      };
    }
    case "deposit": {
      const d = state.deposits.find((d) => d.id === actor.id);
      if (d === undefined) return null;
      const seen = inSight(state, d, mapWidth) ? "" : " · último valor visto";
      return {
        name: `Depósito de ${RESOURCE_NAMES[d.kind]}`,
        kind: `#${d.id}`,
        reading: `restam ${d.amount} de ${params.deposits[d.kind].amount}${seen}`,
      };
    }
    case "core": {
      const team = state.teams[actor.team];
      if (team === undefined) return null;
      return {
        name: `Núcleo ${teamName(actor.team)}`,
        kind: actor.team === viewer.team ? "seu" : "inimigo",
        reading:
          actor.team === viewer.team && isOwnTeam(team)
            ? `estoque ${stockText(team.stock)}`
            : "estoque escondido",
      };
    }
    case "spoil": {
      const spoil = state.spoils.find((s) => s.id === actor.id);
      if (spoil === undefined) return null;
      return {
        name: "Despojo",
        kind: `#${spoil.id}`,
        reading: stockText(spoil.cargo),
      };
    }
    case "battle": {
      const battle = state.battles.find((b) => b.id === actor.id);
      if (battle === undefined) return null;
      const sides = battle.sides.map((s) => teamName(sideTeam(s)));
      return {
        name: "Batalha",
        kind: sides.join(" × "),
        reading: `${battle.participants.length} participantes`,
      };
    }
  }
}

export function ActorList() {
  const { store, viewer } = useGame();
  const list = store.list.value;
  const state = store.current.value?.state;
  const params = store.info.value?.params;
  const width = store.info.value?.map.width ?? 0;
  if (list === null || state === undefined || params === undefined) {
    return null;
  }
  const lines = list.actors.flatMap((actor) => {
    const line = actorLine(actor, state, params, viewer, width);
    return line === null ? [] : [{ actor, line }];
  });
  const size = store.mapSize.value;
  const close = () => {
    store.list.value = null;
    store.hovered.value = null;
  };
  const left = Math.max(8, Math.min(list.at.x + 12, size.width - WIDTH - 8));
  const top = Math.max(8, Math.min(list.at.y - 12, size.height - 220));
  return (
    <div
      class="stack-list panel"
      style={{ left: `${left}px`, top: `${top}px`, width: `${WIDTH}px` }}
      role="listbox"
      aria-label="O que está sob o clique"
      onMouseLeave={() => (store.hovered.value = null)}
    >
      <div class="stack-head">
        <strong>Aqui há {lines.length}</strong>
        <button class="ghost" title="Fechar (Esc)" onClick={close}>
          ×
        </button>
      </div>
      <ul>
        {lines.map(({ actor, line }) => (
          <li key={keyOf(actor)}>
            <button
              class="stack-row"
              role="option"
              onMouseEnter={() =>
                (store.hovered.value =
                  actor.kind === "creep" || actor.kind === "wanderer"
                    ? actor.id
                    : null)
              }
              onClick={() => {
                close();
                if (list.pick !== undefined) list.pick(actor);
                else store.selection.value = actor;
              }}
            >
              <ActorIcon actor={actor} state={state} />
              <span class="stack-name">
                <strong>{line.name}</strong>{" "}
                <span class="muted small">{line.kind}</span>
              </span>
              <span class="muted small">{line.reading}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const keyOf = (actor: Selection) =>
  actor.kind === "core" ? `core${actor.team}` : `${actor.kind}${actor.id}`;

/** A small drawing of each kind of actor, as the map has it. */
function ActorIcon({ actor, state }: { actor: Selection; state: TeamView }) {
  const svg = (children: ComponentChildren) => (
    <svg class="icon" viewBox="0 0 1 1" width="16" height="16">
      {children}
    </svg>
  );
  switch (actor.kind) {
    case "creep": {
      const creep = state.creeps.find((c) => c.id === actor.id)!;
      return <DnaIcon dna={creep.dna} team={creep.team} size={16} />;
    }
    case "wanderer":
      return <DnaIcon dna="circle" team={null} size={16} />;
    case "deposit": {
      const kind = state.deposits.find((d) => d.id === actor.id)!.kind;
      return svg(
        <polygon
          points={
            kind === "materia"
              ? "0.08,0.5 0.29,0.14 0.71,0.14 0.92,0.5 0.71,0.86 0.29,0.86"
              : "0.5,0.06 0.94,0.5 0.5,0.94 0.06,0.5"
          }
          fill={COLORS[kind]}
        />,
      );
    }
    case "core":
      return svg(
        <polygon
          points="0.31,0.06 0.69,0.06 0.94,0.31 0.94,0.69 0.69,0.94 0.31,0.94 0.06,0.69 0.06,0.31"
          fill="none"
          stroke={teamColor(actor.team)}
          stroke-width="0.12"
        />,
      );
    case "spoil":
      return svg(
        <polygon
          points="0.5,0.18 0.82,0.5 0.5,0.82 0.18,0.5"
          fill={COLORS.materia}
        />,
      );
    case "battle":
      return svg(
        <g stroke={COLORS.fight} stroke-width="0.14" stroke-linecap="round">
          <line x1="0.2" y1="0.2" x2="0.8" y2="0.8" />
          <line x1="0.2" y1="0.8" x2="0.8" y2="0.2" />
        </g>,
      );
  }
}
