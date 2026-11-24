# M2 plan — The junction

**Status:** Approved (2026-11-24) · **Date:** 2026-11-24
**Spec:** [spec.md](spec.md) · **ADRs:** [0010](../../adr/0010-world-side-of-the-battle-contract.md) (the world side
of the contract, `Accepted`), [0008](../../adr/0008-battle-package.md) (battle package),
[0007](../../adr/0007-sim-events.md) (`sim` events), [0006](../../adr/0006-world-sync.md) (view deltas),
[0004](../../adr/0004-persistence-sqlite-command-log.md) (log and snapshots), [0002](../../adr/0002-every-action-is-a-command.md)
(command vocabulary)

The decisions the owner approved with the plan (2026-11-24) are marked **(P*n*)** and listed in §12.

## 1. What the code does today and what changes

| Today (`SIM_VERSION` 9, `BATTLE_VERSION` 4, `PROTOCOL_VERSION` 4) | In slice D |
|---|---|
| The encounter's fight is `fightRound`, a roll every 10 world seconds (`encounter.ts`) | The fight is a battle instance; `fightRound` and the `fight` stage leave (D1) |
| The dialogue's flee is a speed roll; a mid-fight `flee` answer | Both leave; fleeing is the grid's border (D2). The `flee` **order** (run home with the bonus) stays: it is what an escapee does (D7) |
| `react` choices: `pay`, `refuse`, `fight`, `flee` | `pay`, `refuse` (extortion only); an attack opens the battle at once |
| `Creep.engagement`: the encounter id | Plus `Creep.battle`: the battle stub id while locked (P3) |
| No battle in the world | `state.battles`: the stubs (cell, window, sides, participants) (P3) |
| Max HP in the `sim` params and in `params/battle.json`; capacity in both | Only in the `sim` params; the battle setup carries them per participant (D9, P8) |
| `step` driven by the server, the CLI harness and the tests | The **junction host** wraps `step` and the battle instances; every caller goes through it (P1, P5) |
| The world log: player and system commands per world tick | Plus the result commands from the host (P2); the battle logs in their own tables, in the same transaction (P6) |
| The battle runs only in the lab's worker and `geo battle` | Also in the host, on the world clock or in real time (D4, D13) |
| The client draws only the world | Plus the battle screen, from the lab's arena view (P10) |
| No neutral creep | The wanderers (D14, P4) |

## 2. Where each thing lives

```text
packages/battle/src/
  setup.ts        ParticipantSetup gains maxHp and capacity (D9); params lose hp and capacity per DNA
  params.ts       the schema without hp/capacity; BATTLE_VERSION 5 (state.ts)
packages/sim/src/
  battle.ts       new: the stub, opening, locking, joins, the window, the result commands (exit, end), loot
  encounter.ts    attack opens the battle; refused extortion opens it; fightRound and the flee roll leave
  world.ts        Battle stub, Creep.battle, state.battles, state.wanderers; SIM_VERSION 10
  commands.ts     the battleExit and battleEnd system commands; react without fight/flee
  wanderers.ts    new (F6): birth curve, band, roaming, targets
  view.ts         battle stubs and wanderers in the team view, through the fog
  events.ts       battleOpened, battleJoined, battleLeft, battleEnded, wandererBorn
packages/junction/              new package (P1), pure, under the sim/battle determinism guards
  src/arena.ts    the window → arena text (rock, floor, spawn zones), the cell mappings (P7)
  src/setup.ts    world creep → ParticipantSetup (HP, max HP, capacity, load, gambits, reaction)
  src/host.ts     JunctionHost: instances, paces, stepping, joins, control, results, serialize/restore
  src/results.ts  battle events → battleExit / battleEnd commands
  src/log.ts      the battle logs the host keeps for persistence (setup + ticks with commands)
packages/protocol/src/
  index.ts        battle messages (commands, screen, frames), battles and wanderers in the delta; PROTOCOL_VERSION 5
apps/server/src/
  world-host.ts   steps through the JunctionHost; commits the battle logs with the tick
  battle-clock.ts new: the 50 ms real-time clock for battles with a human (D13)
  presence.ts     who has which battle screen open
  persistence.ts  battles and battle_ticks tables; recovery rebuilds the instances
  ws.ts           battle messages; frames to watchers
apps/cli/src/
  harness.ts      stepWithBots through the host; verify, sim, sweep and net with battles
apps/client/src/
  battle/         new: the arena view, input and motion, moved out of lab/ (P10); the lab imports them from here
  battle-screen.tsx new: the battle screen of the world client
  map/            the battle sign, the bubble, participants "in battle", wanderers
  chronicle/      the new sentences
```

