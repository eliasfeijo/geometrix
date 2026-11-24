# Current status

> **How to use.** The top is the snapshot of now. **Now** is **rewritten** when a phase closes, an approval gate is
> passed or a blocker appears: it never accumulates. What a phase measured, interpreted or decided goes to its
> slice's `tasks.md`. The source of truth stays in the linked docs.

## Now

**Updated:** 2026-11-24 (end of F3)

| | |
|---|---|
| **Milestone** | **M2 — The ambush** ([ROADMAP](../ROADMAP.md)). M0, M1 and M1.5 ✅ |
| **Slices** | **A — The encounter** ([spec](../specs/m2-encounter/spec.md) · [plan](../specs/m2-encounter/plan.md) · [tasks](../specs/m2-encounter/tasks.md)) ✅ 2026-11-17 · **B — The battle lab** ([spec](../specs/m2-battle-lab/spec.md) · [plan](../specs/m2-battle-lab/plan.md) · [tasks](../specs/m2-battle-lab/tasks.md)) ✅ 2026-11-20 |
| **In progress** | **D — The junction** ([spec](../specs/m2-junction/spec.md) · [plan](../specs/m2-junction/plan.md) · [tasks](../specs/m2-junction/tasks.md)), spec and plan ✅ 2026-11-24. **F1** ✅ (the baseline, the battle contract, the `junction` package) · **F2** ✅ (the world side: stub, lock, joins, the result commands; `SIM_VERSION` 10) · **F3** ✅ (the junction host, every harness caller through it, `geo verify` with the two logs, the battle metrics; checkpoint C1 decided) |
| **Next front** | **F6 — The wanderers, moved before F4/F5** (C1-1; branch `m2/junction-f6-wanderers`): first the **junction matrix** (C1-2) and the **spawn zones' distance as a param** (C1-3), then the wanderers; **checkpoint C1b** (the matrix, the zones' value, the bot × bot report with wanderers against C1, whether the bots need changing) |
| **Then** | F4 (network and server), F5 (client), F7 (soak and playtest); then **P — The friends' playtest**; E's order vs. P decided at D's checkpoint C2 |
| **Waiting on the owner** | (1) [ADR-0009](../adr/0009-prediction-in-the-lab.md) (`Proposed`): prediction as a lab experiment option. (2) `gambits.meleeBerthSteps` 3 (provisional, lab F7). (3) Whenever the owner wants: [PLAYTEST](../PLAYTEST.md) lab group 7 (the four movement options at 0 and 150 ms), which feeds the prediction decision |
| **Blockers** | None |

### Next steps

1. **F6** from the [tasks](../specs/m2-junction/tasks.md), up to checkpoint C1b (stop before the merge with the
   numbers and numbered questions). Why it moved up: the F3 record's "C1 decisions" (the C1 bot × bot battles were
   all early, 1 × 1, from refused extortions, with outcomes set by the victim's DNA; causes: the bots' policy and the
   spawn zones ~10 cells from the exit ring). The matrix comes first: `geo battle sweep`'s shape, but each battle
   built by `battleSetup` from a hand-built world stub (DNA × DNA, loaded or empty, fight or carrier), so it measures
   the junction's real arenas and setups, apart from the strategist.
2. **🐞 The road-builder preset does not work for the player** (owner, 2026-11-20, seen since before slice A): it asks
   for a point on the map, but nothing happens on click or mouse move (no road or cost preview); a road can only be
   built by dominating a creep, in road mode. The bots build with the same preset, so the `sim` works. Hypotheses: the
   picking mode has no preview or feedback; the target is accepted without checking a road is possible, and the creep
   silently falls back to "gather matéria"; a dominated creep runs no rules. **A short fix session** (repro, test,
   fix), alongside D: the "15 minutes a day" style depends on the presets.
3. **Session findings** for the rounds that touch them: the roll-only fight does not pay off the risk (D replaces
   it); extortion against the bot is almost free; the mid-game at ×6 empties after exploring (encounter F6, C14); the
   battle AI is predictable in the corridors (GDD 06, parked).
4. **Design rounds when the owner wants:** the role of cristal (GDD 03) and slice E (siege and repair).

### What the next front needs to know about the code

