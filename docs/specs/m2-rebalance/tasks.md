# M2 tasks — Rebalance and pace

**Status:** F0 done (2026-11-25); F1 next. Branches `m2/rebalance-f<n>-<slug>` (skill `commit`).
**Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)

## F0 — Spec and plan

- [x] Design round with the owner (2026-11-25), recorded in GDD 01, 03, 05, 06 and 07
- [x] Spec approved (2026-11-25), with the owner's review (D23–D29) and slice G placed after K
- [x] **Checkpoint:** the owner approves the plan (P1–P15) (2026-11-25)

## F1 — Baseline and the pace harness

- [x] `world.multiplier` in the params schema and `params/default.json`; `params/world-72h.json` with today's numbers
      and ×6 (P1, P2)
- [x] `geo sim` and `geo sweep`: `--mult`, every time also in real minutes
- [ ] `apps/cli/src/pace.ts`: the §7 metrics (crossing, the first extra creep, exploring, the wanderers, population,
      fights, the creep gap) and the targets table with pass or fail (P13)
- [ ] The recovery scenario: `--shock team:count@minute`, not replayable, refused by `geo verify` (P12)
- [ ] Baseline: `geo sim` and `geo sweep` (seeds 1–20, the full match) on the 72-hour world at ×6, quoted here

## F2 — The world vocabulary

- [ ] `follow`: the order, the action, walking within `autopilot.followCells`, joining the target's battle, the end,
      the cycle refused (F-1..F-5)
- [ ] `allyInBattle` and `joinBattle` with `minHpPermille` and the load check (H-1, H-2, H-4, F-6)
- [ ] `drop`: the order and the action, the `dropped` event, the refusals; during an extortion, a refusal (DR-1..DR-3)
- [ ] `buildRoad` with no cell; `roadTarget` into `roads.ts`; the road-builder preset with no target (RB-1, RB-2)
- [ ] `presetRules(preset, dna)` with the help rule in every preset (H-3)
- [ ] The hostile intent in the three creep views; nothing leaks (HS-1, HS-3)
- [ ] The difficulty in `join` and `Player`; the junction's setup reaction from it (P8)
- [ ] `SIM_VERSION` 12, the fixed hashes; the protocol and the client compile against the new types

## F3 — The strategist

- [ ] The difficulty levels in `strategistCommands` (D26, S-6); the harness's strategist option with a difficulty
- [ ] The posture per level (D17); production before the upgrade pinned by a test (D15, S-2)
- [ ] The defense of the core zone (D14, S-1)
- [ ] The raid group and the escort with `follow` (D16, S-3)
- [ ] The threat pass and the risk (D27, S-7); the harness runs it every tick like the server will
- [ ] Any number of teams in the new rules (D18, S-5)
- [ ] The strategist's metrics in the reports: help joins, groups, defense, payments, drops, the D27 choices
- [ ] **Checkpoint C1:** bot × bot at each difficulty and hard against easy, the 72-hour world at ×6 in real time

## F4 — The balance pass

- [ ] Speeds and map size against crossing and exploring, per ×N candidate (6, 8, 12)
- [ ] Costs and production against the opening, population and recovery
- [ ] The wanderers' curve against its targets
- [ ] The encounter windows (PA-3) and the other durations
- [ ] The 2-hour default world in `params/default.json`; the PA-1/PA-3 test; the fixed hashes
- [ ] **Checkpoint C2:** the targets' table per ×N candidate; the owner picks the candidates to play

## F5 — The pauses, network and server

- [ ] The held pace in the host (`holds`, `paceOf`), skipped by the battle clock (P11)
- [ ] `holds.ts`: the opening hold, pausing, paused, resuming, released by absence (OC-1..OC-6, BP-1..BP-4)
- [ ] `battlePause` and `battleHold`; the follow and drop orders; the hostile intent in the delta;
      `PROTOCOL_VERSION` 8
- [ ] The bot's difficulty on its player row (migration), in world creation and `dev:multi --bot-difficulty`
- [ ] `WorldHost`: the threat pass every tick for hard bots
- [ ] `geo net` on the new default world; the diff property with the new fields (U-4)

## F6 — Client

- [ ] The actors' list on a click; a wanderer selectable (D21, D23, U-3, U-5)
- [ ] The hostile layer: the signs and the line to the team's target (HS-2)
- [ ] The destination layer and the ETA in the inspector (D19, D20, U-1, U-2)
- [ ] "Seguir" in the right-click menu, "Seguir…" in the rules editor, the new rules' text (D8, D9)
- [ ] "Largar carga" in the panel and in the extortion's reply (D24)
- [ ] The road builder without a cell and its plan with the cost line (D12, D13, RB-3)
- [ ] The battle alert with "Entrar" (D6, D7, OC-3); P on the battle screen and the countdowns (D28)
- [ ] The lobby: the default ×N and the bot's difficulty

## F7 — Soak and playtest

- [ ] The soak on the new default world, with a restart during a hold
- [ ] The PLAYTEST R groups (spec §8)
- [ ] **Checkpoint C3:** the owner's sessions; the hypothesis questions; the ×N chosen

## F8 — The final balance pass (after K's merge)

- [ ] The §7 sweeps again with the kits; the numbers that move
- [ ] **Checkpoint C4:** the targets with the kits; R closes
