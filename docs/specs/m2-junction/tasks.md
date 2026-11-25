# M2 junction tasks — Slice D

**Status:** Done (2026-11-25): F1–F7 and checkpoint C2. Branches `m2/junction-f<n>-<slug>` (skill `commit`).
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
- [x] The zones' distance to the border as a param (`battle.zone`), its value from the matrix (C1-3)
- [x] `Wanderer`, `state.wanderers`, the `wanderers` params (stats, band, curve, cap)
- [x] Birth by the curve in the band; roaming
- [x] Targets: loaded team creeps in sight (attack, no dialogue); joining a battle in sight on their side
- [x] In battle: their setup (HP 60, damage 12, marksman); carrying the loot; spoils or pile on death
- [x] Teams attack them, an extortion refused; the strategist counts them; the raider ignores them
- [x] Fog and view; drawing in a neutral color; chronicle (`wandererBorn`); metrics
- [x] **Checkpoint C1b:** the matrix, the zones' value, and the bot × bot report with wanderers against C1; whether
      the bots need changing (C1-4)

### F6 record

**The wanderers as built** (spec D14, W-1..W-7). A `Wanderer` (`state.wanderers`, `wanderers` params: HP 60, damage
12, band 8 rows, the first at 1 h, one every 60 down to 15 minutes, at most 4, spare 10 minutes) is born on a free
band cell, roams the band, attacks a loaded team creep in sight with no dialogue, joins any battle with a team in
sight on the one wanderers' side, never enters a core zone (its routes go around them), heals on the map like a
creep and, after a battle, spares the creeps that were in it with it (W-7, owner 2026-11-25, after a 12 h run where one
wanderer opened 638 battles against one gatherer). A team's creep may attack one; an extortion of one is refused;
the bots' rules count them as enemies; a team sees them in its sight only. `SIM_VERSION` 11, `PROTOCOL_VERSION` 6,
`BATTLE_VERSION` 5 (the setup's optional `damage`). Found on the way: an instance opened with a creep that joined on
the opening's tick placed it twice (the end was refused); it now opens with the opening's creeps only.

**Checkpoint C1b** (`runs/c1b-*` in the session scratchpad, not versioned; `geo verify --seed 42`: deterministic, 52
battles replayed alone to the world log's results):

The matrix (seeds 1–100, 3,600 battles per value; the victim dies / escapes, the other pairs pooled):

| `battle.zone.insetPermille` | 500 (C1) | 650 | 750 (default) | 850 (max) |
|---|---|---|---|---|
| Victim empty, flees | 0% / 100% | 3% / 97% | 13% / 87% | 25% / 75% |
| Victim full, flees | 19% / 81% | 17% / 83% | 37% / 63% | 48% / 52% |
| Victim fights (empty / full): aggressor wins | 48% / 74% | 48% / 75% | 47% / 72% | 50% / 72% |

The zones' distance matters for fleeing only: the arena is 47 × 27, so the nearest exit is the top or bottom ring
whatever the inset. A circle beats a square in every case (aggressor circle × square victim, fighting: 100%).

The bot × bot report with the wanderers against C1:

| | C1 (F3) | C1b (F6) |
|---|---|---|
| `geo sim` 3 days, seed 42: wall time | 13.7 s, 14.2 s | 11.2 s, 11.9 s (baseline 10.7–11.7 s) |
| Encounters between teams (sim) | 7 / 2 | 0 / 0 |
| Battles (sim) | 9, from refused extortions | 218, all opened by a wanderer; 10 wanderer joins |
| Deaths (sim) | 2 | 30 / 25 (47 squares, 5 triangles, 3 circles); 55 by wanderers |
| Team creeps as a wanderer's victim (sim) | — | ■ 64: won 17, died 47 · ▲ 120: escaped 115, died 5 · ● 34: escaped 31, died 3 |
| Wanderers (sim) | — | 22 born, 18 killed by team creeps; 4 alive from hour ~10 on |
| Creeps at the end (sim) | 30 / 30 | 15 / 10 (39 / 29 produced) |
| Delivered materia (sim) | 175,675 / 160,780 | 129,712 / 99,263 (gap 23%) |
| Spoils at the end (sim) | — | 37 piles, 1,593 materia / 205 cristal (1 of 38 picked up: only the raider picks up) |
| `geo sweep` 6 h, seeds 1–20: wall time | 10.1 s | 14.2 s (more battles) |
| Battles per team-hour | 0.4 | 1.5 (331 with a wanderer, 27 between teams; C1: 90) |
| Encounters per team-hour | 0.6 | 0.2 |
| Deaths per team (of 6, no production in 6 h) | 0.6 | 2.6 (86 of 104 by wanderers) |
| Victims dead / escaped by the border | 39% / — | 33% / 60% |
| Resources taken per team | 43 | 26 |

The pressure by knob (the same sweep, one knob at a time; deaths per team · creeps at the end · battles per
team-hour):

| | 0 | 1 | 2 | 4 |
|---|---|---|---|---|
| `wanderers.cap` | 0.8 · 5.2 · 0.2 | 1.8 · 4.2 · 0.9 | 2.2 · 3.8 · 1.2 | 2.6 · 3.4 · 1.5 |

| | 6 | 9 | 12 |
|---|---|---|---|
| `wanderers.damage` | 2.3 · 3.7 · 1.5 | 2.3 · 3.7 · 1.5 | 2.6 · 3.4 · 1.5 |

The damage barely matters: the square, the one that dies, loses to the circle's kiting at any damage; the cap sets
the pressure.

**Interpretations to validate** (implementation details the plan left open):

1. The matrix's battle cell: one per seed, drawn uniformly among the standable cells outside both core zones.
2. `battle.zone.insetPermille`: the zone's center offset from the arena's center, in ‰ of the half-size (500 the old
   halfway); 850 is the largest that keeps the four zones apart.
3. A zone as near to two edges (insets ≥ 600) faces the center along its dominant axis (the battle's arena rule).
4. "Loaded" is any cargo above 0.
5. A wanderer's name comes from the same name sequence as the creeps' (`state.births`).
6. A wanderer that sees both a battle to join and a loaded creep goes for the battle.
7. A wanderer that escapes by the border just stops and roams again (no flee order).
8. An extortion order against a wanderer is refused as `invalidOrder`.
9. The wanderers are drawn at their cell, with no glide between ticks.
10. Their routes treat the core zones' cells as rock: they go around a zone; a target reachable only through one is
    dropped.
11. W-7's sparing starts when either of the pair leaves the battle alive (an escape or the end), 10 minutes from then.
12. In the report, a team's side whose victim escaped "lost" (the wanderer was left alone and won).

**C1b decisions** (owner, 2026-11-25; plan §12, "Decided at checkpoint C1b"): the zones' distance **750‰**; the
wanderers' **cap stays 4** until the playtest; **the strategist unchanged** until the playtest (C1-4 closed); the
square against the circle **watched in the playtest** (GDD 06). All provisional numbers; interpretations 1–12 stand.

## F4 — Network and server

- [x] Protocol: `battleInput`, `battleScreen`, `battleOpen`, `battleFrame`; the system commands refused from clients;
      battles in the delta; `PROTOCOL_VERSION` 7 (F6 took 6)
- [x] `WorldHost` through the `JunctionHost`; the results committed with the tick
- [x] The `battles` and `battle_ticks` tables, in the tick's transaction; recovery rebuilding the instances
- [x] Presence of the battle screen; the battle clock (50 ms); the pace switch (D13)
- [x] Battle inputs only for the dominated participant (C-2); frames only to the open screens (N-2)
- [x] The diff property test with battles and locked creeps; `geo net` with a watcher (frames against 16 KB/s)

### F4 record

**What it does.** The server steps each hosted world through the junction host (`WorldHost.junction`,
`stepJunction`): the battles' results enter the tick's command log after the players' commands, as the system
player's, in the tick's transaction, with the `battles` table (setup, params, the instance's record, the tick it
reached, the end and its hash) and `battle_ticks` (only ticks with commands). Recovery replays the world alone, then
rebuilds each open battle from its rows with `replayLog`, on the world clock (N-3). A socket's `battleScreen` opens
the screen of a battle its team has a side in (`battleOpen`: arena, params, roster and the view now) and frames
follow (`battleFrame`: the delta of the battle view and the events), only to the sockets that show it (N-2); a
dominating player's open screen puts the battle in real time from the next world tick (D13), and a 50 ms battle
clock per world steps it (`battle-clock.ts`, T-2). `battleInput` is queued only for the participant of the creep
the player dominates (C-2). The diff property test runs through the host again, with its floors of battles opened
and closed, locked creeps, deaths and spoils. `PROTOCOL_VERSION` 7; `SIM_VERSION` and `BATTLE_VERSION` unchanged.

**Measured.** `geo net --seed 42 --days 3` (`runs/f4-net-s42`, not versioned): the world delta 146 B/s per client
(target 2,048), 133–146 µs per send (target 250), 0 mismatches in 518,400 checks. A watcher over the run's 218
battles (3,221 battle seconds, mostly 1 × 1 with a wanderer): with the full view in every frame, 12,301 B/s on
average and **16,799 B/s in the worst battle, over the 16 KB/s guess**; so, as plan section 7 says, the frames are
deltas of the battle view (`diffBattleView`, on delta.ts's entity diff): **2,467 B/s on average, 3,387 at worst**,
133 B per real-time frame, 344 B per world-clock frame, 4,377 B for the opening. On the server (seed 42 of the test
params, a scratchpad probe): a world tick 0.18 ms with no battle, 0.8–1.2 ms with battles (20 battle ticks each, and
their rows); a real-time battle tick with its frame 22–33 µs, against the 50 ms tick.

**Interpretations to validate** (implementation details the plan left open):

1. On the world clock, a watcher gets one frame per world tick: the view after the battle's second and the events
   of its 20 ticks. At ×6 that is six jumps of a battle second each per real second (D4: battle time is world time).
2. The pace changes on the next world tick after a screen opens or closes, or a domination changes (up to 1/N s);
   inputs sent before it wait for it, and those of a battle still on the world clock after the world tick are
   dropped.
3. Any player of a team with a side in the stub may open the screen, even when its participants all left; the
   server closes a battle's screens after its last frame (no closing message: the last frame has `ended`).
4. A battle input gets an ack or a reject, like a command; the frames carry no "applied" list (the lab's input
   delay measure).
5. The battle params are kept with the world (`worlds.battle_params_json`; `GEO_BATTLE_PARAMS` for new worlds); a
   world stored before them gets the server's.
6. The battles table keeps the instance's record (members, the world side of each battle side, the joins waiting,
   the results sent) with the reached tick, since `replayLog` rebuilds only the battle's state.
7. A frame carries the roster only when someone joined, and none once the world closed the stub.
8. The battle clock runs all the time (20 wakes a second per world); after a stall it runs at most 40 ticks (2 s),
   then drops the backlog (`maxCatchUpBattleTicks`, an operating value).
9. A world with an open battle and no battle rows (a file from before F4) is not hosted (`RecoveryError`).

## F5 — Client

- [x] The arena view, input, motion and effects moved to `apps/client/src/battle/`; the lab unchanged on top of it
- [x] The battle screen: opens by itself (N-1), back to the map, return; countdown, signs, end table
- [x] Watching from the battle sign (teams with a participant)
- [x] The map: the bubble, the battle sign, participants "in battle"; the inspector
- [x] The reaction panel with pay and refuse only; the mid-fight flee button removed (done with F2's
      vocabulary change, `88ddc6f`; tested in `encounter-actions.test.ts`)
- [x] The chronicle sentences for the new events
- [x] The movement drawing selector in the `?net=1` panel (D19)

### F5 record

**What it does.** The world client shows a battle in place of the map (`battle-screen.tsx`, over the map so it keeps
its pan and zoom): the lab's arena, keyboard, motion options, signs, result table and events list, now shared in
`apps/client/src/battle/` (the lab on top of them, unchanged but for its CSS class names), with each side in its
team's color (`SideStyle`). `battle-session.ts` builds the screen from `battleOpen` and the `battleFrame` deltas and
decides when it opens by itself; `battle-control.ts` asks the server for the screen (`battleScreen`), sends the
keyboard's `battleInput`, goes back to the map and asks again after a reconnect. On the map, `map/battle-layer.tsx`
draws the bubble, a sign over the battle's cell split in its sides' colors (clicking it selects the battle) and a
crossed-blades mark on each creep locked in one; the inspector of a battle, or of a creep in one, offers watching it
(or going back to it). The chronicle has a voiced bank for the battle's events. The `?net=1` panel chooses the
movement drawing (D19) and shows the battle inputs' round trip. The reaction panel was already pay or refuse (F2).

**A bug found and fixed.** With two players dominating creeps in one battle, the control flapped every tick: the
battle kept the lab's "one domination at a time" (lab spec D12), so taking one participant released the other human,
and the host gave it back on the next tick. The battle now changes only the participant named; the lab's page
releases the one before itself. `BATTLE_VERSION` 6 (the lab fixture migrated; its one control command does not
change); a junction test plays two humans on the screen.

**Measured.** 268 client tests (250 before), 2,881 in all. Smoke runs in headless Chromium against `dev:multi` at
×36 (scratchpad drivers, not versioned): a wanderer's ambush on a dominated square opened the screen by itself in real
time, with the countdown, the signs, the end table and Esc back to the map; a teammate watched a real-time battle from
the sign; two humans fought each other with the predict option, each keeping control. A battle on the world clock at
×36 lasts about a real second (D4), too short to open and watch.

**Interpretations to validate** (implementation details the plan left open):

1. The arena colors each side by its team (Azul, Laranja, the wanderers' sand); the spawn zones of the sides a
   battle does not use are gray. The tags and the end say the team ("Azul vence", "os andarilhos vencem").
2. The screen opens by itself once per (dominated creep, battle): back to the map, it stays closed while that creep
   stays in that battle; a new battle, or dominating a creep in one, opens it again, even over a battle being watched.
3. Back to the map is a button or Esc; the lab's Tab, 0, R and P do nothing in the world. While the dominated creep is
   in a battle with the screen closed, a banner over the map brings it back.
4. The screen keeps the chronicle beside the arena, with the roster (HP, who plays each: "você", "jogador", "IA") and
   the battle's events; the map's panels (core, inspector, orders) are under it.
5. The roster offers "dominar" for the team's other participants and "soltar" for one's own: the world's `dominate`
   and `release`, with their cost and cooldown (D12).
6. The end table stays until the player goes back to the map; the arena shrinks to make room for it.
7. The bar says "tempo real" while any participant is under a human's control, else "relógio do mundo".
8. What is held is sent again when the participant comes under human control, since the server drops inputs while
   the battle is still on the world clock (F4 interpretation 2).
9. The glide is always one battle tick (50 ms); on the world clock the creeps jump a battle second per frame.
10. The predict option leads by the battle inputs' acknowledged round trip, smoothed (a fifth of each new one).
11. The battle sign stands over the battle's cell at about 9 px on screen (at least a third of a cell) and is picked
    before the creep under it; the inspector names the participants the team sees, the others by id.
12. Watching is offered to a team with a side in the stub, from the battle's inspector and from a locked creep's.
13. The battle events list says "um jogador domina X" when someone else takes a participant.
14. A reconnect asks for the screen again unless its battle already ended; an ended screen stays when the server no
    longer knows the battle.

## F7 — Soak and playtest

- [x] The soak test with a `kill -9` mid-battle; world and battle hashes after the restart
- [x] The PLAYTEST junction groups (spec §8)
- [x] **Checkpoint C2:** the owner's sessions; the hypothesis questions; the order of E against P (2026-11-25)

### F7 record

**What it does.** `npm run soak` now kills the server only with a battle open: after each planned tick, the soak
polls the `battles` table (read-only, every 5 ms, up to 60 s) and sends the `kill -9` as soon as one has no end, then
reads which battles the last commit left open, the ones recovery has to rebuild (N-3). At the end, besides the world
replay, the clients and the chronicle, every ended battle's stored log must replay to its stored final hash and to the
results the world log applied (`checkBattles`, the soak's version of `geo verify`'s fifth path), and every battle a
kill cut through must have ended after the restart. A server test covers what the bot × bot soak cannot: a crash in
the middle of a **real-time** battle with a human's inputs. The battle ticks run since the last world tick are lost
together with their results, so nothing is half-applied. The battle comes back as that commit stored it, on the world
clock, and both logs agree to the end.

**A bug found and fixed** while writing the playtest: the client could not attack a wanderer. The `sim` accepts the
attack approach (W-4), but the map's markers hold only creeps, so a right click on a wanderer moved there. Without it,
hunting a loaded wanderer and reinforcing a battle against one (331 of the 358 sweep battles have one) could not be
played. The right-click menu now lists the wanderers under the click.

**A harness bug found and fixed:** the first full soak reported 150 battles whose results disagreed with the world
log. They agreed; the exported replay orders a command's keys differently from the tables. The comparison is now on
canonical JSON, and the test feeds it a log with reordered keys.

**Measured.** `npm run soak` (seed 42, ×360, 3 world days, 12.1 min real; `runs/soak-20261125-094737-s42`, not
versioned): **OK**. Five `kill -9`, each with a battle open (302, 319, 327, 330, 500), and one SIGTERM; restarts in
0.3 s. All 218 battles ended, none open at the world's end; every battle log replays to its final hash and to the world
log's results; the world replay rebuilt in Node gives the server's hash (`104c9ad5…`, 614 logged commands). The four
clients end with the server's view and chronicle, with 0 hash mismatches in 3,589 checks each, 6 reconnects and 11–12
resumes each. Chronicle 738 rows, the same as the replay's events. SQLite 108.9 MB at the end. Memory 145–256 MB per
process; the loop at 100% of ×360 (median), 10% in its slowest sample (around a restart). 2,885 tests (2,881 before).

**Interpretations to validate** (implementation details the plan left open):

1. A planned kill waits for the first battle open after its tick (up to 60 real seconds); the SIGTERM does not wait.
2. A wanderer in the right-click menu: "Atacar", and "Extorquir (não negocia)" disabled, with its HP, its load
   ("leva …" or "vazio") and "em batalha" when it is in one.
3. The click hits a wanderer within half a cell of its center; with another team's creep under the click too, both
   are listed, the creeps first. A left click on a wanderer still selects nothing (no inspector for wanderers).
4. A battle that ends with joins still waiting is checked by its hash and its sent commands only (the exits of the
   late joiners carry the world's creep as it was then, which the tables do not keep); the soak had none.

### Checkpoint C2 (2026-11-25)

**The session.** The owner played alone against the bot (`dev:multi --clients 1 --bot --mult 6 --seed 42`), the J1–J5
groups freely, for about 40 real minutes (world #1 stopped at tick 13,931, day 1 03:52). From the world's database:

- **9 battles, 9 won by the owner, no creep lost.** 7 attacks on Orange (5 deaths, 2 escapes by the border) and 2
  fights with wanderers (both died), all by two dominated creeps, the triangle Udo and the circle Velta. Each lasted
  46–107 world seconds, in real time.
- **Orange ended with 1 creep and 110 matéria** (a creep costs 3,000): it could not replace its losses. Blue: 6
  creeps, 1,510 matéria.
- **3 wanderers born in 3.9 world hours** (the first at 1 h, then every hour shrinking to 15 min).
- A triangle walks 3 cells per world minute: 0.3 cells per real second at ×6, ~3.5 real minutes across the 64-cell
  map. The owner still explored the whole map before day 1 03:00; the world lasts 72 h (12 real hours at ×6).

**The owner's findings** (in their words, condensed):

1. The movement on the map feels slow at ×6, yet the whole map was explored before day 1 03:00.
2. The enemy bot is very passive: every loaded creep tries to flee except the square, which dies easily to a
   well-kited circle or triangle. Most attacks happened next to the enemy core, full of Orange creeps, and none came
   to help in any fight, which lost the bot the match.
3. The wanderers take too long to be born.
4. A **"follow"** action is missing, to walk in a group: the follower could join the fight by itself when its target
   attacks or is attacked. A bot's strategist could do the same to attack strategically or to protect a scout.
5. With every enemy creep dead (or one left exploring), there is no way to win or end the match, only to stop the
   process by hand.
6. A rebalance and pace round is due.

**The hypothesis** (spec §1), answered against this bot: the fight is won by micro with no real risk (9–0), and the
bot never sends a reinforcement, so neither the risk (question 1) nor arriving in time (question 2) could show; the
snowball (question 3) happened as soon as a human played, since the losing side cannot afford a new creep. The world
was readable with battles in it (no finding against question 4). The F4, F5 and F7 interpretations were not reviewed
one by one; they stay to validate in the friends' playtest. J6 (two humans) was not played: P has real humans.

**Decided** (owner, 2026-11-25), recorded in the [plan](plan.md) (C2-1 to C2-4), the
[ROADMAP](../../ROADMAP.md) and [GDD 07](../../gdd/07-autopilot.md):

1. **C2 closes** with this session.
2. **Only E's minimal end before P;** siege and repair after.
3. **A rebalance and pace round before the next playtest**, covering the world's pace, the wanderers, the bots'
   strategist, combat and economy, and the "follow" action on an allied creep (for humans and for the strategist).
4. **"Follow" is a proposal** in GDD 07, discussed in that round.
