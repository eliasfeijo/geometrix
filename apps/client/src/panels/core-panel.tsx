// Core panel (spec C-3): stock, production (with "repeat", plan P5), the
// capacity upgrade and population. The own team's panel has the buttons; the
// other team's is read-only (no fog in M1, spec D5).

import {
  canAfford,
  DNAS,
  population,
  productionRefusal,
  type Cost,
  type Dna,
} from "@geometrix/sim";
import { useEffect, useRef, useState } from "preact/hooks";
import { useGame } from "../context.ts";
import { DNA_NAMES, durationWords, teamName } from "../format.ts";
import { COLORS } from "../map/colors.ts";
import { DnaIcon } from "./dna-icon.tsx";

const BLOCK_TEXTS = {
  busy: "O Núcleo está produzindo.",
  populationCap: "Teto de população atingido.",
  stock: "Estoque insuficiente.",
} as const;

export function CorePanel({ team: teamId }: { team: number }) {
  const { store, viewer, send } = useGame();
  const [repeat, setRepeat] = useState(false);
  const state = store.current.value?.state;
  const params = store.info.value?.params;
  const team = state?.teams[teamId];
  if (state === undefined || params === undefined || team === undefined) {
    return null;
  }
  const own = teamId === viewer.team;
  const canAct = own && store.canAct.value;
  const view = { params, creeps: state.creeps };
  const block = productionRefusal(view, team);
  const upgrade = params.upgrade.capacity;
  const counts = (dna: Dna) =>
    state.creeps.filter((c) => c.team === teamId && c.dna === dna).length;
  return (
    <div class={`core-panel team-${teamId}`}>
      <h2 class="title">
        <svg class="icon" viewBox="0 0 1 1" width="18" height="18">
          <polygon
            points="0.31,0.04 0.69,0.04 0.96,0.31 0.96,0.69 0.69,0.96 0.31,0.96 0.04,0.69 0.04,0.31"
            fill="none"
            stroke="currentColor"
            stroke-width="0.12"
          />
        </svg>
        Núcleo <span class="team-name">{teamName(teamId)}</span>
      </h2>

      <div class="stock">
        <Amount kind="materia" value={team.stock.materia} />
        <Amount kind="cristal" value={team.stock.cristal} />
      </div>

      <h3>População</h3>
      <p class="population">
        <strong>
          {population(view, team)}/{params.population.cap}
        </strong>
        {DNAS.map((dna) => (
          <span key={dna} class="dna-count" title={DNA_NAMES[dna]}>
            <DnaIcon dna={dna} team={teamId} size={14} /> {counts(dna)}
          </span>
        ))}
      </p>

      <h3>Produção</h3>
      {team.production === null ? (
        <p class="muted">ociosa</p>
      ) : (
        <div class="production">
          <DnaIcon dna={team.production.dna} team={teamId} size={16} />
          <span>{DNA_NAMES[team.production.dna]}</span>
          <span class="bar">
            <span
              style={{
                width: `${100 * (1 - team.production.remainingSeconds / params.creep.productionSeconds)}%`,
                background: "var(--team)",
              }}
            />
          </span>
          <span class="muted">
            faltam {durationWords(team.production.remainingSeconds)}
          </span>
        </div>
      )}
      {team.repeat !== null && (
        <div class="repeat">
          <span>
            ↻ Repetindo <strong>{DNA_NAMES[team.repeat]}</strong>
            {team.production === null && (
              <span class="muted"> (esperando estoque ou teto)</span>
            )}
          </span>
          {own && (
            <button
              disabled={!canAct}
              onClick={() => void send({ type: "stopRepeat" })}
            >
              Parar
            </button>
          )}
        </div>
      )}

      {own && (
        <div class="produce">
          <p class="muted cost">
            Custo: <CostText cost={params.creep.cost} /> ·{" "}
            {durationWords(params.creep.productionSeconds)}
          </p>
          <div class="produce-buttons">
            {DNAS.map((dna) => (
              <button
                key={dna}
                class="produce-button"
                disabled={!canAct || block !== null}
                title={`${DNA_NAMES[dna]}: carga ${params.dna[dna].capacity}, ${params.dna[dna].cellsPerMinute} células/min`}
                onClick={() => void send({ type: "produce", dna, repeat })}
              >
                <DnaIcon dna={dna} team={teamId} size={16} />
                <span>{DNA_NAMES[dna]}</span>
                <span class="muted small">
                  {params.dna[dna].capacity} · {params.dna[dna].cellsPerMinute}
                  /min
                </span>
              </button>
            ))}
          </div>
          <label class="check">
            <input
              type="checkbox"
              checked={repeat}
              onChange={(e) => setRepeat(e.currentTarget.checked)}
            />
            repetir ao terminar
          </label>
          {block !== null && block !== "busy" && (
            <p class="muted small">{BLOCK_TEXTS[block]}</p>
          )}
        </div>
      )}

      <h3>Upgrade</h3>
      <div class="upgrade">
        <span>
          Capacidade de carga +{upgrade.bonusPermille / 10}%
          <span class="muted">
            {" "}
            · <CostText cost={upgrade.cost} />
          </span>
        </span>
        {team.upgrades.capacity ? (
          <span class="owned">comprado</span>
        ) : (
          own && (
            <button
              disabled={!canAct || !canAfford(team.stock, upgrade.cost)}
              onClick={() =>
                void send({ type: "buyUpgrade", upgrade: "capacity" })
              }
            >
              Comprar
            </button>
          )
        )}
      </div>
    </div>
  );
}

