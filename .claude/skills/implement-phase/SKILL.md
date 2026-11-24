---
name: implement-phase
description: Runs a phase of a geometrix tasks.md (e.g. M2 D F3), from opening to merge into main: raises gaps with the owner before coding, implements task by task with tests and commits, closes the phase with the dashboard and the merge, and reports. Use when starting or resuming the implementation of a phase.
---

# Implementing a phase

The procedure observed in the M1, M1.5 and M2 phases. Code conventions: the "`sim` conventions" section of
`CLAUDE.md`. Commits and branches: the `commit` skill.

A request for several phases (e.g. "run the junction", "F3 onwards"): one phase at a time, each with its closing and
merge, until done or until a checkpoint that needs the owner's judgment (section 4).

## 1. Opening

1. Read the top of `docs/dashboard/current-status.md` (the **Now** section: current phase, what it needs to know
   about the code, live pending items). In a fresh session, it and `CLAUDE.md` are the whole context: what the
   previous phase learned has to be there or in the slice's `tasks.md`.
2. Read the phase's section in the `tasks.md` and the `plan.md` and `spec.md` sections it cites or depends on
   (behavior, params, pipeline). Read the code the phase will extend.
3. The branch the `tasks.md` gives the phase. If it does not exist, create it from `main` (`commit` skill). If it
   exists (it may have docs/harness commits between phases), continue on it. Run `npm ci` in a fresh checkout.

## 2. Gaps before coding

Before the first line of code, list what the phase needs and that **neither the spec nor the plan defines**:

- **Values** (quantities, distances, times, costs): propose guesses and ask the owner **in a single grouped
  question**, with the proposed values visible. The approved ones go into the params (`params/default.json`,
  `params/battle.json`) as provisional. Never as a number in the code.
- **Gameplay rules** that change what the player sees or decides: ask (the "Do not invent gameplay" rule).
- **Implementation details** the plan leaves open and that do not change player decisions: go with the most literal
  or simplest reading, record it in the phase's entry in the `tasks.md` as "to validate in the playtest", and cite it
  in the final report.
- If a neutral value is needed to proceed (e.g. starting stock 0), use it as a parameter and mark it as pending
  confirmation in the dashboard's "Waiting on the owner".

## 3. Each task's cycle

1. Implement in the right package, following the `CLAUDE.md` conventions.
2. Tests with the code: behavior through the real path (`step`, `stepBattle`), edge cases, and a property over many
   seeds when the rule holds for any map. When there is an external reference implementation, compare with it.
3. If the `WorldState` format changed on purpose, update the fixed hash:
   `npx vitest run packages/sim/test/serialize.test.ts -u`, then `npx prettier --write packages/sim`. Only that test
   gets `-u`; any other snapshot failure is a bug until proven otherwise. The battle package has the same rule for its
   fixed hash and `BATTLE_VERSION`.
4. `npm run check` green.
5. Mark `[x]` in the `tasks.md` and commit (`commit` skill) with the task and the `[x]` together.

- **Order:** if a task depends on one listed later, do the dependency first. Each keeps its own commit and `[x]`.
- **A refactor** that comes up goes in a separate `refactor` commit.
- **An owner's decision mid-phase:** record it in the spec/plan (and in the GDD, via the `gdd-decision` skill) in a
  separate `docs` commit and remove the item from the dashboard's pending list.
- **An architectural decision** detected: stop and use the `adr` skill.

## 4. Closing

1. All the phase's tasks `[x]`; the phase checkpoint (if any) met. **A checkpoint the owner judges** (a failed
   criterion, the economy, a plan decision left for the checkpoint): run the measurements, put the numbers in the
   phase's record in the `tasks.md` and the numbered questions in "Waiting on the owner" in the dashboard's Now
   (`docs` commit), report and **stop before the merge**. With the answer, record the decision in the `tasks.md`,
   in the plan (decisions section) and in the GDD if it is gameplay (`gdd-decision` skill); then the closing goes on.
2. Hot-path code (pathfinding, the tick loop, the battle step): measure with a scratchpad script and compare with the
   spec's budget. Cite the number in the report. To find the cost: `node --cpu-prof --cpu-prof-dir=<scratchpad>/prof
   apps/cli/src/main.ts sim ...` and sum time per function from the `.cpuprofile` (JSON) with a script.
3. Update `docs/dashboard/current-status.md`. **Rewrite the Now section** (never accumulate in it): next phase, what
   it needs to know about the code, live pending items (remove the resolved ones). What the phase measured,
   interpreted and decided goes into its record in the slice's `tasks.md`. Commit
   `docs: update status dashboard for the end of F<n>`.
4. Merge into `main` (`commit` skill), then `npm run check` on `main`.

## 5. Report to the owner

Short, in the language of the conversation:
- **Delivered:** what the phase does now, with numbers that prove it (times, test counts, measurements).
- **Interpretations to validate:** those assumed in step 2.
- **Needs your OK:** pending decisions, numbered for a quick answer.
- **Points of attention:** workflow friction and warnings.
- **Next:** the following phase and its branch.

## Pitfalls already seen

- **"Green" is `npm run check`'s exit code, not filtered output.** In `npm run check | grep ... && git commit`, the
  `grep` decides the `&&`: a red typecheck or lint passes, because `grep` finds lines. Run
  `npm run check > <scratchpad>/check.log 2>&1; echo "exit $?"` and only commit with `exit 0`. Not even
  `; git commit` after the check: the `;` commits anyway. In the same command, only with
  `rc=$?; [ $rc -eq 0 ] && git commit`.
- Vitest writes inline snapshots outside Prettier's style: run Prettier after `-u`.
- The ESLint `lintText` warm-up is slow (it was ~9 s on `/mnt/c`): tests that use ESLint warm up in a `beforeAll`
  with a long timeout.
- Node's `parseArgs` refuses `--opt -1` (ambiguous); use `--opt=-1`.
- **A baseline from another revision** (e.g. the hash and the time before the slice): `git worktree add --detach
  <scratchpad>/base <rev>`, `npm ci --prefer-offline --no-audit --no-fund` inside it (~1 min), and run `geo` in both,
  in sequence, twice each: WSL timing varies ~±0.5 s in 10 s. At the end, `git worktree remove`.
- A long bot × bot world test (6 h with production) exceeds Vitest's default 5 s with the whole suite running: give
  it an explicit timeout (`test(..., 30_000)`). Some CLI tests (`net.test.ts`) brush the 5 s under parallel load.
- A mirrored world that diverges between the teams: find the first tick with a script that compares team 1's entities
  mirrored (`mirrorCell`) with team 0's. A game-rule divergence (e.g. the id tie-break at a contested deposit) goes to
  the owner; a code one is a bug.
