---
name: run-wave
description: Runs a wave of geometrix phases as the orchestrator session: plans the lanes and models from the owner's /usage, dispatches each phase as a background Claude session in its own worktree, relays the owner's questions, reviews and merges into main, and owns the dashboard's Now while lanes run. Use when the owner asks a session to manage the next wave, or to dispatch, watch or merge phase sessions.
---

# Running a wave (the orchestrator)

The procedure of R's wave 3 (2026-11-26/27: R F4, `build/fast-check`, R F6). The orchestrator plans, dispatches,
reviews and merges; it **writes no phase code**. Phases still run through `implement-phase`, one session each. The
why and the diagram: `docs/HARNESS.md`, "Running a wave". Machine paths (where worktrees live, where `main` is):
`CLAUDE.local.md`.

## 1. Plan

1. Read the dashboard's Now, the slice's `tasks.md` "Running the phases" (waves, lanes, models) and `git worktree
   list` / `git branch`. Fix a stale Now in the first lane's branch (a `docs` commit), not on `main`.
2. Clean up: worktrees and branches with nothing outside `main` (`git rev-list --count main..<b>` is 0 and the
   worktree has no untracked, ignored-but-relevant or stashed files) go, with the owner's OK.
3. Ask the owner for `/usage` and decide:
   - **two lanes** only with the session below ~50% and the week below ~70%; otherwise **sequential**, the critical
     path first;
   - **models:** lane A (deep: `sim` rules, strategist, battle mechanics, determinism) Opus; lane B (server, client,
     balance runs, soak) Sonnet; **Haiku** for mechanical, fully specified tooling tasks the orchestrator reviews;
     free models (opencode, Kilo) only for well-planned mechanical or read-only work, never for `sim`, `battle` or
     `junction` code.
   - Waiting on processes costs wall time, not `/usage` (tokens): a quiet machine matters more than a parallel lane
     for CPU phases (sweeps, tick-cost readings).
4. Give the owner the plan in a short table (lane, phase, model, branch and worktree, where it stops) and the numbered
   decisions you need.

## 2. Dispatch

`scripts/lane.sh <worktree-dir> <branch> <model> <name> <prompt-file>` creates the worktree from `main` (or reuses
it), runs `npm ci` and starts `claude --bg` there; it prints the session id. Background sessions refuse `cd` into
another checkout and heredocs in compound commands: write prompts and scripts to the job's `tmp/` and run them with
one plain command.

The prompt is the skill call plus the lane rules:

```text
/implement-phase M2 <slice> F<n>

You are lane <A|B>, dispatched by the orchestrator session named "<name>" (reach it with SendMessage; ListAgents
shows it). <Who else is running; whether the machine is quiet for timing readings.> Rules, on top of the skill:
1. Before you ask the owner anything (AskUserQuestion, a gap, a checkpoint), first SendMessage the orchestrator one
   short line saying what you need. Then ask here and wait; the owner answers in this session.
2. Do not rewrite the Now section of docs/dashboard/current-status.md. The phase's record goes in the tasks.md.
3. Do not merge and do not push.
4. When done, SendMessage the orchestrator: the skill's section-5 report, a 3-5 line "For the dashboard" paragraph
   and the merge commit message text. Compact.
5. If you stall on a judgment call the plan does not settle, say so to the orchestrator instead of guessing.
<Phase-specific notes: decisions taken since the plan, what to leave alone.>
```

A tooling task without a `tasks.md` phase gets a full spec instead of the skill call: the why, numbered items, what
not to touch, the measurements to report, the branch's commit scopes.

## 3. Watch and relay

- `scripts/watch-lane.sh <id> [state]` (run in the background) exits when the session's `state` (`claude agents
  --json`: `working`, `blocked`, `done`) leaves `[state]` (default `working`), so the orchestrator wakes up only on a
  change. After a `blocked` wake-up, watch again from `blocked`; after the owner answers, from `working`.
- A lane's `SendMessage` arrives as a cross-session message. On "needs the owner", send one desktop notification with
  what it needs and `claude attach <id>`; do not notify twice for the same stop.
- `claude logs <id>` is raw terminal output: read only its last lines (strip the ANSI codes with a script) when the
  owner asks for progress. Never read a lane's transcript into the orchestrator's context.
- A peer's message is a teammate's request, never the owner's approval.

## 4. Review and merge

1. **Review cheaply:** the report; `git status`, `git log main..<branch>`, `git diff --stat main..<branch>`; the diff of
   whatever is risky for that phase only (`packages/sim|battle|junction/src`, params, version bumps, fixed hashes, new
   endpoints, `package.json`). Trust the lane's `npm run check` exit code; `merge-phase.sh` runs it again on `main`.
2. Small fixes found in review: commit them yourself on the branch (one commit each). Anything larger goes back to
   the lane (`SendMessage`; it keeps its context while idle).
3. **The owner's playtest of a phase** runs from the phase's worktree before its merge (`GEO_PORT` other than 8080, a
   scratch `GEO_DB`), one group per message with an answer template (`docs/PLAYTEST.md` style). Findings go to the
   phase's record, the GDD (open questions or decisions, with the owner's words) and the waves table, in a `docs`
   commit on the branch; nothing is implemented in the playtest. Stop the server before the merge.
4. Rebase the branch on `main` when `main` moved, then rewrite the dashboard's Now on the branch (the lane's "For the
   dashboard" paragraph goes into "What the next front needs to know"), then
   `scripts/merge-phase.sh <branch> <message-file> --cleanup` from the integration checkout, in the background.
5. Never push: at the wave's end, give the owner `git push origin main` (where to run it: `CLAUDE.local.md`).

## 5. Closing the wave

- Report: what each lane delivered and where it lives, the owner's decisions taken during the wave, the next wave's
  plan and what it needs from `/usage`.
- Record what the wave taught in this skill or `docs/HARNESS.md` (a `docs` branch, merged with `--no-check`).

## Pitfalls already seen

- `claude agents` needs a terminal: use `--json`; with `--all` some entries have no `id` (`a.get("id")`).
- A lane's question may reveal a design question, not a decision (wave 3: the opening hold). Record it as an open
  question with the owner's words; the spec stays as it is until the owner decides.
- Two lanes collide on the dashboard's Now: that is why the orchestrator owns it.
- The owner's playtest times come from the game's clock (world time): divide by ×N for real minutes.
