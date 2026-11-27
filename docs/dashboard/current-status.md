# Current status

> **How to use.** The top is the snapshot of now. **Now** is **rewritten** when a phase closes, an approval gate is
> passed or a blocker appears: it never accumulates. What a phase measured, interpreted or decided goes to its
> slice's `tasks.md`. The source of truth stays in the linked docs.

## Now

**Updated:** 2026-11-27 (E-min's F2 done, wave 4; F3 next)

| | |
|---|---|
| **Milestone** | **M2 — The ambush** ([ROADMAP](../ROADMAP.md)). M0, M1 and M1.5 ✅ |
| **Slices** | A ✅ 2026-11-17 · B ✅ 2026-11-20 · D ✅ 2026-11-25 · **R — Rebalance and pace** (F1 and F2 done 2026-11-25, F3 and F5 done 2026-11-26, F4 and F6 done 2026-11-27; F7 after E-min's F4), **E-min — The minimal end** (spec and plan approved 2026-11-25, F1 and F2 done 2026-11-27, F3 next) and **K — The DNA kits** (spec and plan approved 2026-11-25, F1 next) |
| **In progress** | **Wave 4** (2026-11-27, sequential, every phase on Sonnet 5.5 by the owner's choice): **E-min's F1 and F2 done** (F1: the end in the world: `concede`, elimination, one team left, none, or the clock; an ended world is frozen; `teamOut` and `worldEnded` to every team, the first blood, the counters, five highlights and `endSummary` in the state and the views. F2: the balanced bot concedes a lost match; `geo sim`, `sweep` and `verify` stop at the end and report it, `--concede team@minute`; bot × bot on 20 seeds always ends at the clock in a draw. **The owner revised the concession** (2026-11-27, "like in LoL"): a minimum match time `end.concedeAfterSeconds` for everyone, the bot included, and for a team with two or more humans a vote in the sim with a deadline, where who has not voted counts as yes; the agent's details (a "no" ends it, the retry wait, 480 and 1440 s) wait for the owner's OK; `SIM_VERSION` 15; [F1 and F2 records](../specs/m2-minimal-end/tasks.md)). **Next: E-min's F3** (network and server, the vote in the delta), then F4 (the end screen, the countdown, the vote panel), then R's F7 with C3 (owner, 2026-11-27: C3 plays with the end). An orchestrator session dispatches the lanes, reviews and merges, and rewrites this Now section after each merge ([HARNESS](../HARNESS.md)). **G's design round done** (2026-11-25: [spec](../specs/m2-groups/spec.md) approved, [plan](../specs/m2-groups/plan.md) waiting for the owner; G stays after K, owner 2026-11-27) |
| **Next front** | **E-min F3, F4** (Sonnet 5.5, sequential) → **R F7** (soak, playtest C3, the ×N chosen) → K → R F8 after K's merge ([R's waves](../specs/m2-rebalance/tasks.md#running-the-phases-waves-lanes-and-models)). Two lanes at most; lane B opens next to lane A only with room in `/usage` (session < ~50%, week < ~70%). E-min's sim phases collide with R's (`SIM_VERSION`, hashes, strategist): the second to merge rebases. Haiku 5.5 runs mechanical, well-specified tooling tasks (it did `build/fast-check`) |
| **Then** | **G — Groups and formations** (after K; spec approved and [plan](../specs/m2-groups/plan.md) drafted 2026-11-25: squads built with Ctrl and the embodied creep, the panel and the selection keys, formations in the world and in battle, the side each DNA engages from, the battle bot's load experiment; lab first; **scope warning:** about R's size), then **P — The friends' playtest** (two teams: humans against humans, or co-op against the bot); after it, **E** (siege and repair) or **T** (more teams), chosen at P's checkpoint |
| **Waiting on the owner** | (1) [ADR-0009](../adr/0009-prediction-in-the-lab.md) (`Proposed`): prediction as a lab experiment option. (2) `gambits.meleeBerthSteps` 3 (provisional, lab F7). (3) K's checkpoint K1 when F5 ends. (4) Whenever the owner wants: PLAYTEST lab group 7 (the movement options). (5) A design round on battles without a human at ×N and the opening hold's purpose (GDD 06's open question, from F4's playtest). |
| **Blockers** | None |

### Next steps

1. **R's F2–F8** from the [approved plan](../specs/m2-rebalance/plan.md) ([tasks](../specs/m2-rebalance/tasks.md);
   `implement-phase` skill), **F6 done** (the client; the F6 record lists what C3 should play), **F4 done** (the 2-hour world at ×8 with the ×6 and ×12 candidates; C2 answered; the F4 record also holds the owner's quick playtest), **F5 done** (the pauses, network and server; the F5 record says what F6 needs to know about `battleHold`), **F3 done** (the strategist; F3 record in the tasks: with the defense only against
   threats, C1-1, no team is wiped at normal or hard, hard beats easy on 10/10 runs, and D16's groups never form on
   the 72-hour world, measured again at F4's C2, C1-2; the tick cost follows the population, 65–78 µs per tick with
   both teams near the cap, accepted at C1-3), **F2 done** (the world vocabulary), from the [approved spec](../specs/m2-rebalance/spec.md)
   (D1–D29). **Waves and models** in the tasks' "Running the phases": two tasks moved (the server's threat pass from F5
   to F3, `geo net` on the new world from F5 to F7) so F5 depends on F2 alone and runs next to F3. **F1 is done:** the pace harness (`--mult`, real minutes, the §7 targets table, `--shock`) and the
   baseline of the 72-hour world at ×6 (F1 record in the tasks): of the measured targets it misses the length (720
   real minutes), the crossing (3.6 min), the opening (first extra creep at real minute 212), exploring (124), the first
   wanderer (10), the population (7/20 seeds) and the recovery (0/20 seeds back within 15 minutes; 15 never). **G's design round** is done (2026-11-25): squads (built with Ctrl; a plain order to a
   free creep is one-shot), dominating (Shift+N) picks the embodied creep (glow and name for all), C's panel, the
   selection keys, the minimal squad orders and the battle's commands through Z, in [GDD 02](../gdd/02-creeps-and-domination.md),
   [GDD 06](../gdd/06-battles.md) and [GDD 07](../gdd/07-autopilot.md); G's [spec](../specs/m2-groups/spec.md) is approved (2026-11-25, D1–D28) and its [plan](../specs/m2-groups/plan.md) (P1–P15, F0–F7) waits for the owner; F1 starts after R's F2 and F3 are in `main`, F3 after K's merge. The spec's starting point, from the round, in the GDD (01, 03, 05, 06, 07):
   a 2-hour match through a shorter world at a moderate ×N with faster DNAs (sweeps with targets for 2 hours; at C2
   the economy gave a first extra creep at ~3 world hours, the first wanderer came at world hour 1 and the map was
   explored by hour 3); the wanderers early and regular; only the pace rescale against the snowball; the opening
   countdown for humans (5 s, paused, an "Entrar" button); "follow"; helping an ally in battle as a preset rule; the
   road builder as an autopilot preset with its plan on the map (replaces the 2026-11-20 bug); the strategist for
   both P modes; the selected creep's destination on the map and the current action's estimated time in the panel.
   **Scope warning:** the largest of the three.
