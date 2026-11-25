# M2 junction tasks — Slice D

**Status:** F3 done (2026-11-24); F6 next (C1-1). Branches `m2/junction-f<n>-<slug>` (skill `commit`).
**Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)

## F0 — Spec, ADR and plan

- [x] Design round with the owner (2026-11-24), recorded in GDD 05, 06 and 07
- [x] ADR-0010, accepted (2026-11-24): battle instances next to the world
- [x] Spec approved (2026-11-24), the agent's proposals in GDD 02, 05–08
- [x] **Checkpoint:** the owner approves the plan (P1–P11) and the `junction` commit scope (2026-11-24)

## F1 — Baseline and the battle contract

- [x] Baseline: `geo sim` 3 days (seed 42) and `geo sweep` 6 h (seeds 1–20) on `main`, the numbers quoted here
- [x] `ParticipantSetup` with `maxHp` and `capacity`; the validation; `params/battle.json` without them; `BATTLE_VERSION` 5
- [x] The lab and `geo battle` read max HP and capacity from `params/default.json`; the lab log fixture rebuilt
- [x] `packages/junction`: the workspace, tsconfig, the determinism lint, Vitest, `src/index.ts`; the `junction`
      scope in the `commit` skill

### F1 record

**Baseline** (`main` at `0121923`, `SIM_VERSION` 9, slice A's roll; `runs/d-baseline-sim-s42`, `runs/d-baseline-sweep`,
not versioned):

- **`geo sim` 3 days, seed 42:** 10.7 s and 11.7 s (two runs), hash `6dabb099…`. 30 / 30 creeps at the end,
  154,578 / 174,602 materia and 1,117 / 1,283 cristal delivered (gap 11%). Encounters: 6 / 17 opened (all extortion,
  none attacks; all in the first 12 h), victims paid 3, refused 9, tried to flee 11; 2 deaths (both team 0
  squares); flee escapes ■ 1 of 3, ▲ 6 of 8, ● 11 of 18. Encounter balance −102 / −63 against +102 / +63.
- **`geo sweep` 6 h, seeds 1–20** (`creep.cost.materia=3000`, the default, as the single value): 9.7 s. Per team and
  hour 0.8 encounters (0.2–1.8); paid 30%, with a flee 59%, with a death 12%; flee escapes 65% (42–86); 69% in the
  victim's core zone; 0.6 deaths per team (0–1); 63 resources taken per team; creep gap 1 (0–2); delivered-materia
  gap 97 (0–659).

**The contract** (`BATTLE_VERSION` 5):

- Each participant keeps the setup's `maxHp` and `capacity` (state and view); the gambits' HP and load conditions, the
  pickup, the carry brake and the lab's drawing read them there. The departures and the `ended` results also carry
  `maxHp`, so the result table shows HP against it without the params.
- The setup refuses a max HP or capacity that is not a positive integer (capacity 0 would divide the brake by zero).
- `geo battle` reads `params/default.json` through the `sim`'s `parseParams` (the CLI already validates the world's
  file that way); the lab imports it as JSON and checks only the two numbers per DNA, without the `sim` (plan §5).
  Both take the **base** capacity: the upgrade is the world's, applied by the junction's setups (F3).
- With the same numbers moved, `geo battle sweep --quick` gives the same outcomes and durations as `main` (93 rows of
  `battle.csv`, timings aside); the lab fixture migrated (participants and joins with the old kit numbers) replays to
  the same state as before, under the new hash.

## F2 — The world side

- [x] `Battle` stub, `state.battles`, `Creep.battle`, serialize and the fixed hashes; `SIM_VERSION` 10
- [x] An attack opens the battle after the declaration; the `fight` stage and `fightRound` leave
- [x] Extortion: pay or refuse, a refusal (answer, rules, window) opens the battle; the dialogue's flee leaves; `react`
      without `fight`/`flee`