## 3. The world side (`sim`)

### State (P3)

```ts
type Battle = {
  id: number;            // from nextId
  cell: Cell;            // the victim's cell when it opened
  window: { x: number; y: number; width: number; height: number }; // D5, shifted inside the map
  sides: Side[];         // index = battle side; { kind: "team"; team } | { kind: "wanderers" }
  participants: { id: number; side: number }[]; // world ids of locked creeps and wanderers, by id
  openedTick: number;
};
// Creep (and Wanderer): battle: number | null
```

- `Encounter` keeps only the `dialogue` stage (extortion). An attack emits the declaration and opens the battle on the
  same tick; a refused extortion (answer, rules or the end of the window) closes the encounter and opens the battle.
- A locked creep skips the autopilot, its order, gathering, delivery and regeneration (O-5). Domination is allowed.
- **Joins** (D6, J-1 to J-3), at the encounters stage: a creep with an `attack` approach on a participant, inside the
  window, joins the side of its team (or a new side, up to 4) when the side has fewer than `battle.sideCap` (5)
  participants; otherwise it waits, its approach intact. An `extort` approach on a participant is refused with the
  impossible-extortion refusal (J-2). The participant cannot be the target of a new encounter.

### The result commands (P2)

System commands, like `join` and the server's `release`, logged with **player id 0** (no real player has it; SQLite
ids start at 1) and refused from clients by the protocol:

```ts
| { type: "battleExit"; battleId: number; creepId: number;
    outcome: "died" | "escaped"; hp: number; cargo: Stock; cell: Cell }
| { type: "battleEnd"; battleId: number; winnerSide: number | null; reason: "won" | "idle";
    survivors: { creepId: number; hp: number; cargo: Stock; cell: Cell }[];
    piles: { cell: Cell; cargo: Stock }[] }
```

- `hp` is in whole battle points; the `sim` stores `hp × 1000` (D9). `cell` is already the world cell (the host maps
  it, P7).
- **`died`:** the cargo is zeroed (it stayed in the arena as a pile) and slice A's `kill` runs: the domination ends,
  the id is never reused (X-1).
