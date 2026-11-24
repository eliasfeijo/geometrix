---
name: spec-slice
description: Creates and drives a geometrix slice through the spec → plan → tasks flow in docs/specs/<milestone>-<slug>/, respecting the owner's approvals at each step. Use when starting the next slice of a milestone or moving a slice to its next step.
---

# Slice: spec → plan → tasks

Sources: `docs/specs/README.md`, `CLAUDE.md` and the M2 slices (`docs/specs/m2-encounter/`,
`docs/specs/m2-battle-lab/`), which serve as models.

## Main rule

The spec is the source of truth. Facing an ambiguity it does not cover, **stop and ask**. Do not fill the gap with a
guess.

## Steps and gates

| Step | File | May start when | Ends when |
|---|---|---|---|
| 1 | `spec.md` (**what**) | The slice is in `docs/ROADMAP.md` | The owner approves the spec |
| 2 | `plan.md` (**how**) | Spec approved **and** prerequisite ADRs `Accepted` | The owner approves the plan |
| 3 | `tasks.md` | Together with the `plan.md` | All tasks `[x]` |

- `plan.md` and `tasks.md` are only mandatory for substantial slices. For small slices, ask the owner whether the
  spec and the code are enough.
- **No code before the spec is approved.**
- Update the status column in `docs/specs/README.md` at each gate.

## 1. spec.md

Folder: `docs/specs/<milestone>-<slug>/` (e.g. `m2-junction`). Header:

```markdown
# <MILESTONE> spec — <Name>

**Status:** Draft · **Date:** YYYY-MM-DD · **Milestone:** <MILESTONE> ([ROADMAP](../../ROADMAP.md))
**Related GDD:** <links to docs/gdd/>
```

It must cover: **hypothesis, scope, behavior, acceptance criteria and metrics**. Sections, as in the M2 specs:
hypothesis · scope decisions assumed · scope (in/out) · behavior · initial params · harness · test protocol ·
prerequisites before the `plan.md` · open questions.

- Gameplay only from the GDD. What is missing becomes an open question or a proposal marked as such.
- Scope decisions the spec assumes go in a table (`D1`, `D2`, ...) and only hold with the owner's acceptance.
- Numbers are provisional guesses and must be marked as such.
- Needed ADRs go in the prerequisites section and are made with the `adr` skill.

## 2. plan.md

```markdown
# <MILESTONE> plan — <Name>

**Status:** Draft · **Date:** YYYY-MM-DD
**Spec:** [spec.md](spec.md) · **ADRs:** <links>
```

- Technical decisions, modules and files.
- Every decision that needs the owner's OK is marked and listed in its own table (`P1`..`Pn`, with the proposal and
  the alternative).
- Ends with the implementation order in phases (`F0`, `F1`, ...) and the checkpoints.
- If the plan answers an open question of the spec, when the owner approves move the answer to the spec's decision
  table and remove it from the open questions.

## 3. tasks.md

- One section per plan phase (`## F<n> — <name>`), with atomic checkbox tasks `- [ ]`.
- Each task ends with green tests. Mark `[x]` on completion, in the same commit (`commit` skill).
- Checkpoints with the owner appear as a bold task (`**Checkpoint:** ...`).
- Each phase is implemented on its own branch (`commit` skill).
- When the slice closes, condense the `tasks.md`: a phase table, the checkpoints and the findings.

## Approval

When the owner approves a step:
1. File status → `Approved (YYYY-MM-DD)`.
2. Items that depended on the owner's OK stop being marked as pending.
3. Update `docs/specs/README.md`.
4. Commit with the `commit` skill (e.g. `docs: approve M2 junction spec`).
