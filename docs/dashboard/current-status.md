# Current status

> **How to use.** The top is the snapshot of now. **Now** is **rewritten** when a phase closes, an approval gate is
> passed or a blocker appears: it never accumulates. What a phase measured, interpreted or decided goes to its
> slice's `tasks.md`. The source of truth stays in the linked docs.

## Now

**Updated:** 2026-11-24

| | |
|---|---|
| **Milestone** | **M2 — The ambush** ([ROADMAP](../ROADMAP.md)). M0, M1 and M1.5 ✅ |
| **Slices** | **A — The encounter** ([spec](../specs/m2-encounter/spec.md) · [plan](../specs/m2-encounter/plan.md) · [tasks](../specs/m2-encounter/tasks.md)) ✅ 2026-11-17 · **B — The battle lab** ([spec](../specs/m2-battle-lab/spec.md) · [plan](../specs/m2-battle-lab/plan.md) · [tasks](../specs/m2-battle-lab/tasks.md)) ✅ 2026-11-20 |
| **In progress** | **D — The junction, F0** (branch `m2/junction-f0-spec`): the [spec](../specs/m2-junction/spec.md) draft, after the design round of 2026-11-24 (recorded in GDD 05, 06, 07) |
| **Next front** | D's `plan.md` and `tasks.md`, once the spec and ADR-0010 are approved |
| **Then** | **P — The friends' playtest** (ROADMAP); E's order vs. P decided at D's checkpoint |
| **Waiting on the owner** | (0) **The junction spec** (D1–D19; the agent's proposals included) ([ADR-0010](../adr/0010-world-side-of-the-battle-contract.md) ✅ accepted 2026-11-24: battle instances next to the world, run by a junction host). (1) [ADR-0009](../adr/0009-prediction-in-the-lab.md) (`Proposed`): prediction as a lab experiment option. (2) `gambits.meleeBerthSteps` 3 (provisional, lab F7). (3) Whenever the owner wants: [PLAYTEST](../PLAYTEST.md) lab group 7 (the four movement options at 0 and 150 ms), which feeds the prediction decision |
| **Blockers** | None |

### Next steps

1. **The repo was cleaned up** (2026-11-20): a new repository with the code history, the docs rewritten in English,
   and the drift after the lab checkpoint dropped (ROADMAP, "The refocus").
2. **🐞 The road-builder preset does not work for the player** (owner, 2026-11-20, seen since before slice A): it asks
   for a point on the map, but nothing happens on click or mouse move (no road or cost preview); a road can only be
   built by dominating a creep, in road mode. The bots build with the same preset, so the `sim` works. Hypotheses: the
   picking mode has no preview or feedback; the target is accepted without checking a road is possible, and the creep
   silently falls back to "gather matéria"; a dominated creep runs no rules. **A short fix session** (repro, test,
   fix), before D or alongside it: the "15 minutes a day" style depends on the presets.
3. **D's spec** (draft, 2026-11-24): the owner's design round answered world time, auto-resolve, joining, the
   arena, fleeing, loot, the battle screen, taking over and the wanderers (GDD 05, 06, 07). ADR-0010 accepted (2026-11-24); waiting for the
   owner's approval of the spec; then the `plan.md` and `tasks.md`.
4. **Session findings** for the rounds that touch them: the roll-only fight does not pay off the risk (D replaces
   it); extortion against the bot is almost free; the mid-game at ×6 empties after exploring (encounter F6, C14); the
   battle AI is predictable in the corridors (GDD 06, parked).
5. **Design rounds when the owner wants:** the role of cristal (GDD 03) and slice E (siege and repair).

### What the next front needs to know about the code

- **The battle package** (`packages/battle`, ADR-0008): pure, deterministic and integer, with no dependency on the
  `sim`. `setupOf` + `createBattle` → `stepBattle(state, commands)` per tick (50 ms), with the events (`attacked`,
  `hit`, `missed`, `died`, `dropped`, `picked`, `joined`, `escaped`, `controlChanged`, `ended`); `battleView` is the
  view (the gambits' only input); `BattleLog` + `replayLog` redo a battle; `BATTLE_VERSION` 4. Commands: `intent`
  (held direction, space and bag), `attackOnce`, `face`, `drop`, `pickup`, `control` (human or AI), `join` (mid-fight,
  on a new or existing side) and `setGambits`. The 3 s countdown discards taps and honors what is held at its end.
  Numbers in `params/battle.json`.
- **The AI:** gambits per participant, presets per role and defaults per DNA; reaction drawn by the battle `rng`.
  **Auto-resolve** is the whole battle by the AI, with no page: `geo battle sweep` runs 9,200 in ~45 s (the 3 × 3
  costs ~41 ms per 2,400 ticks, target 50).
- **The lab** (`apps/client/src/lab/`, `npm run lab`): the battle in a worker (`worker.ts`), a channel with simulated
  RTT and jitter (`channel.ts`), the drawing in `arena-view.tsx` with the signs and the movement options
  (`motion.ts`), the keyboard in `input.ts`, the session record and blind mode. The starting point of the junction's
  battle screen.
- **The encounter in the world** (`packages/sim/src/encounter.ts`): the fight today is `fightRound`'s roll, by HP ×
  DNA; it is what D replaces with the instance. The chronicle, the reaction panel and the approach menu are in the
  client.
- **The server** (`apps/server`): WebSocket, SQLite command log with snapshots, the lobby with 2 teams and up to 3
  humans each (`teams.maxHumans`), the player token in the URL fragment.
- **Screenshots and clicks in Chromium:** the headless Chromium in the Playwright cache accepts CDP
  (`--remote-debugging-port`), and Node 26's native WebSocket is enough to navigate, click, type
  (`Input.dispatchKeyEvent`), load a file (`DOM.setFileInputFiles`) and capture (`Page.captureScreenshot`).
- **The UI text is in Portuguese** (the chronicle templates, the lab and the world client). The repo is English-only;
  translating the UI is an open question for the owner.
