# M1.5 spec — Fog of war

**Status:** Done (2026-11-14) · **Date:** 2026-11-14 · **Milestone:** M1.5 — The fog ([ROADMAP](../../ROADMAP.md)), slice 2 of 2
**Related GDD:** [01](../../gdd/01-world.md) (Decided, "Fog of war"), [02](../../gdd/02-creeps-and-domination.md)
(sight per DNA), [07](../../gdd/07-autopilot.md) (autopilot by what the team knows, the "explore" action) ·
**ADR:** [0006](../../adr/0006-world-sync.md) (`Accepted`) · **Previous slice:** [network](../m1.5-network/spec.md)

## 1. Hypothesis

> Hiding information creates interesting decisions (exploring, protecting routes) **without making the map
> unreadable**.

This slice changes gameplay on purpose: each team sees only what its core and its own creeps see, and remembers what
it has seen. It answers:
1. Does the player understand what they see, what they remember and what they do not know? (readability playtest)
2. With no deposit guaranteed in sight, does the start of the match work for both teams, on any seed?
3. Do the network and the server stay within the network slice's targets with the filtered view and the memory?

## 2. What the owner decided (GDD, 2026-11-14)

A summary; the source is the GDD.

| Topic | Decision |
|---|---|
| Who gives sight | The core (radius 8) and each creep, by DNA: circle 6, triangle 4, square 3. Manhattan radius. Provisional |
| Map at the start | Black fog: outside sight, nothing is known (terrain, deposits, the enemy core) |
| Of the enemy, in sight | Creeps (position, DNA, load), roads and road jobs. Never stock, production, upgrades, rules or orders |
| Team memory | Deposits with the last value seen; roads and jobs seen; explored terrain and the enemy core once seen. Enemy creeps disappear out of sight |
| Screen | Three states: never seen (black), remembered (dimmed, last value), visible now |
| Paths | By what the team knows: a never-seen cell counts as passable jungle; recompute on discovering rock or river |
| Autopilot | Conditions and deposit choice use only sight + memory; a new "explore" action (nearest never-seen cell); no deposit guaranteed in sight |

## 3. Scope decisions this spec assumes

Accepted by the owner with the spec (2026-11-14). Those marked **(gameplay)** complete the GDD and are in it (01 and
07). In D1 the owner chose line of sight, instead of the original proposal (no blocking).

| # | Decision | Default | Why |
|---|---|---|---|
| D1 | Line of sight **(gameplay)** | **Rocks block.** Visible = a cell within `r` (Manhattan) of the core or of a team creep, with no rock between the two; the rock itself is seen. River and fords do not block. The line algorithm (integers only, equivalent for both teams on the mirrored map) is left to the plan | The owner's choice: rocks become cover, which serves the M2 ambush. Costs more rules and CPU |
| D2 | When sight is measured | At the end of each tick, after movement and the economy. Memory is updated then, and the next tick's autopilot decides by it | A single reading per tick, the same for the network, the bot and the autopilot |
| D3 | How creeps start exploring **(gameplay)** | Both: (a) the gatherer preset gains an "explore" rule right after "gather", valid only when the team knows no deposit with the resource; (b) a new **scout** preset (explore only; when nothing is left to explore, stops at the core) | GDD 07 open question. (a) makes the start work on its own, even offline; (b) gives the player the explicit role the circle (radius 6) asks for |
| D4 | The "explore" target **(gameplay)** | The never-seen cell nearest the creep **in steps over the known map** (a never-seen cell counts as passable; adjusted by plan N4, instead of Manhattan) that no other team creep already targets for exploration; among equally near ones, **the one that would reveal the most never-seen cells within the creep's sight radius** (owner, 2026-11-14, at the F5 checkpoint; plan §10); remaining ties by the lowest index **in the team's frame** (as paths do, `isRotatedSide`) | Without the exclusion, the 6 starting creeps walk in a pack to the same cell. Without the gain, the index tie-break walks the creep sideways along the edge of the dark, one line of sight at a time. The team's frame keeps both sides equivalent on the mirrored map |
| D5 | Roads in the dark | `buildRoad` follows the path rule: the route is computed from what the team knows (known roads and explored terrain); a segment that turns out to be rock or river makes the route recompute | "No order reveals hidden terrain" (GDD 01) |
| D6 | Commands about the unknown | `moveTo` and `buildRoad` to a never-seen cell are accepted. A command citing a deposit or creep the team does not know is refused **with the same refusal** as a nonexistent id | Accepting or refusing must not reveal anything |
| D7 | The enemy in sight | Per enemy creep: `id`, `team`, `dna`, `x`, `y`, `cargo`. Of the enemy team: only the `id` and, once seen, the core position. Enemy road jobs whole (position, team and time left) | GDD 01; orders, rules, domination and activity stay out |
| D8 | The enemy's roster | The player list (name, team, bot or not) stays visible to all, as in the lobby; who dominates which enemy creep does not | Already public in the lobby and the world list |
| D9 | Hidden seed | While the world has not ended, the seed (and the `mapSeed`) does not leave the server: it disappears from the world list and the `welcome` | With the seed and the params, the client (which embeds the `sim`) would regenerate the whole map and void the black fog |
| D10 | Replay | The replay export (`GET /api/worlds/:id/replay`) only works for finished worlds. The replay still shows the whole state, of both teams | During the world, the log reveals everything; afterwards, the full view is what one wants to review |
| D11 | Ids | Ids stay global (one counter for everything); a team sees the enemy creep's id, which lets it guess how many entities exist | Per-team ids cost without gain in M1.5; leak accepted |
| D12 | What changes on purpose | `SIM_VERSION` 3, a new protocol version, and the fixed hashes (3 days of seed 42; 6 h of `bot-world.test.ts`) change | New gameplay; old snapshots and replays become invalid (ADR-0004) |

