# M2 spec — The encounter

**Status:** Done (2026-11-17) · **Date:** 2026-11-15 · **Milestone:** M2 — The ambush ([ROADMAP](../../ROADMAP.md)), slice A
**Related GDD:** [01](../../gdd/01-world.md) (the enemy in sight), [02](../../gdd/02-creeps-and-domination.md)
(HP, death, name), [03](../../gdd/03-economy-and-logistics.md) (extortion, loot, spoils),
[06](../../gdd/06-battles.md) (encounter, safe-conduct, escape, throwaway roll),
[07](../../gdd/07-autopilot.md) (stances), [08](../../gdd/08-chronicle-chat-and-console.md) (chronicle) ·
**ADR:** [0007](../../adr/0007-sim-events.md) (`sim` events, `Accepted`)

## 1. Hypothesis

> Does the battle change the course of the world without dominating the game? (ROADMAP, M2)

This slice answers the world's part, **before combat exists**: the fight is still resolved by a throwaway roll
(GDD 06). It asks:

1. **Does the encounter create conflict and story?** Approaching, extorting, paying, refusing and fleeing are
   decisions the player feels and understands through the chronicle, without looking at the state.
2. **Does the encounter change what the player does?** Routes, escort, which DNA carries cristal, the autopilot
   stances. That is the "changes the course of the world" signal.
3. **Without dominating the game:** in a bot × bot world, encounters happen often enough to matter, and no team
   collapses by snowballing.
4. The network, the server and determinism stay within the M1.5 targets, now with death, HP and events.

This is M2's first slice. After it come the battle lab (B) and the junction (D), where the real battle replaces the
roll (see the [ROADMAP](../../ROADMAP.md)).

## 2. What the owner already decided (GDD, 2026-11-15)

A summary; the source is the GDD. Includes this spec's decisions (§3), already recorded in the GDD.

| Topic | Decision |
|---|---|
| Encounter | An approach with dialogue. The aggressor picks **attack** or **extort** in the approach order and chases the target. On attack, it declares the aggression and the victim fights or tries to flee; on extortion, the victim **pays**, **refuses** (fights) or **flees** |
| The fight until the junction | A **throwaway roll** nobody balances. Each future combat rule will have its own escape mechanic |
| Who wins | Level, stats, skills and micro, not DNA or load alone. In M2, only base stats per DNA |
| Safe-conduct | After paying: immune only to new approaches from the team that extorted, for a while or until reaching its own core zone; lost on approaching someone. The same aggressor does not extort the same creep again for a while |
| Escape | Fleeing is not easy: the chance comes from relative speed (DNA, load, terrain). Whoever escapes drops 50% to 100% of the purse in a spoils pile and runs |
| Loot and spoils | Without an escape, the winner takes the dead's load; what does not fit becomes **spoils**, a pile any creep can pick up |
| HP | Persists in the world and regenerates slowly, faster near the core |
| Death | Permanent; the dead creep's domination ends |
| Chronicle | Dialogues and events appear as text in the match, for players and bots. No LLM |

## 3. Scope decisions this spec assumes

**Accepted by the owner in the interactive round of 2026-11-15**, with the spec. Those marked **(gameplay)** complete
the GDD and are in it. The numbers are in §6 and are guesses.

