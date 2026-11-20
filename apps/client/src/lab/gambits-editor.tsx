// The gambits editor (spec L-7, D15): the list of the selected participant,
// in order, condition → action. Start from a preset, add, remove and reorder
// rules (up to maxRules), and apply: the page sends setGambits, which holds
// from the next tick on.

import {
  DNAS,
  PRESET_IDS,
  presetGambits,
  type Action,
  type Condition,
  type Gambit,
  type PresetId,
  type Target,
} from "@geometrix/battle";
import {
  ACTION_LABELS,
  CONDITION_LABELS,
  DNA_LABELS,
  PRESET_LABELS,
} from "./labels.ts";

const CONDITION_TYPES = Object.keys(CONDITION_LABELS) as Condition["type"][];
const ACTION_TYPES = Object.keys(ACTION_LABELS) as Action["type"][];

/** A condition of `type` with the numbers of the presets as a start. */
export function conditionOf(type: Condition["type"]): Condition {
  switch (type) {
    case "hpBelow":
      return { type, permille: 250 };
    case "enemyWithin":
      return { type, cells: 4 };
    case "carryAbove":
      return { type, permille: 500 };
    case "allyHpBelow":
      return { type, permille: 500, cells: 4 };
    default:
      return { type };
  }
}

export function actionOf(type: Action["type"], keep?: Action): Action {
  const target: Target =
    keep !== undefined && "target" in keep ? keep.target : { by: "nearest" };
  switch (type) {
    case "attack":
    case "approach":
    case "keepDistance":
      return { type, target };
    default:
      return { type };
  }
}

const targetKey = (t: Target) => (t.by === "dna" ? `dna:${t.dna}` : t.by);

function targetOf(key: string): Target {
  if (key === "nearest" || key === "weakest") return { by: key };
  return { by: "dna", dna: key.slice(4) as (typeof DNAS)[number] };
}

/** Moves item `i` of a list by `delta` places. */
export function moved<T>(list: readonly T[], i: number, delta: number): T[] {
  const j = i + delta;
  if (j < 0 || j >= list.length) return [...list];
  const out = [...list];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}

function NumberField(props: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange(n: number): void;
}) {
  return (
    <label class="lab-number">
      <input
        id={props.id}
        type="number"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        onInput={(e) => {
          const n = Math.floor(Number(e.currentTarget.value));
          props.onChange(Math.min(Math.max(n || 0, props.min), props.max));
        }}
      />
      {props.label}
    </label>
  );
}

function ConditionFields(props: {
  id: string;
  value: Condition;
  onChange(c: Condition): void;
}) {
  const c = props.value;
  return (
    <span class="lab-rule-part">
      <select
        id={`${props.id}-when`}
        aria-label="Condição"
        value={c.type}
        onChange={(e) =>
          props.onChange(
            conditionOf(e.currentTarget.value as Condition["type"]),
          )
        }
      >
        {CONDITION_TYPES.map((t) => (
          <option key={t} value={t}>
            {CONDITION_LABELS[t]}
          </option>
        ))}
      </select>
      {"permille" in c && (
        <NumberField
          id={`${props.id}-pct`}
          label="%"
          value={c.permille / 10}
          min={0}
          max={100}
          onChange={(n) => props.onChange({ ...c, permille: n * 10 })}
        />
      )}
      {"cells" in c && (
        <NumberField
          id={`${props.id}-cells`}
          label="células"
          value={c.cells}
          min={0}
          max={60}
          onChange={(n) => props.onChange({ ...c, cells: n })}
        />
      )}
      {c.type === "enemyWithin" && (
        <select
          id={`${props.id}-dna`}
          aria-label="De que forma"
          value={c.dna ?? ""}
          onChange={(e) => {
            const { cells } = c;
            const dna = e.currentTarget.value as (typeof DNAS)[number] | "";
            props.onChange(
              dna === ""
                ? { type: c.type, cells }
                : { type: c.type, cells, dna },
            );
          }}
        >
          <option value="">de qualquer forma</option>
          {DNAS.map((dna) => (
            <option key={dna} value={dna}>
              {DNA_LABELS[dna]}
            </option>
          ))}
        </select>
      )}
    </span>
  );
}

