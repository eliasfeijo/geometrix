---
name: adr
description: Drafts a geometrix ADR (status Proposed), accepts or supersedes an ADR with the owner's OK, and keeps the docs/adr/README.md index. Use when an architectural decision shows up or when the owner approves/rejects an ADR.
---

# ADR

Sources: `CLAUDE.md` (the ADR rule) and `docs/adr/README.md` (the status flow).

## When to use

- On **detecting an architectural decision** during any work: stop, tell the owner and draft the ADR. Do not
  implement the decision as if it were accepted.
- When the owner **approves** an ADR: change the status to `Accepted`.
- When a new decision **replaces** an old one: the old one becomes `Superseded by NNNN`.

## Status

| Status | Who decides |
|---|---|
| `Proposed` | A draft always enters like this. |
| `Accepted (YYYY-MM-DD)` | **Only with the owner's explicit approval.** The date is the approval's. |
| `Superseded by NNNN` | When a later accepted ADR replaces this one. |

Never write `Accepted` on your own, even if the decision looks obvious.

## Creating an ADR

1. Next number: the largest `NNNN` in `docs/adr/` + 1, with 4 digits.
2. File: `docs/adr/NNNN-<slug>.md`, with a short lowercase hyphenated English slug.
3. Content, in English:

```markdown
# ADR-NNNN: <Title>

**Status:** Proposed · **Date:** YYYY-MM-DD
**Related:** ADR-XXXX (<why>), <related spec/GDD/ROADMAP>

## Context
<The problem and the forces at play. Orders of magnitude when they matter.>

## Alternatives
- **A. <option>** (recommended).
  - Pros: ...
  - Cons: ...
- **B. <option>.**
  - Pros: ...
  - Cons: ...

## Decision
<What is proposed and the rules that follow from it.>

## Consequences
<What changes, what gets more expensive, what needs to be checked.>
```

- `**Related:**` is optional.
- While the ADR is `Proposed`, mark the option as **(recommended)**. When the owner accepts, change it to
  **(chosen)**.
- Diagrams only in Mermaid.
- A choice left for later (e.g. "to decide in the `plan.md`") must be stated explicitly.

4. Add the row to the table in `docs/adr/README.md`:
   `| [NNNN](NNNN-<slug>.md) | <Title> | Proposed | YYYY-MM-DD |`
5. Give the owner a summary: the decision, the recommended alternative and what depends on it.

## Accepting an ADR (with the owner's OK)

1. Status → `**Status:** Accepted (YYYY-MM-DD) · **Date:** <original date>`.
2. Recommended option → **(chosen)**. If the owner picked another option, rewrite the Decision accordingly.
3. Update the status in the `docs/adr/README.md` table.
4. If the ADR was a prerequisite of a spec, tell the owner the prerequisite is met.

## Superseding an ADR

1. The new ADR follows the creation flow and cites the old one in `**Related:**`.
2. Only after the new one is accepted: the old one becomes `**Status:** Superseded by NNNN`, here and in the index.

## Commit

Use the `commit` skill: type `docs`, no scope (e.g. `docs: propose ADR-0010 <subject>`, `docs: accept ADR-0010`).