- [x] The lock: locked creeps skip the autopilot, orders, gathering, delivery and regeneration; domination allowed
- [x] `battleExit` (died, escaped) with the `flee` order and its bonus; whole HP points
- [x] `battleEnd`: the winners' loot, spoils from the piles, survivors placed; the end by inactivity
- [x] Joins: an attack approach inside the window joins its team's side or a new one; the side cap and the wait; an
      extortion of a participant refused
- [x] Events (`battleOpened`, `battleJoined`, `battleLeft`, `battleEnded`, `died` with the battle) and their audience
- [x] The team view with the battle stubs and participants; nothing leaks (hand-built world)
- [x] Bots and presets: the raider and the gatherers' reaction rules map to D2 (carrier on flee)

### F2 record

One commit for the whole phase: the encounter's types (`Reply`, the `Encounter` without stage, the events) are one
contract that `protocol`, the CLI and the client compile against, so no task is green alone.

- **The world side** lives in `packages/sim/src/battle.ts` (stub, bubble, lock, joins, the two result commands and
  their validation) and in the rewritten `encounter.ts` (an attack opens the battle at once; an extortion is pay or
  refuse). The params lose `fight` and the flee roll (`flee` keeps `speedPermille` and `seconds`) and gain `battle`
  (`window` 9 × 5 with `cellBlock` 5, `sideCap` 5, `maxSides` 4). Fixed hashes: serialize and the 6 h bot world.
- **Without the host** (F3) no battle ends: in `geo verify --seed 42` the world has 6 events in 50,000 ticks, and the
  bot worlds lock their first fighters for good. The CLI's encounter test ends battles with a stand-in for the host
  (side 0 wins, the rest die on their cells); the protocol's diff property drops its death and spoil floors (4–8
  battle stubs seen per seed instead) until it runs through the host (F4).
- **Done early, as the types required:** in `protocol`, `react` with `pay`/`refuse` only, the battle stubs in the
  delta (`window`, `sides`, `participants` by value), the system commands in the replay schema and
  `PROTOCOL_VERSION` 5 (F4); the server refuses them from clients through the sim (`notSystem`). In the client, the
  reaction panel with pay and refuse only, no fight mark on the map, "em batalha" in the inspector and one plain
  sentence per battle event in the chronicle (F5 keeps the battle screen, the battle sign and the voiced sentences).
- **The CLI's tally:** an encounter ends `paid`, `battle` or `open`; per team, the battles by result (won, lost, idle,
  empty, open), joins, escapes by DNA, deaths, kills, extortion, loot taken and spoils picked up; the spoils' dropped
  cargo is measured from the state. The flee-roll metrics leave the report and the sweep (`battlePercent` and
  `battlesPerHour` come in); the per-team "encounter balance" leaves too, since a battle's loss is not attributable
  to a team from the events (F3's battle metrics may bring it back).

**Interpretations to validate** (implementation details the spec and the plan leave open):

1. `battleEnd` has a third reason, `empty` (nobody left in the arena): no winner, every pile becomes spoils.
2. The end by inactivity returns the survivors stopped, without the flee order and its bonus.
3. The winners loot all the cristal first, then the materia, pile by pile, each winner in creep id order up to its
   free capacity.
4. An extortion approach on a participant ends when it comes within the radius (J-2), as one with nothing to demand.
5. World orders to a locked creep are refused (`inBattle`); `setRules` stays allowed, domination too (O-5).
6. Each participant's stance (`fight`, or `flee` = carrier) is kept in the stub for the host, and hidden from the view.
7. An attack's declaration has its own encounter id (the `battleOpened` event points to it), though no encounter stays
   in the state.
8. `battleExit` carries `by`, the killer's world id, for the chronicle and the kill count.
9. The posture rules read literally under D2: the circle's "always flee" now refuses every extortion and enters as a
   carrier; the triangle pays an extortion and enters an attack as a carrier.
10. A team with a creep in the battle hears all of its events (K-2), even where it does not see the event's cell (an
    escape far away).

