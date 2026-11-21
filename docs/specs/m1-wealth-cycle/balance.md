# M1 — Balance pass 1

**Date:** 2026-11-14 · **Status:** decided (candidate B adopted) · **Protocol:** spec §8, item 1 (bot × bot sweeps)

Part of the F5 checkpoint. The owner adopted candidate B as the provisional `params/default.json` on 2026-11-14
(§6); A stays in `params/balance-a.json` for reference. All numbers come from the (provisional) `balanced`
strategist, 72 world hours, seeds 1–5, unless noted. Reproduce B: `npm run geo -- sim --seed 42 --days 3`.

## 1. A fix before balancing: the symmetric map was not fair

The checkpoint report showed team 1 travelling almost twice as much as team 0 (37.7 × 19.6 min on seed 42). The
cause was A*: it broke ties by the lowest cell index for both teams, which is not symmetric under the 180° rotation.
The teams built differently shaped roads and ended up to ~19% apart in delivered materia (seed 1).

Fixed in `fix(sim): mirror path ties on the rotated side`: team 1 breaks ties in the rotated order, and its route is
the exact mirror of team 0's (property test on 5 seeds). Afterwards both teams end with the same delivery and travel
time; differences of up to ~1% remain where the teams interact (contested cristal, creep id order).

## 2. Diagnosis of the old parameters

| Signal | Value | Why |
|---|---|---|
| Population cap | 4–5 h | 24 creeps × 10 min of production = 4 h. The limit is **production time**, not resources |
| Materia | The 6 deposits empty in 0.6–1.7 h and stay at ~1 until the end | Regeneration of 1/min per deposit = 180/h per team; 30 creeps take far more |
| Creeps walking empty | 55–72% | With everything empty, "gather at the nearest non-empty" chases every regenerated unit |
| Idle stock at the end | 90% of delivered materia | After the cap there is nothing to spend on |
| Cristal | Depleted in ~3 h | The bot keeps ⅓ of the creeps on cristal; each team uses 390 of the 1,200 it gathers |
| Contention on the 2 "contested" deposits | 0–50 min in 72 h | Each one sits on one side of the river; that side's team gets there first |

The economy **explodes and stalls at once**: it grows all it can in 4 h and then has no decision left.

## 3. Targets for "neither stalls nor explodes"

1. **Spread-out expansion:** the population cap is reached between **36 and 60 h**, with regular production from the
   start.
2. **Each extra creep pays:** team throughput grows with population until near the cap.
3. **Healthy logistics:** creeps walking empty below 40%, without wandering between empty deposits.
4. **Symmetry:** both teams deliver the same (±2%) on the same seed.

These remain the reference for the spec §8 "no degenerate state" criterion.

## 4. Candidates

| Parameter | Old | A (`balance-a.json`) | B (`default.json`) |
|---|---|---|---|
| `deposits.materia.perSide` | 3 | 6 | 6 |
| `deposits.materia.maxCoreDistance` | 8 | 20 | 20 |
| `deposits.materia.regen.amount` (per minute) | 1 | 3 | 8 |
| `creep.cost.materia` | 40 | 1,800 | 3,000 |
| `road.cost.materia` | 5 | 100 | 150 |

| Metric (seeds 1–5) | Old | A | B |
|---|---|---|---|
| Population cap | 4–5 h | 47–58 h | 38–50 h |
| Materia delivered per team | 14 k | 63–75 k | 142–175 k |
| Idle stock at the end | 90% | 22–36% | 44–55% |
| Creeps walking empty | 55–72% | 27–36% | 31–39% |
| Cristal depleted | ~3 h | 6–8 h | 6–9 h |

- **A** grows linearly, but throughput hits the regeneration ceiling (≈ 1,080/h) with ~13 creeps; after that a new
  creep yields nothing. Fails targets 2 and 3.
- **B** has throughput growing with population (1,035 → 2,430/h on seed 42). An extra creep yields ~65–90 materia
  per hour and pays for itself in 1.5–2 world days, which creates a real decision about **when to stop investing**.
  Costs: a slow start and more idle stock after the cap.

## 5. Measurement: the DNAs are equivalent in the economy

Teams of 6 creeps of a single DNA, 12 h, no roads: ■ 9,090–10,050, ▲ 9,260–11,160, ● 8,740–10,140 materia delivered
(seeds 1–3). The gap between DNAs is smaller than the gap between seeds. **The owner decided to keep it that way**
(GDD 02): DNA differences come from other systems, from M2 on.

## 6. Owner's decisions (2026-11-14)

- **Candidate B** becomes the provisional `params/default.json`.
- What no parameter solves:
  1. nothing to do after the cap (a stock sink): postponed, not in M1;
  2. gathering with empty deposits: **closed** — the creep keeps the chosen deposit until full and waits for
     regeneration there ([spec §5](spec.md), [GDD 07](../../gdd/07-autopilot.md));
  3. the role of cristal after ~8 h: left for later milestones;
  4. the bot is part of the measurement: worth improving before the next pass, without changing the game.
