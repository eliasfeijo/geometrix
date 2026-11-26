# M2 plan — Rebalance and pace

**Status:** Approved (2026-11-25) · **Date:** 2026-11-25
**Spec:** [spec.md](spec.md) · **ADRs:** [0010](../../adr/0010-world-side-of-the-battle-contract.md) (the world side
of the battle contract: the host and its paces), [0007](../../adr/0007-sim-events.md) (`sim` events),
[0006](../../adr/0006-world-sync.md) (view deltas), [0004](../../adr/0004-persistence-sqlite-command-log.md) (log and
snapshots), [0002](../../adr/0002-every-action-is-a-command.md) (command vocabulary)

The decisions the owner approved with the plan (2026-11-25) are marked **(P*n*)** and listed in §12.

## 1. What the code does today and what changes

| Today (`SIM_VERSION` 11, `BATTLE_VERSION` 6, `PROTOCOL_VERSION` 7) | In slice R |
|---|---|
| `params/default.json` is the 72-hour world, tuned for bot × bot; the ×N lives only in the server's `worlds` row (lobby default 36) | The default params are the 2-hour world, and carry the ×N they are tuned for (P1); the 72-hour world moves to its own file (P2) |
| `geo sim` and `geo sweep` report in world time, no targets | Real minutes at a ×N, the §7 targets with pass or fail, the recovery scenario (P12, P13) |
| Orders: stop, moveTo, explore, gather, deliver, buildRoad, approach, pickup, flee | Plus `follow` and `drop` (P3, P5) |
| Conditions and actions of the closed vocabulary | Plus `allyInBattle`, `joinBattle`, `follow`, `drop`; `buildRoad` with no cell (P4, P6) |
| The road-builder preset asks the player for a cell; the strategist's builder role holds its own target | The preset resolves its target with `roadTarget`; the strategist's builder is the plain preset (P6) |
| A foreign creep in sight shows no intent until an encounter opens | Creeps and wanderers in sight show a hostile intent while chasing (P7) |
| `Player.bot` in the sim; the strategist has one behavior; its creeps fight with the `normal` reaction | `Player.difficulty` from the `join` command; three levels; the bot's battle reaction follows it (P8) |
| The strategist acts once per world minute | Plus, at hard, a threat pass every tick (P9) |
| A battle's pace is `world` or `real` (`paceOf`, junction host) | Plus `held`: the opening pause and the humans' pause, set by the server (P11) |
| A left click picks one thing; several creeps give the creeps' stack list | Every inspectable actor in the area (P15) |
| The inspector says what a creep does | Plus its destination on the map and the estimated time (P14) |

## 2. Where each thing lives

