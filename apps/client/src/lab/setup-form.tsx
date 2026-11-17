// Building a battle (spec L-1) and sending a reinforcement (L-6): the arena,
// 2 to 4 sides of 1 to 5 participants (DNA, starting HP, load, preset,
// reaction) and the seed; the reinforcement picks a side in the arena, or a
// new one, and a participant.

import {
  DNAS,
  PRESET_IDS,
  REACTIONS,
  type BattleParams,
  type Dna,
  type PresetId,
  type Reaction,
} from "@geometrix/battle";
import { ARENA_NAMES, type ArenaName } from "./assets.ts";
import { sideColor } from "./arena-view.tsx";
import {
  HP_CHOICES,
  member,
  randomSeed,
  youOf,
  type MemberDraft,
  type SetupDraft,
} from "./draft.ts";
import {
  DNA_GLYPHS,
  DNA_LABELS,
  labName,
  PRESET_LABELS,
  REACTION_LABELS,
  sideLetter,
} from "./labels.ts";

type MemberProps = {
  value: MemberDraft;
  params: BattleParams;
  idPrefix: string;
  onChange(value: MemberDraft): void;
};

/** The fields of one participant: DNA, HP, load, preset and reaction. */
export function MemberFields({
  value,
  params,
  idPrefix,
  onChange,
}: MemberProps) {
  const set = (patch: Partial<MemberDraft>) => onChange({ ...value, ...patch });
  const capacity = params.dna[value.dna].capacity;
  return (
    <div class="lab-member">
      <select
        id={`${idPrefix}-dna`}
        aria-label="DNA"
        value={value.dna}
        onChange={(e) => {
          const dna = e.currentTarget.value as Dna;
          set({ ...member(dna), reaction: value.reaction });
        }}
      >
        {DNAS.map((dna) => (
          <option key={dna} value={dna}>
            {DNA_GLYPHS[dna]} {DNA_LABELS[dna]}
          </option>
        ))}
      </select>
      <select
        id={`${idPrefix}-hp`}
        aria-label="HP inicial"
        value={String(value.hpPermille)}
        onChange={(e) => set({ hpPermille: Number(e.currentTarget.value) })}
      >
        {HP_CHOICES.map((hp) => (
          <option key={hp} value={String(hp)}>
            HP {hp / 10}%
          </option>
        ))}
      </select>
      <label class="lab-load" title={`Matéria na bolsa (até ${capacity})`}>
        carga
        <input
          id={`${idPrefix}-load`}
          type="number"
          min={0}
          max={capacity}
          value={value.materia}
          onInput={(e) => {
            const n = Math.floor(Number(e.currentTarget.value));
            set({ materia: Math.min(Math.max(n || 0, 0), capacity) });
          }}
        />
      </label>
      <select
        id={`${idPrefix}-preset`}
        aria-label="Gambits"
        value={value.preset}
        onChange={(e) => set({ preset: e.currentTarget.value as PresetId })}
      >
        {PRESET_IDS.map((id) => (
          <option key={id} value={id}>
            {PRESET_LABELS[id]}
          </option>
        ))}
      </select>
      <select
        id={`${idPrefix}-reaction`}
        aria-label="Dificuldade da IA"
        value={value.reaction}
        onChange={(e) => set({ reaction: e.currentTarget.value as Reaction })}
      >
        {REACTIONS.map((r) => (
          <option key={r} value={r}>
            IA {REACTION_LABELS[r]}
          </option>
        ))}
      </select>
    </div>
  );
}

type SetupProps = {
  draft: SetupDraft;
  params: BattleParams;
  onChange(draft: SetupDraft): void;
  onStart(): void;
};

