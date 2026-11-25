# Current status

> **How to use.** The top is the snapshot of now. **Now** is **rewritten** when a phase closes, an approval gate is
> passed or a blocker appears: it never accumulates. What a phase measured, interpreted or decided goes to its
> slice's `tasks.md`. The source of truth stays in the linked docs.

## Now

**Updated:** 2026-11-25 (slice D closed at checkpoint C2)

| | |
|---|---|
| **Milestone** | **M2 — The ambush** ([ROADMAP](../ROADMAP.md)). M0, M1 and M1.5 ✅ |
| **Slices** | **A — The encounter** ✅ 2026-11-17 · **B — The battle lab** ✅ 2026-11-20 · **D — The junction** ([spec](../specs/m2-junction/spec.md) · [plan](../specs/m2-junction/plan.md) · [tasks](../specs/m2-junction/tasks.md)) ✅ 2026-11-25, closed at checkpoint C2 |
| **In progress** | Nothing: the next slices need their design rounds |
| **Next front** | **R — Rebalance and pace** and **E-min — The minimal end** (C2-2, C2-3), each with a design round, then spec → plan → tasks (`spec-slice` skill) |
| **Then** | **P — The friends' playtest**; siege and repair (E) after P |
| **Waiting on the owner** | (1) **The order of R and E-min** (agent's proposal: one design round for both, since the world's duration feeds a draw by the clock; R's parameter sweeps and E-min's code can then run in parallel). (2) [ADR-0009](../adr/0009-prediction-in-the-lab.md) (`Proposed`): prediction as a lab experiment option. (3) `gambits.meleeBerthSteps` 3 (provisional, lab F7). (4) Whenever the owner wants: PLAYTEST lab group 7 (the movement options) |
| **Blockers** | None |

### Next steps

1. **The design round for R and E-min** (an interactive round: cold analysis, then grouped questions). R's material
   is in the junction [tasks](../specs/m2-junction/tasks.md), checkpoint C2: 9 battles won with no loss, a passive bot
   that never reinforces and cannot replace its creeps (a creep costs 3,000 matéria), wanderers too late (3 in 3.9
   world hours), the map explored in 3 of 72 world hours, movement slow at ×6, and the "follow" proposal
   ([GDD 07](../gdd/07-autopilot.md)). E-min's: the [ROADMAP](../ROADMAP.md) row (how a match is won or drawn, the
   end screen, replay markers). **Scope warning:** R grows M2 with the strategist and a new action.
2. **🐞 The road-builder preset does not work for the player** (owner, 2026-11-20, seen since before slice A): it asks
   for a point on the map, but nothing happens on click or mouse move (no road or cost preview); a road can only be
   built by dominating a creep, in road mode. The bots build with the same preset, so the `sim` works. **A short fix
   session** (repro, test, fix): the "15 minutes a day" style depends on the presets.
3. **Session findings** for the rounds that touch them: extortion against the bot is almost free; the battle AI is
   predictable in the corridors (GDD 06, parked); a battle on the world clock at ×36 lasts about a real second (D4);
   a wanderer cannot be selected with a left click (no inspector for it); the soak's server process grows from about
   150 MB to 210–256 MB within a run (RSS, not investigated).
4. **To validate in P:** the interpretations of the junction F4 (1–9), F5 (1–14) and F7 (1–4) records, and J6 (two
   humans in one battle, a teammate watching, a third creep joining).
5. **Design rounds when the owner wants:** the role of cristal (GDD 03) and E (siege and repair).

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
