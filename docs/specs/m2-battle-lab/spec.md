# M2 spec — The battle lab

**Status:** Done (2026-11-20); revised at the F3 checkpoint (2026-11-17: D3, D11, D20, §6, §7) and the F5 checkpoint
(2026-11-18/20: D9, D21, D22, L-3, L-8) · **Date:** 2026-11-15 · **Milestone:** M2 — The ambush ([ROADMAP](../../ROADMAP.md)), slice B
**Related GDD:** [02](../../gdd/02-creeps-and-domination.md) (base stats per DNA, domination),
[06](../../gdd/06-battles.md) (experimental, configurable combat, sides, escape, battle end),
[07](../../gdd/07-autopilot.md) (gambits) · **ADR:** [0008](../../adr/0008-battle-package.md) (battle package,
`Accepted`)

## 1. Hypothesis

> Does the battle change the course of the world without dominating the game? (ROADMAP, M2)

This slice answers the battle's part, **before joining it with the world**: a local lab, with no world, with
hand-built participants. It asks:

1. **Is the grid rule fun?** With only the basic attack and the base stats per DNA, from 1 × 1 to 3 × 3 and with
   three sides, playing and watching holds the owner's attention.
2. **Micro matters and DNA does not decide alone** (GDD 06): dominating a creep, the owner wins fights the AI loses
   in the same setup; and no full-HP 1 × 1 between DNAs is decided in advance.
3. **How much latency does the grid rule take without prediction?** The question that holds the deploy: the lab
   answers it locally, blind. **F5 checkpoint (owner, 2026-11-20):** up to 100 ms the score stays at 4 or more, and
   below 3 from 200 ms on; the deploy and client prediction wait for the junction (plan §15, C10).
4. **The gambits AI serves as opponent and as auto-resolve:** it plays credibly, is fast and is deterministic.

After this slice, the junction (D) connects the world's encounter (A) to the battle instance, in place of the
throwaway roll.

## 2. What the owner already decided (GDD, 2026-11-15)

A summary; the source is the GDD and this spec's interactive round (§3).

| Topic | Decision |
|---|---|
| Separation | World and battle are separate simulations; the battle receives the participants and returns events (ADR-0001) |
| Combat | Experimental and configurable: different rules behind the same contract. **The first is the grid** (BYOND action games). The lab moves in parallel with the encounter, and the two join later |
| Stats | **In M2, only base stats per DNA** (life, damage, range, battle speed), in the params. Level, XP, evolution and skills later |
| Who wins | Level, stats, skills and the micro of whoever plays, human or bot; not DNA or load alone |
| Sides | Minimum 1 × 1, with two or more sides, and joining a battle already under way |
| Domination | Each human controls only the creep they dominate (1 domination per player); the rest go by the AI |
| Escape | Each combat rule has its own escape mechanic |
| Losses | Death is permanent and HP persists after the battle (in the world, at the junction) |

## 3. Scope decisions this spec assumes