2. **E-min's F1–F5** from the [approved plan](../specs/m2-minimal-end/plan.md) ([tasks](../specs/m2-minimal-end/tasks.md);
   `implement-phase` skill; P1–P13 approved 2026-11-25): F1 the end in the world (`end.ts` as a stage of `step`,
   `concede`, the team out, the first blood, the counters and highlights in the state, `endSummary`), F2 the bot and
   the harness, F3 network and server, F4 client (the end screen, "Desistir", the replay markers by a scan pass), F5
   soak and playtest (checkpoint C1). It shares `strategist.ts`, the CLI reports, `world-host.ts`, the top bar and the
   `SIM_VERSION`/`PROTOCOL_VERSION` bumps with R's phases (plan §9): the second to merge rebases and takes the next
   free numbers.
3. **K's F1–F6** from the [approved plan](../specs/m2-kits/plan.md) (P1–P10; [tasks](../specs/m2-kits/tasks.md);
   `implement-phase` skill), F1 first (the bar and the strike), from the [approved spec](../specs/m2-kits/spec.md)
   (D1–D20, 2026-11-25): Space as every DNA's kit
   key (a tap attacks, a hold fills the DNA's bar: the square's strike and charge, the triangle's guard, the circle's
   fan's range), the double-tap dodge, kits behind on/off params, the gambits and presets, the lab first (K1) and the
   world after (K2). The wanderers' own DNA and kit wait for their own design round (GDD 05). **Scope warning:**
   revises "only base stats in M2".
4. **Session findings** for the specs that touch them: extortion against the bot is almost free (R's strategist); the
   battle AI is predictable in the corridors (GDD 06, parked); a wanderer cannot be selected with a left click (no
   inspector for it); the soak's server process grows from about 150 MB to 210–256 MB within a run (RSS, not
   investigated).
5. **To validate in P:** the interpretations of the junction F4 (1–9), F5 (1–14) and F7 (1–4) records, J6 (two
   humans in one battle, a teammate watching, a third creep joining), and R's F1 record (1–9, the harness's readings
   of the §7 targets).