## F3 — The host and the harness

- [x] The arena from the window: the 5 × 5 blocks, rock, the four zones always floor, the shift at the map's edge
- [x] The cell mappings arena → world (ring, rock → nearest walkable)
- [x] The setups: whole HP, max HP, capacity, cargo, gambits (DNA preset or carrier), `normal`; the battle seed
- [x] `JunctionHost`: create on `battleOpened`; `stepJunction` with the world-paced battles before the world step
- [x] Results: `died`/`escaped` → `battleExit`, `ended` → `battleEnd`; the instance leaves
- [x] Joins (`join`, retried when refused) and domination (`control`); `stepRealtime` and `setPace`
- [x] `serializeHost`/`restoreHost`
- [x] Every harness caller through the host: `stepWithBots`, `runBots`, the bot-world tests, `geo sim`, `geo sweep`
- [x] `geo verify`: restore of world and host mid-battle; the fifth path, each battle log against the world log's
      results
- [x] The battle metrics in the `geo sim` and `geo sweep` reports
- [x] **Checkpoint C1:** the bot × bot report against the baseline (battles per hour, outcomes, the risk against the
      roll, snowball, tick cost)

### F3 record

**What it does.** `packages/junction` holds the host: `arenaOf` (the window as 5 × 5 blocks with the ring, rock where
the world has rock, the four zones always floor), `worldCellOf` (back to the world), `battleSetup` (the setups and
the seed), `JunctionHost` with `stepJunction` (the world-paced battles one world second before each world step, then
the world with their results as system commands), `stepRealtime` and `setScreen` (the real-time pace, for F4),
`serializeHost`/`restoreHost`, and `replayResults` (a battle log back to its world commands). The battle's `died`
and `escaped` events now carry the cell (state and replay unchanged, so no `BATTLE_VERSION` bump). `geo sim`, `geo
sweep`, `geo net` and `geo verify` step through the host; the 6 h bot-world lock moved to the junction package and
hashes world and host. `geo verify --seed 42`: deterministic on the four paths, the snapshot mid-battle (tick 25,911),
and the 9 battles replay alone to the world log's results.

**Checkpoint C1** (`runs/c1-sim-s42-1`, `-2`, `runs/c1-sweep`, not versioned):

| | Baseline (roll) | F3 (battles) |
|---|---|---|
| `geo sim` 3 days, seed 42: wall time | 10.7 s, 11.7 s | 13.7 s, 14.2 s (about 1.25×; target ≤ 1.5×) |
| Encounters (sim) | 6 / 17, all extortion, all in the first 12 h | 7 / 2, all extortion, all in the first 12 h |
| Their outcome (sim) | paid 3, refused 9, fled 11 | paid 0, refused 9 → 9 battles |
| Deaths (sim) | 2 (team 0 squares) | 2 (team 1 squares) |
| Delivered materia / cristal (sim) | 154,578 / 174,602 · 1,117 / 1,283 (gap 11%) | 175,675 / 160,780 · 1,305 / 1,095 (gap 8%) |
| Creeps at the end (sim) | 30 / 30 | 30 / 30 |
| `geo sweep` 6 h, seeds 1–20: wall time | 9.7 s | 10.1 s |
| Encounters per team-hour | 0.8 (0.2–1.8) | 0.6 (0.2–1.3) |
| Paid / with a flee or battle / with a death | 30% / 59% / 12% | 35% / 65% (all battles) / 39% of the victims |
| Battles per team-hour | — | 0.4 (0.0–1.1) |
| Deaths per team | 0.6 (0–1) | 0.6 (0–1) |
| Resources taken per team | 63 | 43 (17–75) |
| Creep gap / delivered-materia gap | 1 (0–2) / 97 (0–659) | 1 (0–2) / 80 (0–491) |

The battles over the 20 sweep seeds (90 battles):