- **The battle package** (`packages/battle`, ADR-0008): pure, deterministic and integer, with no dependency on the
  `sim`. `setupOf` + `createBattle` → `stepBattle(state, commands)` per tick (50 ms), with the events (`attacked`,
  `hit`, `missed`, `died`, `dropped`, `picked`, `joined`, `escaped`, `controlChanged`, `ended`); `battleView` is the
  view (the gambits' only input); `BattleLog` + `replayLog` redo a battle; `BATTLE_VERSION` 5. Commands: `intent`
  (held direction, space and bag), `attackOnce`, `face`, `drop`, `pickup`, `control` (human or AI), `join` (mid-fight,
  on a new or existing side) and `setGambits`. The 3 s countdown discards taps and honors what is held at its end.
  Combat numbers in `params/battle.json`; **max HP and capacity are in each participant's setup** (D9), kept on the
  participant and its view, and in the departures and `ended` results. The lab (`assets.ts`, `LAB_KITS`) and
  `geo battle` (`worldKits()`) take them from `params/default.json`, base capacity.
- **The AI:** gambits per participant, presets per role and defaults per DNA; reaction drawn by the battle `rng`.
  **Auto-resolve** is the whole battle by the AI, with no page: `geo battle sweep` runs 9,200 in ~45 s (the 3 × 3
  costs ~41 ms per 2,400 ticks, target 50).
- **The lab** (`apps/client/src/lab/`, `npm run lab`): the battle in a worker (`worker.ts`), a channel with simulated
  RTT and jitter (`channel.ts`), the drawing in `arena-view.tsx` with the signs and the movement options
  (`motion.ts`), the keyboard in `input.ts`, the session record and blind mode. The starting point of the junction's
  battle screen.
- **The junction package** (`packages/junction`, `@geometrix/junction`, F3; commit scope `junction`): `arena.ts`
  (`arenaOf`, `worldCellOf`), `setup.ts` (`battleSetup`, `battleSeed`), `results.ts` (`tickResults`: `died` and an
  edge `escaped` → `battleExit`, `ended` → `battleEnd`, late joiners), `host.ts` (`createHost`, `stepJunction`,
  `stepRealtime`, `setScreen`, `serializeHost`/`restoreHost`; an `Instance` per battle with its log, `members`,
  `sideOf`, the pending joins and what it sent), `replay.ts` (`replayResults`). `stepJunction(world, host, commands)`
  steps each world-paced battle `ticksPerSecond × tickSeconds` ticks, then `step(world, [...commands, ...results])`,
  throws if the world refused a result, and opens instances / queues joins from the tick's events. The pace is
  derived each tick: real while a participant is dominated and in `host.screens`; real-time results wait in
  `host.results` for the next world step. **F4** wires the server: `WorldHost` calls `stepJunction`, a 50 ms clock
  calls `stepRealtime` for the real-paced battles, `setScreen` follows the battle screen's presence.
- **The baseline** for D's comparisons is in the [tasks](../specs/m2-junction/tasks.md) F1 record (`geo sim` 3 days
  seed 42: 10.7–11.7 s; `geo sweep` 6 h seeds 1–20, run as `--set creep.cost.materia=3000`, the default, since
  `sweep` needs a `--set`).
- **The battle in the world** (`packages/sim/src/battle.ts`, F2): `state.battles` holds stubs (`window`, `sides`,
  `participants` with `stance` fight or flee = carrier, `openedTick`, the cell); `creep.battle` locks a creep (no
  autopilot, order, regeneration; orders refused `inBattle`). `encounter.ts` opens a battle at once on an attack
  (after the `encounter` declaration) and on a refused extortion; `runJoins` adds attackers inside the bubble. The
  host's results are the system commands `battleExit` and `battleEnd` with `playerId` `SYSTEM_PLAYER_ID` (0): `step`
  applies them like any command, validated (`notSystem`, `unknownBattle`, `notInBattle`, `invalidResult`), and does
  not count them as a player's. The CLI harness (`apps/cli/src/harness.ts`: `stepWithBots(state, host, bots, log)`,
  `runBots`, `defaultBattleParams`) logs them after the bots' commands; `geo verify` checks a mid-battle snapshot and
  each battle log against the world log. **The server still calls `step` directly** (F4): there, battles open and
  never end yet. Events: `battleOpened`, `battleJoined`, `battleLeft`
  (edge, idle), `battleEnded` (winner, loot, spoils), `died` with its battle; a team with a side hears them all.
- **Already in place for F4/F5:** the protocol's delta carries the stubs, the replay schema the system commands,
  `PROTOCOL_VERSION` 5; the client's reaction panel is pay or refuse, the chronicle has one plain sentence per battle
  event. The protocol's diff property test lost its death and spoil floors until it runs through the host (F4; the
  protocol does not depend on the junction, so the test has to move or the dependency be added).
- **The server** (`apps/server`): WebSocket, SQLite command log with snapshots, the lobby with 2 teams and up to 3
  humans each (`teams.maxHumans`), the player token in the URL fragment.
- **Screenshots and clicks in Chromium:** the headless Chromium in the Playwright cache accepts CDP
  (`--remote-debugging-port`), and Node 26's native WebSocket is enough to navigate, click, type
  (`Input.dispatchKeyEvent`), load a file (`DOM.setFileInputFiles`) and capture (`Page.captureScreenshot`).
- **The UI text is in Portuguese** (the chronicle templates, the lab and the world client). The repo is English-only;
  translating the UI is an open question for the owner.
