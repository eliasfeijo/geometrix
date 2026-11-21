# M2 plan — The battle lab

**Status:** Approved (2026-11-15) · **Date:** 2026-11-15
**Spec:** [spec.md](spec.md) · **ADRs:** [0008](../../adr/0008-battle-package.md) (battle package, `Accepted`),
[0007](../../adr/0007-sim-events.md) (events outside the state),
[0003](../../adr/0003-typescript-node-pure-integer-simulation.md) (pure, integer simulation),
[0002](../../adr/0002-every-action-is-a-command.md) (everything is a command),
[0009](../../adr/0009-prediction-in-the-lab.md) (prediction as a lab experiment, `Proposed`)

The decisions that needed the owner's OK are marked **(P*n*)** and listed in §15. **All approved by the owner
(2026-11-15), as proposed.**

## 1. What exists and what is new

| Today | In slice B |
|---|---|
| One simulation, the `sim` (world, 1 tick per world second) | Plus `@geometrix/battle` (`packages/battle`), with no dependency on the `sim` (ADR-0008), at 20 ticks per second |
| The lint determinism guards cover `packages/sim/src` | They also cover `packages/battle/src` |
| RNG (`rng.ts`) and canonical JSON (`serialize.ts`) in the `sim` | Copied into the battle package, with an equality test (P1) |
| World params in `params/default.json` | Plus `params/battle.json` and the arenas in `params/arenas/*.txt` |
| `geo sim`, `sweep`, `verify`, `net` | Plus `geo battle` (`sweep`, `verify`) |
| The client has one page (`index.html`) | Plus `lab.html`, the lab page, with the battle in a worker (P11) |
| CI: `geo verify` and the `geo sim` budget | Plus `geo battle verify` and an auto-resolve budget |

## 2. Where each thing lives

```text
packages/battle/
  package.json    @geometrix/battle, no runtime dependencies; test devDependency: @geometrix/sim (P1)
  src/
    rng.ts        copy of the sim's xoshiro128** (P1)
    canonical.ts  copy of the sim's canonicalJson (P1)
    params.ts     schema, BattleParams, parseBattleParams, checkConsistency
    arena.ts      text arena parser, cells, neighbors, clear line, exit ring, entry stretches
    state.ts      BattleState, Participant, Projectile, Pile; BATTLE_VERSION
    setup.ts      BattleSetup, validation (S-2) and createBattle (S-1)
    commands.ts   command vocabulary and validateCommand
    movement.ts   points, load slowdown, cell contest by rng
    combat.ts     melee attack, projectiles, damage, death
    carry.ts      drop, pick up, piles
    exits.ts      border escape, inactivity, end
    gambits.ts    vocabulary, evaluation, targets, BFS, dodge; AI reaction (P12)
    presets.ts    frontline, marksman, skirmisher, carrier
    view.ts       BattleView (what the page and the AI read)
    events.ts     BattleEvent and the tick collector
    step.ts       stepBattle(state, commands): BattleEvent[]; the pipeline (§7)
    serialize.ts  serializeBattle, restoreBattle
    log.ts        BattleLog (setup + commands per tick) and replayLog
    index.ts      public exports
  test/           helpers.ts (fixed params, text arenas), one file per module
params/
  battle.json     stats per DNA and battle numbers (spec §6)
  arenas/         aberta.txt (open), pedras.txt (rocks), corredor.txt (corridor)
apps/cli/src/
  battle.ts       geo battle sweep / verify; fight matrix; report
apps/client/
  lab.html        the lab page (the Vite build's second entry)
  src/lab/
    worker.ts     the local server: clock, stepBattle, hash, log
    channel.ts    the channel with delay, jitter and preserved order (P7)
    lab.tsx       the page: setup, controls, panels
    arena-view.tsx  the arena's SVG render (reuses map/creep-shape.tsx)
    input.ts      keyboard → intent (§6)
    motion.ts     the movement drawing options (F7, C11)
    setup-form.tsx, gambits-editor.tsx, events-list.tsx, result-table.tsx, latency-panel.tsx
    session.ts    the session record, blind mode and export (P14)
```

## 3. Units and params