## 4. Scope

### In
- **`sim`:** radius sight with line of sight (D1, D2); team memory in the `WorldState`; the filtered team view (enemy,
  memory, explored terrain); paths and roads by what the team knows (D5); autopilot by what the team knows; the
  "explore" action (D4) and the presets (D3); refusals that do not leak (D6); radius parameters.
- **Bot strategist:** decides only from the view, which now includes the explored terrain (not the full static map),
  and uses the presets with exploration.
- **Protocol:** the `welcome` no longer carries the whole terrain nor the seed (D9); the explored terrain enters the
  view and the delta.
- **Server:** seed hidden from the world list (D9); replay only for finished worlds (D10).
- **Client:** the three states on screen; the enemy only as the view shows it (D7); no enemy team data in the panels;
  road cost and route under the cursor only by what the team knows; the scout preset in the rules panel.
- **Harness:** exploration and match-start metrics (section 7); `geo net` and `npm run soak` again.
- **Readability playtest:** fog questions in [PLAYTEST.md](../../PLAYTEST.md).

### Out
Structures or roads that give sight; per-team sight in the replay; minimap; memory age on screen ("seen X min ago");
a deposit guaranteed in sight; changing DNA speed or capacity; battle, ambush and death (M2); deploy.

## 5. Behavior

Format: *When [trigger], the system shall [response].*

### Sight and memory (`sim`)
- **V-1** At the end of each tick, a cell shall be **visible** to the team when it is within the core radius (8) of
  its core or within the DNA radius of one of its creeps (Manhattan), with no rock on the line between them (D1). A
  rock cell is seen, but hides what is behind it. Radii in the params.
- **V-2** When a cell becomes visible, the team shall know its terrain forever (explored).
- **V-3** When a deposit is on a visible cell, the team memory shall keep the deposit with its current amount. Out of
  sight, memory keeps the last value seen.
- **V-4** When a cell with a road becomes visible, memory shall keep the road. Roads never disappear.
- **V-5** When a visible cell has a road job, memory shall keep it as it is; when a visible cell no longer has a
  remembered job, memory shall forget it.
- **V-6** When the enemy core becomes visible, memory shall keep its position forever.
- **V-7** The team's own creeps, roads, jobs and core shall always be in its view.
- **V-8** An enemy creep shall appear in the view only while on a visible cell, and only with the D7 fields.
- **V-9** The view shall remain a pure function of the state and the team (network spec, V-1); everything it shows of
  what is not visible comes from the team memory, which is part of the state.

### Paths, roads and commands (`sim`)
- **P-1** When a creep computes a path, cells never seen by the team shall count as passable jungle, and roads as the
  ones the team knows.
- **P-2** When the next cell of the path turns out impassable (rock or river without a ford), the creep shall
  recompute the path in the same tick, with what the team knows now.
- **P-3** `buildRoad` shall route and choose the next segment by what the team knows (D5).
- **P-4** A command citing a deposit or a creep the team does not know shall be refused with the nonexistent-id
  refusal (D6). `moveTo` and `buildRoad` to a never-seen cell shall be accepted.

### Autopilot (`sim`)
- **A-1** The `resourceInRange` condition and the `gather` deposit choice shall consider only deposits in the team
  memory, with the remembered amount.
- **A-2** When the creep reaches the chosen deposit and sees it empty (and not regenerating, for cristal), memory
  corrects itself and the rule decides again on the next tick, as today.
- **A-3** The **explore** action shall become the order to go to the D4 cell; it is impossible when no reachable
  never-seen cell remains.
- **A-4** The gatherer preset shall be `deliver if full → gather → explore (only with no known deposit of the
  resource) → deliver the rest`; the **scout** preset, `explore → return to the core` (D3).
- **A-5** Creeps are still born with the materia gatherer preset.

### Bots
- **B-1** The strategist shall decide only from the team view (not the full static map) and emit the same commands as
  a human.
- **B-2** A 3-day bot × bot world shall reach the end without errors, with both teams delivering materia.

### Network and server
- **N-1** The `welcome` shall not carry the whole terrain, nor the seed (D9); only the map dimensions, the params and
  the team view, which brings the explored terrain.
- **N-2** The delta shall carry the newly explored cells, with their terrain.
- **N-3** The network slice's property test (`patch(previous, diff) = new`, every tick, both teams) shall stay green
  with fog.
- **N-4** The world list shall not show the seed of a running world; the replay of a running world shall be refused
  (D10).

