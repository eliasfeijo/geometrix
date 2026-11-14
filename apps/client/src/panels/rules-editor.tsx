// Autopilot rules editor (spec C-4): an ordered list to add to, remove from
// and reorder, plus the presets (spec P-3). Any player of the team edits any
// creep of the team (plan P4); edits stay a local draft until applied.

import {
  RESOURCES,
  type Action,
  type Cell,
  type Condition,
  type Rule,
} from "@geometrix/sim";
import { useState } from "preact/hooks";
import { useGame } from "../context.ts";
import type { CreepView } from "@geometrix/sim";
import { RESOURCE_NAMES, ruleText } from "../format.ts";
import {
  ACTION_LABELS,
  ACTION_TYPES,
  actionOf,
  CONDITION_LABELS,
  CONDITION_TYPES,
  conditionOf,
  move,
  newRule,
  parseCount,
  removeAt,
  replaceAt,
  sameRules,
} from "../rules-draft.ts";

type Draft = { base: Rule[]; rules: Rule[] };

export function RulesEditor({ creep }: { creep: CreepView }) {
  const { store, viewer, send } = useGame();
  const [draft, setDraft] = useState<Draft | null>(null);
  const params = store.info.value?.params;
  const core = store.current.value?.state.teams[creep.team]?.core;
  if (params === undefined || core === undefined || core === null) return null;

  const editable = creep.team === viewer.team;
  const canAct = editable && store.canAct.value;
  const rules = draft?.rules ?? creep.rules;
  const dirty = draft !== null && !sameRules(draft.rules, draft.base);
  const changedElsewhere =
    draft !== null && !sameRules(draft.base, creep.rules);
  const max = params.autopilot.maxRules;

  // Functional, so an edit that lands later (a cell picked on the map) applies
  // to the draft as it is then.
  const edit = (change: (rules: Rule[]) => Rule[]) =>
    setDraft((d) => ({
      base: d?.base ?? creep.rules,
      rules: change(d?.rules ?? creep.rules),
    }));

  const pickCell = (prompt: string, pick: (cell: Cell) => void) => {
    store.mode.value = { type: "pickCell", prompt, pick };
  };

  const apply = async () => {
    if (draft === null) return;
    const ok = await send({
      type: "setRules",
      creepId: creep.id,
      rules: draft.rules,
    });
    if (ok) setDraft(null);
  };

  const preset = (
    name: "materiaCollector" | "cristalCollector" | "roadBuilder",
    target?: Cell,
  ) => {
    setDraft(null);
    void send({
      type: "applyPreset",
      creepId: creep.id,
      preset: name,
      ...(target === undefined ? {} : { target }),
    });
  };

  if (!editable) {
    return (
      <ol class="rules-readonly">
        {creep.rules.map((rule, i) => (
          <li key={i}>{ruleText(rule)}</li>
        ))}
        {creep.rules.length === 0 && <li class="muted">sem regras</li>}
      </ol>
    );
  }

  return (
    <div class="rules-editor">
      <div class="presets">
        <span class="muted small">Presets:</span>
        <button disabled={!canAct} onClick={() => preset("materiaCollector")}>
          Coletor de matéria
        </button>
        <button disabled={!canAct} onClick={() => preset("cristalCollector")}>
          Coletor de cristal
        </button>
        <button
          disabled={!canAct}
          onClick={() =>
            pickCell(
              "Clique no mapa no ponto até onde construir a estrada.",
              (cell) => preset("roadBuilder", cell),
            )
          }
        >
          Construtor de estrada…
        </button>
      </div>

      <ol class="rules">
        {rules.map((rule, i) => (
          <li key={i} class="rule">
            <span class="rule-index">{i + 1}</span>
            <div class="rule-body">
              <ConditionField
                value={rule.when}
                disabled={!canAct}
                onChange={(when) =>
                  edit((r) => replaceAt(r, i, { ...r[i]!, when }))
                }
              />
              <span class="arrow">→</span>
              <ActionField
                value={rule.then}
                core={core}
                disabled={!canAct}
                onChange={(then) =>
                  edit((r) => replaceAt(r, i, { ...r[i]!, then }))
                }
                onPick={(apply) =>
                  pickCell("Clique no mapa para escolher o ponto.", apply)
                }
              />
            </div>
            <div class="rule-buttons">
              <button
                class="ghost"
                title="Subir"
                disabled={!canAct || i === 0}
                onClick={() => edit((r) => move(r, i, -1))}
              >
                ↑
              </button>
              <button
                class="ghost"
                title="Descer"
                disabled={!canAct || i === rules.length - 1}
                onClick={() => edit((r) => move(r, i, 1))}
              >
                ↓
              </button>
              <button
                class="ghost"
                title="Remover"
                disabled={!canAct}
                onClick={() => edit((r) => removeAt(r, i))}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
        {rules.length === 0 && (
          <li class="muted">Sem regras: o creep mantém a ordem atual.</li>
        )}
      </ol>

      <div class="rules-footer">
        <button
          disabled={!canAct || rules.length >= max}
          title={rules.length >= max ? `Máximo de ${max} regras` : undefined}
          onClick={() => edit((r) => [...r, newRule()])}
        >
          + Regra
        </button>
        <span class="spacer" />
        {dirty && (
          <>
            <button onClick={() => setDraft(null)}>Descartar</button>
            <button
              class="primary"
              disabled={!canAct}
              onClick={() => void apply()}
            >
              Aplicar
            </button>
          </>
        )}
      </div>
      {dirty && changedElsewhere && (
        <p class="hint warn">
          As regras mudaram no servidor desde que você começou a editar. Aplicar
          substitui as novas.
        </p>
      )}
      <p class="hint muted">
        A cada tick vale a primeira regra cuja condição é verdadeira e cuja ação
        é possível.
      </p>
    </div>
  );
}

function ResourceSelect(props: {
  value: "materia" | "cristal";
  disabled: boolean;
  onChange(value: "materia" | "cristal"): void;
}) {
  return (
    <select
      value={props.value}
      disabled={props.disabled}
      onChange={(e) =>
        props.onChange(e.currentTarget.value as "materia" | "cristal")
      }
    >
      {RESOURCES.map((r) => (
        <option key={r} value={r}>
          {RESOURCE_NAMES[r]}
        </option>
      ))}
    </select>
  );
}

function CountInput(props: {
  value: number;
  disabled: boolean;
  title: string;
  max?: number;
  onChange(value: number): void;
}) {
  return (
    <input
      type="number"
      min={0}
      max={props.max}
      step={1}
      title={props.title}
      value={props.value}
      disabled={props.disabled}
      onChange={(e) => {
        const value = parseCount(e.currentTarget.value);
        if (value !== null) props.onChange(value);
        else e.currentTarget.value = String(props.value);
      }}
    />
  );
}

function ConditionField(props: {
  value: Condition;
  disabled: boolean;
  onChange(value: Condition): void;
}) {
  const { value, disabled, onChange } = props;
  return (
    <span class="field-group">
      <select
        value={value.type}
        disabled={disabled}
        onChange={(e) =>
          onChange(
            conditionOf(e.currentTarget.value as Condition["type"], value),
          )
        }
      >
        {CONDITION_TYPES.map((t) => (
          <option key={t} value={t}>
            {CONDITION_LABELS[t]}
          </option>
        ))}
      </select>
      {(value.type === "resourceInRange" || value.type === "stockBelow") && (
        <ResourceSelect
          value={value.resource}
          disabled={disabled}
          onChange={(resource) => onChange({ ...value, resource })}
        />
      )}
      {value.type === "resourceInRange" && (
        <CountInput
          title="raio R, em células"
          value={value.radius}
          disabled={disabled}
          onChange={(radius) => onChange({ ...value, radius })}
        />
      )}
      {value.type === "stockBelow" && (
        <CountInput
          title="quantidade N"
          value={value.amount}
          disabled={disabled}
          onChange={(amount) => onChange({ ...value, amount })}
        />
      )}
    </span>
  );
}

function ActionField(props: {
  value: Action;
  core: Cell;
  disabled: boolean;
  onChange(value: Action): void;
  onPick(apply: (cell: Cell) => void): void;
}) {
  const { store } = useGame();
  const map = store.info.value?.map;
  const { value, disabled, onChange } = props;
  return (
    <span class="field-group">
      <select
        value={value.type}
        disabled={disabled}
        onChange={(e) =>
          onChange(
            actionOf(
              e.currentTarget.value as Action["type"],
              value,
              props.core,
            ),
          )
        }
      >
        {ACTION_TYPES.map((t) => (
          <option key={t} value={t}>
            {ACTION_LABELS[t]}
          </option>
        ))}
      </select>
      {value.type === "gather" && (
        <ResourceSelect
          value={value.resource}
          disabled={disabled}
          onChange={(resource) => onChange({ ...value, resource })}
        />
      )}
      {(value.type === "moveTo" || value.type === "buildRoad") && (
        <>
          <CountInput
            title="x"
            max={(map?.width ?? 1) - 1}
            value={value.x}
            disabled={disabled}
            onChange={(x) => onChange({ ...value, x })}
          />
          <CountInput
            title="y"
            max={(map?.height ?? 1) - 1}
            value={value.y}
            disabled={disabled}
            onChange={(y) => onChange({ ...value, y })}
          />
          <button
            class="ghost"
            title="Escolher no mapa"
            disabled={disabled}
            onClick={() =>
              props.onPick((cell) => onChange({ ...value, ...cell }))
            }
          >
            <svg class="icon" viewBox="0 0 16 16" width="14" height="14">
              <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" />
              <path d="M8 0v5M8 11v5M0 8h5M11 8h5" stroke="currentColor" />
            </svg>
          </button>
        </>
      )}
    </span>
  );
}