```text
params/
  default.json      the 2-hour world (F4), world.multiplier (P1), battle.hold (P11), autopilot.followCells (P3)
  world-72h.json    the old default, for the 3-day hypothesis (P2)
packages/sim/src/
  orders.ts         the follow and drop orders: walking by the target, joining its battle, dropping (P3, P5)
  autopilot.ts      allyInBattle, joinBattle (with the load rule), follow, drop, buildRoad with no cell (P4, P6)
  rules.ts          the vocabulary's copy and checks for the new conditions and actions; the follow cycle (P3)
  presets.ts        the help rule per DNA in every preset; the road builder with no target (P6, P10)
  domination.ts     OrderInput follow and drop; drop accepted for the victim of an extortion (P5)
  encounter.ts      a drop by the victim of an extortion is a refusal (D24, DR-3)
  view.ts           the hostile intent of creeps and wanderers in sight (P7); the player's difficulty
  strategist.ts     difficulty, posture, defense, replacement, groups, escort, the threat pass and the risk (P8, P9)
  params.ts         the new params and their consistency
  world.ts          Player.difficulty; SIM_VERSION 12
packages/junction/src/
  host.ts           the held pace: host.holds, set by the server, not serialized (P11)
  setup.ts          the participant's reaction from its team's bot difficulty (P8)
packages/protocol/src/
  index.ts          the follow and drop orders, battlePause (client), battleHold (server), the hostile intent in the
                    delta; PROTOCOL_VERSION 8
apps/server/src/
  holds.ts          new: the opening pause and the humans' pause, their countdowns and releases (P11)
  world-host.ts     the strategist with its difficulty and its threat pass; the holds wired to the host
  persistence.ts    the bot's difficulty on its player row (migration); world creation takes it
  dev-multi.ts      --mult defaults to world.multiplier; --bot-difficulty
apps/cli/src/
  main.ts, sim.ts, sweep.ts, report.ts   --mult, real minutes, the targets table, difficulty per team
  pace.ts           new: the §7 metrics and targets (crossing, opening, exploring, wanderers, population, help)
  shock.ts          new: the recovery scenario (P12)
apps/client/src/
  map/pick.ts, panels/stack-list.tsx    the actors' list (P15)
  map/hostile-layer.tsx                 new: the red signs and the line to the target (D25)
  map/destination-layer.tsx             new: the selected creep's path and destination (D19)
  eta.ts                                new: the estimated time (P14)
  map/road-plan.ts, map/road-preview-layer.tsx   the road builder's plan (D13)
  panels/approach-menu.tsx              "Seguir" on an ally (D8)
  panels/rules-editor.tsx               "Seguir…", the road builder without a cell, the new rules' text (D9, D12)
  panels/inspector.tsx                  "Largar carga", the ETA, the road plan's cost, wanderers (D20, D21, D24)
  battle-alert.tsx                      new: the map alert with the countdown and "Entrar" (D6, D7)
  battle-screen.tsx, battle-control.ts  P on the screen, the countdowns (D28)
  lobby.tsx                             the default ×N and the bot's difficulty
```

## 3. The pace (params and harness)

- **`world.multiplier`** (P1): the ×N the params are tuned for, in `params/default.json`. The server's lobby and
  `dev:multi` default to it; `geo sim` and `geo sweep` convert world time with it (or `--mult`). A world still keeps
  its own ×N in its row: the param is only the default. A test checks `durationSeconds ÷ multiplier` is 2 h ± 5 min
  (PA-1) and `encounter.reactionSeconds ÷ multiplier` ≥ 10 s (PA-3); `checkConsistency` does not, since a 72-hour
  file is also valid.