function Amount({
  kind,
  value,
}: {
  kind: "materia" | "cristal";
  value: number;
}) {
  // The number flashes when it changes (F9): a new key replays the animation.
  const last = useRef(value);
  const [flash, setFlash] = useState<{ up: boolean; n: number } | null>(null);
  useEffect(() => {
    if (value === last.current) return;
    setFlash((f) => ({ up: value > last.current, n: (f?.n ?? 0) + 1 }));
    last.current = value;
  }, [value]);
  return (
    <span class="amount" title={kind === "materia" ? "matéria" : "cristal"}>
      <svg class="icon" viewBox="0 0 1 1" width="14" height="14">
        {kind === "materia" ? (
          <polygon
            points="0.08,0.5 0.29,0.14 0.71,0.14 0.92,0.5 0.71,0.86 0.29,0.86"
            fill={COLORS.materia}
          />
        ) : (
          <polygon
            points="0.5,0.06 0.94,0.5 0.5,0.94 0.06,0.5"
            fill={COLORS.cristal}
          />
        )}
      </svg>
      <strong
        key={flash?.n ?? 0}
        class={
          flash === null ? undefined : flash.up ? "stock-up" : "stock-down"
        }
      >
        {value}
      </strong>
      <span class="muted">{kind === "materia" ? "matéria" : "cristal"}</span>
    </span>
  );
}

function CostText({ cost }: { cost: Cost }) {
  const parts = [
    cost.materia > 0 ? `${cost.materia} matéria` : null,
    cost.cristal > 0 ? `${cost.cristal} cristal` : null,
  ].filter((p) => p !== null);
  return <>{parts.length === 0 ? "grátis" : parts.join(" + ")}</>;
}

/** The own team's core, docked on the left of the map. */
export function CoreDock() {
  const { store, viewer } = useGame();
  const [open, setOpen] = useState(true);
  if (store.current.value === null) return null;
  const selected =
    store.selection.value?.kind === "core" &&
    store.selection.value.team === viewer.team;
  return (
    <aside
      class={`core-dock panel ${selected ? "selected" : ""} ${open ? "" : "collapsed"}`}
      aria-label="Seu Núcleo"
    >
      <button
        class="ghost close"
        title={open ? "Recolher" : "Abrir"}
        onClick={() => setOpen(!open)}
      >
        {open ? "−" : "+"}
      </button>
      {open ? (
        <CorePanel team={viewer.team} />
      ) : (
        <span class={`team-${viewer.team} team-name`}>Núcleo</span>
      )}
    </aside>
  );
}
