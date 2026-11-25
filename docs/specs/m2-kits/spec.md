# M2 spec — The DNA kits

**Status:** Draft · **Date:** 2026-11-25 · **Milestone:** M2 — The ambush ([ROADMAP](../../ROADMAP.md)), slice K
**Related GDD:** [02](../../gdd/02-creeps-and-domination.md) (the DNA kits), [05](../../gdd/05-tribes-and-diplomacy.md)
(the wanderers), [06](../../gdd/06-battles.md) (the grid, the kits' open details), [07](../../gdd/07-autopilot.md)
(battle gambits) · **ADR:** [0008](../../adr/0008-battle-package.md) (battle package),
[0010](../../adr/0010-world-side-of-the-battle-contract.md) (the world side of the contract); no new ADR expected (§9)

## 1. Hypothesis

> Does the battle change the course of the world without dominating the game? (ROADMAP, M2)

The junction joined the grid to the world, and its checkpoints showed the grid's limit: with only walking and the
basic attack, **a circle beats a square in every case** of the junction matrix (C1b: aggressor circle × square victim,
fighting, 100%), and a wanderer, a circle, killed **47 of the 64 loaded squares** that fought it in 3 days of seed 42.
The square never reaches a circle that kites. This slice gives each DNA a kit that is innate to its shape (GDD 02,
2026-11-25) and asks:

1. **Do the kits give the grid interesting micro?** Each DNA gets a decision beyond walking and shooting: when to
   dodge, when to charge, when to guard, when to fan. Playing each DNA in the lab, the owner wants to play it again.
2. **Does the square get a game against the kiting circle?** With the charge and the dodge, the square wins some of
   the fights it always loses today, and the circle keeps its role as the ranged glass cannon.
3. **Do the gambits use the kits credibly?** Auto-resolve decides most battles in the world (no human). A kit only
   the human uses would make humans stronger, not the DNAs different.
4. **Do the kits hold the latency the grid held?** A dodge and a release are timing, the micro that feels latency
   most. The grid stayed playable up to 100 ms blind (lab C10); the kits should not lower that band.

After this slice, P (the friends' playtest) plays with the kits that passed the lab, and R's final balance pass runs
on top of them.

## 2. What the owner already decided (GDD, 2026-11-25)

A summary; the source is GDD 02 and 06 (the R and E-min design round, 2026-11-25).

| Topic | Decision |
|---|---|
| What a kit is | Unique combat mechanics per DNA, **innate to the DNA**: nothing unlocked by level. Level, XP, evolution and leveled skills still come later (GDD 02) |
| Every DNA | **A dodge** (esquiva), with a cooldown |
| ■ Square | **The charged strike:** the melee hit causes a micro-stun on the victim's movement, whose duration and damage grow as the attack is charged, with a bar that fills up to the strike's limit. **The charge** (investida): holding Space speeds the square up while it moves, and the attack goes out by itself when it collides with an enemy creep during the charge |
| ▲ Triangle | **The frontal guard:** holding the skill key, it stands still facing one direction and blocks the projectiles that come from the front; the square's charged strike breaks the guard; the flank stays open. It shields the allies behind it |
| ● Circle | **The fan:** three projectiles at once, in the front lane and the two next to it, with a long cooldown |
| The rule | **The grid stays** (directional attack, bodies, escape by the border, the battle's inactivity clock) |
| The path | **In the lab first, behind params;** the gambits learn the kits, so auto-resolve uses them; **what is not fun in the lab does not reach the world** |
| The screen | The battle screen shows the charge and the cooldowns (ROADMAP, slice K) |
| The order | K runs in parallel with R and E-min, before P; R's final balance pass runs after K's merge (ROADMAP) |

## 3. Scope decisions this spec assumes

**Agent's proposals, pending the owner's acceptance.** Those marked **(gameplay)** complete the GDD; once accepted,
they go into it (GDD 02, 06 and 07). The details the GDD left open for this spec are the questions in §10 (Q1–Q7):
the rules below that depend on them follow the agent's recommendation and say so. The numbers are in §6 and are
guesses.

| # | Decision | Default | Why |
|---|---|---|---|
| D1 | Behind params | Each kit has its own block in the battle params, per DNA, with an **on/off switch** (`enabled`, 0 or 1). With every kit off, the battle plays exactly today's rule. The lab can switch each kit for one battle (its setup already carries the params, and the log keeps them) | "Behind params" (GDD 06): the lab compares with and without, and what does not pass the lab checkpoint is switched off in the world's params instead of removed from the code |
| D2 | Where the kits live | All in `packages/battle`. The world (`sim`) does not change: a creep has no kit state outside a battle, and the junction hands the battle the DNA it already hands. The wanderers get the circle's kit by their DNA (Q7) | The kit is innate to the DNA (GDD 02) and the battle already owns the combat stats (junction D9). No new world state, no `SIM_VERSION` bump |
| D3 | The countdown **(gameplay)** | During the starting countdown no kit acts (only turning, as today). At its end only what is held counts (S-4): a held guard goes up, a held Space starts charging; a dodge tapped during the countdown is discarded | The countdown's own rule (lab D21), extended to the new keys |
| D4 | The micro-stun **(gameplay)** | A stun stops **movement only**: the stunned creep cannot walk, dodge or charge, and its walking points do not accumulate; it can turn, attack, guard and fan. A new stun on a stunned creep keeps the longer of the two remaining times, never the sum | GDD 02 says "a micro-stun on the victim's movement". Not summing avoids a stun lock by two squares |
| D5 | The guard's rules **(gameplay)** | While the guard is up, the triangle **does not move, turn or attack**. It blocks every projectile that enters its cell **moving against its facing** (coming at its face), the fan's included; a projectile from the side or the back hits as today. A melee hit is not blocked (the guard is against projectiles). There is no maximum duration; lowering it starts a short cooldown before it can go up again. A blocked projectile is not damage: it does not reset the battle's inactivity clock | "Stands still facing one direction" (GDD 02). Shooting while guarding would make the triangle win every ranged duel. A guard against a shooter that never moves ends by the inactivity clock, like two kiters (lab D9) |
| D6 | Breaking the guard **(gameplay)** | A square's strike with **at least half the bar** on a guarding triangle, from any side, lowers the guard, starts its cooldown and lands its damage and stun. A weaker strike lands as a hit and the guard stays up | "The square's charged strike breaks the guard" (GDD 02): the basic tap does not, so breaking it is a decision (charge, then strike) |
| D7 | The fan's shape **(gameplay)** | The fan creates three projectiles **in the same tick**, in the firing direction, on the cell in front and on the two cells beside it (the diagonals in front), each one moving straight along its own lane with the circle's damage and range. A projectile whose start cell is rock or outside the arena is not created. The fan has its own cooldown, and firing it also restarts the basic attack's cooldown | "Three projectiles at once, in the front lane and the two next to it" (GDD 02). Parallel lanes make a single enemy take at most one of the three: the fan covers an area, it is not triple damage |
| D8 | Kits are commands | The dodge, the guard and the fan are commands of the dominated participant, through the same validation as today's (lab G-2, junction C-2): the dodge as a one-off command, the guard as a held key on the intent (like the bag key), the fan as a one-off command. The square's Space keeps being the attack key, now with the charge (Q1). New keys: §5 U-1 (Q5) | ADR-0002: every action is a command. The human and the gambits speak the same vocabulary |
| D9 | The gambits learn the kits **(gameplay)** | An action is only **possible** when its kit is on and ready, so the first-valid-rule rule (lab G-1) needs no "ready" condition. The `dodge` action uses the dodge when it is ready and steps out of the line as today when it is not. New actions: **charge** a target (■: the charge towards it, the strike on collision), **guard** (▲: face the incoming projectile's lane and hold the guard while one is coming), **fan** at a target (●: when an enemy is in one of the three lanes within range) | The gambits are the auto-resolve (lab D14): a kit the AI does not use does not change the world's battles |
| D10 | The presets **(gameplay)** | **Frontline** (■): protect the wounded ally → charge the nearest enemy that is out of reach → attack the nearest. **Marksman** (●): flee when low → dodge → fan → keep distance → attack the weakest. **Skirmisher** (▲): flee when low → guard → dodge → keep distance from a square → attack the nearest. **Carrier**: drop with an enemy near → dodge → flee. The wanderers keep their preset with the circle's kit (Q7) | The shape tells the role (pillar 6); each preset uses its DNA's kit at its obvious moment, and the owner tunes the rest in the lab's editor |
| D11 | What the screen shows | On every creep, the states others must read: the square's charging (the bar filling) and charge (a streak behind it), the raised guard (a bar on the triangle's face), the stun (a sign over the creep), the dodge (the creep's glide, untouchable). For the dominated creep, a small panel with the charge bar and the cooldowns of the dodge and of its DNA's skill. In the lab and in the world client's battle screen alike (the shared `battle/` folder) | The ROADMAP's "the battle screen shows charge and cooldowns", and the lab F5 lesson: a hit that cannot be seen is not understood |
| D12 | Events | New battle events: dodge, charge (start and collision), strike (with its charge level), stun, guard up and down, blocked projectile, guard broken, fan. The lab's list shows them. The world's chronicle does not narrate them: what returns to the world (the result) does not change shape | The lab F5 lesson (signs of attack, hit and miss); the world's contract (ADR-0010) stays the same |
| D13 | Versions | `BATTLE_VERSION` bumps (the same log gives another result); `PROTOCOL_VERSION` bumps (new inputs, new fields in the battle frame). A world saved before K with a battle open does not restore that battle; the plan says what to do with it | The project's rule (CLAUDE.md) |
| D14 | Two checkpoints | **K1, in the lab:** the owner plays each kit; each kit passes, changes or stays off. **K2, in the world:** the matrices, the sweep and a battle in the world client with the kits that passed. Only what passed K1 goes on in `params/battle.json` | "What is not fun in the lab does not reach the world" (GDD 06) |

## 4. Scope

### In
- **`@geometrix/battle`:** the kits' params (D1, §6); the state (charge, cooldowns, guard, stun, dodge in flight); the
  commands (D8); the step's new rules (§5); the events (D12); the view; the gambits' vocabulary and the presets (D9,
  D10); `BATTLE_VERSION`.
- **CLI:** `geo battle sweep` and `geo junction matrix` with the kits' use per battle and the comparison with the kits
  off (`--set`); the `verify` of a lab log with kits.
- **Lab:** the keys (U-1), the kits' signs and the panel of the dominated creep (D11), the kit switches per battle
  (D1), the new actions in the gambits editor (D9).
- **World:** the protocol's battle inputs and frames (D8, D13); the world client's battle screen with the same keys
  and signs; the wanderers with the circle's kit (Q7). No `sim` change (D2).
- **Playtest:** a lab group in [PLAYTEST.md](../../PLAYTEST.md) for the kits (K1) and the K2 world battle script.
- **GDD:** the accepted decisions and the answers to Q1–Q7 in GDD 02, 06 and 07.

### Out
Level, XP, evolution, leveled skills and ultimates (GDD 02, parked); critical hits (GDD 06, open, not in M2); energy or
mana; a new combat rule (the grid stays); mouse aim; the corridor AI (GDD 06, parked); battle sound; client
prediction (ADR-0009, P); the world's pace, the wanderers' numbers and the final balance pass (slice R, after K's
merge); a battle gambits editor in the world client (junction D10); the chronicle narrating kits (D12).

## 5. Behavior

Format: *When [trigger], the system shall [response].* "Ready" means the kit is on (D1) and its cooldown has ended.
Rules that depend on a §10 question name it.

### Common (`battle`)
- **B-1** With a kit switched off in the params, its commands shall be refused with the reason, its gambits actions
  shall be impossible, and the battle shall play as before K.
- **B-2** During the countdown, no kit shall act; at its end, the held guard and the held Space shall count and every
  one-off kit command sent during it shall be discarded (D3).
- **B-3** A stun shall stop walking, dodging and charging until it ends; turning, attacking, guarding and the fan
  shall work. A new stun shall keep the longer remaining time (D4).
- **B-4** The kits' rules shall use the battle `rng` only where two creeps contest a cell (lab M-3), in the fixed call
  order; the kits themselves draw nothing.

### The dodge, every DNA (`battle`)
- **DG-1** When the dodge is ready and the creep is not stunned, the dodge command shall move the creep up to the
  dodge's distance in the held direction (its facing, with none), one cell per tick, stopping before rock, a creep or
  the arena's end; it shall not turn the creep. The cooldown starts at once (Q4).
- **DG-2** While the dodge moves the creep, projectiles and melee hits shall pass it by: it is untouchable (Q4).
- **DG-3** A dodge onto an exit cell counts towards the escape like walking onto it (lab F-1).
- **DG-4** The load shall stretch the dodge's cooldown in proportion to the occupied fraction of capacity, up to the
  params' maximum with a full purse; the distance does not change (Q6).

### ■ The square: charged strike and charge (`battle`)
- **SQ-1** While Space is held and the creep is **standing**, the charge bar shall fill from empty to full in the
  params' time, and stay full. Releasing Space shall strike the cell in front with the charge reached, when the attack
  cooldown allows. A tap shall be today's basic hit, with the smallest stun (Q1).
- **SQ-2** A strike that hits shall deal damage and stun the victim's movement, both growing linearly with the charge,
  from the basic hit's values (empty bar) to the params' maximum (full bar) (D4).
- **SQ-3** While Space is held and the creep is **walking**, the square shall **charge**: its walking speed is
  multiplied by the charge's bonus (on top of the load's slowdown) and the bar keeps filling. The charge lasts at most
  the params' time, then the creep walks at its normal pace and the charge has a cooldown (Q3).
- **SQ-4** When a charging square tries to step into a cell held by an enemy, the strike shall go out by itself
  against it, with the bar's charge, and the charge ends (Q2).
- **SQ-5** A strike with at least half the bar on a guarding triangle shall break its guard (D6).

### ▲ The triangle: frontal guard (`battle`)
- **TR-1** While the skill key is held, the guard is ready and the creep is not walking a step, the guard shall be up:
  the triangle does not move, turn or attack (D5).
- **TR-2** A projectile that enters the guarding triangle's cell moving against its facing shall be destroyed without
  damage, with a "blocked" event; from the side or the back it hits as today. Allies behind the triangle are covered
  because the projectile stops on the triangle.
- **TR-3** Releasing the key, or a broken guard (SQ-5), shall lower the guard and start its cooldown.

### ● The circle: the fan (`battle`)
- **CI-1** When the fan is ready, the fan command shall create three projectiles in the same tick, in the facing
  direction, on the cell in front and on the two front diagonals, each with the circle's damage, range and projectile
  speed; a start cell that is rock or outside the arena creates no projectile (D7).
- **CI-2** Firing the fan shall start the fan's cooldown and restart the basic attack's cooldown.

### Gambits (`battle`)
- **G-1** A kit action shall be possible only when its kit is ready and its own condition holds (D9): **charge** when
  the target is reachable and not adjacent; **guard** when an enemy projectile is coming along a lane through the
  triangle; **fan** when an enemy is in one of the three lanes within range.
- **G-2** The `dodge` action shall use the dodge when it is ready, sideways out of the projectile's line, and step out
  as today when it is not.
- **G-3** The presets shall follow D10, and the lab's editor shall offer the new actions.

### Screens and input (client, both battle screens)
- **U-1** The keys: Space keeps attacking (■: hold to charge, release to strike, hold while walking to charge);
  **F dodges** in the held direction; **R is the DNA's skill** (▲ hold to guard, ● tap for the fan); the lab's restart
  moves from R to Backspace (Q5). With latency, a held key still sends one message on press and one on release.
- **U-2** The screen shall draw on every creep the charging bar, the charge, the raised guard, the stun and the dodge
  (D11), and for the dominated creep the panel with the charge bar and the dodge's and skill's cooldowns.
- **U-3** The lab's setup shall switch each kit on or off for the battle (D1), and the export shall carry it in the log.
- **U-4** The world client shall send the kit inputs only for the dominated participant (junction C-2) and draw the
  frames' new fields; the server needs no new rule beyond the protocol's validation.

### Harness
- **H-1** `geo battle sweep` and `geo junction matrix` shall report, per DNA, each kit's uses per battle, and the
  win rates with the kits on and off.
- **H-2** With every kit off, `geo battle sweep` shall give the same wins and durations as before K (timings aside).
- **H-3** `geo battle verify` (seeds 1, 42, 649) and a lab log with kits shall give the worker's hash; `geo verify
  --seed 42` and `npm run soak` stay green.

## 6. Initial parameters (guesses, made to be broken)

In `params/battle.json`, per DNA where it says so; durations multiples of the 50 ms tick, modifiers in ‰. Every kit
starts **on** in the lab; K1 decides what stays on for the world.

| Kit | Parameter | Guess | Note |
|---|---|---|---|
| Dodge (all) | distance | 2 cells | one cell per tick (100 ms in all) |
| | cooldown | 3,000 ms | per DNA, the same for the three to start |
| | cooldown with a full purse | 2,000‰ (double) | Q6 |
| ■ Charged strike | time to a full bar | 1,000 ms | |
| | damage at a full bar | 2,000‰ of the square's damage (60) | the basic hit stays 30 |
| | stun: basic hit / full bar | 100 ms / 600 ms | a cell of the circle is 200 ms |
| | the bar that breaks a guard | 500‰ | D6 |
| ■ Charge | speed bonus | 1,750‰ (3 → 5.25 cells/s) | just above the circle's 5 |
| | longest charge / cooldown | 1,500 ms / 4,000 ms | Q3 |
| ▲ Guard | cooldown after lowering | 1,000 ms | no maximum duration (D5) |
| ● Fan | cooldown | 6,000 ms | each projectile with the circle's damage (24) |

From full HP the square kills a circle with 2 full-bar strikes (120 HP), and a full charge covers 7.8 cells in
1.5 s, against the circle's 7.5 walking away: the charge closes a gap of about a cell, and the dodge or a corner does
the rest. These are where the lab starts, not a balance.

## 7. Harness and acceptance criteria

The targets are guesses; when one fails, the owner decides at the checkpoint. R's final balance pass comes after K,
so K's targets are about the kits working and the square getting a game, not the final numbers.

| Criterion | Target | How it is measured |
|---|---|---|
| The square gets a game | In the junction matrix, aggressor circle × square victim, fighting: from 100% (C1b) to at most 75% | `geo junction matrix`, seeds 1–100 |
| DNA does not decide alone | In a full-HP 1 × 1, AI × AI, no DNA pair exceeds 75% wins in all three arenas (the lab's §7 target, informational since its F3 because raw combat had no skills) | `geo battle sweep` |
| The wanderers against the square | The share of loaded squares a wanderer kills (47 of 64 at C1b), reported; informational, R tunes the wanderers | `geo sim` 3 days, seed 42 |
| The AI uses the kits | Each kit is used in at least half of the battles where a creep of its DNA fights more than 10 s | H-1 |
| Off is today | With every kit off, the same wins and durations as before K | H-2 |
| Duration | Median 1 × 1 and 3 × 3, with and without kits, reported for R (the 2-hour match) | `geo battle sweep` |
| Auto-resolve cost | A 3 × 3 of 120 battle seconds still at most 50 ms median; `geo junction matrix` at most 2× its ~10 s | `geo battle sweep`, `geo junction matrix` |
| The network | The battle frame with the kits' fields within the junction's watcher budget (16 KB/s) | `geo net` with a watcher |
| Latency | In a short blind session (0 and 100 ms RTT, the dominated 1 × 1 with each DNA), the owner's median score at 100 ms stays at 4 or more | Lab blind mode |
| Determinism | H-3 | CI |
| Rules | Each §5 rule with a package test, on text-drawn arenas | `npm run check` |
| Fun | The owner answers hypothesis questions 1–4 at K1 and K2 | Checkpoints |

## 8. Test protocol

1. **Tests** (`battle`, `cli`, `client`): each §5 rule on text arenas; the dodge through a projectile; the stun
   stopping a step but not a shot; the charge's collision; the guard against the front, the flank and the fan; the
   guard broken by half a bar and not by a tap; the fan by a rock; each kit switched off; the countdown with the new
   keys; each new gambits action.
2. **Harness:** the sweep and the junction matrix with the kits on and off (H-1, H-2), `geo sim` 3 days of seed 42.
3. **K1, the owner's lab session** (a new PLAYTEST lab group): each DNA dominated against each DNA on the AI, with its
   kit; the AI × AI with kits on and off; the short blind session. Questions such as "did you use the kit when you
   wanted to?", "could you see the other's kit coming?", "which kit would you switch off?".
4. **K2, a world battle:** the world client against a wanderer and against the bot's creeps, with the kits that
   passed K1.

### Criteria to close the slice
- §7 criteria green, or the owner decides what to do with what failed.
- The owner answers hypothesis questions 1–4 and decides, at K1, which kits go on in the world's params.

## 9. Prerequisites before the `plan.md`

- The owner's acceptance of D1–D14 and the answers to Q1–Q7; the gameplay ones go into GDD 02, 06 and 07
  (`gdd-decision` skill).
- **No new ADR:** the kits live inside the battle package (ADR-0008) and do not change the world's contract
  (ADR-0010, D2, D12); the version bumps follow the existing rules.

## 10. Open questions

The kits' details GDD 06 left for this spec, with the agent's recommendation first. The §5 rules follow the
recommendation until the owner answers.

| # | Question | Recommendation | Alternatives |
|---|---|---|---|
| Q1 | How does the square's bar fill? | Holding Space charges it, releasing strikes; a tap is the basic hit | The bar fills by itself between strikes (waiting makes the next one stronger), and Space works as today |
| Q2 | Does the charge's collision carry the bar built while running? | Yes: the bar keeps filling during the charge, and the collision strikes with it | The collision is the basic hit (the charge only closes the distance) |
| Q3 | Is the charge limited? | Yes: up to 1.5 s per charge, then a cooldown | No limit while Space is held (a square that is always faster than the circle) |
| Q4 | What is the dodge? | A dash of 2 cells in the held direction, fast (100 ms), untouchable during it | The same dash, but a shot in its path still hits; or a 1-cell sidestep |
| Q5 | Which keys? | F for the dodge, R for the DNA's skill (the lab's restart moves to Backspace) | Shift tapped alone for the dodge, F for the skill; or C for the skill |
| Q6 | What does the load do to the dodge and the charge? | Like walking: the charge multiplies the loaded speed, and the dodge's cooldown grows with the load (double with a full purse) | No dodge and no charge above half the purse (drop it to free the kit); or the load does not touch the kits |
| Q7 | Do the wanderers (circles) get the kit? | Yes, the circle's whole kit (dodge and fan) with their own damage; R tunes their numbers | The dodge only, no fan; or no kit |
