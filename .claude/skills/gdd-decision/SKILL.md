---
name: gdd-decision
description: Records an owner's decision in the geometrix GDD, moving the item from Proposal/Open questions to Decided, or adds a proposal, question or new system. Use when the owner decides something about design or when gameplay shows up that is not in the GDD.
---

# A decision in the GDD

Sources: `CLAUDE.md` (the rules "Decided × proposed × open", "Do not invent gameplay" and "Scope guard") and
`docs/gdd/README.md`.

## Structure of each GDD file

| Section | What goes in |
|---|---|
| `## Decided` | Only what the owner explicitly approved. |
| `## Proposal` | Suggestions not approved yet. |
| `## Parked (the owner's ideas, no milestone)` | Optional. The owner's ideas kept as direction, not planned. |
| `## Open questions` | What has no answer yet. |

## Rules

- **Never promote a proposal to decided without the owner's explicit OK.** "Looks good" said by you does not count.
  In doubt whether the owner approved, ask.
- **Do not invent gameplay.** If what you need is not in the GDD or the spec, ask. A suggestion goes in `Proposal`,
  never in `Decided`.
- **Numbers** (costs, times, stats) are provisional until validated in a playtest or simulation. Even when decided,
  they stay marked as provisional in the text.
- **An idea the owner brings up is not a decision.** Record it in `Parked` (or `Proposal`, if it belongs to the
  current milestone), in the owner's words, and ask whether it should become a decision. Brainstorms do not get their own
  files unless the owner asks.

## Recording an owner's decision

1. Find the item in `Proposal`, `Parked` and/or `Open questions` (it may be in more than one, or in more than one
   file).
2. Write the decision in `Decided`, in the words of what the owner decided. Add no details the owner did not give.
3. **Remove** the item from `Proposal`, `Parked` and `Open questions`.
4. If the decision changed what the proposal said, the text in `Decided` follows the decision, not the proposal.
5. Look for the same question in specs (`docs/specs/*/spec.md`, "Open questions") and other GDD files (`grep`), and
   update them too.
6. If the decision has an architectural impact, use the `adr` skill.

## Adding a new system to the GDD

1. **Scope guard:** first tell the owner in which `docs/ROADMAP.md` milestone the system would come in and whether it
   grows the current milestone's scope. Do not accept it silently.
2. With the owner's OK: create `docs/gdd/NN-<slug>.md` with the sections above and add the row to the
   `docs/gdd/README.md` index, with the milestone.

## Commit

Use the `commit` skill: type `docs`, no scope (e.g. `docs: decide domination cooldown in GDD 02`).
