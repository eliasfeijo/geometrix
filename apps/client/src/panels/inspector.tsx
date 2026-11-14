// The selection panel (spec C-2): a creep's DNA, cargo, order, rules and who
// dominates it, with dominate / release; a deposit's amount; a core's panel.

import {
  capacity,
  isOwnCreep,
  isOwnTeam,
  type Deposit,
  type ForeignCreepView,
} from "@geometrix/sim";
import { useGame } from "../context.ts";
import { toggleRoadMode } from "../interaction.ts";
import { cellmates } from "../map/pick.ts";
import { creepName } from "../names.ts";
import { creepStatus, STATUS_TEXTS, viewCapacity } from "../creep-status.ts";
import {
  DNA_NAMES,
  durationWords,
  orderText,
  RESOURCE_NAMES,
  teamName,
} from "../format.ts";
import { COLORS } from "../map/colors.ts";
import { CorePanel } from "./core-panel.tsx";
import { DnaIcon } from "./dna-icon.tsx";
import { RulesEditor } from "./rules-editor.tsx";

export function Inspector() {
  const { store, viewer } = useGame();
  const selection = store.selection.value;
  // The own core has its panel docked on the left.
  if (
    selection === null ||
    (selection.kind === "core" && selection.team === viewer.team)
  ) {
    return null;
  }
  const close = () => (store.selection.value = null);
  return (
    <aside class="side-panel panel" aria-label="Seleção">
      <button class="ghost close" title="Fechar (Esc)" onClick={close}>
        ×
      </button>
      {selection.kind === "creep" && <CreepInspector id={selection.id} />}
      {selection.kind === "deposit" && <DepositInspector id={selection.id} />}
      {selection.kind === "core" && <CorePanel team={selection.team} />}
    </aside>
  );
}

function CreepInspector({ id }: { id: number }) {
  const { store, viewer, send } = useGame();
  const state = store.current.value?.state;
  const params = store.info.value?.params;
  const creep = state?.creeps.find((c) => c.id === id);
  if (state === undefined || params === undefined || creep === undefined) {
    return <p class="muted">Esse creep não existe mais.</p>;
  }
  const team = state.teams[creep.team];
  if (team === undefined || !isOwnCreep(creep) || !isOwnTeam(team)) {
    return <ForeignCreepInspector creep={creep} />;
  }
  const max = capacity(creep, team, params);
  const own = creep.team === viewer.team;
  const mine = creep.dominatedBy === viewer.playerId;
  const canAct = store.canAct.value;
  const status = creepStatus(creep, state.deposits) ?? "idle";
  const roadMode = store.mode.value.type === "road";
  return (
    <div class={`inspector team-${creep.team}`}>
      <h2 class="title creep-title">
        <DnaIcon dna={creep.dna} team={creep.team} />
        <span>
          {creepName(state.creeps, creep.id)}
          <span class="subtitle muted">
            {DNA_NAMES[creep.dna]} · #{creep.id}
          </span>
        </span>
        <span class="team-name">{teamName(creep.team)}</span>
      </h2>
      <Cellmates id={creep.id} />
      <dl class="facts">
        <dt>Estado</dt>
        <dd class={status === "waiting" ? "waiting" : undefined}>
          {STATUS_TEXTS[status]}
        </dd>
        <dt>Ordem</dt>
        <dd>{orderText(creep.order, state.deposits)}</dd>
        <dt>Carga</dt>
        <dd>
          <CargoBar
            materia={creep.cargo.materia}
            cristal={creep.cargo.cristal}
            max={max}
          />
        </dd>
        <dt>Posição</dt>
        <dd>
          ({creep.x}, {creep.y})
        </dd>
        <dt>Domínio</dt>
        <dd>
          {creep.dominatedBy === null
            ? "livre (piloto automático)"
            : mine
              ? "você"
              : (store.names.value.get(creep.dominatedBy) ??
                `jogador #${creep.dominatedBy}`)}
        </dd>
      </dl>
      {own && (
        <div class="actions">
          {mine ? (
            <button
              disabled={!canAct}
              onClick={() => void send({ type: "release" })}
            >
              Liberar
            </button>
          ) : (
            <button
              class="primary"
              disabled={!canAct || creep.dominatedBy !== null}
              onClick={() => void send({ type: "dominate", creepId: creep.id })}
            >
              Dominar
            </button>
          )}
          {mine && (
            <>
              <button
                disabled={!canAct}
                onClick={() =>
                  void send({
                    type: "order",
                    creepId: creep.id,
                    order: { type: "stop" },
                  })
                }
              >
                Parar
              </button>
              <button
                disabled={!canAct}
                onClick={() =>
                  void send({
                    type: "order",
                    creepId: creep.id,
                    order: { type: "deliver" },
                  })
                }
              >
                Entregar
              </button>
              <button
                class={roadMode ? "active" : undefined}
                disabled={!canAct}
                title="Tecla R"
                onClick={() => toggleRoadMode(store)}
              >
                Modo estrada (R)
              </button>
              <p class="hint muted">
                Botão direito no mapa: ir até a célula · num depósito, coletar ·
                no seu Núcleo, entregar.
              </p>
            </>
          )}
        </div>
      )}
      <h3>Piloto automático</h3>
      {mine && (
        <p class="hint muted">
          Dominado: as regras só voltam a valer quando você liberar.
        </p>
      )}
      <RulesEditor key={creep.id} creep={creep} />
    </div>
  );
}