- **`escaped`:** HP and cargo set, the creep moves to `cell`, the `flee` order with the bonus starts (X-2).
- **`battleEnd`:** with a winner, the winning side's survivors collect the piles up to free capacity, cristal first,
  in id order (slice A's D11), and the rest becomes spoils on each pile's cell (X-3); `idle`, everyone as an escape
  without the bonus, the piles as spoils (X-4). The stub leaves the state.
- The commands are validated like any other (the battle and the creep exist and match the stub); a refused one is a
  bug and fails the harness.

### Tick pipeline

The `step.ts` stages, with the changes in bold:

1. external commands, **the host's result commands included**;
2. autopilot: **locked creeps skip; the wanderers decide (F6)**;
3. orders: **locked creeps skip**;
4. encounters: open (**an attack opens the battle**), dialogue (**a refusal opens it**), **joins**;
5. production; **wanderer births (F6)**;
6. regeneration: **locked creeps skip**;
7. vision and memory: **battle stubs and wanderers enter the team's sight and memory**;
8. stats; tick++.

### Events and view

- New events (D15): `battleOpened` (battle, cell, sides with their creeps), `battleJoined`, `battleLeft` (escaped, by
  the border or by inactivity, with the cell), `battleEnded` (winner, loot per creep, spoils created). Death stays
  `died`, with the battle as its cause. The audience follows slice A: a team sees an event in which one of its creeps
  takes part, or whose cell it sees (K-2).
- The team view gains `battles` (the stubs it sees: cell, window, sides, participants' ids) and the participants'
  creeps carry `battle` (D16). The battle's internal state never enters the view (K-3).

## 4. The junction host (`@geometrix/junction`, P1)

### What it holds

```ts
type Instance = {
  battleId: number;           // the world stub's id
  state: BattleState;          // @geometrix/battle
  pace: "world" | "real";
  log: BattleLog;              // setup + ticks with commands (the battle package's format)
  participants: { worldId: number; battleId: number }[]; // world id ↔ participant id
  pending: BattleCommand[];    // joins and control waiting for the next battle tick
};
type JunctionHost = { instances: Instance[]; results: Command[] /* for the next world tick */ };
```

The host is JSON data plus pure functions, like the `sim` and the battle (`serializeHost`, `restoreHost`), so a run's
snapshot is the world's plus the host's.

### One world tick (P5)

```ts
function stepJunction(world, host, commands): SimEvent[] {
  for (const i of host.instances) if (i.pace === "world") stepInstance(i, 20); // one world second
  const events = step(world, [...commands, ...drain(host.results)]);           // X-0
  react(host, world, events); // opened → create instance; joined → join; domination → control
  return events;
}
```

- **The world clock** (T-1): the battles on the world pace advance 20 ticks before each world step, synchronously and
  in id order, so a world with no human is a function of its seed (the harness stays reproducible, ADR-0010 rule 6).
- **Real time** (T-2): the server calls `stepRealtime(host, battleId, commands)` every 50 ms for the battles on the
  real pace; their results queue in `host.results` and enter the next world tick.
- **The pace switch** (`setPace`) is the server's call (D13: a participant controlled by a human with the screen
  open). It is not a world command: the world never knows the pace (ADR-0010).
- **Results** (`results.ts`): each battle tick's `died` and `escaped` become `battleExit`; `ended` becomes `battleEnd`
  with the survivors and the piles, mapped to world cells; the instance leaves the host.
- **Opening** (`setup.ts`): for a `battleOpened` event, the arena from the window (P7), each creep's setup (whole HP
  points, at least 1; max HP and capacity from the world; cargo; gambits by D2/D10; `normal` reaction), the battle's
  seed derived from the world seed and the stub id by a fixed integer mix (no `state.rng` call, so the world's draw
  order does not change because a battle opened).
- **Joins and control:** `battleJoined` becomes a `join` on the next battle tick; a domination change on a
  participant becomes `control` (`human` or `ai`). A join the battle refuses (no free cell in the zone) stays in
  `pending` and is retried each battle tick (J-3).

### The arena (P7)

- The window: 9 × 5 world cells centered on the battle cell (`battle.window` in the `sim` params, with the scale), shifted
  to stay inside the map. Each world cell is a 5 × 5 block: 45 × 25 cells, plus the exit ring (47 × 27).
- Rock blocks where the world has rock; floor elsewhere. The four spawn zones are drawn in the text (`1`–`4`), as in
  the lab's arenas: sides 0 and 1 on the left and right, halfway between the border and the center; 2 and 3 at the top
  and bottom. Rock under a zone becomes floor (O-4).
- Arena → world: the cell under an arena cell is `window.x + floor(ax / 5)`, the same for y; the exit ring maps to the
  window's outer cells. A rock cell becomes the nearest walkable cell (BFS, ties by a fixed order).

## 5. The battle side (`@geometrix/battle`, P8)

- `ParticipantSetup` gains `maxHp` and `capacity`; the setup validation checks HP in 1..maxHp and the load against
  capacity. `params/battle.json` loses `hp` and `capacity` per DNA. `BATTLE_VERSION` 5.
