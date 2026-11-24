# M2 junction tasks — Slice D

**Status:** F1 in progress. Branches `m2/junction-f<n>-<slug>` (skill `commit`).
**Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)

## F0 — Spec, ADR and plan

- [x] Design round with the owner (2026-11-24), recorded in GDD 05, 06 and 07
- [x] ADR-0010, accepted (2026-11-24): battle instances next to the world
- [x] Spec approved (2026-11-24), the agent's proposals in GDD 02, 05–08
- [x] **Checkpoint:** the owner approves the plan (P1–P11) and the `junction` commit scope (2026-11-24)

## F1 — Baseline and the battle contract

- [ ] Baseline: `geo sim` 3 days (seed 42) and `geo sweep` 6 h (seeds 1–20) on `main`, the numbers quoted here
- [ ] `ParticipantSetup` with `maxHp` and `capacity`; the validation; `params/battle.json` without them; `BATTLE_VERSION` 5
- [ ] The lab and `geo battle` read max HP and capacity from `params/default.json`; the lab log fixture rebuilt
- [ ] `packages/junction`: the workspace, tsconfig, the determinism lint, Vitest, `src/index.ts`; the `junction`
      scope in the `commit` skill

## F2 — The world side

- [ ] `Battle` stub, `state.battles`, `Creep.battle`, serialize and the fixed hashes; `SIM_VERSION` 10
- [ ] An attack opens the battle after the declaration; the `fight` stage and `fightRound` leave
- [ ] Extortion: pay or refuse, a refusal (answer, rules, window) opens the battle; the dialogue's flee leaves; `react`
      without `fight`/`flee`
- [ ] The lock: locked creeps skip the autopilot, orders, gathering, delivery and regeneration; domination allowed
- [ ] `battleExit` (died, escaped) with the `flee` order and its bonus; whole HP points
- [ ] `battleEnd`: the winners' loot, spoils from the piles, survivors placed; the end by inactivity
- [ ] Joins: an attack approach inside the window joins its team's side or a new one; the side cap and the wait; an
      extortion of a participant refused
- [ ] Events (`battleOpened`, `battleJoined`, `battleLeft`, `battleEnded`, `died` with the battle) and their audience
- [ ] The team view with the battle stubs and participants; nothing leaks (hand-built world)
- [ ] Bots and presets: the raider and the gatherers' reaction rules map to D2 (carrier on flee)

## F3 — The host and the harness

- [ ] The arena from the window: the 5 × 5 blocks, rock, the four zones always floor, the shift at the map's edge
- [ ] The cell mappings arena → world (ring, rock → nearest walkable)
- [ ] The setups: whole HP, max HP, capacity, cargo, gambits (DNA preset or carrier), `normal`; the battle seed
- [ ] `JunctionHost`: create on `battleOpened`; `stepJunction` with the world-paced battles before the world step
- [ ] Results: `died`/`escaped` → `battleExit`, `ended` → `battleEnd`; the instance leaves
- [ ] Joins (`join`, retried when refused) and domination (`control`); `stepRealtime` and `setPace`
- [ ] `serializeHost`/`restoreHost`
- [ ] Every harness caller through the host: `stepWithBots`, `runBots`, the bot-world tests, `geo sim`, `geo sweep`
- [ ] `geo verify`: restore of world and host mid-battle; the fifth path, each battle log against the world log's
      results
- [ ] The battle metrics in the `geo sim` and `geo sweep` reports
- [ ] **Checkpoint C1:** the bot × bot report against the baseline (battles per hour, outcomes, the risk against the
      roll, snowball, tick cost)

## F4 — Network and server

- [ ] Protocol: `battleInput`, `battleScreen`, `battleOpen`, `battleFrame`; the system commands refused from clients;
      battles in the delta; `PROTOCOL_VERSION` 5
- [ ] `WorldHost` through the `JunctionHost`; the results committed with the tick
- [ ] The `battles` and `battle_ticks` tables, in the tick's transaction; recovery rebuilding the instances
- [ ] Presence of the battle screen; the battle clock (50 ms); the pace switch (D13)
- [ ] Battle inputs only for the dominated participant (C-2); frames only to the open screens (N-2)
- [ ] The diff property test with battles and locked creeps; `geo net` with a watcher (frames against 16 KB/s)

## F5 — Client

- [ ] The arena view, input, motion and effects moved to `apps/client/src/battle/`; the lab unchanged on top of it
- [ ] The battle screen: opens by itself (N-1), back to the map, return; countdown, signs, end table
- [ ] Watching from the battle sign (teams with a participant)
- [ ] The map: the bubble, the battle sign, participants "in battle"; the inspector
- [ ] The reaction panel with pay and refuse only; the mid-fight flee button removed
- [ ] The chronicle sentences for the new events
- [ ] The movement drawing selector in the `?net=1` panel (D19)

## F6 — The wanderers

- [ ] `Wanderer`, `state.wanderers`, the `wanderers` params (stats, band, curve, cap)
- [ ] Birth by the curve in the band; roaming
- [ ] Targets: loaded team creeps in sight (attack, no dialogue); joining a battle in sight on their side
- [ ] In battle: their setup (HP 60, damage 12, marksman); carrying the loot; spoils or pile on death
- [ ] Teams attack them, an extortion refused; the strategist counts them; the raider ignores them
- [ ] Fog and view; drawing in a neutral color; chronicle (`wandererBorn`); metrics

## F7 — Soak and playtest

- [ ] The soak test with a `kill -9` mid-battle; world and battle hashes after the restart
- [ ] The PLAYTEST junction groups (spec §8)
- [ ] **Checkpoint C2:** the owner's sessions; the hypothesis questions; the order of E against P
