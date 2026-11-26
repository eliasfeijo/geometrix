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
- **A new word in the closed vocabulary** (an order, a condition, an action, an event, a refusal) touches the same
  places every time; go down the list instead of finding them by typecheck rounds (~20 s each):
  1. `sim`: the type (`orders.ts` `Order`, `autopilot.ts` `Condition`/`Action`, `domination.ts` `OrderInput` and
     `DominationRefusal`, `events.ts` `EventBody`); what it does (`resolveOrders`, `holds`, `orderFor`, `toOrder`,
     `orderRefusal`); the copy and checks of `rules.ts` (`copyCondition`, `copyAction`, `setRulesRefusal`); an
     event's `participants`/`battleOf` in `events.ts`.
  2. `protocol` (`src/index.ts`): the zod `condition`, `action` or `orderInput`; the `sameVocabulary` compile check
     fails until the schema matches the sim.
  3. `client`: `format.ts` (`conditionText`, `actionText`, `orderText`, the refusal texts), `rules-draft.ts`
     (`CONDITION_TYPES`/`ACTION_TYPES`, the labels, `conditionOf`/`actionOf`), `panels/rules-editor.tsx` (the
     fields), `map/creep-layer.tsx` (`orderTarget`), `chronicle/narrate.ts` and `templates.ts` (an event's
     sentence). A word the editor cannot offer yet stays out of `ACTION_TYPES` and the client's vocabulary test says
     why.
  4. Tests: the sim's behavior on a text map; a new param also changes the fixed hashes (serialize, the junction's
     6 h bot world).
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
4. Merge into `main` (`commit` skill), then `npm run check` on `main`. **A session isolated in a worktree** (a
   background job) cannot run git in the checkout that holds `main`: write the merge message to a file and end the
   report with the owner's one line, `scripts/merge-phase.sh <branch> <message-file> [--cleanup]`, which merges,
   runs the check there and cleans up (`--no-check` for a docs-only branch). The owner **pastes it into their own
   terminal**; never offer it with the `!` prefix, which runs it through the session's worktree guard, where git in
   another checkout is refused and the merge fails silently.

## 5. Report to the owner

Short, in the language of the conversation:
- **Delivered:** what the phase does now, with numbers that prove it (times, test counts, measurements).
- **Interpretations to validate:** those assumed in step 2.
- **Needs your OK:** pending decisions, numbered for a quick answer.
- **Points of attention:** workflow friction and warnings.
- **Next:** the following phase and its branch.

## Pitfalls already seen

- **Background sessions refuse complex shell commands.** The worktree guard rejects heredocs, `python -c` with
  several statements, `git -C` or `cd` into another checkout. Write the script to the job's `tmp/` and run it with
  one plain command (`python3 <file>`); edit several files in one script instead of one `Edit` call per hunk.
- **Tests pinned to an emergent moment break with any rule change.** A fixture like "battle 157 opens at tick 8,539"
  moves whenever a rule shifts the bot world (R F2 broke ten server tests that way). Find the moment by searching
  (`firstTeamBattle` in `apps/server/test/helpers.ts`), and give coverage floors (battles in the delta property)
  room, with the measured values in a comment.
- **Know what a check costs** (R F2, 2026-11-25, WSL worktree): `npm run check` ~125–130 s (typecheck ~21 s, lint
  ~5 s, tests ~95 s, of which the protocol's two 6 h delta-property worlds ~48 s); one workspace's tests: `sim`
  ~16 s, `server` ~21 s. Lint fails in ~27 s, before the tests. Iterate with `npx vitest run <files>` and
  `npm run typecheck`; run the full check once per task, before its commit.

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
