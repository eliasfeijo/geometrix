# M2 plan — The DNA kits

**Status:** Draft · **Date:** 2026-11-25
**Spec:** [spec.md](spec.md) · **ADRs:** [0008](../../adr/0008-battle-package.md) (battle package),
[0010](../../adr/0010-world-side-of-the-battle-contract.md) (the world side of the contract),
[0002](../../adr/0002-every-action-is-a-command.md) (command vocabulary), [0003](../../adr/0003-typescript-node-pure-integer-simulation.md)
(determinism)

The decisions that need the owner's OK are marked **(P*n*)** and listed in §12.

## 1. What the code does today and what changes

| Today (`BATTLE_VERSION` 6, `PROTOCOL_VERSION` 7; R takes 8) | In slice K |
|---|---|
| Space held is `intent.attack`: an attack whenever the cooldown allows; its press also arms `attackLatch`, so a quick tap fires at once | With the DNA's kit on, the press only starts a **hold**; the release decides: within the tap window, the basic attack; past it, the DNA's skill (P1). With the kit off, as today |
| A participant has `cooldownTicks` (the attack) and nothing else that lasts | A `kit` record per participant: the hold, the charge, the stun, the dash, the guard and the cooldowns (§4) |
| Movement: one walking pace per DNA, slowed by the load; disputes by the `rng` | Plus the charge's bonus, the stun that stops it, and the dash, which moves before the walkers (P5) |
| A projectile hits the first enemy on its cell | Unless the enemy is dashing (passes it) or guarding against it (blocked) |
| A hit takes HP | A square's strike also stuns, by its charge, and may break a guard |
| The ranged attack fires one projectile | The circle's fan fires three, in parallel lanes, with the bar's range |
| Gambits: attack, approach, keep distance, dodge (a step), protect, flee, drop, pick up | Plus charge, guard and fan; `dodge` dashes when it can (spec D15) |
| `geo battle sweep` and `geo junction matrix` with the kits implied by the code | `--kits on,off`: both in one report, plus each kit's uses per battle (H-1, H-2) |
| The battle screens draw the creep, its HP, load, facing, projectiles and the escape count | Plus the bar, the charge, the guard, the stun, the dash and the dominated creep's panel (D17) |

## 2. Where each thing lives

```text
params/
  battle.json        the kits block (§3), every kit on in the lab; K1 sets what stays on
packages/battle/src/
  params.ts          the kits schema and consistency (§3)
  state.ts           Participant.kit (§4); BATTLE_VERSION 7
  kits.ts            new: stage 3a, the hold and the release, the bar, the guard, the dash's start (§5)
  combat.ts          the release's strike, the fan, the stun and the guard on hits; the dash's untouchability
  movement.ts        the charge's bonus, the stun, the dash's cells, the charge's collision (§5)
  commands.ts        the dodge command; the intent's attack as the hold (§6)
  step.ts            stage 3a in the pipeline; the countdown with the kits (B-3)
  events.ts          the kits' events (D18)
  view.ts            the kit fields a screen and the gambits need (§9)
  gambits.ts, actions.ts, mind.ts, presets.ts   charge, guard, fan; dodge with the dash; the presets (§7)
packages/protocol/src/
  index.ts           the dodge input; PROTOCOL_VERSION (the next after R's)
  battle-delta.ts    the view's new fields in the frame (§9)
apps/client/src/battle/
  input.ts           the hold and its release, the double tap (P3)
  arena-view.tsx     the bar, the charge, the guard, the stun, the dash (D17)
  kit-panel.tsx      new: the dominated creep's bar and cooldowns
  labels.ts, events-list.tsx   the kits' events
apps/client/src/lab/
  setup-form.tsx     the kit switches per battle (P10)
  gambits-editor.tsx, labels.ts   the new actions
apps/client/src/
  battle-screen.tsx  the panel and the dodge input in the world's battle screen
apps/cli/src/
  battle.ts, junction-matrix.ts, report.ts   --kits on,off and the kits' uses (P9)
docs/PLAYTEST.md     the lab group for K1, the K2 world battle script
```

The `sim` and the junction do not change (spec D2): the junction hands the battle the DNA, and a wanderer enters as a
circle with the marksman preset, so it gets the circle's kit and the fan by the preset (spec D8, D16).

## 3. Params

Every leaf a non-negative integer, durations multiples of the tick, as today. The numbers are the spec's §6.

