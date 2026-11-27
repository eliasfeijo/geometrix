// Autopilot rules editor (spec C-4): an ordered list to add to, remove from
// and reorder, plus the presets (spec P-3). Any player of the team edits any
// creep of the team (plan P4); edits stay a local draft until applied.

import {
  DNAS,
  RESOURCES,
  type Action,
  type Cell,
  type Condition,
  type Dna,
  type Rule,
} from "@geometrix/sim";
import { useState } from "preact/hooks";
import { useGame } from "../context.ts";
import type { CreepView, PresetId } from "@geometrix/sim";
import {
  DNA_NAMES,
  namesOf,
  RESOURCE_NAMES,
  ruleText,
  type NameOf,
} from "../format.ts";
import { DnaIcon } from "./dna-icon.tsx";
import {
  ACTION_LABELS,
  actionOf,
  CONDITION_LABELS,
  conditionOf,
  GROUP_ACTIONS,
  GROUP_CONDITIONS,
  groupOf,
  indicesOf,
  moveInGroup,
  newRule,
  parseCount,
  percentOf,
  permilleOf,
  removeAt,
  replaceAt,
  sameRules,
  toggleDna,
  withFollow,
  type RuleGroup,
} from "../rules-draft.ts";

/** The two groups of the editor (M2 encontro plan section 9). */
const GROUPS: {
  group: RuleGroup;
  title: string | null;
  empty: string;
  hint?: string;
}[] = [
  {
    group: "plain",
    title: null,
    empty: "Sem regras: o creep mantém a ordem atual.",
  },
  {
    group: "reaction",
    title: "Quando abordado",
    empty: "Sem reações: valem os padrões abaixo.",
    hint: "Decididas só num encontro ou numa luta",
  },
];

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
  const nameOf = namesOf(store.current.value?.state.creeps ?? []);

  // "Seguir…" (R spec D9): an ally picked on the map, then the rule at once.
  const follow = () => {
    store.mode.value = {
      type: "pickAlly",
      prompt: `Clique no creep que ${creep.name} deve seguir.`,
      exclude: creep.id,
      pick: (creepId) => {
        const now = store.current.value?.state.creeps.find(
          (c): c is CreepView => c.id === creep.id && "rules" in c,
        );
        if (now === undefined) return;
        void send({
          type: "setRules",
          creepId: creep.id,
          rules: withFollow(now.rules, creepId),
        });
      },
    };
  };

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

  const preset = (name: PresetId, target?: Cell) => {
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
      <>
        {GROUPS.map(({ group, title }) => {
          const list = creep.rules.filter((r) => groupOf(r) === group);
          if (group === "reaction" && list.length === 0) return null;
          return (
            <div key={group}>
              {title !== null && <h4>{title}</h4>}
              <ol class="rules-readonly">
                {list.map((rule, i) => (
                  <li key={i}>{ruleText(rule, nameOf)}</li>
                ))}
                {list.length === 0 && <li class="muted">sem regras</li>}
              </ol>
            </div>
          );
        })}
      </>
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
          title="Constrói estrada até a jazida conhecida mais perto do Núcleo que ainda não tem estrada"
          onClick={() => preset("roadBuilder")}
        >
          Construtor de estrada
        </button>
        <button
          disabled={!canAct}
          title="Explora a célula nunca vista mais próxima; sem nada a explorar, volta ao Núcleo"
          onClick={() => preset("scout")}
        >
          Batedor
        </button>
        <button
          disabled={!canAct}
          title="Extorque inimigos carregados à vista, cata despojos e entrega; luta quando abordado e foge com o HP baixo"
          onClick={() => preset("raider")}
        >
          Salteador
        </button>
        {creep.dominatedBy === null && (
          <button
            disabled={!canAct || dirty || creep.rules.length >= max}
            title={
              dirty
                ? "Aplique ou descarte as mudanças antes"
                : creep.rules.length >= max
                  ? `Máximo de ${max} regras`
                  : "Segue um aliado e entra nas lutas dele"
            }
            onClick={follow}
          >
            Seguir…
          </button>
        )}
      </div>

      {GROUPS.map(({ group, title, empty, hint }) => {
        const indices = indicesOf(rules, group);
        return (
          <div key={group} class={`rule-group rule-group-${group}`}>
            {title !== null && <h4 title={hint}>{title}</h4>}
            <ol class="rules">
              {indices.map((i, k) => {
                const rule = rules[i]!;
                return (
                  <li key={i} class="rule">
                    <span class="rule-index">{k + 1}</span>
                    <div class="rule-body">
                      <ConditionField
                        value={rule.when}
                        options={GROUP_CONDITIONS[group]}
                        disabled={!canAct}
                        onChange={(when) =>
                          edit((r) => replaceAt(r, i, { ...r[i]!, when }))
                        }
                      />
                      <span class="arrow">→</span>
                      <ActionField
                        value={rule.then}
                        options={GROUP_ACTIONS[group]}
                        core={core}
                        nameOf={nameOf}
                        disabled={!canAct}
                        onChange={(then) =>
                          edit((r) => replaceAt(r, i, { ...r[i]!, then }))
                        }
                        onPick={(apply) =>
                          pickCell(
                            "Clique no mapa para escolher o ponto.",
                            apply,
                          )
                        }
                      />
                    </div>
                    <div class="rule-buttons">
                      <button
                        class="ghost"
                        title="Subir"
                        disabled={!canAct || k === 0}
                        onClick={() => edit((r) => moveInGroup(r, i, -1))}
                      >
                        ↑
                      </button>
                      <button
                        class="ghost"
                        title="Descer"
                        disabled={!canAct || k === indices.length - 1}
                        onClick={() => edit((r) => moveInGroup(r, i, 1))}
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
                );
              })}
              {indices.length === 0 && <li class="muted">{empty}</li>}
            </ol>
            <button
              class="add-rule"
              disabled={!canAct || rules.length >= max}
              title={
                rules.length >= max ? `Máximo de ${max} regras` : undefined
              }
              onClick={() => edit((r) => [...r, newRule(group)])}
            >
              {group === "plain" ? "+ Regra" : "+ Reação"}
            </button>
          </div>
        );
      })}

      <div class="rules-footer">
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
        é possível. Num encontro, valem só as reações; sem reação que valha, o
        creep paga a extorsão, tenta fugir do ataque e, na luta, continua
        lutando.
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
  options: readonly Condition["type"][];
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
        {withCurrent(props.options, value.type).map((t) => (
          <option key={t} value={t}>
            {CONDITION_LABELS[t]}
          </option>
        ))}
      </select>
      {(value.type === "resourceInRange" ||
        value.type === "stockBelow" ||
        value.type === "resourceUnknown") && (
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
      {value.type === "allyInBattle" && (
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
      {value.type === "enemyInSight" && (
        <EnemyFilter
          value={value}
          disabled={disabled}
          onChange={(filter) => onChange({ type: "enemyInSight", ...filter })}
        />
      )}
      {(value.type === "hpBelow" || value.type === "demandAtMost") && (
        <PercentInput
          title={
            value.type === "hpBelow"
              ? "% do HP máximo"
              : "% da carga que a exigência leva"
          }
          permille={value.permille}
          disabled={disabled}
          onChange={(permille) => onChange({ ...value, permille })}
        />
      )}
    </span>
  );
}

/** The option list, with the current type even if the group lacks it. */
const withCurrent = <T extends string>(options: readonly T[], current: T) =>
  options.includes(current) ? options : [current, ...options];

function PercentInput(props: {
  permille: number;
  disabled: boolean;
  title: string;
  onChange(permille: number): void;
}) {
  return (
    <span class="percent">
      <CountInput
        title={props.title}
        max={100}
        value={percentOf(props.permille)}
        disabled={props.disabled}
        onChange={(percent) => props.onChange(permilleOf(percent))}
      />
      %
    </span>
  );
}

type EnemyFilterValue = { radius: number; dna?: Dna[]; minCargo: number };

/** Radius, DNA and minimum cargo of "inimigo à vista" and "abordar" (D13). */
function EnemyFilter(props: {
  value: EnemyFilterValue;
  disabled: boolean;
  onChange(value: EnemyFilterValue): void;
}) {
  const { value, disabled, onChange } = props;
  const set = (change: Partial<EnemyFilterValue>) => {
    const next = { ...value, ...change };
    const { radius, minCargo, dna } = next;
    onChange(
      dna === undefined ? { radius, minCargo } : { radius, dna, minCargo },
    );
  };
  return (
    <>
      <CountInput
        title="raio, em células"
        value={value.radius}
        disabled={disabled}
        onChange={(radius) => set({ radius })}
      />
      <span class="dna-filter" title="DNA do inimigo">
        {DNAS.map((d) => {
          const on = value.dna === undefined || value.dna.includes(d);
          return (
            <button
              key={d}
              class={on ? "ghost dna-on" : "ghost dna-off"}
              title={`${DNA_NAMES[d]}: ${on ? "sim" : "não"}`}
              aria-pressed={on}
              disabled={disabled}
              onClick={() => set({ dna: toggleDna(value.dna, d) })}
            >
              <DnaIcon dna={d} team={1} size={14} />
            </button>
          );
        })}
      </span>
      <span class="small muted">carga ≥</span>
      <CountInput
        title="carga mínima do inimigo"
        value={value.minCargo}
        disabled={disabled}
        onChange={(minCargo) => set({ minCargo })}
      />
    </>
  );
}

function ActionField(props: {
  value: Action;
  options: readonly Action["type"][];
  core: Cell;
  nameOf: NameOf;
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
        {withCurrent(props.options, value.type).map((t) => (
          <option key={t} value={t}>
            {ACTION_LABELS[t]}
          </option>
        ))}
      </select>
      {value.type === "follow" && (
        <span class="small">{props.nameOf(value.creepId)}</span>
      )}
      {value.type === "buildRoad" && value.x === undefined && (
        <span class="small muted">a jazida mais perto sem estrada</span>
      )}
      {value.type === "gather" && (
        <ResourceSelect
          value={value.resource}
          disabled={disabled}
          onChange={(resource) => onChange({ ...value, resource })}
        />
      )}
      {value.type === "joinBattle" && (
        <PercentInput
          title="HP mínimo, % do máximo"
          permille={value.minHpPermille}
          disabled={disabled}
          onChange={(minHpPermille) => onChange({ ...value, minHpPermille })}
        />
      )}
      {value.type === "approach" && (
        <>
          <select
            value={value.intent}
            disabled={disabled}
            title="intenção"
            onChange={(e) =>
              onChange({
                ...value,
                intent: e.currentTarget.value as "attack" | "extort",
              })
            }
          >
            <option value="extort">para extorquir</option>
            <option value="attack">para atacar</option>
          </select>
          <EnemyFilter
            value={value}
            disabled={disabled}
            onChange={(filter) =>
              onChange({ type: "approach", intent: value.intent, ...filter })
            }
          />
        </>
      )}
      {(value.type === "moveTo" ||
        (value.type === "buildRoad" && value.x !== undefined)) && (
        <>
          <CountInput
            title="x"
            max={(map?.width ?? 1) - 1}
            value={value.x ?? 0}
            disabled={disabled}
            onChange={(x) => onChange({ ...value, x })}
          />
          <CountInput
            title="y"
            max={(map?.height ?? 1) - 1}
            value={value.y ?? 0}
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