| # | Decision | Default | Why |
|---|---|---|---|
| D1 | Name in the state **(gameplay)** | The creep gets its name at birth, in the `sim`, from the 179-word list that used to live in the client, by the same rule (birth order, consecutive births with distant names, a "II" suffix when the list runs out). **No rename command** in this slice | GDD 02 asks for the name in the state in M2: with death, a name generated from the order would change. The chronicle needs stable names |
| D2 | Base stats: HP only **(gameplay)** | Each DNA gets a max `hp` and a **fight weight** in the params (D7). Damage, range and battle speed are left to the lab (B), where they matter | The roll uses neither damage nor range; adding those numbers now would balance something nobody uses |
| D3 | HP regeneration **(gameplay)** | In ‰ of max HP per world minute, the same for the three DNAs: slow on the map, faster within a radius of one's own core. No regeneration during an encounter or a fight | GDD 02 ("faster near the core"). In ‰, one DNA does not heal faster than another just for having less HP |
| D4 | Death and domination **(gameplay)** | At HP 0 the creep leaves the state; its load becomes loot or spoils (D11). If it was dominated, **the domination ends**, like a `release`, with no cooldown | Answers the GDD 02 open question |
| D5 | Approach **(gameplay)** | A new `approach` order, with the intent already chosen (**attack** or **extort**): the creep enters chase mode and walks to an enemy creep the team sees, recomputing the path when the target changes cell. The encounter opens when both are within the encounter radius (Manhattan). If the target leaves the team's sight, the order ends | Owner: the intent goes in the order, and the order makes the creep chase the target. Works the same for the human and the autopilot |
| D6 | The dialogue and the window **(gameplay)** | **1 × 1 only** in this slice. A creep is in at most one encounter or fight, and cannot be approached meanwhile. **Even the attack opens with a dialogue:** the aggressor declares the aggression and the victim reacts (fight or try to flee). On extortion, the victim pays, refuses or tries to flee. **A free creep reacts at once**, by its autopilot rules (D13); **a dominated one** gets a window in world seconds for the player to answer, and without an answer its rules apply. Both stand still during the window | Owner: the attack also confirms the aggression in a dialogue before the fight. More than two sides and joining mid-fight are the junction's (D). In a compressed playtest the window is short: encounter sessions run at ×6 (§8) |
| D7 | The throwaway roll **(gameplay, provisional)** | The fight is a series of rounds, one every N world seconds, with both standing still. Each round, `state.rng` picks who hits, each one's chance **proportional to (current HP ÷ max HP) × DNA weight** (params; equal for the three at first). The hit takes a fixed fraction of the **max** HP of whoever is hit. The fight ends when one of them dies or flees (D10) | Owner: the hit relative to DNA, stats and HP. In this slice the only stat is HP; the DNA weight is ready to tune without code changes. Whoever enters wounded loses more: persistent HP matters. The lab (B) and the junction (D) replace the roll |
| D8 | Extortion **(gameplay)** | The demand is **the victim's load up to the aggressor's free capacity**, cristal first. An empty victim, or a full aggressor, cannot extort. Paying moves the demand from the victim's load to the aggressor's | Gives the "amount relative to DNA" with no new number: the square extorts a lot and is slow; the circle extorts little and catches up. Cristal first because it is what is worth ambushing (GDD 03) |
| D9 | Safe-conduct **(gameplay)** | Immune to approaches from the team that extorted, for a while or **until entering its own core zone** (a radius). Lost on approaching someone. The aggressor–victim pair cannot repeat the extortion for a longer while | Owner, instead of "until its own road network": a finished road is neutral and does not protect its builder |
| D10 | Escape **(gameplay, provisional)** | Valid at three moments: answering an attack, answering an extortion and in the middle of a fight. The **escape chance** is `v_fleeing ÷ (v_fleeing + v_opponent)`, with the speed the `sim` already computes for each on its current cell and with its current load (DNA, loaded, ford, road). **Failed:** drops nothing and the fight starts, or goes on. **Escaped:** drops a fraction rolled by `state.rng`, per resource, between a minimum and 100% of the load, in a spoils pile on its own cell, and runs for the core with a speed bonus for a while. While fleeing, it can be approached to attack, but not extorted; if the aggressor catches it, the encounter opens straight into the fight | Owner: within combat, fleeing should not be easy (a square loaded to the brim, alone, far from a road or crossing the ford almost never escapes), and not every escape loses 100% of the purse, without going easy on the one who flees. This is the roll's escape; each future combat rule will have its own |
| D11 | Loot and spoils **(gameplay)** | The winner collects the dead's load up to its free capacity, cristal first; the rest becomes spoils on the dead's cell. Spoils on the same cell add up. Spoils **do not expire** in this slice. A new `pickup` order and a "pick up spoils" action: picks up at once, up to free capacity. Spoils enter the team's view and memory like a deposit (last value seen) | GDD 03. Expiring would be a sink, but it is a new rule; left for the balancing round, if the map fills up with spoils |
| D12 | Mutual encounter **(gameplay)** | When both approach each other in the same tick, the one **not in the river or on a ford** chooses first, then the one with **less relative load** (load ÷ capacity); remaining ties by `state.rng`. Never by id | The owner's idea. The id breaks the mirror between teams (fog F6) |
| D13 | Autopilot stances **(gameplay)** | New vocabulary. Condition **enemy in sight** (radius, DNA, minimum load). Actions **approach** (attack or extort the nearest enemy in sight that passes the filter) and **pick up spoils**. **Reaction rules**, evaluated only in the encounter and the fight: conditions **demand up to X‰ of the load** and **HP below X‰**; actions **pay**, **fight** and **flee**. With no applicable reaction rule: **pays** the extortion, **tries to flee** the attack and, **mid-fight, keeps fighting** | The GDD 07 "encounter stances" proposal. Almost every encounter happens with no human watching. The defaults preserve the creep of someone who configured nothing |
| D14 | Presets **(gameplay)** | The gatherers use the D13 defaults. A new preset, **raider**: extort a loaded enemy in sight → pick up spoils in sight → deliver if full → explore; fights when attacked; flees with HP below a threshold | The player needs a one-click way to start ambushing, as the scout gave for exploring |
| D15 | Bots | The strategist makes a fraction of its creeps raiders (§6) | Without a bot that approaches, the owner's solo session has no conflict |
| D16 | `sim` events | `step` emits **structured events** (who, what, how much), outside the state and the hash. Replay and recovery recompute them, like the rest. A new contract: ADR-0007 | The `sim` emitted no events, and the chronicle needs them. Outside the state, the snapshot does not grow |
| D17 | Chronicle **(gameplay)** | The client narrates the events with sentence templates (in Portuguese, the language of the first playtesters), with **the voice by DNA** and the variant picked by a number of the event itself (everyone reads the same sentence). Encounters (with the aggressor's declaration), escapes, fights, deaths, loot and births go in. A team sees an event in which one of its creeps takes part or that happens in its sight. The text lives outside the `sim`. **The agent writes the initial bank and the owner reviews the tone at the checkpoint** | GDD 08. The text changes without bumping `SIM_VERSION` |
| D18 | The enemy in sight **(gameplay)** | An enemy creep in sight also shows its **name**, **HP** and whether it is in an encounter or a fight | Wounded, it becomes a target (GDD 02), and the player needs to see that to pick the victim |
| D19 | Commands about the unknown | Approaching a creep the team does not see, or picking up spoils it does not know, is refused with the nonexistent-id refusal | The fog spec's D6 rule |
| D20 | What changes on purpose | `SIM_VERSION` 6, `PROTOCOL_VERSION` 4, a new command vocabulary (`BREAKING CHANGE`), and the fixed hashes (3 days of seed 42, 6 h of `bot-world.test.ts`) change | New gameplay: old snapshots and replays become invalid (ADR-0004) |
| D21 | No safe zone **(gameplay)** | In this slice nobody is safe near the core. The harness measures whether the bots camp outside the enemy core | Owner: no safe zone for now |

## 4. Scope

### In
- **`sim`:** name at birth (D1); HP, regeneration and death (D2–D4); the `approach` order, the chase, the encounter,
  the dialogue, the window and the reactions (D5, D6, D8); the roll (D7); escape (D10); safe-conduct and the pair
  block (D9); spoils, `pickup` and loot (D11); the mutual encounter (D12); the autopilot vocabulary and the presets
  (D13, D14); events (D16); the view with the new fields and spoils in memory (D11, D18); refusals without leaks
  (D19); the params.
- **Bot strategist:** the raiders (D15).
- **Protocol:** the new commands (approach, react to the encounter, flee the fight, pick up); the team's events in the
  delta; the `welcome` with the recent chronicle entries.
- **Server:** sends each team the events it sees; stores the chronicle so that a reconnecting client, or a restarting
  server, does not lose it (§5, N-2).
- **Client:** HP bar; name from the state; spoils on the map; chase, encounter and fight marks between the two
  creeps; the chronicle panel; a reaction panel for the dominated creep (fight or flee on attack; pay, refuse or flee
  on extortion; with the time left); a flee button mid-fight; right-clicking an enemy with the choice attack or
  extort; inspector with HP, safe-conduct and encounter state; the rules editor with the new conditions, actions and
  preset; the replay with the chronicle.
- **Content:** the initial chronicle sentence bank (D17).
- **Harness:** the new metrics (§7); `geo net` and `npm run soak` again.
- **Playtest:** encounter questions in [PLAYTEST.md](../../PLAYTEST.md).

### Out
Real combat and the battle instance (slices B and D); more than two sides, groups and joining mid-fight (D); the
wanderers, a neutral faction (D); building HP, siege, repair and victory (E); camps, towers and battle terrain from
the surroundings; chat, console and macros; a third action per DNA, temperaments, level, XP and skills; renaming
creeps; spoils that expire; a safe zone (D21); barter between teams; load slowing in proportion to weight (the M1
loaded slowdown stays); the depletion and role of cristal, which this slice **measures** but does not decide (§7);
deploy.

## 5. Behavior

Format: *When [trigger], the system shall [response].*

### Identity, HP and death (`sim`)
- **H-1** When a creep is born (in `createWorld` or in production), it shall get a name by the D1 rule and HP equal to
  its DNA's max.
- **H-2** Every tick, a creep out of an encounter and a fight shall recover HP by the D3 rule, up to the max. The core
  zone is a Manhattan radius from the team's core.
- **H-3** When a creep's HP reaches 0, it shall leave the state in the same tick, with its load handled by D11 and its
  domination ended (D4). The id is never reused.

### Approach and dialogue (`sim`)
- **E-1** The `approach` order (from the dominating player or the autopilot) shall be accepted only for an enemy creep
  the team sees now, with intent `attack` or `extort`. Otherwise, it is refused by the D19 rule.
- **E-2** While the target stays in sight, the creep shall chase it, recomputing the path when the target changes
  cell. When the target leaves sight, the order shall end.
- **E-3** When the aggressor and the target are within the encounter radius, the target is free (no encounter or
  fight) and has no safe-conduct against the aggressor's team, the encounter shall open: both stop and the
  declaration event is emitted.
- **E-4** With intent `attack`, the victim reacts: **fight** (the fight starts) or **flee** (D10). A free creep reacts
  in the same tick, by its reaction rules; a dominated one, until the end of the window, and without an answer its
  rules apply. With no applicable rule, it tries to flee (D13).
- **E-5** With intent `extort`, the demand is computed by D8. With a demand of 0 (empty victim or full aggressor), the
  action is impossible: the order ends and the autopilot decides again. Otherwise the victim reacts as in E-4, among
  **pay**, **refuse** and **flee**; with no applicable rule, it pays.
- **E-6** **Paying** shall move the demand to the aggressor, give the victim the safe-conduct and block the pair (D9),
  and close the encounter.
- **E-7** **Refusing** shall start the fight.
- **E-8** The safe-conduct shall end by time, on entering one's own core zone, or when the creep opens an encounter as
  the aggressor.
- **E-9** In a mutual encounter, who chooses first is decided by D12. The other becomes the victim.

### Escape (`sim`)
- **F-1** When a creep tries to flee (a reaction to an attack or extortion, a reaction rule or the mid-fight button),
  `state.rng` shall decide whether it escapes, with the D10 chance.
- **F-2** If it escapes, it shall drop in the spoils the rolled fraction of each resource (D10) and run for the core
  with the speed bonus, until the bonus ends; the encounter or the fight closes.
- **F-3** If it does not escape, it drops nothing: on a reaction, the fight starts; mid-fight, the round goes on
  normally.
- **F-4** A fleeing creep cannot be extorted. If an attack approach catches it, the fight starts with no dialogue.

### Fight (`sim`)
- **L-1** Each round (D7), both creeps' reaction rules shall be evaluated (flee below some HP, for instance); then, if
  nobody escaped, `state.rng` shall pick who hits, with the D7 chance, and the hit shall take the fraction of the max
  HP of whoever is hit. Fights are resolved in id order, and the order of `rng` calls is fixed.
- **L-2** When one of the two dies, the other shall collect the loot and the rest becomes spoils (D11), and the fight
  ends.
- **L-3** During the fight, neither walks, gathers, delivers or receives an order that changes that, except fleeing.
  Domination may start or end.

### Spoils (`sim`)
- **S-1** When a creep with a `pickup` order reaches the spoils' cell, it shall take what fits, cristal first; empty
  spoils shall leave the state.

### Autopilot and bots (`sim`)
- **A-1** The new conditions and actions (D13) shall decide only by what the team knows (sight and memory), like the
  rest of the autopilot.
- **A-2** Reaction rules shall only be evaluated during an encounter or a fight; the other rules, only outside them.
- **A-3** The gatherer presets shall follow the D13 defaults, and the raider preset shall exist (D14).
- **B-1** The strategist shall keep a fraction of raiders (D15), with the same commands as a human.
- **B-2** A 3-day bot × bot world shall reach the end without errors, with both teams still having creeps and
  delivering materia.

### Events and chronicle
- **K-1** Each declaration, reaction, escape attempt, fight end, death, loot, spoils pickup and birth shall emit a
  structured event (D16), in the same order on any run.
- **K-2** A team shall receive only the events in which one of its creeps takes part or that happen on a cell visible
  to it in that tick.
- **K-3** The same event shall become the same sentence on any client and in the replay (D17).

### Network and server
- **N-1** Each team's delta shall carry the new events the team sees; the `welcome`, the team's latest chronicle
  entries (amount in §6).
- **N-2** After a server restart, each team's chronicle shall keep at least the latest entries (N-1), the same as
  before the restart.
- **N-3** The diff property test (every tick, both teams) shall stay green with death, HP and spoils.

### Client
- **C-1** Each creep shall show the HP bar when not full; the enemy in sight too (D18).
- **C-2** Spoils shall appear on the map, remembered under the veil like a deposit.
- **C-3** The chase, the encounter, the escape and the fight shall be readable on the map: who chases whom, the demand
  and the rounds.
- **C-4** The chronicle panel shall show the team's sentences, newest on top, with clickable creep names (selects the
  creep, if it still exists and is in sight).
