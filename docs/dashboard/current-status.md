# Current status

> **How to use.** The top is the snapshot of now. **Now** is **rewritten** when a phase closes, an approval gate is
> passed or a blocker appears: it never accumulates. What a phase measured, interpreted or decided goes to its
> slice's `tasks.md`. The source of truth stays in the linked docs.

## Now

**Updated:** 2026-11-26 (R's F3 done: the strategist; C1 answered; F4 next after F3 and F5 merge)

| | |
|---|---|
| **Milestone** | **M2 — The ambush** ([ROADMAP](../ROADMAP.md)). M0, M1 and M1.5 ✅ |
| **Slices** | A ✅ 2026-11-17 · B ✅ 2026-11-20 · D ✅ 2026-11-25 · **R — Rebalance and pace** (F1 and F2 done 2026-11-25, F3 done 2026-11-26; F5 in its lane, F4 next), **E-min — The minimal end** (spec and plan approved 2026-11-25, F1 next) and **K — The DNA kits** (spec and plan approved 2026-11-25, F1 next) |
| **In progress** | **R's F3 done** (2026-11-26, the strategist: the difficulty levels, the D17 posture, the D14 defense against threats, the D16 groups and escort, the D27 threat pass in the harness and in `WorldHost`, their metrics in report.md), branch `m2/rebalance-f3-strategist` waiting for the owner's merge (`scripts/merge-phase.sh`); C1 answered (C1-1..C1-3, F3 record in the [tasks](../specs/m2-rebalance/tasks.md), ten interpretations to validate). **R's F5** runs in lane B (`m2/rebalance-f5-pauses`); **next in lane A: wave 3**, F4 (the balance pass) once F3 and F5 are in `main`; **G's design round done** (2026-11-25, on `docs/g-design`: squads, the embodied creep, the panel, formations; the [spec](../specs/m2-groups/spec.md) approved and the [plan](../specs/m2-groups/plan.md) drafted; GDD 02, 06, 07); **E-min's F1** (the end in the world) waiting for a lane (below): the [E-min spec](../specs/m2-minimal-end/spec.md) and [plan](../specs/m2-minimal-end/plan.md) approved 2026-11-25, worktree `~/workspace/geometrix/emin-f1` on `m2/emin-f1-world`; **K's F1** (the bar and the strike) waiting for a lane (below): the [K spec](../specs/m2-kits/spec.md) and [plan](../specs/m2-kits/plan.md) approved 2026-11-25, worktree `~/workspace/geometrix/kits-f1` on `m2/kits-f1-bar-strike` |
| **Next front** | The phases of **R**, **E-min** and **K** in **two lanes at most** ([R's waves](../specs/m2-rebalance/tasks.md#running-the-phases-waves-lanes-and-models)): lane A on Opus 5.5 for the deep phases (`sim` rules, strategist, battle mechanics), lane B on Sonnet 5.5 for server, client, balance runs and soak. R: wave 1 F2 alone; wave 2 F3 (A) ∥ F5 (B); wave 3 F4 then F6 (B), lane A free for E-min or K; wave 4 F7; F8 after K's merge. Lane B opens only with room in `/usage` (session < ~50%, week < ~70%); otherwise sequential. K is the safe partner (no file shared with R F2–F7); E-min's sim phases collide with R's (`SIM_VERSION`, hashes, strategist) |
| **Then** | **G — Groups and formations** (after K; spec approved and [plan](../specs/m2-groups/plan.md) drafted 2026-11-25: squads built with Ctrl and the embodied creep, the panel and the selection keys, formations in the world and in battle, the side each DNA engages from, the battle bot's load experiment; lab first; **scope warning:** about R's size), then **P — The friends' playtest** (two teams: humans against humans, or co-op against the bot); after it, **E** (siege and repair) or **T** (more teams), chosen at P's checkpoint |
| **Waiting on the owner** | (1) [ADR-0009](../adr/0009-prediction-in-the-lab.md) (`Proposed`): prediction as a lab experiment option. (2) `gambits.meleeBerthSteps` 3 (provisional, lab F7). (3) K's checkpoint K1 when F5 ends. (4) Whenever the owner wants: PLAYTEST lab group 7 (the movement options). |
| **Blockers** | None |

### Next steps

1. **R's F2–F8** from the [approved plan](../specs/m2-rebalance/plan.md) ([tasks](../specs/m2-rebalance/tasks.md);
   `implement-phase` skill), **F3 done** (the strategist; F3 record in the tasks: with the defense only against
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
  `packages/sim` (the world; battle stubs, `Creep.battle`, the wanderers; `SIM_VERSION` 11), `packages/junction`
  (`createHost`, `stepJunction` on the world clock, `stepRealtime` for real-time battles, `setScreen`,
  `serializeHost`/`restoreHost`, `replayResults`), `packages/protocol` (`PROTOCOL_VERSION` 7; `battleOpen`,
  `battleFrame` with `applyBattleDelta`, `battleScreen`, `battleInput`).
- **The server** (`apps/server`): `WorldHost` steps through the junction host; results go into the tick's log as the
  system player's; the `battles` and `battle_ticks` tables, written in the tick's transaction, rebuild open battles on
  recovery (on the world clock until a human is back, N-3); `battle-clock.ts` steps real-paced battles every 50 ms;
  screens per socket, frames only to open screens, inputs only for the dominated participant.
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
