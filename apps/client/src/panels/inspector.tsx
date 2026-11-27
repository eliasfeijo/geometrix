// The selection panel (spec C-2): a creep's DNA, cargo, order, rules and who
// dominates it, with dominate / release; a deposit's amount; a core's panel.

import {
  capacity,
  isOwnCreep,
  isOwnTeam,
  maxHp,
  type Deposit,
  type ForeignCreepView,
  type TeamView,
} from "@geometrix/sim";
import { useGame } from "../context.ts";
import { toggleRoadMode } from "../interaction.ts";
import { etaOf, etaText, viewMap } from "../map/destination.ts";
import { inSight } from "../map/fog.ts";
import { cellmates } from "../map/pick.ts";
import { creepStatus, STATUS_TEXTS, viewCapacity } from "../creep-status.ts";
import { engagementText, safeConductLeft } from "../encounter-actions.ts";
import { hpBand, hpPoints } from "../map/combat-marks.ts";
import {
  DNA_NAMES,
  duration,
  durationWords,
  namesOf,
  orderText,
  RESOURCE_NAMES,
  stockText,
  teamName,
} from "../format.ts";
import { COLORS } from "../map/colors.ts";
import { BattleInspector, WatchButton } from "./battle-inspector.tsx";
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
      {selection.kind === "battle" && <BattleInspector id={selection.id} />}
      {selection.kind === "wanderer" && <WandererInspector id={selection.id} />}
      {selection.kind === "spoil" && <SpoilInspector id={selection.id} />}
    </aside>
  );
}

