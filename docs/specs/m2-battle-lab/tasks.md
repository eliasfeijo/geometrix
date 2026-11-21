# M2 battle lab tasks — Slice B

**Status:** all phases done (2026-11-20). Condensed history; branches were `m2/laboratorio-f<n>-<slug>`.
**Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)

| Phase | Delivered |
|---|---|
| F0 — Design, spec and plan | interactive round (D1–D19); ADR-0008; plan P1–P14 |
| F1 — The package and movement | `packages/battle` with its guards; RNG and canonical JSON copied with an equality test; `params/battle.json`; the three text arenas; setup, state, `serialize`/`restore`; intent and turn; movement with slowdown and contest; `stepBattle` skeleton; `BATTLE_VERSION` 1 |
| F2 — Combat | melee and projectiles, damage, death and piles, drop and pick up, border escape, inactivity, end, join, `control`, `setGambits`, events and result, the log and `replayLog` |
| F3 — AI and auto-resolve | gambits vocabulary, BFS, dodge, reaction time, presets; `geo battle sweep`/`verify`; CI steps. **Checkpoint:** C1–C3 |
| F4 — The lab | 2× arenas with spawn zones; per-participant reaction; `lab.html`, worker, latency channel, SVG render, keyboard, setup, domination switching, reinforcements, gambits editor, events and result, measured delay, log export and CLI fixture |
| F5 — Blind mode and playtest | blind mode, session record and export, PLAYTEST groups; the starting countdown (D21, `BATTLE_VERSION` 2). **Checkpoint part 1** (2026-11-18): C4–C8 |
| F6 — F5 checkpoint adjustments | immediate first step, a single battle inactivity clock (`BATTLE_VERSION` 3), domination ending with the battle, a laptop-readable screen with attack, hit and miss signs |
| F7 — F5 checkpoint adjustments, part 2 | the countdown honors what is held (`BATTLE_VERSION` 4); the four movement drawings and ADR-0009; ▲ kites ■ and ● avoids melee corners; death and escape signs; inactivity meter over the arena; Start scrolls to the arena. Closes slice B |

## F5 checkpoint, part 2 (owner, 2026-11-19 and 20): the session record

With F6's `main` (`BATTLE_VERSION` 3), a clean record and the lab on Vite. 71 battles exported (the export file is in
the owner's Downloads folder, outside the repo).

**Group 1** (9 duels dominating, RTT 0, normal AI): 7 of 9 won (4 of 9 in part 1). Scores 5, 5, 5 (3, 3, 4 in part
1). "The visual feedback improved the combat experience 1000%, even with basic attacks only"; movement "quite fluid";
"100% stable". ■ and ▲ the most fun; the best fight, the ■ baiting the ● at the rocks; in the open arena and the
corridor, the ■ hardly beats the ●.

**Group 2** (27 instant AI × AI): no number surprised. Only one fight the AI loses flipped with the owner's micro: ■ ×
● at the rocks, through terrain (one battle, a signal).

**Group 3** (watching): everything readable; of the inactivity clock, only the red warning of the last 5 s was
noticed, "and that's enough for me". The AI "is still pretty dumb, there's room to improve, but it does the job". A
signal of who dies or flees was missing; idea of a **commander** in group battles (GDD 06, proposal).

**Group 4** (watching, ▲ × ▲ with a reinforcement): the presets are enough; "hard for the player to edit the creeps'
rules during combat". **Dodging made a big difference.** The ▲ AI stands in the ■'s melee taking hits when it could
kite (fixed in F7).

**Groups 5 and 6** (blind, ▲ dominated × ● normal at the rocks, interpolation on, 29 battles, 28 won):

| RTT | 0 | 50 | 100 | 150 | 200 | 300 |
|---|---|---|---|---|---|---|
| Scores | 4 5 3 3 4 | 5 5 3 5 3 | 5 3 3 5 4 | 4 3 2 4 | 3 2 2 2 2 | 2 2 2 2 2 |
| Median | 4 | 5 | 4 | 3.5 | 2 | 2 |
| Measured delay (median) | 78 ms | 125 | 184 | 234 | 282 | 386 |