- **Time in ticks.** `tick.ticksPerSecond` = 20. Every duration in the params is in **milliseconds**, and
  `checkConsistency` requires a multiple of `1000 / ticksPerSecond` (50 ms). E.g. a 0.8 s cooldown is 800 ms, 16
  ticks.
- **Movement in points**, like the `sim`'s `CELL_COST`: `CELL_COST = 6 000`, divisible by 20. Per tick, the creep
  gains `cellsPerSecond × CELL_COST ÷ ticksPerSecond` points, times the load slowdown in ‰, with `Math.floor`; it
  enters the next cell on reaching `CELL_COST`. The projectile moves by the same arithmetic, with its own speed.
  **Since F6** (spec D22, C4): standing still, the creep also gains points, but only up to `CELL_COST`; whoever is
  born or joins starts with `CELL_COST`. The first step comes on the tick after the command, and tapping is not faster
  than holding.
- **Load slowdown** (spec D8): `brake‰ = 1 000 − fullBrakePermille × load ÷ capacity` (with `Math.floor`); with a
  full purse and `fullBrakePermille` = 500, half speed.
- **Integer HP and damage**, no thousandths: the battle does not regenerate, so there is no rounding to accumulate.
- **Melee is a speed-0 projectile:** `projectileCellsPerSecond` = 0 means the attack hits the cell in front (the
  square). So each DNA's kit lives entirely in the params, and the lab can try a shooting square with no code change.

```json
{
  "tick": { "ticksPerSecond": 20 },
  "start": { "countdownMs": 3000 },
  "dna": {
    "square":   { "hp": 300, "damage": 30, "range": 1, "cooldownMs": 1000, "cellsPerSecond": 3,
                  "projectileCellsPerSecond": 0, "capacity": 30 },
    "triangle": { "hp": 200, "damage": 20, "range": 4, "cooldownMs": 800, "cellsPerSecond": 4,
                  "projectileCellsPerSecond": 10, "capacity": 20 },
    "circle":   { "hp": 120, "damage": 24, "range": 6, "cooldownMs": 800, "cellsPerSecond": 5,
                  "projectileCellsPerSecond": 12, "capacity": 10 }
  },
  "carry": { "fullBrakePermille": 500 },
  "exit": { "dwellMs": 2000 },
  "inactivity": { "timeoutMs": 15000 },
  "ai": { "decisionMs": 250, "decisionJitterMs": 100 },
  "gambits": { "maxRules": 8 },
  "limits": { "maxSides": 4, "maxPerSide": 5 }
}
```

The package's `test/params.json` fixes the same numbers and does not follow balancing, as in the `sim`. The exception
is the starting countdown (spec D21, F5): 0 in the test params, so the rules are tested from the first tick; the
countdown tests turn it on.

## 4. The arena

