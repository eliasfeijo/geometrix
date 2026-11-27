# Harness — developing geometrix with AI agents

How this project is built with AI coding agents (mainly [Claude Code](https://claude.com/claude-code)), and how to
set up your own machine for it. The rules agents follow are in [`CLAUDE.md`](../CLAUDE.md) and
[`.claude/skills/`](../.claude/skills); this page explains the workflow around them.

## The loop

The owner decides the design and approves every gate; agents draft, implement and report. Nothing in the GDD goes
from proposal to decided without the owner's OK.

```mermaid
flowchart LR
  GDD["GDD / pillars<br/>(gdd-decision)"] --> Spec["spec → plan → tasks<br/>(spec-slice)"]
  Spec --> Phase["one phase per branch<br/>(implement-phase)"]
  Phase --> Merge["merge --no-ff into main<br/>(commit)"]
  Merge --> Check{"checkpoint or<br/>playtest?"}
  Check -- "findings" --> GDD
  Check -- "next phase" --> Phase
  Phase -. "architectural decision" .-> ADR["ADR, Proposed<br/>(adr)"]
```

- **Sources of truth:** the table at the top of `CLAUDE.md`. Start from `docs/dashboard/current-status.md`.
- **Skills** (in `.claude/skills/`): `spec-slice` (spec → plan → tasks), `implement-phase` (a phase, from opening to
  merge), `commit` (commit style, branches, merges), `gdd-decision` (recording the owner's decisions), `adr`, `run-wave` (an orchestrator managing a wave of
  phase sessions, below).
- **Fresh sessions.** A session starts with a minimal prompt (e.g. `/implement-phase M2 D F1`) and resumes from the
  repository: the dashboard's Now section, the slice's `tasks.md` and `CLAUDE.md`. Anything the next session needs is
  written there before stopping, not left in a conversation.
- **One kind of work per session.** Implementation, design rounds and human checkpoints/playtests stay in separate
  sessions. Findings from a checkpoint become a new phase with concrete tasks, implemented in a fresh session.
- **Branches.** One branch per phase (`m<milestone>/<slice>-f<phase>-<slug>`), merged into `main` with
  `git merge --no-ff`, so `git log --first-parent main` shows one line per phase. Agents push only when the owner
  asks.

## Running a wave: the orchestrator session

When a slice's phases are planned in waves (e.g. R's `tasks.md`, "Running the phases"), one **orchestrator session**
manages the wave: it plans the lanes and models from the owner's `/usage`, dispatches each phase as a background
Claude session in its own worktree, tells the owner when a lane needs them, reviews each branch and merges it into
`main`. It writes no phase code; each phase is still one `implement-phase` session. The procedure is the
[`run-wave`](../.claude/skills/run-wave/SKILL.md) skill; it was first done in R's wave 3 (2026-11-26/27).

```mermaid
sequenceDiagram
  participant O as Owner
  participant M as Orchestrator (main checkout)
  participant L as Lane session (worktree)
  O->>M: /usage, decisions
  M->>L: scripts/lane.sh (worktree, npm ci, claude --bg)
  L-->>M: SendMessage "needs the owner"
  M-->>O: notification: claude attach <id>
  O->>L: answers in the lane
  L-->>M: SendMessage report + merge message
  M->>M: review, dashboard Now, scripts/merge-phase.sh
  M-->>O: git push origin main (owner runs it)
```

- **Lanes and models.** At most two implementation sessions at once. Lane A (Opus) for the deep phases (`sim` rules,
  the strategist, battle mechanics, determinism), lane B (Sonnet) for server, client, balance runs and soak. Haiku
  runs mechanical, fully specified tooling tasks the orchestrator reviews (`build/fast-check` in wave 3). Free models
  through opencode or Kilo only for well-planned mechanical or read-only work, never `sim`, `battle` or `junction`
  code: a determinism mistake costs a hash rebuild and a re-sweep.
- **`/usage` decides parallel or sequential:** two lanes only with the session below ~50% and the week below ~70%.
  Waiting on processes costs wall time but no tokens, so CPU-bound phases (sweeps, tick-cost readings) gain more from
  a quiet machine than from a second lane.
- **The owner answers in the lane.** A lane messages the orchestrator before it asks anything; the orchestrator
  watches each lane's state (`scripts/watch-lane.sh`, `claude agents --json`: `working`, `blocked`, `done`) and sends
  one notification with `claude attach <id>`.
- **The orchestrator owns the dashboard's Now while lanes run** (two lanes rewriting it collide on every merge). A lane
  writes its phase record in the `tasks.md` and ends with a "For the dashboard" paragraph and its merge message.
- **Review is cheap and targeted:** the report, the commit list, the diff stat, and the diff of what is risky for the
  phase only. Small fixes are the orchestrator's commits on the branch; larger ones go back to the lane.
- **A playtest of a phase** (the owner's) runs from the phase's worktree before its merge; findings go into the repo
  (the phase record, the GDD, the waves table), not into code.
- **Where it runs:** the orchestrator sits in the integration checkout, where `merge-phase.sh` runs; lanes in their
  worktrees. Which directories those are is machine-specific (`CLAUDE.local.md`).

## Your machine: `CLAUDE.local.md`

`CLAUDE.md` is shared and describes no particular machine. What only makes sense on yours (where your checkouts
live, where merges run, how you push, OS quirks) goes into a `CLAUDE.local.md` at the repository root. It is in
`.gitignore`.

- **Claude Code** loads it natively, right after `CLAUDE.md`. The two are concatenated, not merged: the local file
  cannot override the shared one, so write it as **additions**. If you need to contradict `CLAUDE.md`, the shared
  file is probably describing a machine and should be fixed instead.
- **It exists only in the checkout where you create it.** A git worktree is a separate directory, so a session opened
  in a worktree sees only the versioned harness (copy the file there if you want it).
- **opencode and Kilo CLI** do not read it on their own. Add it to their global config (once per machine, works for
  every repository): relative entries are searched from the working directory up to the git root, and missing files
  are skipped.

  ```jsonc
  // ~/.config/opencode/opencode.jsonc and ~/.config/kilo/kilo.jsonc
  "instructions": ["CLAUDE.md", "CLAUDE.local.md"]
  ```

  Kilo (7.7) already reads `CLAUDE.md` when there is no `AGENTS.md`. opencode (2.2.5) did not in practice, despite
  its docs, hence `CLAUDE.md` in the list. opencode's background service caches the config:
  `opencode service restart` after editing it. Both read the skills in `.claude/skills/`.
- **Why there is no `AGENTS.md`:** by default Claude Code reads `AGENTS.md` only when there is no `CLAUDE.md` or
  `CLAUDE.local.md`, so with an `AGENTS.md`-only repository a personal `CLAUDE.local.md` would hide the project's
  rules from Claude.

### Recommended layout: worktrees

Keep `main` in one checkout and give each phase branch its own git worktree, so several agents can work in parallel
without touching `main`:

```sh
git worktree add ../<slug> -b <branch>   # one per phase branch; run npm ci inside
# … work, commit, then from the main checkout:
git merge --no-ff <branch> -F <message-file>
git worktree remove ../<slug> && git branch -d <branch>
```

`scripts/merge-phase.sh <branch> <message-file> [--no-check] [--cleanup]` does the merge, the check on `main`, the
`main..<branch>` test and the cleanup from any checkout, timing each step. A session isolated in its worktree (a
background job) cannot touch the checkout that holds `main`: it ends with that one line for the owner to **paste into
their own terminal**. Not with the `!` prefix: a `!` command runs through the session's worktree guard, which refuses
git in another checkout, and the merge fails with no visible error.

Worktrees share ports (8080, 5173: use `GEO_PORT`) and the CPU, so timing-sensitive tests can skew when several run
at once.

### Example

```markdown
# CLAUDE.local.md — my machine (not versioned)

- This checkout holds `main` and is where merges run. Phase branches get a worktree in `~/work/geometrix/<slug>`.
- git here has no GitHub credentials: finish with local commits and give me the push command.
```