- The lab and `geo battle` read max HP and capacity from `params/default.json` (the world's file, imported as JSON,
  not through the `sim`), so the number has one home. The CLI fixture of a lab log is rebuilt.
- Nothing else changes in the battle: the host drives it through its existing commands (`join`, `control`, `intent`,
  …) and reads its events.

## 6. Persistence and recovery (P6)

- New tables: `battles` (world, battle id, setup JSON, opened world tick, ended world tick, `BATTLE_VERSION`, final
  hash) and `battle_ticks` (world, battle id, battle tick, commands JSON), only ticks with commands, plus the battle
  tick each instance reached at the last commit (`battles.reached_tick`).
- `commitTick` writes, in the same transaction, the world tick's commands (results included), the new battles, the
  battle ticks run since the previous commit and the reached ticks (ADR-0010 rule 5).
- **Recovery:** the world from its snapshot and log (it replays alone); then, for each stub still in the state, the
  instance rebuilt with `replayLog` from its setup and ticks up to `reached_tick`, on the world pace (N-3). Battle
  ticks after the last commit are lost on both sides.
- The chronicle table is unchanged (derived from the world's events).

## 7. Network and server (P9)

- **Messages:** client → server `battleInput { battleId, command }` (only `intent`, `attackOnce`, `face`, `drop`,
  `pickup`, for the dominated participant, C-2) and `battleScreen { battleId | null }`; server → client
  `battleOpen { battleId, arena, params, setup names }` once, then `battleFrame { battleId, view, events }` per battle
  tick to whoever has the screen open (N-2). `PROTOCOL_VERSION` 5.
- **The delta** gains `battles` and the wanderers (§3); the diff property test covers them (N-4).
- **Frames** start as the battle view without the arena (sent once in `battleOpen`); `geo net` measures a watcher.
  If over 16 KB/s, the frames go through the M1.5 per-field diff (`delta.ts`).
- **The battle clock** (`battle-clock.ts`): a 50 ms `setTimeout` against a fixed baseline, like `TickLoop`, stepping
  the battles on the real pace; it does not drive the world.
- **Presence:** the socket tells which battle screen it has open; a battle is on the real pace while a player who
  dominates one of its participants has its screen open (D13). A disconnect closes the screen (and the existing
  release ends the domination).

## 8. Client (P10)

- **The shared battle module** (`apps/client/src/battle/`): `arena-view.tsx`, `input.ts`, `motion.ts`,
  `interpolate.ts`, `effects.ts` and their assets move out of `lab/`; the lab imports them from there, unchanged.
- **The battle screen** (`battle-screen.tsx`): it takes the map's place in the game layout when the dominated creep
  enters a battle, or when it dominates a participant (N-1); "back to the map" closes it (the creep goes to its
  gambits, D11), and a battle sign brings it back. The countdown, the signs, the inactivity line and the end table as
  in the lab. The movement drawing selector in the `?net=1` panel (D19).
- **Watching:** the battle sign on the map offers "watch" to the teams with a participant (D11, N-2).
- **The map:** the bubble as a thin outline, a sign at the battle cell with the sides' colors, the participants with
  an "in battle" mark; the wanderers in a neutral color (F6).
- **The reaction panel:** pay or refuse; the attack's reaction and the mid-fight flee button leave.
- **The chronicle:** sentences for the new events, with slice A's voice by DNA (the agent writes them, the owner
  reviews the tone at the checkpoint).

## 9. The wanderers (P4, P11; F6)

- **State:** `state.wanderers: Wanderer[]`, their own type (id from `nextId`, name, `dna: "circle"`, HP, cargo,
  order, `movePoints`, path, `battle`, cell), not `Creep`: every per-team path (stats, economy, production,
  domination, memory) stays untouched. The helpers they share with creeps (movement, pathfinding, HP) take the fields
  they need.
