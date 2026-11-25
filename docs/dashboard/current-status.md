# Current status

> **How to use.** The top is the snapshot of now. **Now** is **rewritten** when a phase closes, an approval gate is
> passed or a blocker appears: it never accumulates. What a phase measured, interpreted or decided goes to its
> slice's `tasks.md`. The source of truth stays in the linked docs.

## Now

**Updated:** 2026-11-25 (the R and E-min design round)

| | |
|---|---|
| **Milestone** | **M2 — The ambush** ([ROADMAP](../ROADMAP.md)). M0, M1 and M1.5 ✅ |
| **Slices** | A ✅ 2026-11-17 · B ✅ 2026-11-20 · D ✅ 2026-11-25 · **R — Rebalance and pace**, **E-min — The minimal end** and **K — The DNA kits**: design round done 2026-11-25, specs to write |
| **In progress** | Three spec drafts (2026-11-25), waiting for the owner: [R](../specs/m2-rebalance/spec.md), [E-min](../specs/m2-minimal-end/spec.md) and [K](../specs/m2-kits/spec.md) |
| **Next front** | The specs of **R**, **E-min** and **K** (`spec-slice` skill), one session each; they can run in parallel (R: `sim` params, autopilot, strategist, map UI; E-min: the end rule, end screen and replay; K: `packages/battle`, gambits, lab, battle screen). R's final balance pass runs after K's merge |
| **Then** | **P — The friends' playtest** (two teams: humans against humans, or co-op against the bot); after it, **E** (siege and repair) or **T** (more teams), chosen at P's checkpoint |
| **Waiting on the owner** | (1) Each spec's approval; R's draft, revised with the owner's review, has D1–D29 to accept and no open question; slice G (groups and formations, after K, before P) is a proposal in the [ROADMAP](../ROADMAP.md). (2) [ADR-0009](../adr/0009-prediction-in-the-lab.md) (`Proposed`): prediction as a lab experiment option. (3) `gambits.meleeBerthSteps` 3 (provisional, lab F7). (4) Whenever the owner wants: PLAYTEST lab group 7 (the movement options) |
| **Blockers** | None |

### Next steps

1. **The R spec.** What the round decided is in the GDD (01, 03, 05, 06, 07) and the [ROADMAP](../ROADMAP.md) row:
   a 2-hour match through a shorter world at a moderate ×N with faster DNAs (sweeps with targets for 2 hours; at C2
   the economy gave a first extra creep at ~3 world hours, the first wanderer came at world hour 1 and the map was
   explored by hour 3); the wanderers early and regular; only the pace rescale against the snowball; the opening
   countdown for humans (5 s, paused, an "Entrar" button); "follow"; helping an ally in battle as a preset rule; the
   road builder as an autopilot preset with its plan on the map (replaces the 2026-11-20 bug); the strategist for
   both P modes; the selected creep's destination on the map and the current action's estimated time in the panel.
   **Scope warning:** the largest of the three.
2. **The E-min spec** ([GDD 01](../gdd/01-world.md), "The minimal end before the siege"): elimination in fact,
   concession, the bot conceding, the draw at the clock, the frozen world, the end screen, replay markers, N teams.
3. **The K spec** ([GDD 02](../gdd/02-creeps-and-domination.md), [GDD 06](../gdd/06-battles.md)): the dodge, the
   square's charged strike and charge (hold Space), the triangle's frontal guard, the circle's fan; open details in GDD
   06's open questions. **Scope warning:** revises "only base stats in M2"; lab first.
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
