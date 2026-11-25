# M2 spec — The DNA kits

**Status:** Approved (2026-11-25) · **Date:** 2026-11-25 · **Milestone:** M2 — The ambush ([ROADMAP](../../ROADMAP.md)), slice K
**Related GDD:** [02](../../gdd/02-creeps-and-domination.md) (the DNA kits), [05](../../gdd/05-tribes-and-diplomacy.md)
(the wanderers), [06](../../gdd/06-battles.md) (the grid, the kits' details), [07](../../gdd/07-autopilot.md)
(battle gambits) · **ADR:** [0008](../../adr/0008-battle-package.md) (battle package),
[0010](../../adr/0010-world-side-of-the-battle-contract.md) (the world side of the contract); no new ADR expected (§9)

## 1. Hypothesis

> Does the battle change the course of the world without dominating the game? (ROADMAP, M2)

The junction joined the grid to the world, and its checkpoints showed the grid's limit: with only walking and the
basic attack, **a circle beats a square in every case** of the junction matrix (C1b: aggressor circle × square victim,
fighting, 100%), and a wanderer, a circle, killed **47 of the 64 loaded squares** that fought it in 3 days of seed 42.
The square never reaches a circle that kites. This slice gives each DNA a kit that is innate to its shape (GDD 02,
2026-11-25) and asks:

1. **Do the kits give the grid interesting micro?** Each DNA gets a decision beyond walking and shooting: how long to
   hold the charge, when to dodge. Playing each DNA in the lab, the owner wants to play it again.
2. **Does the square get a game against the kiting circle?** With the charge and the dodge, the square wins some of
   the fights it always loses today, and the circle keeps its role as the ranged glass cannon.
3. **Do the gambits use the kits credibly?** Auto-resolve decides most battles in the world (no human). A kit only
   the human uses would make humans stronger, not the DNAs different.
4. **Do the kits hold the latency the grid held?** A release and a double tap are timing, the micro that feels latency
   most. The grid stayed playable up to 100 ms blind (lab C10); the kits should not lower that band.

After this slice, P (the friends' playtest) plays with the kits that passed the lab, and R's final balance pass runs
on top of them.

## 2. What the owner already decided (GDD, 2026-11-25)

A summary; the source is GDD 02 and 06 (the R and E-min design round, and this spec's round, both 2026-11-25).

| Topic | Decision |
|---|---|
| What a kit is | Unique combat mechanics per DNA, **innate to the DNA**: nothing unlocked by level. Level, XP, evolution and leveled skills still come later (GDD 02) |
| Every DNA | **A dodge** (esquiva), with a cooldown |
| ■ Square | **The charged strike:** the melee hit causes a micro-stun on the victim's movement, whose duration and damage grow as the attack is charged, with a bar that fills up to the strike's limit. **The charge** (investida): holding Space speeds the square up while it moves, and the attack goes out by itself when it collides with an enemy creep during the charge |
| ▲ Triangle | **The frontal guard:** it stands still facing one direction and blocks the projectiles that come from the front; the square's charged strike breaks the guard; the flank stays open. It shields the allies behind it |
| ● Circle | **The fan:** three projectiles at once, in the front lane and the two next to it, with a long cooldown |
| The rule | **The grid stays** (directional attack, bodies, escape by the border, the battle's inactivity clock) |
| The path | **In the lab first, behind params;** the gambits learn the kits, so auto-resolve uses them; **what is not fun in the lab does not reach the world** |
| The screen | The battle screen shows the charge and the cooldowns (ROADMAP, slice K) |
| The order | K runs in parallel with R and E-min, before P; R's final balance pass runs after K's merge (ROADMAP) |

## 3. Scope decisions this spec assumes

D3–D10 are **the owner's answers** in this spec's round (2026-11-25), to the kits' details GDD 06 left open; they go
into GDD 02 and 06. The others are **the agent's proposals, accepted by the owner with the spec** (2026-11-25);
those marked **(gameplay)** are in the GDD, and those marked **(interpretation)** fill a detail the owner's answers
did not cover. The numbers are in §6 and are guesses.

| # | Decision | Default | Why |
|---|---|---|---|
| D1 | Behind params | Each kit has its own params, per DNA, with an **on/off switch** (`enabled`, 0 or 1). With every kit off, the battle plays exactly today's rule. The lab can switch each kit for one battle (its setup already carries the params, and the log keeps them) | "Behind params" (GDD 06): the lab compares with and without, and what does not pass the lab checkpoint is switched off in the world's params instead of removed from the code |
| D2 | Where the kits live | All in `packages/battle`. The world (`sim`) does not change: a creep has no kit state outside a battle, and the junction hands the battle the DNA it already hands | The kit is innate to the DNA (GDD 02) and the battle already owns the combat stats (junction D9). No new world state, no `SIM_VERSION` bump |
| D3 | **One key: Space** **(gameplay; owner)** | Space is every DNA's kit key; there is no separate skill key. **A tap is the DNA's basic attack. Held, it fills the DNA's bar** up to its limit, in a time set **per DNA** in the params, and the hold is the DNA's skill: the square charges its strike (and, walking, its charge), the triangle **guards while the bar fills**, the circle **charges its fan's range** | Owner: "segurar barra de espaço carrega a habilidade (triângulo protege durante o tempo carregando a barra e círculo carrega o alcance do tiro em leque, tudo configurável), não precisa de outra tecla" |
| D4 | ■ The strike **(gameplay; owner)** | **The basic hit (a tap) also stuns.** The longer Space is held, the larger the strike's damage, its stun's duration **and the square's walking speed**. The strike can be charged while walking. When the charge collides with an enemy, the strike goes out **with the bar built while running** | Owner, answering GDD 06's open question ("does the charge's hit carry the charge built while running?"): yes |
| D5 | ■ The charge's limit **(gameplay; owner)** | The charge lasts at most a duration set in the params. **It has no cooldown of its own: it comes back with the attack's cooldown** after the strike goes out | Owner: "limitada, mas recarrega ao mesmo tempo que o delay do ataque carregado (pode propor uma duração configurável)". Without a limit the square would always be faster than the circle |
| D6 | **The dodge** **(gameplay; owner)** | **A double tap of a direction** (arrow or WASD) dashes 2 cells that way, fast, and the creep is **untouchable** during the dash: a shot in its path goes through. **The dodge has priority:** it resets the bar, ends the square's charge and lowers the triangle's guard | Owner, answering "which key is the dodge, how far, untouchable?" |
| D7 | **The load** **(gameplay; owner)** | **As in walking:** the charge's bonus multiplies the speed the load already slows; the dodge keeps its distance, and its cooldown grows with the load (double with a full purse) | Owner, answering "what does a dodging or charging creep do with its load?". The loaded square still almost never escapes (lab D8) |
| D8 | **The wanderers** **(owner)** | **In K, the wanderers get the circle's kit** by their battle DNA (a circle with their own stats). Their own DNA and kit (the owner's idea: a circle with a "mohawk" of triangular spikes, a challenging fight from the start of the match to its end) get **their own design round** ([GDD 05](../../gdd/05-tribes-and-diplomacy.md)) | Owner, answering "do the wanderers get the fan?". The round is not part of K |
| D9 | ▲ The guard **(gameplay; interpretation)** | While Space is held past a tap, the triangle **does not move, turn or attack** and blocks every projectile that enters its cell **moving against its facing**, the fan's included; a projectile from the side or the back hits as today; a melee hit is not blocked. The guard lasts **while the bar fills**: when it is full, the guard drops. Releasing Space drops the guard and **fires the basic shot**, if the attack is ready. After the guard drops, the bar fills again only after a short cooldown. A blocked projectile is not damage: it does not reset the inactivity clock | "Stands still facing one direction" (GDD 02) and "protects while the bar fills" (D3). The full bar as the guard's limit keeps a guard from lasting forever; the shot on release turns a guard into a counter |
| D10 | ● The fan **(gameplay; interpretation)** | The circle may walk while its bar fills. Releasing Space past a tap fires the fan: three projectiles **in the same tick**, in the facing direction, on the cell in front and on the two front diagonals, each moving straight along its own lane with the circle's damage, and **a range that grows with the bar** (from the params' minimum to its maximum). A projectile whose start cell is rock or outside the arena is not created. The fan has its long cooldown, and firing it restarts the basic attack's cooldown too; while the fan is cooling down, a held Space is just the basic shot on release | "Three projectiles at once, in the front lane and the two next to it" (GDD 02); "the circle charges the fan's range" (D3). Parallel lanes make a single enemy take at most one of the three: the fan covers an area, it is not triple damage. Walking keeps the circle's kiting role |
| D11 | The countdown **(gameplay)** | During the starting countdown no kit acts (only turning, as today). At its end only what is held counts (lab S-4): a held Space starts its DNA's bar; a double tap during the countdown is discarded | The countdown's own rule (lab D21), extended to the kits |
| D12 | The micro-stun **(gameplay)** | A stun stops **movement only**: the stunned creep cannot walk, dodge or charge, and its walking points do not accumulate; it can turn, attack, fill its bar and guard. A new stun on a stunned creep keeps the longer of the two remaining times, never the sum | GDD 02 says "a micro-stun on the victim's movement". Not summing avoids a stun lock by two squares |
| D13 | Breaking the guard **(gameplay)** | A square's strike with **at least half the bar** on a guarding triangle, from any side, drops the guard, starts its cooldown and lands its damage and stun. A weaker strike lands as a hit and the guard stays up | "The square's charged strike breaks the guard" (GDD 02): the basic tap does not, so breaking it is a decision |
| D14 | Kits are commands | The dodge is a one-off command with its direction; the held Space rides on the intent, as today's held attack and bag key do. The human and the gambits send them through the same validation (lab G-2, junction C-2). The double tap is read by the client, which sends the dodge | ADR-0002: every action is a command. The battle does not know about keys |
| D15 | The gambits learn the kits **(gameplay)** | An action is only **possible** when its kit is on and ready, so the first-valid-rule rule (lab G-1) needs no "ready" condition. The `dodge` action uses the dash when it is ready and steps out of the line as today when it is not. New actions: **charge** a target (■: hold Space while walking to it; the strike on collision, or on release when adjacent), **guard** (▲: face the incoming projectile and hold while one is coming), **fan** at a target (●: hold until the bar's range reaches the target, release with the target in one of the three lanes). `attack` stays the basic attack (taps) | The gambits are the auto-resolve (lab D14): a kit the AI does not use does not change the world's battles |
| D16 | The presets **(gameplay)** | **Frontline** (■): protect the wounded ally → charge the nearest enemy that is out of reach → attack the nearest. **Marksman** (●): flee when low → dodge → fan the nearest → keep distance → attack the weakest. **Skirmisher** (▲): flee when low → guard → dodge → keep distance from a square → attack the nearest. **Carrier**: drop with an enemy near → dodge → flee. The wanderers keep their gambits, with the fan where the marksman has it | The shape tells the role (pillar 6); each preset uses its DNA's kit at its obvious moment, and the owner tunes the rest in the lab's editor |
| D17 | What the screen shows | On every creep, what others must read: the bar filling (the square's strike, the circle's fan), the square's charge (a streak behind it), the raised guard (a bar on the triangle's face), the stun (a sign over the creep), the dash (the creep's glide). For the dominated creep, a small panel with its bar and the cooldowns of the dodge and of its skill. In the lab and in the world client's battle screen alike (the shared `battle/` folder) | The ROADMAP's "the battle screen shows charge and cooldowns", and the lab F5 lesson: a hit that cannot be seen is not understood |
| D18 | Events | New battle events: dodge, charge (start and collision), strike (with its charge), stun, guard up and down, blocked projectile, guard broken, fan. The lab's list shows them. The world's chronicle does not narrate them: what returns to the world (the result) does not change shape | The lab F5 lesson (signs of attack, hit and miss); the world's contract (ADR-0010) stays the same |
| D19 | Versions | `BATTLE_VERSION` bumps (the same log gives another result); `PROTOCOL_VERSION` bumps (the dodge input, new fields in the battle frame). A world saved before K with a battle open does not restore that battle; the plan says what to do with it | The project's rule (CLAUDE.md) |
| D20 | Two checkpoints | **K1, in the lab:** the owner plays each kit; each kit passes, changes or stays off. **K2, in the world:** the matrices, the sweep and a battle in the world client with the kits that passed. Only what passed K1 goes on in `params/battle.json` | "What is not fun in the lab does not reach the world" (GDD 06) |

## 4. Scope

### In
- **`@geometrix/battle`:** the kits' params (D1, §6); the state (the bar, the charge, the cooldowns, the guard, the
  stun, the dash in flight); the commands (D14); the step's new rules (§5); the events (D18); the view; the gambits'
  vocabulary and the presets (D15, D16); `BATTLE_VERSION`.
- **CLI:** `geo battle sweep` and `geo junction matrix` with the kits' use per battle and the comparison with the kits
  off (`--set`); the `verify` of a lab log with kits.
- **Lab:** Space's tap and hold, the double tap (U-1), the kits' signs and the dominated creep's panel (D17), the kit
  switches per battle (D1), the new actions in the gambits editor (D15).
- **World:** the protocol's battle inputs and frames (D14, D19); the world client's battle screen with the same keys
  and signs; the wanderers with the circle's kit (D8). No `sim` change (D2).
- **Playtest:** a lab group in [PLAYTEST.md](../../PLAYTEST.md) for the kits (K1) and the K2 world battle script.
- **GDD:** the accepted decisions in GDD 02, 06 and 07.

### Out
The wanderers' own DNA and kit (D8, their own design round); level, XP, evolution, leveled skills and ultimates (GDD
02, parked); critical hits (GDD 06, not in M2); energy or mana; a new combat rule (the grid stays); mouse aim; the
corridor AI (GDD 06, parked); battle sound; client prediction (ADR-0009, P); the world's pace, the wanderers' numbers
and the final balance pass (slice R, after K's merge); a battle gambits editor in the world client (junction D10); the
chronicle narrating kits (D18).

## 5. Behavior

Format: *When [trigger], the system shall [response].* "Ready" means the kit is on (D1) and its cooldown has ended. A
**tap** is a Space press released within the tap window (§6); a **hold** is one held past it.

### Common (`battle`)
- **B-1** With a DNA's kit switched off, its kit commands shall be refused with the reason, its gambits actions shall
  be impossible, and its Space shall work as before K (held, it attacks whenever the cooldown allows).
- **B-2** A tap shall be the DNA's basic attack, as today. A hold shall fill the DNA's bar from empty to full in the
  DNA's bar time and stay full; what the hold does is the DNA's (SQ, TR, CI) (D3).
- **B-3** During the countdown, no kit shall act; at its end, a held Space shall start its bar, and a dodge sent
  during the countdown shall be discarded (D11).
- **B-4** A stun shall stop walking, dodging and the charge until it ends; turning, attacking, filling the bar and
  guarding shall work. A new stun shall keep the longer remaining time (D12).
- **B-5** The kits shall draw nothing from the battle `rng`; it stays only where two creeps contest a cell (lab M-3),
  in the fixed call order.

### The dodge, every DNA (`battle`)
- **DG-1** When the dodge is ready and the creep is not stunned, the dodge command shall move the creep up to the
  dodge's distance in the command's direction, one cell per tick, stopping before rock, a creep or the arena's end; it
  shall not turn the creep. The cooldown starts at once (D6).
- **DG-2** While the dash moves the creep, projectiles and melee hits shall pass it by: it is untouchable.
- **DG-3** The dodge shall reset the bar, end the square's charge and drop the triangle's guard (D6).
- **DG-4** A dash onto an exit cell counts towards the escape like walking onto it (lab F-1).
- **DG-5** The load shall stretch the dodge's cooldown in proportion to the occupied fraction of capacity, up to the
  params' maximum with a full purse; the distance does not change (D7).

### ■ The square: charged strike and charge (`battle`)
- **SQ-1** While Space is held, standing or walking, the square's bar shall fill. Releasing Space shall strike the
  cell in front with the bar's charge, when the attack cooldown allows (D4).
- **SQ-2** A strike that hits shall deal damage and stun the victim's movement, both growing linearly with the bar,
  from the basic hit's values (a tap, with its own short stun) to the params' maximum (a full bar).
- **SQ-3** While Space is held and the square walks, it shall **charge**: its walking speed is multiplied by a bonus
  that grows with the bar, from none to the params' maximum, on top of the load's slowdown (D7). The charge lasts at
  most the params' time; after it, the square walks at its normal pace and keeps the bar (D5).
- **SQ-4** When a square holding Space tries to step into a cell held by an enemy, the strike shall go out by itself
  against it, with the bar's charge (D4).
- **SQ-5** The charge shall have no cooldown of its own: after a strike, the attack's cooldown starts, and the bar
  and the charge come back with it (D5).
- **SQ-6** A strike with at least half the bar on a guarding triangle shall break its guard (D13).

### ▲ The triangle: frontal guard (`battle`)
- **TR-1** While Space is held past a tap and the guard is ready, the guard shall be up: the triangle does not move,
  turn or attack, and its bar fills; when the bar is full, the guard drops (D9).
- **TR-2** A projectile that enters the guarding triangle's cell moving against its facing shall be destroyed without
  damage, with a "blocked" event; from the side or the back it hits as today. Allies behind the triangle are covered
  because the projectile stops on the triangle.
- **TR-3** Releasing Space shall drop the guard and fire the basic shot, if the attack is ready.
- **TR-4** A guard that drops (released, full, broken or by the dodge) shall start the guard's cooldown.

### ● The circle: the fan (`battle`)
- **CI-1** While Space is held past a tap and the fan is ready, the circle's bar shall fill, walking or standing.
  Releasing Space shall fire the fan, with a range from the params' minimum (an empty bar) to its maximum (a full bar)
  (D10).
- **CI-2** The fan shall create three projectiles in the same tick, in the facing direction, on the cell in front and
  on the two front diagonals, each with the circle's damage and projectile speed; a start cell that is rock or
  outside the arena creates no projectile.
- **CI-3** Firing the fan shall start the fan's cooldown and restart the basic attack's cooldown. While the fan is
  cooling down, releasing a hold shall fire the basic shot.

### Gambits (`battle`)
- **G-1** A kit action shall be possible only when its kit is ready and its own condition holds (D15): **charge** when
  the target is reachable and not adjacent; **guard** when an enemy projectile is coming along a lane through the
  triangle; **fan** when an enemy is in one of the three lanes within the bar's maximum range.
- **G-2** The `dodge` action shall use the dash when it is ready, sideways out of the projectile's line, and step out
  as today when it is not.
- **G-3** The presets shall follow D16, and the lab's editor shall offer the new actions.

### Screens and input (client, both battle screens)
- **U-1** Space: a tap attacks, a hold is the DNA's skill; a double tap of a direction (arrow or WASD) within the
  double-tap window sends the dodge that way; the first tap still steps, as today (lab D22). The other keys do not
  change. With latency, a held key still sends one message on press and one on release.
- **U-2** The screen shall draw on every creep the bar, the charge, the raised guard, the stun and the dash (D17), and
  for the dominated creep the panel with its bar and the dodge's and skill's cooldowns.
- **U-3** The lab's setup shall switch each kit on or off for the battle (D1), and the export shall carry it in the
  log.
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
| Space (all) | tap window | 150 ms | a release within it is a tap |
| Dodge (all) | distance | 2 cells | one cell per tick (100 ms in all) |
| | cooldown | 3,000 ms | per DNA, the same for the three to start |
| | cooldown with a full purse | 2,000‰ (double) | D7 |
| | double-tap window | 250 ms | the client's (D14) |
| ■ Strike | time to a full bar | 1,000 ms | |
| | damage: tap / full bar | 30 / 60 | 1,000‰ to 2,000‰ of the square's damage |
| | stun: tap / full bar | 100 ms / 600 ms | a circle's cell takes 200 ms |
| | the bar that breaks a guard | 500‰ | D13 |
| ■ Charge | speed bonus at a full bar | 1,750‰ (3 → 5.25 cells/s) | just above the circle's 5 |
| | longest charge | 1,500 ms | then the attack's cooldown (1,000 ms) after the strike (D5) |
| ▲ Guard | time to a full bar (the longest guard) | 2,000 ms | |
| | cooldown after it drops | 1,000 ms | |
| ● Fan | time to a full bar | 1,000 ms | |
| | range: empty / full bar | 3 / 8 cells | the basic shot's is 6 |
| | cooldown | 6,000 ms | each projectile with the circle's damage (24) |

From full HP the square kills a circle with 2 full-bar strikes (120 HP); a charge that starts with a full bar covers
7.8 cells in 1.5 s, against the circle's 7.5 walking away. The charge closes about a cell; the dodge, a corner or the
stun does the rest. These are where the lab starts, not a balance.

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

1. **Tests** (`battle`, `cli`, `client`): each §5 rule on text arenas; a tap against a hold; the dash through a
   projectile; the dash resetting the bar; the stun stopping a step but not a shot; the charge's collision with the
   bar; the charge's limit and its return with the attack's cooldown; the guard against the front, the flank and the
   fan, its end at a full bar and its shot on release; the guard broken by half a bar and not by a tap; the fan's
   range by the bar, and by a rock; each kit switched off; the countdown with Space held and a double tap; the double
   tap in the client; each new gambits action.
2. **Harness:** the sweep and the junction matrix with the kits on and off (H-1, H-2), `geo sim` 3 days of seed 42.
3. **K1, the owner's lab session** (a new PLAYTEST lab group): each DNA dominated against each DNA on the AI, with its
   kit; the AI × AI with kits on and off; the short blind session. Questions such as "did the kit do what you
   wanted?", "could you see the other's kit coming?", "which kit would you switch off?".
4. **K2, a world battle:** the world client against a wanderer and against the bot's creeps, with the kits that
   passed K1.

### Criteria to close the slice
- §7 criteria green, or the owner decides what to do with what failed.
- The owner answers hypothesis questions 1–4 and decides, at K1, which kits go on in the world's params.

## 9. Prerequisites before the `plan.md`

- The owner's acceptance of the agent's proposals (D1, D2, D9–D20) ✅ with the spec (2026-11-25); D3–D8 are the
  owner's answers. The gameplay ones are in GDD 02, 05, 06 and 07.
- **No new ADR:** the kits live inside the battle package (ADR-0008) and do not change the world's contract
  (ADR-0010, D2, D18); the version bumps follow the existing rules.

## 10. Open questions

None in this spec: the owner answered GDD 06's open details on 2026-11-25 (D3–D8). Pending elsewhere, not blocking:
the wanderers' own DNA and kit (their own design round, GDD 05).