**Accepted by the owner in the interactive round of 2026-11-15**, with the spec: D4, D7, D9 and D11 were chosen by
the owner among alternatives (D9 with the end by inactivity, the owner's own idea, and "active" as dealing or taking damage); D14 and
D15 with the editor in the lab. Those marked **(gameplay)** complete the GDD and are in it. The numbers are in §6 and
are guesses.

| # | Decision | Default | Why |
|---|---|---|---|
| D1 | The package | The battle lives in its own package, `@geometrix/battle`, pure, deterministic and integer, with its own params, version and hash. It does not import the `sim` (ADR-0008) | Moves in parallel with slice A without touching its files; at the junction, the world calls the battle |
| D2 | The lab | A local client page, **with no world and no game server**: build a battle, play, watch, measure. The battle runs in a worker playing the authoritative server (ADR-0008, rule 9) | Iterates the fun in minutes, without waiting for the world, and measures latency without paying for a server |
| D3 | The arena **(gameplay)** | A grid drawn in text, with **floor** and **rock** (blocks movement and projectiles). The ring of floor cells on the border is the **exit** (D9). Three fixed arenas in the slice: open field, field with rocks and a corridor (the bottleneck of a ford). Everyone sees the whole arena: **no fog in battle**. **F3 checkpoint (owner, 2026-11-17):** the arena doubles in size, and each side is born in a **spawn zone**, a floor block halfway between the border and the center, away from the exit | The minimum for position to matter (cover, bottleneck). Terrain from the surroundings (river, trees, structures) is an owner idea with no milestone (GDD 06). Being born next to the exit let anyone flee in 2.6 s, before the enemy arrived |
| D4 | Directional attack **(gameplay; owner)** | The creep faces one of 4 directions. The **square** hits the cell in front. The **circle** and the **triangle** fire a **projectile** that travels cell by cell up to its range and hits the **first enemy** in its way, or stops at a rock. Allies neither block nor take the shot (no friendly fire). Each DNA has its own damage, range and cooldown. **The projectile can be dodged** by leaving its line | Owner, 2026-11-15: BYOND style. The micro is aiming and dodging, and it is the one that feels latency most, which the lab wants to measure |
| D5 | Movement and bodies **(gameplay)** | Cell by cell, in 4 directions, at the DNA's battle speed. **One cell, one creep:** nobody walks through anybody, and the square blocks the way (the tank holds the line). When two want the same cell in the same tick, the battle `rng` decides, never the id. Turning without moving is possible (to aim) | A grid with bodies gives the tank's role with no skill. The id breaks the mirror between sides (fog F6) |
| D6 | Base stats per DNA **(gameplay)** | In the battle params: **max HP, damage, range, attack cooldown, battle speed, projectile speed and carrying capacity**. A participant enters with the **current HP** the setup gives (the wounded fight wounded) | GDD 02. Max HP and capacity repeat the `sim`'s numbers until the junction, which picks a single source (ADR-0008) |
| D7 | Escape by the border **(gameplay; owner)** | Whoever stays on an exit cell for a moment, without being hit, **leaves the battle** with what it carries; a hit resets the count | Owner, 2026-11-15. The arena is the bubble |
| D8 | Load, dropping and picking up **(gameplay)** | The load **slows** the creep in battle, in proportion to the occupied fraction of capacity (full, half speed). The **drop the purse** command leaves the whole load in a **pile** on the cell and removes the slowdown. Whoever dies leaves its load in a pile on its own cell. The **pick up** command takes from the cell's pile up to free capacity, cristal first | Owner, 2026-11-15 (escape): the aggressor chooses between picking up and chasing, as in the world. The proportional slowdown makes the fully loaded square the one who almost never escapes (GDD 06). What is left in the arena returns to the world at the junction (D) |
| D9 | Battle end and inactivity **(gameplay; owner)** | **There is no battle clock.** Each participant has an **inactivity clock**, running from the start or from its entry and reset when it **deals or takes damage**. When it runs out, the creep **flees by itself** (leaves as in D7, with what it carries). The battle ends when **at most one side** is left in the arena (the others died or fled): that side wins; if nobody is left, there is no winner. **F5 checkpoint (owner, 2026-11-18):** the inactivity clock becomes **a single one, for the battle**: reset when anyone deals or takes damage, and when it runs out **everyone flees at once**, with no winner | Owner, 2026-11-15: annihilation or escape, with time counting only inactivity. Solves the stalemate between two kiters and the absent human, without cutting a fight that is happening. Owner, 2026-11-18: with one clock per creep, whoever neither hit nor was hit fled in the middle of the others' fight (in 3 × 3 and 1 × 1 × 1); the battle clock solves the same stalemate without that |
| D10 | Sides **(gameplay)** | From 2 to 4 sides, **all hostile to each other** in this slice. Each side has a stretch of entry border | GDD 06 (sides, not groups). Alliances between sides are left for when there is someone to ally with |
| D11 | Joining mid-fight **(gameplay; owner)** | The **join** command puts a new participant on a side (existing or new) on a free cell of that side's entry stretch. Whoever joins skips the dialogue. The lab has a button for it. With the spawn zones (D3), whoever joins is born in its side's zone | Owner, 2026-11-15: the engine and the lab are born with it; the world side (who may join, the bubble) belongs to the junction |
| D12 | Domination in the lab **(gameplay)** | The human dominates **one** participant at a time, or none (just watches). In the lab, they switch participants at any time, at no cost. The dominated one does not use its gambits; once released, it goes back to them | GDD 02. Free switching is the lab's: in the world, domination comes from slice A |
| D13 | Human controls | Keyboard: arrows or WASD move (against a rock or a creep, they only turn); space attacks in the facing direction; one key drops the purse and another picks up. The details (mouse aim, hold to repeat) are left to the `plan.md` and the checkpoint | The BYOND minimum. The owner judges the "feel" at the checkpoint |
| D14 | Gambits AI **(gameplay)** | An ordered **condition → action** list per participant; the first rule with a true condition and a possible action becomes the tick's commands, like the world autopilot (GDD 07). **Conditions:** always; HP below X‰; enemy within N cells; enemy aligned within range (clear line); enemy projectile coming my way; load above X‰ of capacity; ally with HP below X‰ within N cells. **Actions:** attack a target (the nearest, the most wounded, or of a DNA), moving until aligned and shooting; approach; keep distance (stay at the target's max range); dodge (leave the projectile's line); protect an ally (stand between it and the nearest enemy); flee (to the nearest exit); drop the purse; pick up the nearest pile | The gambits AI from day one, because it is the lab's opponent and the world's auto-resolve. Without dodging, no AI would stand up to a human in the directional rule |
| D15 | Presets per DNA **(gameplay)** | **Frontline** (square): protect the wounded ally → attack the nearest. **Marksman** (circle): flee with low HP → dodge → keep distance → attack the most wounded. **Skirmisher** (triangle): flee with low HP → dodge → attack the nearest. **Carrier** (any DNA): drop the purse with an enemy near → flee. The lab lets the user pick each participant's preset and **edit the list** (add, remove, reorder rules) | The shape tells the role (pillar 6). Editing the list lets the owner tune the AI with no code; the same idea as the world's rules editor |
| D16 | Auto-resolve | The same simulation, with no page and no channel, with every participant on the AI, as fast as the machine goes. The CLI gains `geo battle`: fights in series (each DNA pair, each arena, several seeds), the §7 report and the `verify` of a log | ADR-0001: the battle runs with or without a client, accelerated. The report is the lab's balancing |
| D17 | Simulated latency | The page and the worker talk through a channel with **up and down delay** (half the chosen RTT each) and **jitter**. RTT selector: 0, 50, 100, 150, 200 and 300 ms. The page shows the measured delay between key and on-screen effect. **Blind mode:** the lab draws the RTT for each battle without showing it, the owner gives a score from 1 to 5 at the end ("is it playable?"), and the report crosses score × RTT, exportable | Hypothesis question 3. Blind, the owner does not judge the number but the game |
| D18 | Determinism | Same setup + same commands ⇒ same hash, on any run and engine. The lab **exports the log** of a battle (setup + commands per tick), and `geo battle verify` reproduces the hash the worker computed | ADR-0003 and ADR-0008. It is what guarantees the junction's auto-resolve gives the same result on the server and in the replay |
| D19 | Events | The battle step returns structured events outside the state (ADR-0007): attack, hit, damage, death, dropped, picked up, joined, fled (by the border or by inactivity), end. The lab shows a simple list, **without the narrated chronicle**, and the result table at the end | The chronicle is slice A's; translating to world events is D's |
| D20 | AI difficulty **(gameplay; owner)** | Each AI participant has a **reaction** in the setup: easy (600 ms), normal (250 ms) or hard (100 ms), plus the gambits list, which the lab already lets the user edit. Provisional numbers in `params/battle.json` | Owner, 2026-11-17, at the F3 checkpoint: getting stuck at the border under fire is acceptable if the bot's difficulty is configurable. A learning AI stays a proposal with no milestone (GDD 06) |
| D21 | Countdown at the start **(gameplay; owner)** | The battle starts with a **3 s countdown**: everyone stands still, may **turn**, but not move or attack; the AI too. A battle rule: it applies in the lab, in the world and in auto-resolve. Provisional number in `params/battle.json` | Owner, 2026-11-17, playing the lab: without it, whoever dominates reaches the fight with the ally already dying, and the blind score would measure the rush, not the latency. **F5 checkpoint (owner, 2026-11-20):** at the end of the countdown only what is held at that instant counts (move, attack, drop, pick up); what was pressed and released during it is discarded, so an accidental tap does not drop the purse (plan §15, C15) |
| D22 | Immediate first step **(gameplay; owner)** | Standing still, the creep takes its **first step on the tick after** the move command, and then keeps the DNA's rhythm. Each key tap moves one cell; the average speed does not change (tapping is not faster than holding) | Owner, 2026-11-18, at the F5 checkpoint: a standing creep waited a whole cell's time (200 to 333 ms) before moving, and a shorter tap was lost; tapping the key repeatedly did not move the creep, and stopping and moving again felt slow |

## 4. Scope

### In
- **`@geometrix/battle`:** state, params (the D6 stats and the D7–D9 numbers), setup, the text arena (D3), the step
  with the grid rule (D4, D5, D7–D11), the commands (move, turn, attack, drop, pick up, join), validation, events
  (D19), a view for whoever renders, `serialize` and hash, the gambits AI with the vocabulary and presets (D14, D15).
- **Toolchain:** the lint and tsconfig determinism guards for the new package; the battle `verify` in CI (D18).
- **CLI:** `geo battle` with the fights in series, the report and the `verify` of a log (D16, D18).
- **Client:** the lab page (D2): build the battle (arena, sides, participants with DNA, starting HP, load and preset;
  seed), play dominating a participant (D12, D13), watch, pause, restart, change speed (×1, ×4, instant), drop in a
  reinforcement (D11), edit the gambits (D15), the latency channel and blind mode (D17), the event list and the
  result (D19), export the log.
- **Visuals:** the creep by its DNA shape, with its facing direction, HP bar and load; the battle's inactivity clock
  near running out; projectiles; rocks, the exit and the entry stretches; piles; the escape countdown at the border.
- **Playtest:** lab questions in [PLAYTEST.md](../../PLAYTEST.md).

### Out
The junction with the world: the encounter opening the battle, the bubble, world time during the fight, participants
coming from the world, translating the events into the `sim` (slice D); the wanderers and the neutral side (D); the
**free** rule (MOBA-lite) and the **forge** layer, which the owner decides at the checkpoint after seeing the grid;
client prediction (back on the table at the junction, owner, 2026-11-20; F7 only experiments with drawing one's own
creep ahead, plan §15, C11); skills, energy, level and XP; fog inside the battle; terrain from the surroundings,
river, ford, trees and structures in the arena; friendly fire; alliances between sides; the real network transport
(WebSocket) and the battle server; the narrated chronicle; battle replay in the page.

## 5. Behavior

Format: *When [trigger], the system shall [response].*

### Setup and state (`battle`)
- **S-1** When a battle is created from a valid setup, each participant shall be born on a free cell of its side's
  entry stretch (the spawn zone, D3), facing into the arena, with the setup's current HP and load.
- **S-2** An invalid setup (fewer than two sides, an arena with no floor, a side with no entry stretch, HP outside
  1..max, load above capacity, more participants than entry cells) shall be refused with the reason, without creating
  the battle.
- **S-3** The state shall be JSON only, with ids from a counter never reused and arrays ordered by id; `serialize`
  shall refuse the rest.
- **S-4** During the starting countdown (D21), everyone shall stand still: turning works, for the human and the AI;
  moving and attacking do not. At its end, only what is held at that instant shall count; what was pressed and
  released during the countdown shall be discarded (F5 checkpoint, C15).

### Movement (`battle`)
- **M-1** Every tick, a creep with a move order shall accumulate points by its DNA's battle speed, slowed by its load
  (D8), and enter the neighboring cell when it completes a cell's cost. A standing creep shall have its next step
  ready as soon as it has stood for a cell's time (D22): the first step comes on the tick after the command, and
  tapping the key is not faster than holding it.
- **M-2** A creep shall not enter a rock cell or an occupied cell; in that case, it only turns.
- **M-3** When two creeps complete a step into the same cell in the same tick, the battle `rng` shall choose who
  enters; the other stays and keeps its points. The order of `rng` calls shall be fixed.

### Attack (`battle`)
- **A-1** An attack shall only go out when the attacker's cooldown has ended; it restarts the cooldown.
- **A-2** The square's attack shall hit the enemy on the cell in front, if any; otherwise it misses.
- **A-3** The circle's and the triangle's attack shall create a projectile on the cell in front, which advances at
  the projectile speed, in the firing direction, until it hits the first enemy, enters a rock or travels its range.
  The shooter's allies do not block it.
- **A-4** A hit shall take the attacker's damage from the HP of whoever is hit and reset the battle's inactivity
  clock (D9).
- **A-5** When HP reaches 0, the creep shall leave the arena in the same tick, leaving its load in a pile (D8).

### Load and piles (`battle`)
- **C-1** Dropping the purse shall move the creep's whole load to the pile on its cell (adding to what is there).
- **C-2** Picking up shall move from the cell's pile to the creep up to free capacity, cristal first; an empty pile
  leaves the state.

### Escape, inactivity and end (`battle`)
- **F-1** A creep that stays on an exit cell for the exit time, without being hit, shall leave the battle with the HP
  and load it has. A hit shall reset the count.
- **F-2** When the battle's inactivity clock runs out (D9), everyone in the arena shall leave at once, as in F-1, with
  the reason "inactivity" in the event, and the battle ends with no winner.
- **F-3** When at most one side is left in the arena, the battle shall end: that side wins, or nobody, if the arena is
  empty. The end event shall carry each participant's outcome (won, died, fled by the border, fled by inactivity), its
  final HP, damage dealt and taken, and the load it left with; and the piles left in the arena.
- **F-4** A finished battle shall accept no commands and not advance.

### Joining mid-fight (`battle`)
- **E-1** The join command shall put the new participant on a free cell of its side's entry stretch; a new side shall
  get a free entry stretch. Without a free cell, the join shall be refused with the reason.

### Gambits AI (`battle`)
- **G-1** Every tick, for each non-dominated participant, the first rule with a true condition and a possible action
  shall become the tick's commands, chosen only from the battle view. With no valid rule, the creep stands still.
- **G-2** The AI's commands shall go through the same validation as the human's.
- **G-3** The presets (D15) shall exist and be the lab's defaults per DNA.

### Auto-resolve, CLI and determinism
- **R-1** `geo battle` shall run the report's fights (§7) with the AI only and write the report in `runs/<id>/`.
- **R-2** Two runs of the same log and a snapshot → restore in the middle shall give the same final hash.
- **R-3** The log exported by the lab shall give, in `geo battle verify`, the hash the worker computed.

### Lab (client)
- **L-1** The page shall build the battle (D2): arena, 2 to 4 sides, 1 to 5 participants per side, with DNA, starting
  HP, load, preset, reaction (D20) and seed.
- **L-2** The human shall be able to dominate a participant, switch participants or dominate none at any time (D12),
  and play with the keyboard (D13).
- **L-3** Every human input shall cross the simulated channel to the worker, and the page shall render only what
  comes back through the channel, with no prediction (D17). **F5 checkpoint (part 2):** an experiment option may draw
  the dominated creep ahead (C11, ADR-0009); the simulation stays only in the worker.
- **L-4** The RTT selector and the jitter shall take effect at once; the measured delay between key and effect shall
  appear on screen.
- **L-5** In blind mode, each battle's RTT shall be drawn from the selector and stay hidden until the owner gives the
  score. The page shall keep the session record (setup, dominated side, outcome, RTT, score), exportable, with the
  score × RTT summary.
- **L-6** The reinforcement button shall drop a new participant on an existing side or a new side (D11).
- **L-7** The gambits editor shall let the user pick the preset and add, remove and reorder a participant's rules,
  effective from the next tick.
- **L-8** The screen shall make readable who faces where, the projectiles, the HP, the load, the piles, the exit, the
  escape countdown and the inactivity clock near running out; and show the event list and, at the end, the result
  table. **F5 checkpoint:** readable on a laptop screen (the arena takes the available width), with a sign of who
  attacks, who is hit (and how much) and where a projectile disappears without hitting.

## 6. Initial parameters (guesses, made to be broken)

In the battle params (`schema`, `default.json` and fixed test params). Times are in battle seconds (real time; at the
junction, D decides how much world time that is worth).

| Parameter | Square | Triangle | Circle |
|---|---|---|---|
| Max HP | 300 | 200 | 120 |
| Damage | 30 | 20 | 24 |
| Range (cells) | 1 (melee) | 4 | 6 |
| Attack cooldown | 1.0 s | 0.8 s | 0.8 s |
| Battle speed (cells/s) | 3 | 4 | 5 |
| Projectile speed (cells/s) | — | 10 | 12 |
| Carrying capacity | 30 | 20 | 10 |

Max HP and capacity are the `sim`'s (slice A spec; GDD 02). Damage per second: 30, 25 and 30; from full HP, the
circle kills the square in 13 hits and the square kills the circle in 4.

| Parameter | Guess |
|---|---|
| Ticks per second | 20 (ADR-0001: 20–30) |
| Load slowdown | linear, down to 500‰ of speed with a full purse |
| Time on the exit to flee (D7) | 2 s |
| Inactivity clock (D9) | 15 s |
| Arena | 43 × 27 cells, plus the exit ring (2× the 21 × 13 one, owner, 2026-11-17); an open 63 × 39 (3×) only for comparison in the report |
| Spawn zones | one per side, 1/4 of the width (or height) from the border: opposite for 2 sides and spread for 3 or 4 |
| AI reaction (D20) | easy 600 ms, normal 250 ms, hard 100 ms |
| Starting countdown (D21) | 3 s |
| Low HP in the presets (flee) | 250‰ (rule data, not a param) |
| Enemy near, in the carrier preset | 4 cells (rule data) |
| Channel RTT | 0, 50, 100, 150, 200, 300 ms; jitter of ±20% of each leg's delay (lab constants) |

## 7. Harness and acceptance criteria

The targets are guesses. When one fails, the owner decides at the checkpoint. **Since the F3 checkpoint (owner,
2026-11-17), "DNA does not decide alone" and "duration" are informational only:** raw combat (basic attack only, no
skills, levels or stats) is not balanced now. The lab serves to experiment with and validate the candidate combat
rules, each one evolving as the shared mechanics come in.

| Criterion | Target | How it is measured |
|---|---|---|
| DNA does not decide alone | In a full-HP 1 × 1, AI × AI, no DNA pair exceeds 75% wins **in all three arenas** (it may in one: the arena matters). The report carries the matrix per arena | `geo battle`, seeds 1–100 per fight |
| The wounded weigh | The same fight with one side at 500‰ HP shifts the win rate toward the other; the report shows by how much | `geo battle` |
| Duration | Median 1 × 1 between 15 s and 90 s; 3 × 3 up to 120 s. The report carries the distribution | `geo battle` |
| Inactivity | Fraction of battles that end by inactivity escapes, per fight. The owner judges whether the stalemate is being solved or fights are being cut | `geo battle` |
| Loaded escape | Escape rate of a square with a full purse against a circle, with and without dropping the purse, in the three arenas | `geo battle` |
| Micro matters | In the owner's sessions, the win rate dominating a side is higher than the AI's in the same setup | Lab (session report) + `geo battle` as a baseline |
| Latency | The highest RTT band where the owner's median blind score stays at 4 or more; the lowest where it falls below 3 | Blind mode (D17), at least 5 battles per RTT |
| Measured delay | Key → on-screen effect ≈ RTT + 1 tick (+ jitter), with no accumulation over the battle | Lab (L-4) |
| Auto-resolve cost | A 3 × 3 of 120 battle seconds (2,400 ticks) resolved in at most 50 ms, median | `geo battle`, on the owner's machine |
| Determinism | 2 runs and snapshot → restore give the same hash; the lab's log gives the worker's hash in the CLI | `geo battle verify` in CI |
| Rules | Each §5 rule with a package test, on text-drawn arenas | `npm run check` |
| Fun | The owner answers hypothesis questions 1 to 4 | Checkpoint |

## 8. Test protocol

1. **Tests** (`battle`, `cli`, `client`): the §5 rules on text arenas; the projectile missing whoever dodged; the body
   blocking; the cell contest by `rng`; the border escape interrupted by a hit; inactivity; joining mid-fight; the end
   with three sides; each gambits condition and action.
2. **Harness:** `geo battle` with the fight matrix (1 × 1 of each pair and mirrors, 2 × 2, 3 × 3, 1 × 1 × 1; full HP
   and wounded; with and without load; the three arenas; seeds 1–100).
3. **The owner's free session:** play each DNA against the AI, watch AI × AI, edit a gambit, drop a reinforcement into
   a 1 × 1. PLAYTEST questions (e.g. "did you know why you lost?", "could you see the shot coming?", "which DNA did you
   want to play again?").
4. **The owner's blind session:** at least 5 battles per RTT, in random order, with a score at the end of each one.
   **A single setup** for the whole session (owner, 2026-11-17), the dominated 1 × 1, so the score measures the delay
   and not the matchup.

### Criteria to close the slice
- §7 criteria green, or the owner decides what to do with what failed.
- The owner answers hypothesis questions 1 to 4 at the checkpoint, and decides whether the next rule to try is the
  free one, the forge or none before the junction (plan §15: none before the junction, C9).

## 9. Prerequisites before the `plan.md`

- The owner's acceptance of D1–D19 ✅ (2026-11-15); the gameplay ones are in the GDD (02, 06, 07).
- **ADR-0008 — Battle package** ✅ `Accepted` (2026-11-15).
- The contract with the world (the bubble, world time, joining from the world) is slice D's ADR.

## 10. Open questions

None.
