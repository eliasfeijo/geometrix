---
name: commit
description: Creates commits in geometrix's Conventional Commits style, one per logical unit of work, on the phase branch. Use whenever committing in this repository.
---

# Commit

geometrix commit rules. Sources: the owner's request (Conventional Commits, one commit per logical unit), `CLAUDE.md`
(everything in English) and the package layout of the [M1 plan §1](../../../docs/specs/m1-wealth-cycle/plan.md).

## Branches

- `main` is the default branch and **the owner's**. Phase work is not committed on it directly.
- Each phase of a `tasks.md` has its branch: `m<milestone>/<slice>-f<phase>-<slug>` (e.g. `m2/junction-f1-contract`),
  created from `main`. Where it is checked out is the local setup's call (`CLAUDE.local.md`, if any).
- At the end of the phase, with `npm run check` green, the branch enters `main` with **`git merge --no-ff`** (never
  squash or rebase): each phase becomes a merge commit, `git log --first-parent main` shows one line per phase, and the
  per-unit commits are kept. Message: `merge: m2/junction-f1-contract (M2 D F1 — The contract)`, with a body
  summarizing the phase and the trailers. `git merge` does not read `-F -`: write the message to a scratchpad file and
  use `git merge --no-ff <branch> -F <file>`, in the checkout that has `main`, or `scripts/merge-phase.sh <branch>
  <file>`, which does it from any checkout (with the checks and the cleanup; the owner runs it in their own
  terminal when the session is isolated in a worktree, never through the session's `!` prefix).
- Before the merge, update `docs/dashboard/current-status.md` on the phase branch itself.
- Work between phases (docs, owner decisions, harness) goes in as the first commits of the **next** phase's branch,
  created from `main` if it does not exist yet, or on a `docs/<slug>` branch.
- Before committing, check the current branch. If the work belongs to no phase (e.g. design for another milestone),
  **ask the owner** where to commit.
- **Pushing:** the owner pushes. Never push to `main`, never force-push.

## Logical unit

One commit = one logical unit of work, describable in one sentence with no "and also".

- A task of the `tasks.md` is usually one commit. The task's `[x]` goes **in the same commit** that completes it.
- If a task has independent parts (e.g. a preparatory refactor + the change), split them into commits.
- Never mix unrelated changes in one commit (e.g. a doc fix in the middle of a feature).
- Code and its tests go together.
- A task is only marked `[x]` with green tests.

## Format

```
<type>(<scope>)!: <description>

<body>

<footers>
```

- **Language:** English, throughout.
- **description:** imperative mood, lowercase start, no final period.
- **`!`** and/or the `BREAKING CHANGE: ...` footer when it breaks a contract (e.g. the command vocabulary, versioned
  by ADR-0002, or the log/snapshot format of ADR-0004).
- **body:** optional. Explains the **why** when the diff does not make it obvious.
- **footers:** the attribution trailers the harness indicates.

### type

| type | Use |
|---|---|
| `feat` | New behavior of the game, server, client or CLI |
| `fix` | Bug fix |
| `refactor` | Code change with no behavior change |
| `perf` | Performance improvement |
| `test` | Tests only |
| `docs` | Documentation only (GDD, ADR, spec, README, CLAUDE.md) |
| `build` | Dependencies, `package.json`, tsconfig, Docker |
| `ci` | GitHub Actions |
| `style` | Formatting only |
| `chore` | Maintenance that fits nothing above (e.g. harness skills in `.claude/`) |

### scope

Optional. A closed list:

| scope | Where |
|---|---|
| `sim` | `packages/sim` |
| `battle` | `packages/battle` |
| `junction` | `packages/junction` |
| `protocol` | `packages/protocol` |
| `server` | `apps/server` |
| `client` | `apps/client` |
| `cli` | `apps/cli` |
| `params` | `params/` |
| `infra` | `infra/` |
| `docs` | `docs/` |
| `repo` | The repository root: toolchain, configs, `.claude/`, `CLAUDE.md` |

- Omit the scope when the commit spans several of them, or when it would only repeat the type (`docs(docs)`).
- Need a scope not on the list? **Ask the owner** before inventing one.

## Step by step

1. `git status` and `git diff`: understand everything that changed.
2. Group the changes into logical units. If there is more than one, make more than one commit.
3. Add files **by name** (`git add <files>`). No `git add -A` or `git add .` without checking.
4. `git diff --staged`: check that only the unit is staged.
5. If the commit completes a task, run the `CLAUDE.md` checks first and only go on with them green.
6. Commit with the message in a heredoc (`git commit -F - <<'EOF' ... EOF`).
7. `git log --oneline -n 5` to confirm.

Never use `--no-verify`, `--amend` on a published commit, or `push`, unless the owner asks.

## Examples

```
feat(sim): add seeded xoshiro128** rng with serializable state
build(repo): set up npm workspaces and pin node version
docs: approve M1 plan and decisions P1-P6
fix(server): release domination on websocket close
```