- **How they opened:** all 90 from a refused extortion; no attack (the bots only extort, as in the baseline).
- **How they ended:** all 90 by a win; no end by inactivity or with nobody left.
- **Size:** always 1 against 1, with no join.
- **Duration:** 13 s on average on the world clock, at most 28 s. Battle time equals world time at the world pace.
- **The aggressor is always the raider triangle:** it wins 87 of 90 (97%) and dies in 2.
- **Victims:**
  - circles (always loaded, carrier preset): escape by the border 64 of 64 (baseline flee escapes: 65%);
  - squares (fight): die 23 of 25 and win 2;
  - a triangle won its only battle.
- **Loot:** checked against the spoils, nothing is duplicated. In seed 42 the winner takes up to its free capacity
  from the dead square's pile, the rest goes to spoils, and it picks that up later (90 cristal: 45 looted, 45 through
  spoils).

**Interpretations to validate** (implementation details the plan left open):

1. The spawn zones: side 0 on the left and 1 on the right, centered halfway between the border and the center; 2 at
   the top and 3 at the bottom. Their size is the new provisional params `battle.zone` (3 × 5, the lab's).
2. A creep or a pile comes back on the world cell under its arena cell; on rock or river, on the nearest walkable cell
   (breadth-first, up, right, down, left).
3. The battle seed mixes the world seed and the stub id (fmix32); opening a battle draws nothing from the world's rng.
4. One join placed per battle tick. A join still waiting for room at the end comes back where it waited, with its
   world HP and cargo: as a survivor if its side won or nobody won, as an escape if its side lost.
5. The pace is derived, not set: real time while a participant is dominated *and* its player has the battle screen
   open (`setScreen`, the server's, not in the snapshot); the world clock otherwise. The plan's `setPace` is that
   derivation.
6. `geo verify` cuts its snapshot at the first tick from halfway on with a battle open (else at halfway).

**C1 decisions** (owner, 2026-11-24; plan §12, "Decided at checkpoint C1"). The causes found: the raiders exist only
while there is map to explore (gone by 6–12 h), are picked by id (triangles here), only extort, and nobody joins; the
bots' posture is fixed by DNA; and the spawn zones put the victim ~10 cells from the exit ring and ~23 from the
aggressor, so a circle leaves before any contact. Hence: merge F3; **F6 (the wanderers) before F4 and F5**, with the
**junction matrix** and the **zones' distance as a param** first, and checkpoint **C1b** with the bot × bot report
again; the strategist unchanged until then (C1-4). Interpretations 2–6 stand; 1 becomes the param.

## F6 — The wanderers (runs after F3: C1-1)

- [x] The junction matrix (C1-2): `geo junction matrix`, battles auto-resolved from real world setups and arenas, DNA ×
      DNA, loaded or empty, fight or flee (carrier), seeds 1–100; wins, deaths, escapes and durations per cell
- [ ] The zones' distance to the border as a param (`battle.zone`), its value from the matrix (C1-3)
- [ ] `Wanderer`, `state.wanderers`, the `wanderers` params (stats, band, curve, cap)
- [ ] Birth by the curve in the band; roaming
- [ ] Targets: loaded team creeps in sight (attack, no dialogue); joining a battle in sight on their side
- [ ] In battle: their setup (HP 60, damage 12, marksman); carrying the loot; spoils or pile on death
- [ ] Teams attack them, an extortion refused; the strategist counts them; the raider ignores them
- [ ] Fog and view; drawing in a neutral color; chronicle (`wandererBorn`); metrics
- [ ] **Checkpoint C1b:** the matrix, the zones' value, and the bot × bot report with wanderers against C1; whether
      the bots need changing (C1-4)

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

## F7 — Soak and playtest

- [ ] The soak test with a `kill -9` mid-battle; world and battle hashes after the restart
- [ ] The PLAYTEST junction groups (spec §8)
- [ ] **Checkpoint C2:** the owner's sessions; the hypothesis questions; the order of E against P