- **The two files** (P2): `params/default.json` becomes the 2-hour world in F4; the current numbers move to
  `params/world-72h.json` in F1, unchanged, with `world.multiplier` 6 (C2's). The tests keep `test/params.json`.
- **The balance pass** (F4) runs `geo sweep` over the §6 guesses, one family of params at a time, against the
  targets: speeds and map size first (crossing, exploring), then costs and production (the opening, population,
  recovery), then the wanderers, then the encounter windows. The ×N candidates (6, 8, 12) each get the set that
  passes; the runs and the chosen set go into `tasks.md`. The world's other durations scale with the ×N candidate:
  the sweep converts a target in real minutes with the candidate's ×N.
- **The targets module** (P13, `apps/cli/src/pace.ts`): every §7 metric computed from a run (the stats samples, the
  events, the final state), in world seconds and in real minutes at the ×N, and a table of targets with pass or
  fail in `report.md` and the sweep's summary. The thresholds are the spec's §7, as harness criteria (like the
  junction's targets), not params.
- **The recovery scenario** (P12, `shock.ts`): `--shock <team>:<count>@<real minute>` removes that many of the team's
  creeps (the free ones of highest HP first, ties by id) when the run reaches the minute, by the death path of slice
  A without a killer, then measures how long the team takes to be back to its count. It is a harness mutation, not a
  command: such a run is marked not replayable, and `geo verify` refuses `--shock`.
- **Crossing** is computed, not simulated: the path cost from a core to the other with the triangle's speed, per seed.

## 4. The world side (`sim`)

### Follow (P3)
- `Order` gains `{ type: "follow"; targetId }`; `Action` gains `{ type: "follow"; creepId }`; `OrderInput` gains the
  order (the dominated creep; the target must be the team's creep, alive, not itself).
- **Walking:** the follower walks toward its target's cell by the cached path (keyed on the target cell, like the
  approach), and halts its points while within `autopilot.followCells` (Manhattan, 2). It does not gather, deliver or
  pick up while following.
- **Joining:** when the target has a battle (`Creep.battle`), the follower's step picks the nearest enemy participant
  of that battle it sees (ties by the cell in its team's frame, then id) and walks to it as an attack approach does,
  so `battleToJoin` joins it on its target's side (junction J-1). When the target opens an encounter, the battle that
  opens is the same case one tick later. A follower does not take part in an extortion's dialogue.
- **The end:** when the target dies or leaves the team, the order halts (`stop`); the rule stops matching, so the
  autopilot falls through to the next rule.
- **Cycles** (F-5): the rule copy refuses a `follow` on the creep itself; a command or rule whose chain of follow
  targets (orders and first matching rules) comes back to the creep is refused (`invalidTarget`). The chain is short;
  the check walks it once per command.
- **Load** (F-6): a loaded follower whose target is in a battle obeys the help rule's load check (below).

### Helping an ally (P4)
- `Condition` gains `{ type: "allyInBattle"; radius }`: some battle stub with a participant of the team, whose cell is
  within `radius` (Manhattan) of the creep and visible to the team.
- `Action` gains `{ type: "joinBattle" }`: the nearest such battle (ties by the frame and id); its order is an attack
  approach on the battle's nearest enemy participant in sight (`opening` must allow it), so joining is the junction's.
- **The load check** (H-4) in `joinBattle`'s order: with some load, the creep compares the path cost to its core with
  the path cost to the battle's cell on the team's known map (`nearestTargets`, bounded by the battle's cost so the
  search stays small); when the core costs less, the action is not possible now (null), so the next rules (deliver)
  decide; once empty, the rule matches again.
- The battle stubs are already in the state with their participants; nothing new is stored.

### Dropping the load (P5)
- `Order` gains `{ type: "drop" }` (`Action` and `OrderInput` too). In `resolveOrders` it calls `dropSpoil` on the
  creep's cell with its whole cargo, emits a `dropped` event (creep, cell, cargo), and halts. An empty creep halts
  with no event; the command is refused when empty (`emptyCargo`) or in a battle (`inBattle`, as today).
- **During an extortion** (DR-3): the `drop` order is the one order accepted while engaged, and only from the victim
  of an extortion. Its command drops at once (step 1) and sets the encounter's reply to `refuse`, so step 4 opens the
  battle with the victim empty. A free victim decides by its rules the tick the encounter opens; the bot drops before
  that, by the threat pass (P9).
- The chronicle gets one sentence for `dropped`.

### The road builder with no cell (P6)
- `Action`'s `buildRoad` takes `x`, `y` optionally; with none, `orderFor` resolves the target with `roadTarget` on the
  team's known road context (the strategist's rule, moved from `strategist.ts` to `roads.ts`) and builds toward it
  as today. `presetRules("roadBuilder")` takes no target; `applyPreset` refuses a target for it.
- The strategist's builder role becomes the plain preset: `roleOf` recognizes it by its rules like the others.

### The presets (P10)
- `presetRules(preset, dna)`: every preset gets one help rule, `{ when: allyInBattle(radius), then: joinBattle }`,
  after its reaction rules and before gathering. The vocabulary has no "HP at least" condition, so the HP floor is a
  field of the action: `{ type: "joinBattle"; minHpPermille }`, not possible below it (P10). Numbers per DNA in
  `presets.ts` (■ 6 cells and 400‰, ▲ 6 and 500‰, ● 8 and 500‰), like the raider's numbers today.
- A creep's rules are replaced whole (CLAUDE.md); creeps born after the change get the new presets; the saved worlds
  are retired by the version bump.

### The hostile intent (P7)
- `CreepView`, `ForeignCreepView` and `WandererView` gain `hostile: { intent: "attack" | "extort"; target: number |
  null } | null`, from an `approach` order (a wanderer's approach is an attack). `target` is the target's id when the
  target is the viewing team's own creep or in its sight; else null, so a hidden creep's id never leaks (HS-3).
- The view is a shallow copy: the field is built per view, a new object only when it changes, so the delta compares
  it by value. `fullView` shows every intent.

### The difficulty (P8)
- The `join` command gains `difficulty?: "easy" | "normal" | "hard"`, accepted only with `bot: true` (default
  `hard`); `Player.difficulty` stores it (null for humans). The view shows it on the team's own players.
- The junction's setup gives a participant the battle reaction of its team's bot (the first bot player of the team by
  id), or `normal` when the team has none, as today. The battle log keeps the setup, so replays are unchanged.

### Events, version
- New event `dropped`. `SIM_VERSION` 12; the fixed hashes (serialize, the 6 h bot world) are rebuilt in F2 and again
  in F4 (the new default world).

## 5. The strategist (P8, P9)

- `strategistCommands(id, seen, size, params)` reads its difficulty from its own player in the view.
- **Every world minute** (as today), by difficulty:
  - **production** (D15, every level): `balanced()` already produces first and buys the upgrade only with what is
    left, so D15 holds today; what C2 lacked was stock (110 matéria for a 3,000 creep), which is the pace's job (D4).
    F3 pins the order with a test and changes nothing else (no peak: the view has no history of the team, and the
    strategist stays memoryless, fog spec B-1);
  - **defense** (D14, normal and hard): while a threat in sight stands in its core zone (a wanderer, or another
    team's creep whose hostile intent targets one of the team's creeps; C1, 2026-11-26), its free creeps in the zone
    get `approach attack` with the zone's radius on top of their rules; the rule leaves when no threat is left there;
  - **groups and escort** (D16, normal and hard): the raider role holds one raider and two followers (`follow` rules
    on the raider's id) from 8 creeps; one escort follows a cristal collector from 10; members whose leader died go
    back to gathering at the next decision;
  - **posture** (D17): normal and hard give every gatherer `[demandAtMost 250 → pay, hpBelow 400 → flee, always →
    fight]`; easy keeps slice D's `postureRules`.
  - The settings (cadence, shares, group sizes, the posture's numbers, the risk's weights) stay in `BALANCED`,
    printed in `report.md` (the strategist's policy, as today), not in the world's params.
- **The threat pass** (P9, hard only, every tick): for each own creep with a load and no encounter or battle, the
  enemies in sight whose hostile intent targets it. A new threat gets the D27 choice:
  - **the risk** compares the attackers' power with the power of the victim plus the own creeps whose path to the
    victim is no longer than the attacker's; power is HP × the DNA's weight (`BALANCED.risk`, from the junction
    matrix's win rates); help counts only for allies not in a battle;
  - **help coming:** the victim keeps its rules (the posture fights); the helpers get a `follow` rule on the victim;
  - **stronger enemy:** the victim gets `[demandAtMost 250 → pay, always → drop, always → deliver]` (a drop is an
    order of the autopilot, so it happens on the next autopilot pass, before the encounter opens when the chase
    lasts at least a tick);
  - **even or weaker enemy:** `[always → drop, always → fight]`, and after the battle the next full decision puts a
    `pickup` on top while the team remembers the spoil.
  - The threat pass's rules leave at the next full decision when the threat is gone. Its cost is one scan of the
    view's hostile intents per tick; the tick-cost target (§7) measures it.
- **N teams** (D18): "enemy" is any other team or a wanderer; ties use the existing frame helpers.

## 6. The pauses (P11)

- **The host:** `JunctionHost.holds: number[]` (battle ids), set by the server like `screens`, never serialized.
  `paceOf` returns `held` for a held battle: `stepJunction` does not step it, and the server's battle clock skips it.
  After a restart there are no holds, so a held battle resumes on the world clock (OC-6, BP-4 by construction).
- **The server** (`holds.ts`), per battle, a small state machine in real time:
  - **opening:** after a world tick whose `battleOpened` event has a team with a connected human (the presence
    tracker's sockets), hold it for `battle.hold.openingMs` (OC-1); with none, nothing (OC-2);
  - **pausing → paused:** a `battlePause` from a socket whose player dominates a participant of a real-time battle
    starts `battle.hold.countdownMs`, then holds (BP-1); **resuming:** the same message on a paused battle starts the
    countdown, then releases (BP-2); a request during a countdown or from a watcher is rejected (`busy`, `notInBattle`,
    BP-3);
  - **released by absence:** a paused battle with no human controlling a participant on its screen starts the resume
    countdown by itself (BP-4);
  - the battle's 3 s start countdown is the battle's own, in its first ticks, so it runs when the opening hold ends
    (OC-4).
- **The protocol:** client `battlePause { ref, battleId }`; server `battleHold { battleId, state: "opening" |
  "pausing" | "paused" | "resuming" | null, endsAt }` (server time in ms, the client shows the countdown) to every
  socket of a team with a participant and every socket with the screen open.
- **The world log** is unaffected (results are logged as before); the battle log has no ticks while held. The soak
  test and a server test cover a restart during a hold.

## 7. Network and server

- `PROTOCOL_VERSION` 8: `follow` and `drop` in `OrderInput`; `join` with the difficulty (bots only, server-side);
  `battlePause` and `battleHold`; the hostile intent in the creeps' and wanderers' delta (by value).
- `createWorld` requests take `botDifficulty` per bot team (default hard); the `players` table gains a `difficulty`
  column (migration, null for humans); `dev:multi --bot-difficulty`.
- `WorldHost.tick` runs the threat pass on every tick for hard bots, and the full decision when `strategistActs`;
  the CLI harness's `botCommands` runs the same function, so a server world and a harness world decide alike.

## 8. Client

- **The actors' list** (P15): `pickAt` returns every pick within the radius the creeps' pick already uses (creeps of
  any team, wanderers, the deposit, the core, spoils, the battle); one alone is selected; several open the list (the
  stack list, generalized), each line with its icon and key reading. A left click on a wanderer selects it (D21).
- **The hostile layer** (D25): a red sword or purse over each creep or wanderer with a hostile intent; for the
  team's own targets, a red line from the aggressor to it.
- **The destination layer** (D19): for the selected own creep, its path (`findPath` on the team's known map, as the
  road preview) to the order's destination and a marker there; a follow or an approach points at the target creep.
- **The ETA** (P14, `eta.ts`): walking, the path's cost against the creep's speed with the load and terrain
  modifiers (`stepCost`), divided by the world's ×N for real seconds; gathering, the free cargo over the gather rate;
  building, the road job's remaining time (already on the map). Shown as "~" and rounded.
- **"Seguir"** in the right-click menu on an ally (the dominated creep's order); **"Seguir…"** in the rules editor
  (pick an ally, then `setRules` with the follow rule after the reaction rules); **"Largar carga"** in the dominated
  creep's panel, also during an extortion (in the reaction panel, next to pay and refuse).
- **The road builder** without a cell; its plan on the map from `roadTarget` on the team's view and the road plan's
  drawing; the cost line in the inspector.
- **The battle alert** (D6, D7): on `battleHold` opening for a team's battle, a banner on the map with the countdown
  and "Entrar", which dominates the D7 creep (or opens the screen to watch) and opens the battle screen.
- **P on the battle screen** (D28): the key sends `battlePause`; the countdowns and "pausado" on the screen.
- **The lobby:** the default ×N from the params, the bot's difficulty per bot team.

## 9. Harness and tests

- **Tests per rule** (spec §5): `sim` on text maps (follow on a path, into a battle, the target dying, a cycle; the
  help rule at its radius and through the fog; the load check with and without a road; drop, and drop during an
  extortion; the hostile intent and HS-3; the road builder re-resolving; the strategist on hand-built views: defense,
  groups, posture, each D27 choice); `junction` (held pace, the reaction from the difficulty); `server` (the holds'
  machine with fake timers, a restart during a hold, the migration); `protocol` (the diff property with the new
  fields); `client` (the actors' list, the ETA against a hand-computed path).
- **`geo verify`** with follow, drop and hostile intents (seeds 1, 42, 649); `geo net` on the new default world.
- **`npm run soak`** on the new default world (the soak keeps its own ×360), with holds.

## 10. Running next to the other slices

- **E-min** touches the strategist (conceding), the CLI reports and `world.durationSeconds`: the second to merge
  rebases its strategist changes and its report section on the first. The concession reads the population, which R's
  production changes; the E-min threshold stays its own.
- **K** changes the battle (kits, presets, the carrier's gambits); R's F8 is the final balance pass on top of it. R
  does not touch `packages/battle`.
- **G** (groups and formations) designs on top of R's `follow` and the strategist's groups; its design round runs now,
  its code after K.

## 11. Risks

- **Tick cost:** the help rule's load check and the threat pass add path searches. Both are bounded (the battle's cost
  caps the search; the threat pass scans only targeted creeps). §7's 1.5× target catches it.
- **Information leaks:** the hostile intent is new view data; HS-3 has its own test with a hand-built world.
- **Balance against moving code:** F4's pass runs after the strategist and the help rule change the economy, and F8
  runs again after K. The numbers chosen in F4 may move in F8.
- **Pauses abused:** no limit in R (D28); a human can freeze a battle with another team's human in it. The playtest
  is among friends; a limit is parked.

## 12. Decisions (approved 2026-11-25)

| # | Proposal | Alternative |
|---|---|---|
| P1 | **`world.multiplier` in the params:** the ×N the params are tuned for; the lobby, `dev:multi` and the CLI's real time default to it; a world keeps its own ×N | The ×N only in the server's config (the params and the harness would not know the session's real time) |
| P2 | **The 72-hour world kept as `params/world-72h.json`** (today's numbers, ×6) for the 3-day hypothesis | Drop it; git history keeps it |
| P3 | **Follow as an order and an action**, distance `autopilot.followCells` (2) in the params; joining by the approach path to the nearest enemy participant; a cycle refused at the command and the rule | A follow that only walks, with joining left to the help rule (two rules for one behavior) |
| P4 | **`allyInBattle` + `joinBattle`**, the load check inside `joinBattle` (null when the core is cheaper, so the next rule delivers) | A separate condition for the load (a rule more per preset) |
| P5 | **`drop` as an order**, executed in step 3; during an extortion, its command drops at once and sets the reply to refuse | A third `react` choice (`drop`) for the dialogue only |
| P6 | **`buildRoad` with an optional cell;** none means `roadTarget`, moved into `roads.ts` | A new action `buildRoadAuto` |
| P7 | **The hostile intent in the three creep views**, the target's id only when the viewing team owns or sees it | The whole order of foreign creeps (leaks more than the sign) |
| P8 | **The difficulty in the `join` command and `Player`**, so the strategist, the junction's battle reaction and replays share one source | A server-only setting (the host and the harness would each need a copy) |
| P9 | **A threat pass every tick at hard**, acting by `setRules` on the victim and the helpers before the encounter opens; the strategist's numbers stay in `BALANCED` | React only at the minute's decision (often too late: the chase is short) |
| P10 | **The help rule's HP floor as a field of `joinBattle`** (`minHpPermille`), numbers per DNA in `presets.ts` like the raider's | A `hpAtLeast` condition (a new condition and one more rule per preset) |
| P11 | **The pauses as a held pace in the host**, set by the server like `screens`, not serialized; params `battle.hold.openingMs` (5,000) and `countdownMs` (3,000) | The pause inside the battle package (a `BATTLE_VERSION` bump and pause ticks in the battle log) |
| P12 | **The recovery scenario as a harness mutation** (`--shock`), marked not replayable | A system command to kill creeps (a command in the vocabulary only for the harness) |
| P13 | **The §7 targets in a CLI module**, printed with pass or fail; thresholds are harness criteria, not params | Targets in a JSON file next to the params |
| P14 | **The ETA in the client**, from the sim's path and speed helpers on the team's known map | The server sends an ETA per creep (more delta for a readout) |
| P15 | **One pick list for every actor**, the creeps' stack list generalized | A separate list for structures |

**At F3's checkpoint C1** (owner, 2026-11-26; the numbers in the F3 record of the tasks):

- **C1-1** D14's defense starts only for a threat in the zone: a wanderer, or another team's creep chasing one of the
  team's creeps (it wiped the teams whose collectors worked a deposit in the zone). Its attack still goes to the
  nearest enemy within the radius (the `approach` action's choice).
- **C1-2** D16 keeps "while the team can still explore"; the groups are measured again at F4's checkpoint C2, on the
  2-hour world. If they still never form, where a group raids with nothing to explore goes to the owner as a design
  question.
- **C1-3** The tick cost is accepted (48 µs per tick for hard × hard, ~94 µs in the busiest easy × hard world, the
  threat pass 2.3% of it). A cache of `roadTarget` per `roadRevision` is parked for F4/F7, if the 2-hour world's
  cost passes 1.5× F1's.

## 13. Implementation order

| Phase | Content | Checkpoint |
|---|---|---|
| **F0** — Spec and plan | The spec (approved 2026-11-25); this plan and its P1–P15 | The owner approves the plan |
| **F1** — Baseline and the pace harness | `world.multiplier`; `params/world-72h.json`; `--mult`, real minutes and the targets table; the crossing; the recovery scenario; the baseline on the 72-hour world at ×6 | — |
| **F2** — The world vocabulary | follow, allyInBattle/joinBattle with the load check, drop (and during an extortion), buildRoad with no cell; the presets; the hostile intent in the view; difficulty in `join`/`Player` and in the junction's setup; `SIM_VERSION` 12; the protocol types the sim's types require | — |
| **F3** — The strategist | Difficulty levels; posture, defense, production, groups and escort; the threat pass and the risk; its metrics; the junction matrix with the new posture | **C1:** bot × bot at each difficulty and hard against easy, on the 72-hour world in real time at ×6: help, groups, defense, payments, drops, choices |
| **F4** — The balance pass | The sweeps of §3 over ×6, ×8 and ×12; the 2-hour default world; the fixed hashes | **C2:** the targets' table per ×N candidate; the owner picks the candidates to play |
| **F5** — The pauses, network and server | The held pace; `holds.ts`; `battlePause`/`battleHold`; the difficulty column and world creation; `PROTOCOL_VERSION` 8; `geo net` | — |
| **F6** — Client | The actors' list, the hostile layer, the destination and the ETA, "Seguir"/"Seguir…"/"Largar carga", the road builder's plan, the battle alert and "Entrar", P on the screen, the lobby | — |
| **F7** — Soak and playtest | The soak on the new world with holds; the PLAYTEST R groups | **C3:** the owner's sessions (spec §8); the ×N chosen |
| **F8** — The final balance pass (after K's merge) | The §7 sweeps again with the kits; the numbers that move | **C4:** the targets with the kits; R closes |