```json
"kits": {
  "tapMs": 150,
  "dodge": {
    "enabled": 1, "cells": 2, "fullLoadCooldownPermille": 2000,
    "cooldownMs": { "square": 3000, "triangle": 3000, "circle": 3000 }
  },
  "square": {
    "enabled": 1, "barMs": 1000, "fullDamagePermille": 2000, "tapStunMs": 100, "fullStunMs": 600,
    "breakGuardPermille": 500, "chargeSpeedPermille": 1750, "chargeMaxMs": 1500
  },
  "triangle": { "enabled": 1, "barMs": 2000, "cooldownMs": 1000 },
  "circle": { "enabled": 1, "barMs": 1000, "minRange": 3, "maxRange": 8, "cooldownMs": 6000 }
}
```

- `enabled` is 0 or 1 (`checkConsistency`), the switch of spec D1; the dodge's is for every DNA.
- `checkConsistency`: `tapMs` shorter than every `barMs`; `fullDamagePermille` and `chargeSpeedPermille` at least
  1000; `tapStunMs` ≤ `fullStunMs`; `minRange` ≤ `maxRange`; `breakGuardPermille` ≤ 1000;
  `fullLoadCooldownPermille` ≥ 1000.
- The bar is counted in **ticks held**; every scaled value is linear and floored:
  `value = tapValue + ⌊(fullValue − tapValue) × held ÷ barTicks⌋`, with `held` capped at `barTicks`. The charge's
  speed multiplies `moveGain` by `1000 + ⌊(chargeSpeedPermille − 1000) × held ÷ barTicks⌋` ‰, then floors.
- The test params (`packages/battle/test/params.json`) get the same block, with round numbers for the tests.

## 4. State

```ts
type Kit = {
  /** Ticks since Space went down, while it is held (tap or hold); 0 when not held. */
  pressed: number;
  /** The bar: ticks held while the kit is ready, capped at the bar's length; 0 when not held. */
  held: number;
  /** The square: ticks walked while holding (the charge's limit, D5); the charge is spent at chargeMaxMs. */
  charged: number;
  stunTicks: number;
  /** The dash in flight: direction and cells left (DG-1), or null. */
  dash: { dir: Dir; cellsLeft: number } | null;
  guard: boolean;
  dodgeCooldownTicks: number;
  /** The triangle's guard or the circle's fan (the square has none: the attack's cooldown, D5). */
  skillCooldownTicks: number;
  /** The bar released this tick, for stage 3's skill; null when no skill goes out. */
  released: number | null;
};
```

- `Participant.kit`, initial value in `placeParticipant` (a join too). JSON only. `Intent` gains nothing: the hold is
  `intent.attack`, the tap is `attackLatch` (§6).
- **`BATTLE_VERSION` 7.** A world saved with a battle open from version 6 is refused on recovery, as today
  (`world-host.ts`); the dev worlds are recreated.

## 5. The tick with the kits

The pipeline of the lab plan §7, with one new stage and the changes in bold:

| Stage | What | K |
|---|---|---|
| 1 | Commands | **The dodge command** sets `kit.dash` if the dodge is ready and the creep is not stunned (DG-1); it resets `held`, ends the charge and drops the guard (DG-3) |
| 2 | Gambits | The new actions (§7) |
| 3 | Turn | **Not while guarding** (D9) or dashing |
| **3a** | **Kits** (`kits.ts`) | Cooldowns count down. **The hold:** while `intent.attack`, `pressed` += 1, and while the DNA's kit is also ready (the square: the attack's cooldown is over; the others: the skill's), `held` += 1 up to the bar. **The release** (`intent.attack` went false): with `pressed` within the tap window or `held` 0 (the whole hold fell in a cooldown), it is **a tap** and arms the latch, which fires the basic attack when it is ready, as today; otherwise `kit.released = held`. Both counts go back to 0. A press and release within one tick arrives as the latch alone: a tap. **The guard:** up while the triangle holds past the tap window, down at a full bar, on release or on the dodge (TR-1, TR-4) |
| 3 | Attack | **The latch** is the basic attack, as today; **`released`** is the skill: the square's strike with `released` as its charge (SQ-1, SQ-2), the triangle's basic shot (TR-3), the circle's fan with the bar's range (CI-1..CI-3). **No attack while holding** with the kit on (P1) |
| 4 | Movement | **The dashes first**, in id order: one cell per tick, stopping before rock, a creep, a cell another dash took this tick, or the grid's end (P5). **Then the walkers:** a stunned or guarding creep does not walk and its points do not accumulate (B-4); a square holding while walking gains the charge's bonus until `charged` reaches `chargeMaxMs` (SQ-3); **its step into an enemy's cell records the strike** with `held` as the charge, then `held` = 0 and the attack's cooldown starts (SQ-4, P8) |
| 5 | Projectiles | `enemyAt` skips a **dashing** participant (DG-2, P4) and **blocks** on a guarding triangle the projectile meets face to face: the projectile is spent with a `blocked` event, no hit (TR-2) |
| 6 | Hits | A melee hit on a dashing participant is lost (DG-2). A square's hit **stuns** by its charge (keeping the longer stun, B-4) and **breaks the guard** at `breakGuardPermille` (SQ-6, TR-4) |
| 7–9 | Bag, exit, end | A dash onto an exit cell counts like a step (DG-4) |