- **C-5** When the dominated creep is approached, the reaction panel shall open with the intent, the demand (on
  extortion), the choices and the time left in world seconds; mid-fight, the flee button.
- **C-6** Right-clicking an enemy in sight, with a dominated creep, shall offer attack or extort; extortion shows the
  demand before confirming.
- **C-7** The rules editor shall offer the new conditions, actions and preset; the inspector, the HP, the name, the
  safe-conduct and the encounter state.

## 6. Initial parameters (guesses, made to be broken)

Balancing in the `sim` params (`schema`, `default.json` and `test/params.json`), unless noted.

| Parameter | Guess |
|---|---|
| Max HP of square / triangle / circle | 300 / 200 / 120 (in this slice, only the bar uses them) |
| Fight weight of square / triangle / circle | 1,000 / 1,000 / 1,000 (‰; equal at first) |
| Regeneration on the map / in the core zone | 10‰ / 100‰ of max per minute (0 to full in 100 min / 10 min) |
| Core zone radius (regeneration and safe-conduct) | 8 (the core's sight radius) |
| Encounter radius | 1 |
| Reaction window of a dominated creep | 60 world seconds |
| Roll round | every 10 world seconds; a hit of 250‰ of max HP (from full, 4 hits kill) |
| Escape | drop 500‰ to 1,000‰ of each resource; 1,500‰ speed for 60 world seconds |
| Safe-conduct | 600 world seconds |
| Aggressor–victim pair block | 1,800 world seconds |
| HP threshold to flee, in the raider preset | 400‰ (rule data, not a param) |
| Minimum target load, in the raider preset | 1 until F5; **10** since F6 (owner, 2026-11-17; plan §11.1, C11), rule data, not a param |
| Bot raiders | 1 in every 6 creeps (a strategist constant, not a game one) |
| Chronicle entries in the `welcome` | 100 (a server constant) |

## 7. Harness and acceptance criteria

The targets are guesses. When one fails, the owner decides at the checkpoint.

| Criterion | Target | How it is measured |
|---|---|---|
| Encounters happen | In the report: encounters per team and per world hour, and the split between paid, fought, refused and fled (escaped or not). The owner judges whether the frequency matters | `geo sim` 3 days (seed 42) and `geo sweep` 6 h (seeds 1–20) |
| No snowball | On every seed, both teams end with creeps and delivering materia (B-2); the population and delivered-materia gap between teams goes into the report | Same runs |
| Camping | Encounters within the victim's core zone radius, per team (D21) | Same runs |
| Economy | Materia and cristal delivered, deaths, loot and extortion per team, side by side with fog F6 (`b64579c3…`) | `geo sim`; the owner judges |
| Cristal | When the map's cristal is depleted and how much sits idle in stock, against F6 (9.7 h; 68%) | Same run. The decision is left for the balancing round |
| Determinism | 2 runs and snapshot → restore give the same hash, with fights, escapes and deaths | `geo verify` in CI |
| Diff correctness | Property test green (N-3) | CI, seeds 1, 42, 649 |
| Bandwidth and CPU | The [network spec §7](../m1.5-network/spec.md) targets, with the events | `geo net --seed 42 --days 3` |
| Tick cost | At most 1.5× that of fog F6 (`geo sim` 3 days, 13–14 s) | Harness |
| No divergence | 0 divergent hashes; each client's final view and chronicle equal to the server's | `npm run soak` |
| Nothing leaks | A team's view and events have no creep, spoils or event outside its sight or memory | `sim` test with a hand-built world |
| Rules | Each §5 rule with a `sim` test, on text maps | `npm run check` |

**New metrics in the report:** encounters per team (opened as aggressor and as victim) and per outcome; escapes tried
and succeeded, per DNA and per terrain; deaths per team and per DNA; materia and cristal that changed hands by
extortion, loot and spoils; spoils created, picked up and left on the map; average creep HP over time; population over
time.

## 8. Test protocol

1. **Tests** (`sim`, `protocol`, `server`, `client`): the §5 rules; the roll and escape with a fixed `rng`; the escape
   chance of a loaded square on a ford against a circle; the mutual encounter on both sides of a mirrored map;
   nothing leaks.
2. **Harness:** seeds 1 to 20 (6 h) and the 3-day world of seed 42, with the §7 metrics; `geo net`.
3. **Soak:** the full `npm run soak`.
4. **The owner's session:** `npm run dev:multi` against the bot, **at ×6** (the 60 s window lasts 10 real seconds),
   with encounter questions in the PLAYTEST (e.g. "what happened to that creep?", "why did it pay?", "what did you
   change after the first ambush?"). The owner also reviews the chronicle's tone (D17).

### Criteria to close the slice
- §7 criteria green, or the owner decides what to do with what failed.
- The owner answers hypothesis questions 1 to 3 at the session checkpoint.

## 9. Prerequisites before the `plan.md`

- The owner's acceptance of D1–D21 ✅ (2026-11-15); the gameplay ones are in the GDD (01, 02, 03, 06, 07, 08).
- **ADR-0007 — `sim` events** ✅ `Accepted` (2026-11-15).
- The roll is throwaway and needs no ADR. The world ↔ battle contract (ADR-0001 with joining mid-fight) belongs to
  slice D.

## 10. Open questions

None.