function CreepInspector({ id }: { id: number }) {
  const { store, viewer, send, battles } = useGame();
  const state = store.current.value?.state;
  const params = store.info.value?.params;
  const creep = state?.creeps.find((c) => c.id === id);
  if (state === undefined || params === undefined || creep === undefined) {
    // An own creep the view lost died; another team's may also have left
    // the team's sight (the view cannot tell which).
    return (
      <p class="muted">
        {state !== undefined && state.team >= 0
          ? "Esse creep morreu ou saiu da visão do seu time."
          : "Esse creep não existe mais."}
      </p>
    );
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
  const engagement = engagementText(state, creep);
  // A replay plays at its own speed: no real time to estimate there.
  const info = store.info.value;
  const known = store.map.value;
  const eta =
    battles === undefined || info === null || known === null
      ? null
      : etaOf(
          creep,
          state,
          params,
          viewMap(known, state.roads),
          info.multiplier,
        );
  const safeConduct = safeConductLeft(creep.safeConduct, state.tick, params);
  return (
    <div class={`inspector team-${creep.team}`}>
      <h2 class="title creep-title">
        <DnaIcon dna={creep.dna} team={creep.team} />
        <span>
          {creep.name}
          <span class="subtitle muted">
            {DNA_NAMES[creep.dna]} · #{creep.id}
          </span>
        </span>
        <span class="team-name">{teamName(creep.team)}</span>
      </h2>
      <Cellmates id={creep.id} />
      <dl class="facts">
        <dt>HP</dt>
        <dd>
          <HpBar hp={creep.hp} full={maxHp(params, creep.dna)} />
        </dd>
        <dt>Estado</dt>
        <dd class={status === "waiting" ? "waiting" : undefined}>
          {STATUS_TEXTS[status]}
        </dd>
        {engagement !== null && (
          <>
            <dt>Encontro</dt>
            <dd class="engaged">
              {engagement}
              <BattleOf state={state} id={creep.battle} />
            </dd>
          </>
        )}
        <dt>Salvo-conduto</dt>
        <dd>
          {safeConduct === null
            ? "nenhum"
            : `contra o ${teamName(safeConduct.team)} por mais ${duration(safeConduct.seconds)}`}
        </dd>
        <dt>Ordem</dt>
        <dd>{orderText(creep.order, state.deposits, namesOf(state.creeps))}</dd>
        {eta !== null && (
          <>
            <dt>Previsão</dt>
            <dd title="Tempo real neste ×N; outros mudam o mundo no caminho">
              {etaText(eta)}
            </dd>
          </>
        )}
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
  const engagement = engagementText(state, creep);
  return (
    <div class={`inspector team-${creep.team}`}>
      <h2 class="title creep-title">
        <DnaIcon dna={creep.dna} team={creep.team} />
        <span>
          {creep.name}
          <span class="subtitle muted">
            {DNA_NAMES[creep.dna]} · #{creep.id}
          </span>
        </span>
        <span class="team-name">{teamName(creep.team)}</span>
      </h2>
      <Cellmates id={creep.id} />
      <dl class="facts">
        <dt>HP</dt>
        <dd>
          <HpBar hp={creep.hp} full={maxHp(params, creep.dna)} />
        </dd>
        {engagement !== null && (
          <>
            <dt>Encontro</dt>
            <dd class="engaged">
              {engagement}
              <BattleOf state={state} id={creep.battle} />
            </dd>
          </>
        )}
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
        {store.myCreep.value !== null &&
          " Botão direito nele: atacar ou extorquir."}
      </p>
    </div>
  );
}

/**
 * A wanderer (R spec D21): what any enemy creep shows, its destination hidden
 * like an enemy's.
 */
function WandererInspector({ id }: { id: number }) {
  const { store } = useGame();
  const state = store.current.value?.state;
  const params = store.info.value?.params;
  const wanderer = state?.wanderers.find((w) => w.id === id);
  if (state === undefined || params === undefined || wanderer === undefined) {
    return <p class="muted">Esse andarilho morreu ou saiu da visão.</p>;
  }
  return (
    <div class="inspector">
      <h2 class="title creep-title">
        <DnaIcon dna={wanderer.dna} team={null} />
        <span>
          {wanderer.name}
          <span class="subtitle muted">
            {DNA_NAMES[wanderer.dna]} · #{wanderer.id}
          </span>
        </span>
        <span class="team-name">andarilho</span>
      </h2>
      <dl class="facts">
        <dt>HP</dt>
        <dd>
          <HpBar hp={wanderer.hp} full={params.wanderers.hp * 1000} />
        </dd>
        {wanderer.battle !== null && (
          <>
            <dt>Encontro</dt>
            <dd class="engaged">
              em batalha
              <BattleOf state={state} id={wanderer.battle} />
            </dd>
          </>
        )}
        <dt>Carga</dt>
        <dd>
          <CargoBar
            materia={wanderer.cargo.materia}
            cristal={wanderer.cargo.cristal}
            max={params.dna.circle.capacity}
          />
        </dd>
        <dt>Posição</dt>
        <dd>
          ({wanderer.x}, {wanderer.y})
        </dd>
      </dl>
      <p class="hint muted">
        {store.myCreep.value !== null && "Botão direito nele: atacar."}
      </p>
    </div>
  );
}

/** A spoil the team knows, with what it last saw in it. */
function SpoilInspector({ id }: { id: number }) {
  const { store } = useGame();
  const state = store.current.value?.state;
  const spoil = state?.spoils.find((s) => s.id === id);
  if (state === undefined || spoil === undefined) {
    return <p class="muted">Esse despojo não existe mais.</p>;
  }
  const width = store.info.value?.map.width ?? 0;
  return (
    <div class="inspector">
      <h2 class="title">Despojo #{spoil.id}</h2>
      <dl class="facts">
        <dt>Conteúdo</dt>
        <dd>
          {stockText(spoil.cargo)}
          {!inSight(state, spoil, width) && (
            <span class="muted"> · último valor visto</span>
          )}
        </dd>
        <dt>Posição</dt>
        <dd>
          ({spoil.x}, {spoil.y})
        </dd>
      </dl>
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

/** HP in whole points over the maximum, as a bar (spec C-7). */
function HpBar(props: { hp: number; full: number }) {
  const { full } = props;
  const share = Math.max(0, props.hp) / full;
  return (
    <span class="cargo hp">
      <span class="bar">
        <span
          style={{
            width: `${Math.min(100 * share, 100)}%`,
            background: COLORS.hp[hpBand(share)],
          }}
        />
      </span>
      <span class="cargo-text">
        {hpPoints(props.hp)}/{hpPoints(full)}
      </span>
    </span>
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
  // Out of sight, the view has the amount the team saw last (spec C-1).
  const width = store.info.value?.map.width ?? 0;
  const remembered = !inSight(state, deposit, width);
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
          {remembered && <span class="muted"> · último valor visto</span>}
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

/** The watch button of the battle a creep is in (junction D11). */
function BattleOf({ state, id }: { state: TeamView; id: number | null }) {
  const battle = state.battles.find((b) => b.id === id);
  if (battle === undefined) return null;
  return (
    <span class="engaged-action">
      <WatchButton battle={battle} />
    </span>
  );
}