- **The countdown** (B-3): stages 1, 2 and the turn run; stage 3a does not fill the bar, and a dodge command during
  it is dropped. At its end a held Space starts the hold on the first fighting tick, like the held bag today.
- **The load** (DG-5, D7): the dodge's cooldown is stretched by `1000 + ⌊(fullLoadCooldownPermille − 1000) × load ÷
  capacity⌋` ‰ when it starts; the charge's bonus multiplies the already-braked gain.
- **The `rng`** stays where it is (cell disputes, the gambits); the dashes take their cells before the walkers'
  disputes, with no draw (B-5).

## 6. Commands

- **`{ type: "dodge", id, dir }`**: a participant command (human and gambits). Refused with the reason when the
  dodge kit is off, on cooldown, during the countdown, or the creep is stunned (B-1). Applied in stage 1.
- **The intent's `attack`** keeps its meaning with the kit off (held: attack whenever ready). With the kit on, it is
  the hold, and stage 3a turns its release into a tap (the latch) or the skill. **`attackOnce`** stays what the
  client sends on the press; with the kit on, stage 3a clears it while Space is still held, so only a press and
  release within one tick leaves it armed as a tap.
- The protocol's `battleInputCommand` gains `dodge`; the server's check of the dominated participant covers it.

## 7. The gambits

- **Possible only when ready** (spec D15): an action whose kit is off or cooling down returns null, so the rule
  passes to the next.
- **The hold and the release are decisions (P2):** the AI holds Space by an intent with `attack: true` and releases
  it on a later decision, with its reaction time; an `easy` AI holds longer and releases later than a `hard` one.
- **`dodge`:** with the dash ready, the dash sideways out of the projectile's line (the direction by the same safe
  cells as today's step, two cells deep); otherwise today's step.
- **`charge` (■):** target picked as `attack`; if adjacent, null (the `attack` rule below does it). Otherwise walk
  towards it holding Space; the collision strikes (SQ-4). Released on a decision that finds the target adjacent
  and the bar full, or out of the charge's reach.
- **`guard` (▲):** when an enemy projectile's lane passes through the triangle, face the projectile and hold; release
  on the first decision with no projectile coming at its face (the release fires the basic shot back).
- **`fan` (●):** target picked as `attack`; possible when the target is in one of the three lanes from a cell the
  circle can stand on; hold until the bar's range reaches the target's distance, then release facing it.
- **Presets** (spec D16): `frontline`: protect → charge the nearest → attack the nearest; `marksman`: flee when low →
  dodge → fan the nearest → keep distance → attack the weakest; `skirmisher`: flee when low → guard → dodge → keep
  distance from a square → attack the nearest; `carrier`: drop with an enemy near → dodge → flee.

## 8. Lab and the battle screens

- **`input.ts` (P1, P3):** Space press: `intent.attack` true (and the latch, for a tap within one tick); release:
  false. The page does not decide tap or hold; the battle does, by the ticks held, so latency does not change the
  rule. **The double tap:** a direction pressed again within `DOUBLE_TAP_MS` (250, the input's constant) of its last
  press sends `dodge` that way; the first press still walks a cell (lab D22). `KeyLike` gains the event's time.
- **`arena-view.tsx`:** the bar as a thin arc under the creep (filling with `held`), the charge as a short streak
  behind the square, the guard as a thick bar on the triangle's face, the stun as a small star over the creep, the
  dash as the glide the motion drawing already does, faded while untouchable. The lab F5 signs stay.
- **`kit-panel.tsx`:** for the dominated creep, the bar, the dodge's cooldown and the skill's cooldown (the square:
  the attack's), in both battle screens.
- **The lab's setup (P10):** a switch per kit in the setup form, applied to the params the worker gets for that
  battle; the exported log keeps them (the log already carries the params).
- **The gambits editor:** the three new actions; labels in Portuguese (`investir`, `guardar`, `leque`).
- **The world's battle screen:** the same input class and drawing; the dodge goes out as a `battleInput`.

## 9. Network

- **The view** (`ViewParticipant`) gains `kit: { held, guard, stunTicks, dashing, dodgeCooldownTicks,
  skillCooldownTicks, charging }`: what the screens draw and the gambits read. The delta compares participants by
  value, so a held bar sends a change every tick for the holder only.
- **The frame's cost** (spec §7): a 3 × 3 with everyone holding is the worst case; `geo net` with a watcher must stay
  within 16 KB/s. If it does not, `held` goes out in steps of the bar (P9's alternative).
- **`PROTOCOL_VERSION`:** the next after R's 8, whichever of R and K merges second takes the bump after the other.

## 10. Harness and tests

- **Kits off is today (H-2):** before any rule changes, F1 records a fixture of today's results for a fixed sample
  (the `battle verify` seeds and a slice of the sweep: winner, ticks, each participant's outcome, HP and totals). Each
  later phase runs it with every kit off; the hash differs (the state has new fields), the results must not (P6).
- **Unit tests** on text arenas for each §5 rule of the spec (the spec's §8 list), in `packages/battle/test/kits.test.ts`
  and the existing files where a stage changed.
- **`geo battle sweep --kits on,off`** and **`geo junction matrix --kits on,off`** (P9): one report with both columns
  and each kit's uses per battle per DNA (H-1); the default stays `on`.
- **`geo battle verify`** (seeds 1, 42, 649) and a lab log with kits; `geo verify --seed 42`; `npm run soak` at K2.

## 11. Running next to the other slices

- **R** does not touch `packages/battle`; its F5 adds the pause (P on the battle screen, `battleHold`) and bumps the
  protocol to 8. K's world phase (F6) touches the same client files (`battle-screen.tsx`, `input.ts`): the second to
  merge brings the other's changes in. R's F8 is the final balance pass on top of K.
- **E-min** does not touch the battle.
- **G** (groups and formations) designs on top of K's kits (the guard shields whoever is behind it); its code comes
  after K's merge.

## 12. Decisions for the owner

| # | Proposal | Alternative |
|---|---|---|
| P1 | **The attack goes out on release** when the DNA's kit is on: a tap fires when the key comes up (a tap is ~50–100 ms, so the basic attack leaves that much later), and holding Space no longer repeats attacks. K1 judges the feel | The basic attack fires on the press, and the hold's skill comes on top: the square would strike twice (the tap's and the release's) and the triangle would shoot on the press and on the release |
| P2 | **The AI holds and releases by its decisions** (its reaction time), with the human's commands: the difficulty applies to the kits by itself | An AI-only "charge to X‰" command that releases on the exact tick: a sharper AI, and a command the human never sends |
| P3 | **The double tap is read by the client** (250 ms, the input's constant, not a battle param); the first tap still walks a cell | The first tap waits for the window before walking (every step 250 ms late); or the window in the battle params |
| P4 | **Untouchable on the dash's own ticks** (2 ticks, 100 ms): a projectile or a blow that reaches the creep on those ticks passes; on the landing tick it can be hit again | Untouchable also on the landing tick (150 ms) |
| P5 | **The dashes move before the walkers**, in id order, with no `rng`: a dash stops before any creep and takes its cell before the walkers' disputes | The dash joins the walkers' disputes (the `rng` picks) |
| P6 | **A fixture of today's results** recorded in F1 guards "kits off is today" (H-2) in every phase | Only the sweep at the end (a regression found late) |
| P7 | **The guard rises when the hold passes the tap window** (150 ms after the press); a tap never raises it | The guard rises on the press (a tap would guard for up to 150 ms before its shot) |
| P8 | **The charge's collision lands in the same tick** as the step that met the enemy (stage 6 with the other hits); the square stays in its cell | The strike waits for the next tick's attack stage |
| P9 | **`--kits on,off`** in the sweep and the junction matrix: both columns in one report (the sweep's ~45 s doubles to ~90 s); the default is `on` | A general `--battle-set path=v1,v2` (more flexible, and switching every kit off takes several paths) |
| P10 | **The lab's kit switches in the setup form**, per battle, kept in the exported log | Switches only in `params/battle.json` (restart the lab to compare) |

## 13. Implementation order

| Phase | What | Checkpoint |
|---|---|---|
| **F1** — The bar and the strike | The kits params (all of §3), `Participant.kit`, stage 3a with the hold and the release, the square's strike and stun, the kits-off fixture (P6), `BATTLE_VERSION` 7, the events | — |
| **F2** — The charge and the dodge | The charge's bonus, limit and collision; the dodge command, the dash, untouchability, its priority and the load's cooldown | — |
| **F3** — The guard and the fan | The triangle's guard, blocking and breaking; the circle's fan and its range | — |
| **F4** — The gambits and the reports | The actions and presets (§7); `--kits on,off` and the kits' uses in the sweep and the matrix; a first sweep read | — |
| **F5** — The lab | The input (the hold, the double tap), the drawing and the panel, the kit switches, the editor's actions, the PLAYTEST group | **K1:** the owner plays each kit in the lab, the sweep with and without kits, a short blind session; each kit passes, changes or stays off |
| **F6** — The world | The protocol and the frame, the world's battle screen, `params/battle.json` with what passed K1, `geo net`, `geo sim` 3 days, the soak | **K2:** a world battle against a wanderer and the bot; the §7 criteria; K closes |