**Verdict:** a score of 4 or more up to **100 ms**; below 3 from **200 ms**. "Above 100 ms it starts to be
noticeable". Against the bot, the delay "is predictable": after a few matches the owner anticipates the shot. What bothers
the owner most is not latency but **"the pause between each move"**: the one-tick interpolation slides for 50 ms and the ▲
then stands ~200 ms on each cell. Larger and longer fights (an end-game siege) were not tested.

**Group 7** (300 ms): without interpolation it feels better, "easier to sync the movement with the latency"; the owner asked
for a middle ground that does not pause when the next input continues the movement (F7's four options; **to compare
in PLAYTEST group 7, pending**).

**Group 8** (closing):

1. **Is the grid rule fun?** Yes: "I really liked the result we reached for combat".
2. **Does micro matter?** Yes, thanks to the signs that show each creep's shot range and make it possible to time the hit. The ●
   exploit at the rocks (always the same corridors, walking straight into the waiting corner) — "humans learn by
   themselves" (F7 reduced it).
3. **Latency:** "forget deploy for now". The deploy, even a test one, waits for the **joined junction** (the world
   creates the instance, the channel stays open for reinforcements and third parties, the result returns to the
   world); "we may well end up putting prediction in the client".
4. **Does the AI serve?** "It does its job."
5. **The next rule:** none before the junction: "let's join what we have".
6. **Movement:** try the options before asking for a decision.
7. **F7:** yes, with Start scrolling to the arena.

## F7 record (2026-11-20)

- **The countdown (C15; `BATTLE_VERSION` 4):** the intent gains the held **bag** (`drop` or `pickup`, next to the
  direction and space). During the countdown the worker discards one-tap requests; on its last tick, the held bag
  becomes the request, and the held space and direction act on the first fight tick. The AI uses the same path.
- **The AI (C12):** the skirmisher gained "enemy square within 3 cells → keep distance from the square" (a DNA filter
  on `enemyWithin`). Shooters' alignment paths avoid cells within `gambits.meleeBerthSteps` (3) steps of an enemy
  melee creep. In the corner bait, the ■'s hits before the ● reaches it went from 12–18% of battles to 0%.
- **`geo battle sweep`** (seeds 1–100, 9,200 battles in 48 s): 1 × 1 median 20.4 s; 3 × 3 median 38.5 s; 3 × 3 cost
  40.8–41.6 ms per 2,400 ticks (target 50 ms); ■ × ▲ went from 100/0 to ~50/50; `geo battle verify` OK.
- **Movement (C11):** a **Movement** selector with four drawings (no interpolation, interpolate 1 tick, slide the
  whole step, predict my creep — ADR-0009). Measured with headless Chromium (key → first on-screen movement at 0 /
  150 / 300 ms): no interpolation 52 / 175 / 345; 1 tick 64 / 231 / 329; whole step 60 / 239 / 354 (no pause); predict
  15 / 16 / 43 (no pause). PLAYTEST group 7 compares them.
- **The screen (C13):** death shatters the creep where it was hit; escape leaves an arrow off the arena; the "no
  damage" meter is a discreet line above the arena; Start scrolls to the header.
- **Fixture:** rebuilt from a page export (v4, 300 ms); 2,729 tests.

**Interpretations to validate (pending, with PLAYTEST group 7):**

1. The held bag in the intent, and the AI holding its last decision's bag through the countdown.
2. The DNA filter on `enemyWithin` and the skirmisher's new rule (after dodge, before attack).
3. The melee berth applies to shooters (▲ and ●) and only when aligning; 3 steps is a guess.
4. What the panel measures for each movement option, and prediction only for the dominated creep, up to one step
   behind the battle; during the countdown, it waits.
5. Death and escape signs last 1.4 s of page time; without the cell (no previous frame), no sign.