### Client
- **C-1** The map shall show the three states: never seen in black, remembered dimmed (with the last value) and
  visible normally.
- **C-2** No panel shall show the enemy team's stock, production, upgrades, rules or orders.
- **C-3** Road cost and route under the cursor shall use only what the team knows; over a never-seen cell, the cursor
  shows no terrain.
- **C-4** The rules panel shall offer the scout preset and the explore action.
- **C-5** The replay (finished world) still shows the whole state.

## 6. Initial parameters (guesses, made to be broken)

Balancing, in the `sim` params (`schema`, `default.json` and `test/params.json`):

| Parameter | Guess |
|---|---|
| Core sight radius | 8 |
| Circle / triangle / square sight radius | 6 / 4 / 3 |

## 7. Harness and acceptance criteria

The targets are provisional guesses. When one fails, the owner decides at the checkpoint (e.g. going back to the
GDD 01 "deposit guaranteed in sight" option).

| Criterion | Target | How it is measured |
|---|---|---|
| Match start | On every seed 1 to 20, both teams deliver their first materia within 30 world minutes | Harness: 6 h bot × bot per seed; time to first delivery per team |
| Team equivalence | Difference in time to first delivery and in materia delivered in 6 h between teams, per seed, in the report | Same run |
| Economy | Materia and cristal delivered in 3 days (seed 42) in the report, side by side with the pre-fog run | `geo sim`; the owner judges at the checkpoint |
| Exploration | % of the map explored per team over the world, in the report | Same run |
| Determinism | 2 runs and snapshot → restore give the same hash, with fog | `geo verify` in CI |
| Diff correctness | Property test green (N-3) | CI, seeds 1, 42, 649 |
| Bandwidth and CPU | The [network spec §7](../m1.5-network/spec.md) targets (≤ 2 KB/s per client; view + diff ≤ 0.25 ms per world per send, median) | `geo net --seed 42 --days 3` |
| Tick cost | The fog tick costs at most twice the tick without fog | Harness, average time per tick over the 3-day world |
| No divergence | 0 divergent hashes; each client's final view equal to the server's | `npm run soak` |
| Line of sight | Text test maps: what is behind a rock is not seen; the rock is; river does not block; the result is the same for both teams in mirrored positions | `sim` test |
| Nothing leaks | A team's view has no field beyond D7 nor any entity out of sight or memory | `sim` test with a hand-built world |

**New metrics in the harness report:** time to first delivery of each resource, per team; % of the map explored per
team over time; time to see the enemy core; creeps on "explore" over time.

## 8. Test protocol

1. **Tests** (`sim`, `protocol`, `server`, `client`): radius sight and line of sight, memory, paths and roads in the
   dark, explore and the presets, refusals without leaks, the enemy filter, `welcome` without terrain or seed, replay
   refused on a live world.
2. **Harness:** seeds 1 to 20 (6 h) and the 3-day world of seed 42, with the section 7 metrics; `geo net`.
3. **Soak:** the full `npm run soak`.
4. **The owner's session (readability):** `npm run dev:multi -- --clients 3` with both teams, with the fog questions
   of [PLAYTEST.md](../../PLAYTEST.md) (e.g. "where is the enemy now?", "what is the dimmed area?", "why did that
   creep go there?").

### Criteria to close M1.5
- Section 7 criteria green, or the owner decides what to do with what failed.
- The owner answers the hypothesis at the readability session checkpoint.

## 9. Prerequisites before the `plan.md`

- The owner's acceptance of D1–D12 ✅ (2026-11-14); the gameplay ones (D1, D3, D4) are in the GDD.
- No new ADR expected: fog is the per-team view [ADR-0006](../../adr/0006-world-sync.md) already assumes.

## 10. Open questions

None.

## 11. F6 — Playtest adjustments (owner, 2026-11-14)

Findings from the owner's session 2. The owner decided the rules (E1, E2) and what the cursor signals (E4), and put
the phase in M1.5, before closing it. **Validated at the F6 checkpoint (owner, 2026-11-14)**, which closed M1.5
([plan §10](plan.md)).

| # | Finding | Decision |
|---|---|---|
| E1 | Materia gatherers compete for the deposit nearest the core and wait for regeneration one by one | **(gameplay, GDD 07)** The gatherer picks the non-empty deposit it reaches fastest (travel time over the known map, with roads). With the deposit empty, **it only waits if it pays**: it compares the time to wait for a full load with the time to walk to the nearest known deposit with enough materia, and goes if walking is faster |
| E2 | Cristal is depleted in 8.6 h out of 72 | **(gameplay, GDD 03)** A gathering rate per resource; cristal slower (guess: 1 unit every 5 s). The value is measured before being fixed |
| E3 | Zoomed out, a click on an overlapping "ball" does not select what one wants | A click area with a minimum in screen pixels; if the click clearly falls on one creep, select it; if on several, open their list (like a cell's stack) |
| E4 | No feedback on which action the click will produce | A cursor with an icon for: the dominated creep's orders (gather, deliver, walk), road mode (red without stock), select (over something selectable) and pick on the map (crosshair) |