6. **Design rounds when the owner wants:** the role of cristal (GDD 03), E (siege and repair) and T (more teams, GDD
   01's proposal with the agent's analysis).

### What the next front needs to know about the code

- **The end in the world** (E-min F1, `packages/sim/src/end.ts`): `Team.out`, `WorldState.result` and `highlights`, `Battle.entered`; `checkEnd` is stage 6b of `step` and `recordHighlights` runs with the stats; `endSummary(state)`; `params.end.highlights` 5. The concession (E-min F2, plan P14): `concede` and `rejectConcede`, `Team.vote` and `voteRejectedTick`, the refusals `tooEarly`, `voteCooldown`, `alreadyVoted`, `noVote`, the `concedeVoteOpened`/`Closed` events to the team, `end.concedeAfterSeconds` 7200, `concedeVoteSeconds` 480, `concedeRetrySeconds` 1440 (world s, in every params file); `apps/cli/src/ending.ts` (the End section, the ends table). **Until F3, `main` has known gaps:** the server still ends by tick count, so an elimination or a concession before the clock (the bot's too, reachable after 15 real minutes) makes its next tick throw; the deltas do not carry `result`/`summary`/`vote`, so client and server view hashes differ on the end tick; `geo net` does not stop at the end. `concede` is already in the protocol's command schema; the chronicle's `teamOut`/`worldEnded` sentences are placeholders (F4). `recovery.test` "stopped mid-run without a snapshot" hit its 5 s timeout once under `check:fast` load (0.8 s alone).
- **The 2-hour world** (R F4): `params/default.json` is ×8 (creep 1,100 + 5, road segment 10, matéria regen 5 per 60 s, speeds ■ 3 ▲ 4 ● 7 cells per world minute, the first wanderer at real minute 5); the other candidates run with `GEO_PARAMS=params/pace-x6.json` or `pace-x12.json`; `params/world-72h.json` is the old world. F7: the soak and `geo net` on this world, the ×N chosen at C3. Mechanics tests use `test/params.json`, but the CLI's `sim.test` reads the default's ×N. A whole match simulates in 4–6 s.
- **The world client after R F6** (`apps/client/src`): `map/pick.ts` (`actorsAt`, `creepsUnder`: a left click lists two or more actors in its area, wanderers and spoils selectable), `map/destination.ts` (the selected creep's path and ETA), `store.holds` (the `battleHold` alerts, dropped when the socket opens), the hostile layer, "Seguir", "Largar carga", the road builder's plan; the lobby reads `GET /api/config` (`multiplier` only). For C3: zoomed out the list opens on most clicks near a core or deposit, and the red sword looks like the red "in battle" mark.
- **The check loop** (`build/fast-check`): `npm run check:fast` (~20–80 s: incremental typecheck, cached lint and Prettier, the tests related to uncommitted changes with `GEO_FAST=1`) before each task commit; `npm run check` (~150 s) at the phase's close. A change to the root `package.json` makes `--changed` run every test.
- **The pace harness** (R F1, `apps/cli`): `world.multiplier` in the params (6; the sim never reads it;
  `params/world-72h.json` keeps the 72-hour world); `geo sim`/`geo sweep --mult`, real minutes in the reports;
  `pace.ts` (`PaceTracker`, `pace.json`, the §7 `TARGETS` and the targets table per run and per sweep value;
  `TeamPace.helpJoins` from the encounter tally since R F3); `shock.ts` (`--shock t:n@m`, no `replay.json`, refused
  by `geo verify`); `format.ts` (the report formatters). The tick-cost baseline is ~50 µs per world tick (seed 42,
  the 72-hour world).
- **The strategist** (R F3, `packages/sim/src/strategist.ts`, `threat.ts`): `botsFor(strategists, difficulties)`
  (hard by default); `geo sim --strategist balanced:hard,balanced:easy`; the level comes from the team's first bot
  player (`teamDifficulty`). `threatPass(state, team)` runs on every tick between the full decisions in `botCommands`
  and in `WorldHost.tick`; the settings (posture, groups, `RISK`) live in `BALANCED`, not in the params.
  `apps/cli/src/choices.ts` reads the bots' choices from the log for report.md's "Estrategista" section.

- **Packages:** `packages/battle` (pure combat, ADR-0008, `BATTLE_VERSION` 6: a participant's `control` changes only
  that participant, so several humans play one battle; the lab's page releases its previous one itself),
  `packages/sim` (the world; battle stubs, `Creep.battle`, the wanderers; `SIM_VERSION` 13), `packages/junction`
  (`createHost`, `stepJunction` on the world clock, `stepRealtime` for real-time battles, `setScreen`, `setHold`,
  `serializeHost`/`restoreHost`, `replayResults`), `packages/protocol` (`PROTOCOL_VERSION` 8; `battleHold`, `battlePause`, `battleOpen`,
  `battleFrame` with `applyBattleDelta`, `battleScreen`, `battleInput`).
- **The server** (`apps/server`): `WorldHost` steps through the junction host; results go into the tick's log as the
  system player's; the `battles` and `battle_ticks` tables, written in the tick's transaction, rebuild open battles on
  recovery (on the world clock until a human is back, N-3); `battle-clock.ts` steps real-paced battles every 50 ms;
  screens per socket, frames only to open screens, inputs only for the dominated participant; `holds.ts` (one per
  hosted world, in `Worlds`) holds battles for the opening pause and P, never stored. With a human connected, every
  new battle waits 5 real seconds: scripts that play over WebSocket have to allow for it.
- **The soak test** (`npm run soak`, `apps/server/src/soak*.ts`): a bot × bot world ×360 with `kill -9` and restart,
  WebSocket clients following the deltas, the exported replay checked against the server's hash. Since F7 each kill
  waits for a battle open in the tables, and `checkBattles` replays every ended battle's log to its final hash and
  to the world log's results (canonical JSON: the exported replay orders keys differently).
- **The world client's battle screen** (`apps/client/src`, F5): `battle/` holds what the lab shares (arena view,
  keyboard, motion, interpolation, signs, result table, events list, labels, `battle.css`); `battle-session.ts` (the
  screen from the messages, the auto-open), `battle-control.ts` (requests, reconnect, inputs, the round trip),
  `battle-screen.tsx` (the screen and the map's "Voltar à batalha" banner), `map/battle-layer.tsx` (bubble, sign,
  "in battle" mark), `panels/battle-inspector.tsx` (the battle's inspector and the watch button). `store.shownBattle`
  is the battle shown, `store.battleScreen` its data, `store.motion` the movement drawing.
- **Smoke tests in Chromium:** `npm run dev:multi -- --clients 2 --mult 36 --no-open` prints each player's URL with
  its token; a Node script can play the same players over WebSocket (dominate, order, approach) while the headless
  Chromium in the Playwright cache shows their tabs over CDP (`--remote-debugging-port`; `Input.dispatchKeyEvent`,
  `Input.dispatchMouseEvent`, `Page.captureScreenshot`). A command sent right after `dominate` is refused
  (`notDominating`) until the next world tick applies it. Stop the server before `npm run check`: its CPU makes the
  server tests time out.
- **The baseline** for D's comparisons is in the [tasks](../specs/m2-junction/tasks.md) F1 record.
- **The UI text is in Portuguese** (the chronicle templates, the lab and the world client). The repo is English-only;
  translating the UI is an open question for the owner.
