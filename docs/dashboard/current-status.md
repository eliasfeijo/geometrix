# Current status

> **How to use.** The top is the snapshot of now. **Now** is **rewritten** when a phase closes, an approval gate is
> passed or a blocker appears: it never accumulates. What a phase measured, interpreted or decided goes to its
> slice's `tasks.md`. The source of truth stays in the linked docs.

## Now

**Updated:** 2026-11-25 (F7 built; checkpoint C2 open)

| | |
|---|---|
| **Milestone** | **M2 — The ambush** ([ROADMAP](../ROADMAP.md)). M0, M1 and M1.5 ✅ |
| **Slices** | **A — The encounter** ([spec](../specs/m2-encounter/spec.md) · [plan](../specs/m2-encounter/plan.md) · [tasks](../specs/m2-encounter/tasks.md)) ✅ 2026-11-17 · **B — The battle lab** ([spec](../specs/m2-battle-lab/spec.md) · [plan](../specs/m2-battle-lab/plan.md) · [tasks](../specs/m2-battle-lab/tasks.md)) ✅ 2026-11-20 |
| **In progress** | **D — The junction** ([spec](../specs/m2-junction/spec.md) · [plan](../specs/m2-junction/plan.md) · [tasks](../specs/m2-junction/tasks.md)). F1–F6 ✅ · **F7** built on branch `m2/junction-f7-soak` (not merged): the soak kills mid-battle and checks every battle log (OK: 5 kills in a battle, 218 battles agree); a server test of a crash mid real-time battle; the client attacks wanderers (a bug found); the [PLAYTEST](../PLAYTEST.md) junction groups J1–J6 |
| **Next front** | **Checkpoint C2** with the owner: the PLAYTEST groups J1–J6 at ×6, the hypothesis questions, the order of E against P. Then F7's closing and merge |
| **Then** | **P — The friends' playtest**, or E first (decided at C2) |
| **Waiting on the owner** | (1) **Checkpoint C2**: play J1–J6 ([PLAYTEST](../PLAYTEST.md)), answer Q1–Q17 and C2-1, C2-2; validate the interpretations of the F4 (1–9), F5 (1–14) and F7 (1–4) records. (2) [ADR-0009](../adr/0009-prediction-in-the-lab.md) (`Proposed`): prediction as a lab experiment option. (3) `gambits.meleeBerthSteps` 3 (provisional, lab F7). (4) Whenever the owner wants: PLAYTEST lab group 7 (the movement options); J6 step 5 covers the same in the world |
| **Blockers** | None |

### Next steps

1. **Checkpoint C2** (a human session, in the Windows checkout or the F7 worktree): the owner plays the junction groups,
   one group per message; Claude reads the world's `battles` table afterwards and builds the tables. The decisions go
   to the tasks (F7 record), the plan (decisions) and the GDD; then F7 closes (dashboard) and merges.
2. **🐞 The road-builder preset does not work for the player** (owner, 2026-11-20, seen since before slice A): it asks
   for a point on the map, but nothing happens on click or mouse move (no road or cost preview); a road can only be
   built by dominating a creep, in road mode. The bots build with the same preset, so the `sim` works. **A short fix
   session** (repro, test, fix): the "15 minutes a day" style depends on the presets.
3. **Session findings** for the rounds that touch them: the roll-only fight does not pay off the risk (D replaces
   it); extortion against the bot is almost free; the mid-game at ×6 empties after exploring (encounter F6, C14); the
   battle AI is predictable in the corridors (GDD 06, parked). **F5:** a battle on the world clock at ×36 lasts about
   a real second (D4), too short to open and watch; at ×6 about six battle seconds pass per real second. **F7:** a
   wanderer cannot be selected with a left click (no inspector for it); the soak's server process grows from about
   150 MB to 210–256 MB within a run (RSS, not investigated; no earlier number recorded).
4. **Design rounds when the owner wants:** the role of cristal (GDD 03) and slice E (siege and repair).

### What the next front needs to know about the code

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