Text, one line per row, with the exit ring included (23 × 15 for the spec's original 21 × 13 arena):

| Character | Cell |
|---|---|
| `.` | floor |
| `#` | rock (blocks movement and projectiles) |
| `1`–`4` | floor of side *n*'s entry stretch |

- The **exit ring** is the outer row and column, and may only hold floor or rock. The entry stretches sit **on the
  first inner ring**, next to the exit: whoever is born is not on the exit and does not start fleeing (spec S-1, D7).
- **F3 checkpoint (owner, 2026-11-17), done in F4:** the three arenas become 43 × 27 (45 × 29 with the ring), plus an
  open 63 × 39 only for comparison in the report. The stretches become **spawn zones**: floor blocks 1/4 of the width
  (or height) from the border, away from the exit (spec D3). The text format does not change: digits 1–4 mark the
  zone, wherever it is.
- The three arenas are **180° rotation-symmetric** between stretches 1 and 2 (and between 3 and 4), so the side
  decides nothing; the harness checks this (the mirror must give ~50%, §12).
- The arena is setup data (a `string[]`), not a param: the package is pure and reads no files. The CLI reads
  `params/arenas/` with `fs`; the client imports the text through Vite (`?raw`).

## 5. State

JSON only, arrays ordered by id, ids from `nextId` (spec S-3).

```ts
type Dir = "up" | "down" | "left" | "right";
type Controller = "gambits" | "human";

type Participant = {
  id: number; side: number; name: string; dna: Dna;
  cell: number;               // index in the arena
  facing: Dir;
  hp: number;                 // current; the max comes from the params
  carry: { materia: number; cristal: number };
  controller: Controller;
  gambits: Gambit[];          // replaced whole, never mutated (like the sim's rules)
  intent: { move: Dir | null; attack: boolean; attackLatch: boolean; drop: boolean; pickup: boolean };
  movePoints: number;
  cooldownTicks: number;
  exitTicks: number;          // consecutive ticks on the ring without being hit
  ai: { nextDecisionTick: number; target: number | null };
  status: "fighting";         // whoever leaves goes to `departed`
};

type Projectile = { id: number; owner: number; side: number; cell: number; dir: Dir;
                    points: number; cellsLeft: number; damage: number };
type Pile = { id: number; cell: number; materia: number; cristal: number };

type BattleState = {
  battleVersion: number; params: BattleParams; arena: Arena; rng: RngState;
  tick: number; nextId: number;
  participants: Participant[]; projectiles: Projectile[]; piles: Pile[];
  departed: Departure[];      // died or fled: outcome, final HP, load, damage dealt and taken, tick
  totals: { id: number; dealt: number; taken: number }[];  // per participant, ordered by id
  idleTicks: number;          // the battle's (F6, C5): fight ticks since the last hit that took HP
  ended: { tick: number; winnerSide: number | null } | null;
};
```

The exact types come out of F1; the shape above is the contract F2 and F3 assume. (F7 added the held `bag` to the
intent, C15.)

## 6. Commands

A single vocabulary for the human and the AI (ADR-0008, rule 6), validated by `validateCommand`:

| Command | Who | Effect |
|---|---|---|
| `intent { id, move, attack }` | human | **persistent intent:** moves in the direction while `move` ≠ `null`; attacks whenever the cooldown allows while `attack` |
| `attackOnce { id }` | human | arms the latch: the next possible attack goes out, even if the key was already released |
| `face { id, dir }` | human, AI | turns without moving (aiming) |
| `drop { id }`, `pickup { id }` | human, AI | drop the purse and pick up (spec D8), on the next tick |
| `control { id, controller }` | lab | changes who commands (spec D12); `human` on one participant releases the previous one |
| `setGambits { id, gambits }` | lab | replaces the whole list (L-7), copied field by field like the `sim`'s `rules.ts` |
| `join { side, participant }` | lab | joining mid-fight (spec D11, E-1) |

- **Intent, not step** (P4): with latency, the human sends one message on pressing and another on releasing, not one
  per cell. The effect of latency on "release" (the creep walks one cell too many) is exactly what the lab measures.
- **Commands apply on the tick after they reach the worker** (P5). The log keeps `{ tick, commands }` in arrival
  order; the replay applies them on the same tick.
- A command for a participant that no longer exists, or of a type its controller cannot emit (the AI does not send
  `control`), is refused with no effect and no event.

## 7. Tick pipeline

`stepBattle(state, commands): BattleEvent[]` (like the `sim`'s `step` in slice A):

1. **Commands** from the human and the lab, validated and applied (intent, latch, `control`, `setGambits`, `join`).
2. **AI:** for each participant with `controller = "gambits"` whose `nextDecisionTick` has come, evaluate the gambits
   over the `BattleView` at the start of the tick and replace its intent (P12). Between two decisions, it follows the
   previous intent.
3. **Turn and attack** (P3): whoever intends to attack (or has the latch) with the cooldown at zero attacks in the
   facing direction. Melee resolves at once; the projectile is born on the cell in front (if it is rock, it vanishes,
   with the `missed` event).
4. **Movement:** points, load slowdown (standing, up to `CELL_COST`); whoever reaches `CELL_COST` tries to enter the
   neighboring cell. Rock or an occupied cell at the start of the stage: only turns. Two entries into the same cell:
   the `rng` chooses, in the candidates' id order, one call per contest (M-3).
5. **Projectiles**, in id order: each checks the cell it is on and each cell it enters this tick, **after movement**;
   it hits the first enemy it finds, vanishes in a rock or at the end of its range (the `missed` event, since F6).
   Checking the starting cell catches the creep that walked into the shot.
6. **Damage and death:** a hit that takes HP resets the battle's `idleTicks` (spec A-4, D9; until F5, those of the
   hitter and the hit) and the `exitTicks` of whoever is hit (F-1). HP 0: moves to `departed`, and the load becomes a
   pile on the cell (A-5).
7. **Drop and pick up** (C-1, C-2).
8. **Exit and inactivity:** on the ring, `exitTicks` + 1; on reaching `dwellMs`, flees by the border (F-1). Off the
   ring, `exitTicks` = 0. Then the battle's `idleTicks` + 1; on reaching `timeoutMs`, everyone left in the arena flees
   by inactivity, in id order, and the battle ends with no winner (F-2). Whoever completed the border in the same tick
   leaves by the border.
9. **End:** if at most one side has participants left, `ended` (F-3).

**Attack before moving** (P3): in the same tick, the hit goes out before the step. Whoever stands next to the square
and runs takes that tick's hit; the projectile, in turn, only moves after the creeps, so one can leave its line.

## 8. The rules, in detail

- **Clear line** (`arena.ts`): from the cell in front up to the range, in the direction, with no rock in the way.
  Used for the "enemy aligned within range" condition and for the melee attack (range 1).
- **Cell contest:** only among those who reached their points in the same tick. The loser keeps the points and tries
  again on the next tick, if the cell is still free.
- **Piles:** one per cell, summed. A pile does not occupy the cell (one can step on it and pick up).
- **Joining** (E-1): the free cell of the side's stretch is chosen by the `rng`; a new side gets the first stretch
  with no live participants. Whoever joins does not reset the battle's `idleTicks` (F6); it starts with its step
  ready.
- **Birth** (S-1): the same choice by the `rng`, facing away from the stretch's side.
- **Name:** comes from the setup (the lab uses a short list of its own names; world names arrive with the junction).

## 9. Gambits AI

```ts
type Target = { by: "nearest" } | { by: "weakest" } | { by: "dna"; dna: Dna };
type Condition =
  | { type: "always" }
  | { type: "hpBelow"; permille: number }
  | { type: "enemyWithin"; cells: number; dna?: Dna }  // the DNA filter since F7 (C12)
  | { type: "enemyAligned" }                       // within range, with a clear line
  | { type: "projectileIncoming" }                 // an enemy projectile whose line goes through me
  | { type: "carryAbove"; permille: number }
  | { type: "allyHpBelow"; permille: number; cells: number };
type Action =
  | { type: "attack"; target: Target } | { type: "approach"; target: Target }
  | { type: "keepDistance"; target: Target } | { type: "dodge" } | { type: "protect" }
  | { type: "flee" } | { type: "drop" } | { type: "pickup" };
type Gambit = { when: Condition; then: Action };
```

- **Evaluation** (spec G-1): the first rule with a true condition and a possible action gives the intent. An
  impossible action (e.g. pick up with no pile in sight, dodge with no free cell) passes to the next rule.
- **Reaction time** (P12): each AI participant decides every `decisionMs` ± `decisionJitterMs` (drawn by the `rng` at
  each decision). Without it, the AI would see each projectile on the tick it is born and dodge all of them: the
  circle would never hit the AI, and fights would end by inactivity. At 250 ms, from afar it usually dodges and up
  close it does not, which gives distance its value. The drawn reaction also gives variety to the `geo battle` seeds
  (§12). Since F4, the reaction is per participant in the setup (spec D20).
- **Targets:** "nearest" in steps (BFS); "most wounded" by relative HP (‰); ties: keep the previous target, then the
  `rng`. Never the id.
- **Move until aligned** (`attack`, `approach`): BFS on the arena to the nearest cell from which the target is
  aligned within range with a clear line; melee, to the neighboring one. The BFS runs only on decisions (every
  ~250 ms), not every tick: a 120 s 3 × 3 does ~3,000 BFS of ~300 cells, within the 50 ms budget. **Since F7** (C12):
  for shooters, the alignment path avoids cells within `gambits.meleeBerthSteps` steps (3, provisional; 0 turns it
  off) of an enemy melee creep, unless there is no other path.
- **Keep distance:** stays at a distance between its own range − 1 and its own range; backs off if the target comes
  closer; shoots when aligned.
- **Dodge:** steps to a free neighboring cell off the projectile's line (the perpendicular); with none, the action is
  impossible.
- **Protect:** goes to a cell between the most wounded ally in the radius and the enemy nearest to it.
- **Flee:** BFS to the nearest ring cell and stays on it.
- **Presets** (spec D15), with the low-HP threshold at 250‰ and the carrier's "enemy near" at 4 cells:

| Preset | Rules, in order |
|---|---|
| Frontline (square) | `allyHpBelow 500‰ within 4` → `protect`; `always` → `attack nearest` |
| Marksman (circle) | `hpBelow 250‰` → `flee`; `projectileIncoming` → `dodge`; `enemyWithin 3` → `keepDistance nearest`; `always` → `attack weakest` |
| Skirmisher (triangle) | `hpBelow 250‰` → `flee`; `projectileIncoming` → `dodge`; `enemyWithin 3 square` → `keepDistance square` (F7, C12); `always` → `attack nearest` |
| Carrier (any) | `enemyWithin 4` → `drop` (impossible without load: passes on); `always` → `flee` |

## 10. Events and result

`BattleEvent = { tick, index, type, ... }`, outside the state (ADR-0007): `attacked` (who, direction), `hit` (who,
whom, damage, remaining HP and, since F6, the cell of whoever was hit), `missed` (F6: the shooter, the last cell of the
projectile that vanished without hitting and the direction; the shooter's, when the front was already rock), `died`,
`dropped`, `picked`, `joined`, `escaped` (`reason: "edge" | "idle"`), `controlChanged`, `ended` (the winning side or
`null`, and each participant's outcome: `won`, `died`, `escapedEdge`, `escapedIdle`, with final HP, load, damage dealt
and taken; and the piles left). The events are ADR-0008's internal contract v0, versioned by `BATTLE_VERSION`.

## 11. Determinism

- **RNG and canonical JSON copied from the `sim`** (P1): two small files, with a battle package test that compares the
  RNG sequence and the `canonicalJson` output with the `sim`'s (a test-only devDependency: the runtime does not import
  the `sim`). Extracting a common package is left for the junction, when the world calls the battle.
- **Hash:** sha256 of `serializeBattle`, outside the package (`node:crypto` in the CLI, Web Crypto in the worker).
- **`BATTLE_VERSION`** = 1; bumped when the same log starts giving another result (2 in F5, with the countdown; 3 in
  F6, with the immediate first step and the battle's inactivity; 4 in F7, with the countdown honoring what is held).
- **The log** (`BattleLog`): `{ battleVersion, setup, params, commands: { tick, commands }[], finalHash }`.
  `replayLog` recreates the battle and applies the commands; `geo battle verify --log` compares with `finalHash`.
- **Lint and tsconfig:** the `eslint.config.js` block covers `packages/battle/src/**/*.ts`; the package's tsconfig is
  the `sim`'s (`lib` ES2023, empty `types`).

## 12. `geo battle` and CI

- **`geo battle sweep`** (spec R-1): the spec §7 and §8 matrix (1 × 1 of each pair and mirrors, 2 × 2, 3 × 3,
  1 × 1 × 1; full HP and at 500‰; with and without load; three arenas; `--seeds 1-100`), presets only. Writes
  `runs/<id>/battle.md` and `battle.csv`: wins per fight and arena, side 1's rate in the mirrors (the symmetry test,
  ~50%), the duration distribution, the fraction of inactivity and border escapes, the loaded escape with and without
  dropping the purse, and the cost per battle (median and p95 ms per 3 × 3).
- **`geo battle verify`**: without `--log`, runs a sample of the matrix twice and with a snapshot → restore in the
  middle and compares the hashes (R-2); with `--log <file>`, replays the lab's log (R-3).
- **CI:** `geo battle verify --seeds 1,42,649` and the `geo battle sweep --quick --max-seconds 60` budget (a fraction
  of the matrix), like the `geo sim` budget. A log exported from the lab is a CLI test fixture.

## 13. The lab

- **The page** (P11): `apps/client/lab.html`, the Vite build's second entry (`build.rollupOptions.input`). `npm run
  lab` opens Vite at `/lab.html`; `npm run server` also serves it, from `dist`. It opens no WebSocket and does not
  talk to the game server.
- **The worker** is the local server: receives the setup, creates the battle, runs the 20 ticks per second clock
  (accumulating real time, with no drift), applies the commands that arrived on the next tick, sends the `BattleView`
  and the events of each tick, keeps the log and computes the hash at the end. Speeds: ×1, ×4 and instant (all ticks
  at once, AI only); pause and restart.
- **The channel** (P7): messages in both directions go through a queue with a delay of `RTT ÷ 2 ± jitter` per leg,
  and **order is preserved** (as on a WebSocket over TCP: a message never overtakes the previous one). What goes over
  the channel is the **whole view of each tick** (P6); the page shows its average size, as data for the deploy.
- **The render** (P8, P9): SVG in Preact, like the world map, with the shapes from `map/creep-shape.tsx`. The creep's
  position is **interpolated over one tick** between the last two views; since F7, a **Movement** selector compares
  four drawings (no interpolation, interpolate 1 tick, slide the whole step, predict my creep; C11, ADR-0009). The
  drawing enters the measured delay.
- **The measured delay** (L-4): the page stamps the key with the local clock and measures until the first view that
  shows the effect (the intent applied); shows the battle's median and p95.
- **Controls** (spec D13): arrows or WASD give the move intent (and turn); Shift + arrow only turns; holding space
  attacks (and a tap arms the latch); `Q` drops the purse; `E` picks up; `Tab` switches the dominated creep; `0`
  releases domination.
- **Setup:** arena, sides, participants (DNA, starting HP in ‰, load, preset, reaction), seed; a "random seed" button.
- **Gambits editor** (L-7): the selected participant's list, with the preset, add, remove and reorder, capped at
  `maxRules`; sends `setGambits`.
- **Reinforcement** (L-6): pick the side (an existing one or a new one, up to 4) and the participant, and send `join`.
- **Session and blind mode** (P14, L-5): each finished battle enters the record (setup, who was dominated, outcome,
  RTT, score). In blind mode, the RTT is drawn among the selector's **by the page, with `Math.random`** (outside the
  simulation, not in the log), the selector disappears, and the 1-to-5 score is asked for at the end before revealing
  the RTT. The record lives in `localStorage` (with `try/catch`) and leaves as an exportable JSON, with the score × RTT
  summary and wins dominating × AI.
- **Log export:** a button downloads the last battle's `BattleLog`.

## 14. Tests

- **`battle`**, on text arenas: S-1..S-4 (including invalid setups), M-1..M-3 (slowdown, blocking body, contest by
  `rng`), A-1..A-5 (cooldown, melee, a projectile that hits, that misses whoever left the line, that catches whoever
  entered the line, that stops at a rock, that passes through an ally), C-1, C-2, F-1..F-4 (escape interrupted by a
  hit, inactivity, end with three sides, empty arena), E-1, G-1..G-3 (each condition and action, presets, reaction
  time), serialize → restore, equality with the `sim`'s RNG and canonical JSON, `replayLog`.
- **`cli`:** `verify` with and without a log (with the lab fixture); the report's shape.
- **`client`:** the channel (delay, jitter, preserved order, with a fake clock), keyboard input → intent, the
  movement drawings, the session record and the score × RTT summary.

## 15. Approved decisions (owner, 2026-11-15)

| # | Decision | Approved (the proposal) | Discarded alternative |
|---|---|---|---|
| P1 | RNG and canonical JSON | Copy both files from the `sim` into the battle package, with an equality test; extract a common package at the junction | Extract a `@geometrix/core` with both now: touches the `sim` while slice A is in it |
| P2 | Units | 20 ticks per second; durations in ms, multiples of 50; movement in points (`CELL_COST` 6 000); integer HP | Durations in ticks in the params (less readable; changing the tick changes every number) |
| P3 | Tick order | Attack before moving; projectiles move after the creeps and check the starting cell | Move before attacking: melee misses whoever leaves in the same tick, and dodging gets easier |
| P4 | Human input | Persistent intent (press and release) plus a latch for the attack tap | One command per step (one message per cell; latency weighs twice) |
| P5 | When a command applies | On the tick after it reaches the worker, in arrival order | On the tick it arrives (the tick may already have run: non-deterministic on replay) |
| P6 | What goes over the channel | The whole view of each tick (few creeps; ~2–4 KB) | Deltas, as in ADR-0006: the battle network format is left to the junction and the deploy |
| P7 | The channel | Per-leg delay of RTT ÷ 2 ± jitter, with order preserved (TCP) | Independent messages (may arrive out of order, like UDP): not what the deploy's WebSocket does |
| P8 | Render | One-tick interpolation, with a button to turn it off | No interpolation (jumps from cell to cell) |
| P9 | Render technology | SVG in Preact, with the world map's shapes | Canvas (only if SVG cannot cope; a dozen creeps does not need it) |
| P10 | Worker clock | Accumulates real time and runs the due ticks, with no drift; ×1, ×4, instant | Plain `setInterval` (drifts under load) |
| P11 | Where the page lives | `apps/client/lab.html`, the second Vite entry, with `npm run lab` | A new app, `apps/lab` (duplicates Vite, styles and shapes) |
| P12 | **AI reaction time (gameplay)** | The AI decides every 250 ms ± 100 ms (params, drawn by the battle `rng`); between decisions, it follows the previous intent | Deciding every tick: the AI would dodge every projectile, and the circle would never hit anyone |
| P13 | Gambits in the simulation | Inside `stepBattle`, like the world autopilot: the list is in the state and the log only has the human's and the lab's commands | Outside, like the bot strategist, with the AI's commands in the log (the log grows 20× and auto-resolve depends on who runs the AI) |
| P14 | Session record | `localStorage` with `try/catch`, plus the JSON export | Memory only, with the export (gone on page reload) |

### F3 checkpoint decisions (owner, 2026-11-17)

| # | Decision |
|---|---|
| C1 | Raw combat is not balanced now: square × triangle at 100% is fair (melee that is not kited wins), and ~14 s fights in the 1 × 1 are fine without variety of mechanics. In the report, wins and duration become **informational**; only the cost can fail |
| C2 | Arenas 2× larger, with spawn zones 1/4 of the width in (spec D3, §6); an open 3× one for comparison. First F4 task, with the `sweep` and the replays again before the page |
| C3 | The border escape does not change (a hit resets the count). The AI's difficulty becomes configurable: reaction per participant in the setup (spec D20); a learning AI is a proposal with no milestone in GDD 06 |

### F5 checkpoint decisions (owner, 2026-11-18, in the free session)

| # | Decision |
|---|---|
| C4 | **Immediate first step** (spec D22, M-1): standing still, the creep moves on the tick after the command; each tap moves one cell, never faster than the DNA's speed |
| C5 | **The battle's inactivity** (spec D9, A-4, F-2): a single clock; 15 s with no damage to anyone, everyone flees at once, with no winner |
| C6 | **The lab screen readable on a laptop** (spec L-8): the arena at the available width, bigger shapes, bars and strokes; a sign for who attacks, for the hit (with the damage) and for the projectile that vanishes without hitting. No sound (proposal with no milestone in GDD 06) |
| C7 | **Domination ends with the battle** in the lab: "instant" does not stay locked after the end, and dominating one's own creep does not mark the battle as "switched domination" |
| C8 | **Critical hits** stay an open question in GDD 06, for when stats and skills arrive; not in M2 |

### F5 checkpoint decisions, part 2 (owner, 2026-11-19 and 20, on resuming)

F7 implements these decisions ([tasks.md](tasks.md)).

| # | Decision |
|---|---|
| C9 | **No new combat rule before the junction** (neither the free one nor the forge): the grid is fun and good enough to see combat in a match. Slice B closes after F7; the next front is the junction (D) |
| C10 | **Deploy and prediction wait for the junction:** the grid held up to 100 ms blind (median score 4 or more; below 3 from 200 ms), but the deploy, even a test one, only after the cycle is joined; client prediction may come in |
| C11 | **Movement is experimented with before becoming a rule:** the "pause" between cells (the one-tick interpolation, P8) feels stiff. F7 adds two drawing options to compare (slide the whole step; predict one's own creep); the owner chooses after playing |
| C12 | **The AI:** the ▲ kites the melee, like the ●; the ● stops always falling for the same bait at the rock corners (a gambits tweak; a learning AI stays a proposal) |
| C13 | **The screen:** a sign for death and escape; the inactivity meter visible over the arena (the warning stays); Start scrolls the page to the arena |
| C14 | **Proposals in GDD 06:** a commander (the team's tactics in group battles) and kill announcements (no priority, with sound) |
| C15 | **The countdown honors what is held at the end** (spec D21, S-4): direction, space, Q and E held at the end of the countdown act on the first fight tick; what was pressed and released during it is discarded (an accidental Q does not drop the purse). Applies to the AI and to whoever joins during the countdown. `BATTLE_VERSION` 4 |

## 16. Contact points with slice A

Slice B moved in parallel and lives in a new package. The files both touched, which needed attention on merge:
`eslint.config.js` (the guards' glob includes `packages/battle`), `package-lock.json` (the new workspace),
`.github/workflows/ci.yml` (the `geo battle` steps), `apps/cli/src/main.ts` (the `battle` subcommand),
`apps/client/vite.config.ts` and `package.json` (the second entry, `npm run lab`), `apps/client/src/map/creep-shape.tsx`
(read only) and `docs/PLAYTEST.md` (separate sections). Nothing in B touches `packages/sim/src`,
`params/default.json`, `SIM_VERSION` or the world hashes.

## 17. Implementation order

Each phase on its branch `m2/laboratorio-f<n>-<slug>`, merged `--no-ff` into `main`.

| Phase | Delivery | Checkpoint |
|---|---|---|
| F0 | Spec, ADR-0008 and plan | Plan approved |
| F1 | **The package and movement:** `packages/battle` (package, tsconfig, lint, Vitest project), RNG and canonical JSON with the equality test, params and `params/battle.json`, the arena and the three arenas, setup and `createBattle`, state, `serialize`/`restore`, the intent and turn commands, movement with the slowdown and the contest, the `stepBattle` skeleton with events, `BATTLE_VERSION` | — |
| F2 | **Combat:** melee and projectiles, damage, death and piles, drop and pick up, the border escape, inactivity, the end, joining, `control` and `setGambits`, events and result, the log and `replayLog` | — |
| F3 | **AI and auto-resolve:** the gambits vocabulary, BFS, dodging, reaction time, presets; `geo battle sweep` and `verify`; the CI steps | **Owner:** the fight matrix, duration, inactivity and loaded escape, in numbers, before the page |
| F4 | **The lab:** the 2× arenas and spawn zones (C2), per-participant reaction (C3), `lab.html`, the worker, the latency channel, the render, the keyboard, setup, switching domination, reinforcements, the gambits editor, events and result, the measured delay, the log export (and the CLI fixture) | — |
| F5 | **Blind mode and the playtest:** blind mode, the session record and export, the PLAYTEST questions | **Owner:** free session and blind session; answers hypothesis questions 1 to 4 and decides the next rule |
| F6 | **The F5 checkpoint adjustments** (C4–C7): immediate first step, the battle's inactivity, `BATTLE_VERSION` 3 with the `sweep` and the fixture redone, domination ending with the battle, the readable screen with the attack, hit and miss signs | — (the F5 checkpoint resumes) |
| F7 | **The F5 checkpoint adjustments, part 2** (C9–C15): the countdown honors what is held (`BATTLE_VERSION` 4), the four movement drawings and ADR-0009, the ▲ kiting the ■ and the ● avoiding melee corners, death and escape signs, the inactivity meter over the arena, Start scrolling to the arena | **Closes slice B** (2026-11-20) |