function ActionFields(props: {
  id: string;
  value: Action;
  onChange(a: Action): void;
}) {
  const a = props.value;
  return (
    <span class="lab-rule-part">
      <select
        id={`${props.id}-then`}
        aria-label="Ação"
        value={a.type}
        onChange={(e) =>
          props.onChange(actionOf(e.currentTarget.value as Action["type"], a))
        }
      >
        {ACTION_TYPES.map((t) => (
          <option key={t} value={t}>
            {ACTION_LABELS[t]}
          </option>
        ))}
      </select>
      {"target" in a && (
        <select
          id={`${props.id}-target`}
          aria-label="Alvo"
          value={targetKey(a.target)}
          onChange={(e) =>
            props.onChange({ ...a, target: targetOf(e.currentTarget.value) })
          }
        >
          <option value="nearest">o mais perto</option>
          <option value="weakest">o mais ferido</option>
          {DNAS.map((dna) => (
            <option key={dna} value={`dna:${dna}`}>
              o {DNA_LABELS[dna]}
            </option>
          ))}
        </select>
      )}
    </span>
  );
}

type Props = {
  /** Who is selected, or null. */
  name: string | null;
  /** The list being edited; null while it loads. */
  draft: Gambit[] | null;
  maxRules: number;
  /** The draft differs from what the participant runs. */
  dirty: boolean;
  onChange(draft: Gambit[]): void;
  onApply(): void;
};

export function GambitsEditor(props: Props) {
  const { draft } = props;
  if (props.name === null) {
    return (
      <section class="lab-panel">
        <h2>Gambits</h2>
        <p class="lab-hint">
          Clique num participante para ver e editar a lista dele.
        </p>
      </section>
    );
  }
  return (
    <section class="lab-panel lab-gambits">
      <h2>Gambits de {props.name}</h2>
      {draft === null ? (
        <p class="lab-hint">Carregando…</p>
      ) : (
        <>
          <div class="lab-row">
            <select
              id="gambits-preset"
              aria-label="Começar de um preset"
              value=""
              onChange={(e) => {
                const id = e.currentTarget.value as PresetId;
                if (id) props.onChange(presetGambits(id));
              }}
            >
              <option value="">trocar pelo preset…</option>
              {PRESET_IDS.map((id) => (
                <option key={id} value={id}>
                  {PRESET_LABELS[id]}
                </option>
              ))}
            </select>
          </div>
          <ol class="lab-rules">
            {draft.map((rule, i) => (
              <li key={i}>
                <span class="lab-rule-head">se</span>
                <ConditionFields
                  id={`rule-${i}`}
                  value={rule.when}
                  onChange={(when) =>
                    props.onChange(
                      draft.map((r, j) => (j === i ? { ...r, when } : r)),
                    )
                  }
                />
                <span class="lab-rule-head">→</span>
                <ActionFields
                  id={`rule-${i}`}
                  value={rule.then}
                  onChange={(then) =>
                    props.onChange(
                      draft.map((r, j) => (j === i ? { ...r, then } : r)),
                    )
                  }
                />
                <span class="lab-rule-tools">
                  <button
                    type="button"
                    class="lab-icon"
                    aria-label="Subir a regra"
                    disabled={i === 0}
                    onClick={() => props.onChange(moved(draft, i, -1))}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    class="lab-icon"
                    aria-label="Descer a regra"
                    disabled={i === draft.length - 1}
                    onClick={() => props.onChange(moved(draft, i, 1))}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    class="lab-icon"
                    aria-label="Tirar a regra"
                    onClick={() =>
                      props.onChange(draft.filter((_, j) => j !== i))
                    }
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ol>
          {draft.length === 0 && (
            <p class="lab-hint">Sem regras, o participante fica parado.</p>
          )}
          <div class="lab-row">
            <button
              type="button"
              disabled={draft.length >= props.maxRules}
              onClick={() =>
                props.onChange([
                  ...draft,
                  {
                    when: { type: "always" },
                    then: { type: "attack", target: { by: "nearest" } },
                  },
                ])
              }
            >
              + regra
            </button>
            <button
              type="button"
              class="lab-primary"
              disabled={!props.dirty}
              onClick={props.onApply}
            >
              Aplicar
            </button>
          </div>
        </>
      )}
    </section>
  );
}