export function SetupForm({ draft, params, onChange, onStart }: SetupProps) {
  const { maxSides, maxPerSide } = params.limits;
  const setSide = (side: number, members: MemberDraft[]) =>
    onChange({
      ...draft,
      sides: draft.sides.map((m, i) => (i === side ? members : m)),
    });
  return (
    <form
      class="lab-panel lab-setup"
      onSubmit={(e) => {
        e.preventDefault();
        onStart();
      }}
    >
      <h2>Montar a batalha</h2>
      <div class="lab-row">
        <label>
          arena
          <select
            id="setup-arena"
            value={draft.arena}
            onChange={(e) =>
              onChange({ ...draft, arena: e.currentTarget.value as ArenaName })
            }
          >
            {ARENA_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          seed
          <input
            id="setup-seed"
            type="number"
            min={0}
            value={draft.seed}
            onInput={(e) =>
              onChange({
                ...draft,
                seed: Math.max(0, Math.floor(Number(e.currentTarget.value))),
              })
            }
          />
        </label>
        <button
          type="button"
          onClick={() => onChange({ ...draft, seed: randomSeed() })}
        >
          sortear
        </button>
      </div>
      {draft.sides.map((members, side) => (
        <fieldset key={side} class="lab-side">
          <legend style={{ color: sideColor(side) }}>
            Lado {sideLetter(side)}
          </legend>
          {members.map((m, i) => (
            <div key={i} class="lab-member-row">
              <MemberFields
                value={m}
                params={params}
                idPrefix={`setup-${side}-${i}`}
                onChange={(value) =>
                  setSide(
                    side,
                    members.map((old, j) => (j === i ? value : old)),
                  )
                }
              />
              {members.length > 1 && (
                <button
                  type="button"
                  class="lab-icon"
                  aria-label="Tirar participante"
                  onClick={() =>
                    setSide(
                      side,
                      members.filter((_, j) => j !== i),
                    )
                  }
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <div class="lab-row">
            {members.length < maxPerSide && (
              <button
                type="button"
                onClick={() =>
                  setSide(side, [...members, member(members[0]!.dna)])
                }
              >
                + participante
              </button>
            )}
            {draft.sides.length > 2 && (
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...draft,
                    sides: draft.sides.filter((_, i) => i !== side),
                  })
                }
              >
                tirar o lado
              </button>
            )}
          </div>
        </fieldset>
      ))}
      <div class="lab-row">
        <label>
          você joga com
          <select
            id="setup-you"
            value={String(youOf(draft) ?? "")}
            onChange={(e) => {
              const value = e.currentTarget.value;
              onChange({ ...draft, you: value === "" ? null : Number(value) });
            }}
          >
            <option value="">ninguém (só assistir)</option>
            {draft.sides.flatMap((members, side) =>
              members.map((m, i) => {
                const place = draft.sides.slice(0, side).flat().length + i;
                return (
                  <option key={place} value={String(place)}>
                    {sideLetter(side)} · {DNA_GLYPHS[m.dna]} {labName(place)}
                  </option>
                );
              }),
            )}
          </select>
        </label>
      </div>
      <div class="lab-row">
        {draft.sides.length < maxSides && (
          <button
            type="button"
            onClick={() =>
              onChange({
                ...draft,
                sides: [...draft.sides, [member("triangle")]],
              })
            }
          >
            + lado
          </button>
        )}
        <button type="submit" class="lab-primary">
          Começar
        </button>
      </div>
    </form>
  );
}

type ReinforceProps = {
  /** The sides with someone in the arena. */
  sides: number[];
  /** The id a new side gets, or null when no more sides fit. */
  newSide: number | null;
  value: MemberDraft;
  params: BattleParams;
  onChange(value: MemberDraft): void;
  onSend(side: number): void;
  side: number;
  onSide(side: number): void;
};

export function ReinforceForm(props: ReinforceProps) {
  const choices = [...props.sides];
  if (props.newSide !== null) choices.push(props.newSide);
  const side = choices.includes(props.side) ? props.side : choices[0];
  return (
    <form
      class="lab-panel"
      onSubmit={(e) => {
        e.preventDefault();
        if (side !== undefined) props.onSend(side);
      }}
    >
      <h2>Reforço</h2>
      <div class="lab-row">
        <label>
          lado
          <select
            id="reinforce-side"
            value={String(side)}
            onChange={(e) => props.onSide(Number(e.currentTarget.value))}
          >
            {choices.map((s) => (
              <option key={s} value={String(s)}>
                {s === props.newSide
                  ? `novo (${sideLetter(s)})`
                  : sideLetter(s)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <MemberFields
        value={props.value}
        params={props.params}
        idPrefix="reinforce"
        onChange={props.onChange}
      />
      <button type="submit" disabled={side === undefined}>
        Soltar na arena
      </button>
    </form>
  );
}