/**
 * Another team's creep: what the view has of it (M1.5 fog spec D7). Its
 * team's upgrades are hidden, so the cargo shows the DNA's base capacity.
 */
function ForeignCreepInspector({ creep }: { creep: ForeignCreepView }) {
  const { store } = useGame();
  const state = store.current.value?.state;
  const params = store.info.value?.params;
  if (state === undefined || params === undefined) return null;
  const max = viewCapacity(creep, state.teams[creep.team], params);
  return (
    <div class={`inspector team-${creep.team}`}>
      <h2 class="title creep-title">
        <DnaIcon dna={creep.dna} team={creep.team} />
        <span>
          {creepName(state.creeps, creep.id)}
          <span class="subtitle muted">
            {DNA_NAMES[creep.dna]} · #{creep.id}
          </span>
        </span>
        <span class="team-name">{teamName(creep.team)}</span>
      </h2>
      <Cellmates id={creep.id} />
      <dl class="facts">
        <dt>Carga</dt>
        <dd>
          <CargoBar
            materia={creep.cargo.materia}
            cristal={creep.cargo.cristal}
            max={max}
          />
        </dd>
        <dt>Posição</dt>
        <dd>
          ({creep.x}, {creep.y})
        </dd>
      </dl>
      <p class="hint muted">
        Ordem, regras e domínio de um creep de outro time ficam escondidos.
      </p>
    </div>
  );
}

/** Other creeps on the same cell: step through them without the map. */
function Cellmates({ id }: { id: number }) {
  const { store } = useGame();
  const creeps = store.current.value?.state.creeps ?? [];
  const ids = cellmates(creeps, id);
  if (ids.length < 2) return null;
  const i = ids.indexOf(id);
  const go = (delta: number) => {
    const next = ids[(i + delta + ids.length) % ids.length]!;
    store.selection.value = { kind: "creep", id: next };
  };
  return (
    <div class="cellmates">
      <span class="muted">Nesta célula:</span>
      <button class="ghost" title="Anterior" onClick={() => go(-1)}>
        ◀
      </button>
      <span>
        {i + 1}/{ids.length}
      </span>
      <button class="ghost" title="Próximo" onClick={() => go(1)}>
        ▶
      </button>
    </div>
  );
}

export function CargoBar(props: {
  materia: number;
  cristal: number;
  max: number;
}) {
  const { materia, cristal, max } = props;
  const pct = (v: number) => `${Math.min((100 * v) / Math.max(max, 1), 100)}%`;
  return (
    <span class="cargo">
      <span class="bar">
        <span style={{ width: pct(materia), background: COLORS.materia }} />
        <span style={{ width: pct(cristal), background: COLORS.cristal }} />
      </span>
      <span class="cargo-text">
        {materia + cristal}/{max}
        {materia > 0 && cristal > 0 && (
          <span class="muted">
            {" "}
            ({materia} m · {cristal} c)
          </span>
        )}
        {materia + cristal >= max && <span class="cargo-full"> cheia</span>}
      </span>
    </span>
  );
}

function DepositInspector({ id }: { id: number }) {
  const { store } = useGame();
  const state = store.current.value?.state;
  const params = store.info.value?.params;
  const deposit = state?.deposits.find((d) => d.id === id);
  if (state === undefined || params === undefined || deposit === undefined) {
    return <p class="muted">Esse depósito não existe.</p>;
  }
  const full = params.deposits[deposit.kind].amount;
  const regen = params.deposits.materia.regen;
  // Only the own creeps' orders are in the view (spec D7).
  const heading = (team: number) =>
    state.creeps.filter(
      (c) =>
        c.team === team &&
        isOwnCreep(c) &&
        c.order.type === "gather" &&
        c.order.depositId === deposit.id,
    ).length;
  return (
    <div class="inspector">
      <h2 class="title">
        <DepositIcon deposit={deposit} />
        Depósito de {RESOURCE_NAMES[deposit.kind]} #{deposit.id}
      </h2>
      <dl class="facts">
        <dt>Quantidade</dt>
        <dd>
          {deposit.amount}/{full}
        </dd>
        <dt>Regeneração</dt>
        <dd>
          {deposit.kind === "materia" && regen.amount > 0
            ? `+${regen.amount} a cada ${durationWords(regen.everySeconds)}, até ${full}`
            : deposit.amount === 0
              ? "esgotado para sempre"
              : "não regenera"}
        </dd>
        <dt>Posição</dt>
        <dd>
          ({deposit.x}, {deposit.y})
        </dd>
        <dt>Coletando aqui</dt>
        <dd>
          {state.teams.filter(isOwnTeam).map((team) => (
            <span key={team.id} class={`team-${team.id} team-count`}>
              <span class="team-name">{teamName(team.id)}</span>{" "}
              {heading(team.id)}
            </span>
          ))}
        </dd>
      </dl>
    </div>
  );
}

function DepositIcon({ deposit }: { deposit: Deposit }) {
  const color =
    deposit.amount === 0 && deposit.kind === "cristal"
      ? COLORS.depleted
      : COLORS[deposit.kind];
  return (
    <svg class="icon" viewBox="0 0 1 1" width="18" height="18">
      {deposit.kind === "materia" ? (
        <polygon
          points="0.08,0.5 0.29,0.14 0.71,0.14 0.92,0.5 0.71,0.86 0.29,0.86"
          fill={color}
        />
      ) : (
        <polygon points="0.5,0.06 0.94,0.5 0.5,0.94 0.06,0.5" fill={color} />
      )}
    </svg>
  );
}