- **Params** (`wanderers` in the `sim` params): HP 60 and damage 12 (the battle's circle kit with those two; the host
  builds their setup with them), the band (rows within 8 of the river, outside the core zones), the birth curve
  (first at 3,600 s; interval 3,600 s down to 900 s, linear up to the world's end), the cap (4).
- **Behavior** (a stage of their own inside stage 2): roam to a random reachable cell of the band (`state.rng`), with a
  loaded team creep in sight approach it to attack, with a battle between teams in sight approach a participant
  (W-2). They never extort. In battle, the marksman preset, `normal` reaction.
- **Sides:** a battle side `{ kind: "wanderers" }`; at most one per battle. A wanderer that wins carries the loot (D8,
  W-3); its death leaves its load as spoils or a pile.
- **Fog:** a team sees them like an enemy creep (W-5); the strategist counts them as enemies in sight; the raider
  preset does not target them (no extortion).

## 10. Harness and tests

- **Baseline (F1):** `geo sim` 3 days (seed 42) and `geo sweep` 6 h (seeds 1–20) on `main` before any change, kept in
  `runs/` and quoted in `tasks.md` (spec §7).
- **Through the host:** `stepWithBots`, `runBots`, `geo verify`, `geo sim`, `geo sweep`, `geo net`, the bot-world
  tests and the soak test step with `stepJunction`. `geo verify` gains a fifth path: **each battle log replays to the
  results the world log applied** (the two logs agree, ADR-0010 rule 4); path 3 restores both the world and the host.
- **New metrics** (spec §7): battles per team and hour, by opening and ending; participants and joins; durations in
  battle and world seconds; win, death and escape per DNA and load against the baseline's roll; wanderers.
- **Tests:** the §5 rules on text maps (`sim`), the arena from a text window with rock and at the map's edge
  (`junction`), the world clock (a battle opened on tick T has stepped 20 × n ticks on tick T + n), a result command
  applied, the loot, a join waiting, a takeover, the two logs agreeing, nothing leaking.
- **Soak:** a `kill -9` while a battle is open; after the restart, the battle resumes and the final world and battle
  hashes match.

## 11. Risks

- **A join the battle cannot place:** the `sim` caps a side at 5, but the zone may be occupied by others standing on
  it. The host retries (J-3); if it lingers, the plan's fallback is the side's free entry cells nearest the zone.
- **Frames:** a full view every 50 ms to several watchers may pass the 16 KB/s guess; the diff is ready (§7).
- **The locked time at ×36:** a human battle locks creeps for long in world time (D3, accepted); the playtest runs at
  ×6.
- **The bots:** without the roll, the raiders may lose or win far more; the F3 checkpoint looks at it before the
  client is built.

## 12. Decisions (approved 2026-11-24)

| # | Decision | Alternative not taken |
|---|---|---|
| P1 | A **new package `@geometrix/junction`**, pure, under the determinism guards, used by the server and the CLI; a new commit scope `junction` | The host inside the server (the CLI and the tests could not run bot battles) or inside the `sim` (breaks ADR-0010 rule 1) |
| P2 | The results are **system commands** of the world vocabulary (`battleExit`, `battleEnd`), logged with player id 0 | A table of their own for results (the world replay would read two sources) |
| P3 | The world keeps a **stub** (`state.battles`) and `Creep.battle`; the `Encounter` keeps only the dialogue (extortion) | The battle as a third encounter stage (mixes two lifecycles in one record) |
| P4 | The wanderers in **their own array and type** (`state.wanderers`), sharing only the movement and HP helpers | Wanderers as `Creep`s with a reserved team (every per-team path would need a guard) |
| P5 | The host steps the world-paced battles **before** each world step, and their results enter that step; the real-time results enter the next one | Results applied in the same tick that produced them (the world would step twice per tick) |
| P6 | **`battles` and `battle_ticks` tables**, only ticks with commands, written in the world tick's transaction; recovery rebuilds with `replayLog` | Battle snapshots every N ticks (faster recovery, more to store and verify; battles are short) |
| P7 | The arena: a **9 × 5 window, 5 × 5 blocks**, the four spawn zones always drawn, north up; the cell mapping by floor division | A window as tall as wide (45 × 45: too tall for a laptop screen, lab C13) |
| P8 | Max HP and capacity in the **setup**; the lab and `geo battle` read them from `params/default.json` | A copy of the table in the battle package (two homes again) |
| P9 | Frames: **the view without the arena, every battle tick**, to whoever has the screen open; the diff only if `geo net` asks | The diff from the start (more work before knowing it is needed) |
| P10 | The lab's view, input and motion **move to `apps/client/src/battle/`**, shared by the lab and the game | A copy in the game (two arena views to keep in step) |
| P11 | The wanderers' behavior as a **stage of their own** in the `sim`, not a strategist (they are not a player) | A bot strategist with its own commands (they would need a player and a team) |

### Decided at checkpoint C1 (2026-11-24)

The bot × bot report through the host (tasks, F3 record) had battles only in a world's first hours, all 1 × 1,
all from a refused extortion, with outcomes set by the victim's DNA. The causes found are the bots' policy (raiders
only while there is map to explore, picked by id, extortion only, nobody helping) and the spawn zones' distance to
the exit ring, not the combat numbers. The owner decided:

| # | Decision | Alternative not taken |
|---|---|---|
| C1-1 | **Merge F3; the wanderers (F6) run before F4 and F5**, and the bot × bot report is measured again with them (checkpoint C1b) before the network and the client | The plan's order F4 → F5 → F6; a balance round before any new phase |
| C1-2 | **A junction matrix in the harness**, now: auto-resolved battles from real world setups and arenas, DNA × DNA, loaded or empty, fight or flee, seeds 1–100, so the risk is measured apart from the bots' policy | Judging the combat from the bot × bot runs only |
| C1-3 | **The spawn zones' distance to the border becomes a param**, its value chosen with the matrix and brought to the owner | The zones halfway between the border and the center, fixed (F3 interpretation 1) |
| C1-4 | **The strategist unchanged until the wanderers are in**; changes to the bots, if still needed, come at C1b as a proposal | Raiders patrolling after exploring, mixed DNA and helping a teammate, together with F6 |

## 13. Implementation order

| Phase | Content | Checkpoint |
|---|---|---|
| **F0** — Spec, ADR and plan | Design round; ADR-0010; this plan | The owner approves the plan |
| **F1** — Baseline and the battle contract | The baseline runs; max HP and capacity in the setup, the lab and CLI reading the world's params (`BATTLE_VERSION` 5); the `junction` package skeleton with the guards and CI | — |
| **F2** — The world side | The stub and the lock; the attack and the refused extortion opening the battle; the roll and its flee leaving; `react`; the result commands with loot, spoils and escape; joins with the cap; events and view; `SIM_VERSION` 10. Tested with hand-built result commands | — |
| **F3** — The host and the harness | The arena from the window; the setups; both paces' code; joins and control; results; host serialize; every harness caller through the host; `geo verify` with the two logs; the battle metrics | **C1:** the bot × bot report (battles per hour, outcomes, the risk against the roll, snowball, tick cost) |
| **F6** — The wanderers (after F3, C1-1) | The junction matrix and the zones' distance as a param (C1-2, C1-3); state, params, birth, roaming, targets, joining, loot; fog and view; drawing; chronicle; metrics | **C1b:** the matrix, the zones' value and the bot × bot report with wanderers against C1; the bots (C1-4) |
| **F4** — Network and server | Protocol 5; the delta with stubs; frames, inputs and screen presence; the battle clock and the pace; the battle tables and recovery; `geo net` with a watcher | — |
| **F5** — Client | The shared battle module; the battle screen opening by itself, back to the map, watching; the battle on the map; the reaction panel; the chronicle sentences | — |
| **F7** — Soak and playtest | The soak test with a `kill -9` mid-battle; the PLAYTEST junction groups | **C2:** the owner's sessions (spec §8), the hypothesis questions, the order of E against P |
