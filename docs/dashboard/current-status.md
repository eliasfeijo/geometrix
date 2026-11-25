# Current status

> **How to use.** The top is the snapshot of now. **Now** is **rewritten** when a phase closes, an approval gate is
> passed or a blocker appears: it never accumulates. What a phase measured, interpreted or decided goes to its
> slice's `tasks.md`. The source of truth stays in the linked docs.

## Now

**Updated:** 2026-11-25 (K's spec approved; E-min's spec approved and its plan drafted)

| | |
|---|---|
| **Milestone** | **M2 — The ambush** ([ROADMAP](../ROADMAP.md)). M0, M1 and M1.5 ✅ |
| **Slices** | A ✅ 2026-11-17 · B ✅ 2026-11-20 · D ✅ 2026-11-25 · **R — Rebalance and pace** (spec and plan approved 2026-11-25, F1 next), **E-min — The minimal end** (spec approved 2026-11-25, plan draft) and **K — The DNA kits** (spec approved 2026-11-25, plan next) |
| **In progress** | **R's F1** (the pace harness) in a new session: the [R spec](../specs/m2-rebalance/spec.md) and [plan](../specs/m2-rebalance/plan.md) approved 2026-11-25, worktree `~/workspace/geometrix/rebalance-f1` on `m2/rebalance-f1-pace-harness`; **G's design round** in a parallel session; **E-min's plan draft**, waiting for the owner (the [E-min spec](../specs/m2-minimal-end/spec.md) approved 2026-11-25, with the first blood); **K's plan** (the [K spec](../specs/m2-kits/spec.md) approved 2026-11-25) |
| **Next front** | The specs of **R**, **E-min** and **K** (`spec-slice` skill), one session each; they can run in parallel (R: `sim` params, autopilot, strategist, map UI; E-min: the end rule, end screen and replay; K: `packages/battle`, gambits, lab, battle screen). R's final balance pass runs after K's merge |
| **Then** | **G — Groups and formations** (after K: formations in the world and in battle, the side each DNA engages from, the battle bot's load experiment; lab first), then **P — The friends' playtest** (two teams: humans against humans, or co-op against the bot); after it, **E** (siege and repair) or **T** (more teams), chosen at P's checkpoint |
| **Waiting on the owner** | (1) [E-min's plan](../specs/m2-minimal-end/plan.md) draft (P1–P13); K's plan, once drafted. (2) [ADR-0009](../adr/0009-prediction-in-the-lab.md) (`Proposed`): prediction as a lab experiment option. (3) `gambits.meleeBerthSteps` 3 (provisional, lab F7). (4) Whenever the owner wants: PLAYTEST lab group 7 (the movement options) |
| **Blockers** | None |

### Next steps

1. **R's F1–F8** from the [approved plan](../specs/m2-rebalance/plan.md) ([tasks](../specs/m2-rebalance/tasks.md);
   `implement-phase` skill), from the [approved spec](../specs/m2-rebalance/spec.md) (D1–D29, 2026-11-25, with the owner's review:
   the actors' list on a click, the hostile sign, the bot's difficulty and its encounter reactions, dropping the load,
   pausing a battle with P). **G's design round** runs in a parallel session (formations in the world and in battle,
   the side each DNA engages from, the battle bot's load experiment; [GDD 06](../gdd/06-battles.md),
   [GDD 07](../gdd/07-autopilot.md)). The spec's starting point, from the round, in the GDD (01, 03, 05, 06, 07):
   a 2-hour match through a shorter world at a moderate ×N with faster DNAs (sweeps with targets for 2 hours; at C2
   the economy gave a first extra creep at ~3 world hours, the first wanderer came at world hour 1 and the map was
   explored by hour 3); the wanderers early and regular; only the pace rescale against the snowball; the opening
   countdown for humans (5 s, paused, an "Entrar" button); "follow"; helping an ally in battle as a preset rule; the
   road builder as an autopilot preset with its plan on the map (replaces the 2026-11-20 bug); the strategist for
   both P modes; the selected creep's destination on the map and the current action's estimated time in the panel.
   **Scope warning:** the largest of the three.
2. **E-min's plan** ([draft](../specs/m2-minimal-end/plan.md), P1–P13): the end as a stage of `step`, `concede`, the
   team out, the first blood, the summary kept in the state, the replay markers by a scan pass, `dev:multi --set` for
   short sessions; five phases (F1 world, F2 bot and harness, F3 network and server, F4 client, F5 soak and
   playtest). It shares the strategist, the CLI reports and the version numbers with R: the second to merge rebases.
3. **K's plan** from the [approved spec](../specs/m2-kits/spec.md) (D1–D20, 2026-11-25): Space as every DNA's kit
   key (a tap attacks, a hold fills the DNA's bar: the square's strike and charge, the triangle's guard, the circle's
   fan's range), the double-tap dodge, kits behind on/off params, the gambits and presets, the lab first (K1) and the
   world after (K2). The wanderers' own DNA and kit wait for their own design round (GDD 05). **Scope warning:**
   revises "only base stats in M2".
4. **Session findings** for the specs that touch them: extortion against the bot is almost free (R's strategist); the
   battle AI is predictable in the corridors (GDD 06, parked); a wanderer cannot be selected with a left click (no
   inspector for it); the soak's server process grows from about 150 MB to 210–256 MB within a run (RSS, not
   investigated).
5. **To validate in P:** the interpretations of the junction F4 (1–9), F5 (1–14) and F7 (1–4) records, and J6 (two
   humans in one battle, a teammate watching, a third creep joining).
6. **Design rounds when the owner wants:** the role of cristal (GDD 03), E (siege and repair) and T (more teams, GDD
   01's proposal with the agent's analysis).

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
