# M2 spec — Rebalance and pace

**Status:** Draft · **Date:** 2026-11-25 · **Milestone:** M2 — The ambush ([ROADMAP](../../ROADMAP.md)), slice R
**Related GDD:** [01](../../gdd/01-world.md) (the pace of the friends' playtest), [03](../../gdd/03-economy-and-logistics.md)
(the snowball, dropping the load), [05](../../gdd/05-tribes-and-diplomacy.md) (the wanderers in the new pace),
[06](../../gdd/06-battles.md) (the opening countdown for humans, the hostile sign, pausing a battle),
[07](../../gdd/07-autopilot.md) (follow, helping an ally, the road builder, the strategist for P and its difficulty) ·
**ADR:** none new expected (§9); [0010](../../adr/0010-world-side-of-the-battle-contract.md) (the paces of a battle)

## 1. Hypothesis

> Does the battle change the course of the world without dominating the game? (ROADMAP, M2)

Checkpoint C2 (junction [tasks](../m2-junction/tasks.md), 2026-11-25) could not answer it: the owner won 9 battles
to 0 against a bot that never sent help and could not replace its losses, the wanderers came late, the map was
explored in 3 of 72 world hours, and a match had no length a group of friends can play. The root was the pace: the
economy was tuned for 72 world hours of bot against bot, and the session covered 4. This slice asks:

1. **Does a match fit one evening?** About 2 real hours from the start to the clock, with an opening, a middle and an
   end the players feel (first extra creep, the map explored, wanderers around, fights that matter late too).
2. **Does the pace alone stop the snowball?** With creeps cheaper in session time, a team that loses fights can
   rebuild, with no new rule (GDD 03).
3. **Do numbers arrive in time?** With "follow", helping an ally and the bot reinforcing, a fight on the map draws
   more creeps, so the risk of an ambush is real (C2 hypothesis questions 1 and 2, unanswered).
4. **Is the bot a real opponent** for humans in co-op, so the friends' playtest has two modes (humans against
   humans, or humans in co-op against the bot)?
5. **Does a human get to their fights and read what their creeps do?** The opening countdown, the pause, the hostile
   sign, the actors' list on a click, the selected creep's destination and the current action's estimated time.

After this slice and E-min and K (and G, groups and formations, if its proposal holds) comes P, the friends'
playtest. R's final balance pass runs after K's merge (ROADMAP).

## 2. What the owner already decided

A summary of the R and E-min design round and of this spec's review (both 2026-11-25); the source is the GDD.

| Topic | Decision |
|---|---|
| The pace (GDD 01) | A match of **about 2 real hours**, by a **shorter world at a moderate ×N** (around ×6 to ×12), not a higher ×N on the 72-hour world. Duration, costs, production, regeneration and the wanderers rescaled in world time; the DNAs walk faster. The numbers, the ×N and the map size come from a **balance pass of sweeps with targets for 2 hours** |
| The snowball (GDD 03) | **Only the rescale of the pace**, no new rule; the sweeps measure whether it is enough |
| The wanderers (GDD 05) | **Early and regular:** the first around 5 real minutes in, then at short intervals, at most 4 alive (numbers set by the sweeps) |
| The opening countdown (GDD 06) | A battle opens **paused for a few real seconds** (5 s, in the params) when some team in it has a human connected, with an alert on the map, the countdown and an **"Entrar"** button that dominates the creep and opens the battle screen. With no human connected, it does not wait |
| Follow (GDD 07) | A creep follows another to walk in a group and **joins the fight by itself** when its target attacks or is attacked. A right click on an ally gives **"Seguir"** (a dominated ally too); when the target dies, the follower goes back to its next rules. The strategist uses it to escort and to attack in a group |
| Helping an ally (GDD 07) | A new condition, **an ally in battle in sight**, with the action to join it, a radius and a posture per DNA, **in the presets by default** for human teams and the bot alike, editable like any rule |
| The road builder (GDD 07) | **An autopilot preset that decides where to build** (the strategist's rule), not a point the player picks; it gathers matéria when the stock is short. With the creep selected, **the map shows the plan**: the path from the core to the deposit, the total cost against what is already paid. A dominated creep still builds where the human chooses |
| The strategist for P (GDD 07) | A real opponent in both modes: it **reinforces fights in sight, defends its core, replaces its losses, attacks in a group with "follow"**, and its posture stops sending every loaded creep fleeing (and stops the triangle always paying) |
| The client (ROADMAP) | The **selected creep's destination on the map** and the **current action's estimated time in the panel** |
| Out (ROADMAP) | Combat stats (slice K), the role of cristal, a sink, the deposit tie-break, the empty-deposit memory, the corridor AI |
| N teams (GDD 01) | Slices R and E-min add **no new two-team assumption** |
| Helping and following with a load (GDD 07, review) | A loaded creep **delivers at the core first when its path there costs less than its path to the fight** (by roads, for instance); otherwise it helps |
| "Seguir…" (GDD 07, review) | The rules editor offers it for a creep that is not dominated |
| Dropping the load (GDD 03, review) | A world order and an autopilot action; it opens new behaviors for the bot |
| The hostile sign (GDD 06, review) | A creep heading for another to attack or extort shows a **red sign** (a sword's silhouette, or similar); the bot can react to it |
| The bot's difficulty (GDD 07, review) | The strategist reacts **by its configured difficulty**, the hardest by default for now, configurable; it **reacts to each encounter** by its difficulty and the action's estimated risk |
| Pausing a battle (GDD 06, review) | A human pauses with **P** after a **3 s countdown**; **any human** resumes with P after another 3 s |
| The actors' list (review) | A left click where creeps stand on a deposit, a core or the like (or near them, zoomed out) **lists every inspectable actor in the click's area**, deposits and cores included |
| Formations (GDD 06, 07, review) | Formation commands, presets and rules in the world and in battle, in the style of Mount & Blade; placed in slice **G** (D29) |

## 3. Scope decisions this spec assumes

Decisions marked **owner** come from the design round or the spec's review (§2). The others are the **agent's proposal**, pending the
owner's acceptance with the spec. Those marked **(gameplay)** complete the GDD and go into it when accepted. The
numbers are in §6 and are guesses.

| # | Decision | Default | Why |
|---|---|---|---|
| D1 | The 2-hour match **(owner; method by the agent)** | The match length is a pair: the world's duration in world seconds and the ×N the world is created with, so that duration ÷ ×N ≈ 2 real hours. The **default params** become the playtest's world (the 72-hour world stays reachable as a params file for the 3-day hypothesis, GDD 01). The lobby's default ×N becomes the chosen one; `dev:multi` too | One world of reference for the sweeps, the server and the playtest; the 3-day hypothesis is not dropped (GDD 01) |
| D2 | The balance pass **(owner; method by the agent)** | Every number that lives in world time is reviewed by sweeps against the §7 targets, which are written in **real minutes at the chosen ×N**: DNA speeds, the map size, creep and road costs, production time, deposit regeneration, HP regeneration, the wanderers' curve, the encounter windows. The sweeps start from the §6 guesses and compare the ×N candidates (6, 8, 12). The chosen set and the runs that chose it are recorded in `tasks.md` | The owner asked for targets, not hand-tuned numbers |
| D3 | Windows a human must react in **(gameplay; agent)** | A window meant for a human's reaction (the extortion answer, `encounter.reactionSeconds`) keeps **at least 10 real seconds** at the chosen ×N; the sweeps do not shorten it. The other durations (flee bonus, safe-conduct, the wanderers' spare time) follow the sweeps | At ×12, today's 60 world seconds are 5 real seconds |
| D4 | The snowball **(owner)** | Only the pace: no catch-up rule, no sink, no income for the losing team. A **recovery scenario** in the harness (§7) measures how long a team that lost most of its creeps takes to rebuild; when it fails the target, the owner decides at the checkpoint | GDD 03 |
| D5 | The wanderers' curve **(owner; shape by the agent)** | The D (junction) curve stays: the first after `firstSeconds`, then an interval shrinking linearly from `start` to `end` over the world's duration, at most `cap` alive; only the numbers move (§6). The band and the behavior stay as slice D left them | Early and regular is a matter of numbers; the behavior was just tuned at slice D (F6) |
| D6 | The opening countdown **(owner; details by the agent)** | When a battle opens and **some team in it has a human player connected**, the battle stays **paused** for `pauseMs` real milliseconds: it does not advance on either clock, and its participants stay locked in the world (junction D3). The world keeps its pace. Each connected player of such a team gets a **map alert** with the countdown and **"Entrar"**. When the pause ends the battle runs with the junction's rules: real time if a human controls a participant with the screen open, the world clock otherwise. The battle's own 3 s countdown (junction T-3) still runs at its start. Only the **opening** pauses; a join does not. A battle that opens with no human connected never pauses (sweeps, bots) | Owner. The world-clock rule of a no-human world stays deterministic (junction T-1) |
| D7 | "Entrar" **(gameplay; agent)** | It dominates **the team's participant with the lowest id that no other player dominates** (a player who already dominates a participant keeps it) and opens the battle screen. With every participant of the team dominated by others, it opens the screen to watch. Pressing it after the pause works the same way (it is the junction's taking over, D12) | One button, no choice to make under a 5-second countdown |
| D8 | Follow as an order and a rule **(gameplay; owner, the vocabulary by the agent)** | A **world order** `follow` (a dominated creep: right click on an allied creep, "Seguir") and an **autopilot action** `follow` with the ally's id (the strategist's escorts and groups). The follower walks to stay within **2 cells** of its target, by the target's path; it does not gather, deliver or pick up while following. When the target is **in a battle**, the follower approaches an enemy participant to attack and joins (junction D6) on its target's side, also when it is dominated (its battle screen opens, junction D11). When the target **opens an encounter** (an attack, or an extortion refused), the follower joins the battle that opens. A follower does not join an extortion's dialogue. When the target dies or leaves the team, the order ends (`stop`) and the rule stops matching (next rules). A creep cannot follow itself, a creep of another team, or a wanderer; following a creep that follows another is allowed, a cycle is refused. A **loaded** follower whose target enters a fight obeys D10's load rule | Owner: walk in a group, join by itself. The order serves the human, the rule the strategist |
| D9 | Follow for an undominated creep **(gameplay; owner, the editor by the agent)** | The rules editor of a selected creep gets **"Seguir…"**: pick an ally on the map, and a `follow` rule goes on top of the creep's rules (after its reaction rules). So a human who dominates one creep can bring others along | Owner (review). Without it, "walk in a group" would need one human per creep |
| D10 | Helping an ally **(gameplay; owner, the rule by the agent)** | A condition `allyInBattle` (an allied creep in a battle whose cell is within `radius` of this creep, in the team's sight) and an action `joinBattle` (approach the nearest enemy participant of that battle to attack, which joins by junction D6). **The posture per DNA** is the rule's radius and an HP floor: the rule goes after an `hpBelow` reaction, so a creep below the floor does not help. Defaults: ■ radius 6, helps above 400‰ HP; ▲ radius 6, above 500‰; ● radius 8, above 500‰ (provisional). **With a load (owner):** the creep compares its path's cost (movement points, roads and load included) to its core and to the battle's cell; when the core costs less it delivers first, and the rule may fire again once it is empty; otherwise it helps, load and all | Owner: in the presets by default; the load rule from the review. A floor stops the wounded from feeding a fight |
| D11 | Where the help rule sits **(gameplay; agent)** | In **every preset** (matéria and cristal collectors, road builder, scout, raider), after the reaction rules and before gathering and delivering; the strategist's rules include it. Creeps born from now on get it with their preset; the rules editor shows and edits it like any rule | Owner: for human teams and the bot alike |
| D12 | The road-builder preset **(gameplay; owner, the vocabulary by the agent)** | The preset takes **no target**: its rule is `buildRoad` with no cell, which the autopilot resolves every time with the strategist's choice (`roadTarget`: the known non-empty deposit nearest the core with no road on its cell and a segment it can build). With no target it gathers matéria and delivers, as the preset already does when the stock is short. The `buildRoad` action with a cell stays in the vocabulary (the rules editor and the human's dominated order) | Owner. One rule for humans and the bot, so the strategist's builder becomes the plain preset |
| D13 | The road plan on the map **(gameplay; owner, the drawing by the agent)** | With a road builder selected (its rule resolved to a target), the map draws the **path from the core to the target deposit** with the road mode's drawing (the cells to pay, those already paid, where it stops), and the panel says the **total cost against what is already paid** ("Estrada até a jazida: 450 de 1.200 matéria pagos"). With no target, the panel says why ("nenhuma jazida conhecida sem estrada") | The road mode's preview already computes it (`road-plan.ts`) |
| D14 | The strategist reinforces and defends **(gameplay; owner, the rules by the agent)** | Its creeps carry the D10 help rule like everyone's. **Defense:** while the team sees an enemy creep inside its core zone, its free creeps inside the core zone get an attack approach on enemies within the core zone's radius on top of their rules; when none is left, their rules go back | Owner: it never helped a fight and lost every creep next to its own core (C2) |
| D15 | The strategist replaces its losses **(gameplay; agent)** | It **produces before buying the upgrade** when its population is below its peak, and keeps producing the scarcest DNA. Nothing else: the cheaper creep is the pace's job (D4) | C2: 110 matéria left, nothing produced |
| D16 | The strategist attacks in a group **(gameplay; owner, the shape by the agent)** | The raider role becomes a **group**: one raider and **2 followers** (D8), from the team's free creeps with the highest HP, formed when the team has at least **8** creeps and can still explore; the followers go back to gathering when their raider dies. **Escort:** a cristal collector gets **1 follower** when the team has at least **10** creeps (numbers provisional, the strategist's settings). The group walks by plain "follow" (D8); its formation comes with slice G (D29) | Owner: escort and attack in a group with "follow" |
| D17 | The bot's posture **(gameplay; owner, the rules by the agent)** | The bot's **static rules** at normal and hard (D26; hard adds D27 on top). Every DNA: **pays an extortion when the demand is at most 250‰ of its load** (`demandAtMost`), **flees as a carrier below 400‰ HP**, and **refuses and fights with its DNA's preset** otherwise. The triangle stops always paying, the circle stops always fleeing. Human teams' presets keep their defaults (junction D2) | Owner: the posture stops sending every loaded creep fleeing; extortion stops being free |
| D18 | The strategist for N teams **(agent)** | Every new strategist rule reads "enemy" as any other team or a wanderer, and "ally" as its own team; no rule assumes one enemy team | GDD 01: no new two-team assumption |
| D19 | The destination on the map **(gameplay; owner, the drawing by the agent)** | For the **selected own creep** (dominated or not), the map draws a line along its path to the order's destination and a marker there: the cell (move, explore), the deposit (gather), the core (deliver, flee), the segment (road), the spoil (pickup), the target creep (approach, follow), the battle (joining). Another team's creep shows none (fog spec D7) | Owner. The order is already in the team view |
| D20 | The estimated time in the panel **(gameplay; owner, the details by the agent)** | The inspector shows the current action's estimate in **real seconds at the world's ×N** ("chega em ~40 s", "cheio em ~1 min 10 s", "trecho em ~25 s"): while walking, the time to arrive; while gathering, the time to fill up; while building, the segment's remaining time (as the map's road-job time). Computed in the client from the path, the speed rules and the params; "~" because others change the world meanwhile | Owner. The human lives in real time; world seconds read wrong at ×8 |
| D21 | Selecting a wanderer **(agent; a C2 finding)** | A left click on a wanderer selects it and the inspector shows what any enemy creep shows (HP, load, "em batalha"), with its destination hidden like an enemy's (D19) | Found at the junction's F7: a wanderer could not be selected. Small, and R makes them common. Alternative: leave it to P |
| D22 | What changes on purpose | `SIM_VERSION` (the vocabulary: `follow`, `allyInBattle`, `joinBattle`, `drop`, `buildRoad` without a cell; the hostile intent in the view; the default params), `PROTOCOL_VERSION` (the `follow` and `drop` orders, the pause command, the pauses and the hostile intent in the view), the fixed hashes; old snapshots and replays become invalid (ADR-0004). `BATTLE_VERSION` should not change (both pauses are outside the battle) | New gameplay and a new default world |
| D23 | The actors' list on a click **(gameplay; owner, details by the agent)** | A left click lists **every inspectable actor in the click's area**: the creeps of any team, the wanderers, the deposit, the core, a spoil, a battle. The area is the one the creeps' pick already uses, which grows as the map zooms out. Each line has its icon and its key reading (a deposit: what is left as the team remembers it; a core: its team, and its stock if it is the player's; a creep: name, DNA, HP, load). One actor alone is selected at once, as today; choosing a line selects it | Owner: with creeps on a deposit or a core, nothing but the creeps could be selected. Today's list holds only creeps |
| D24 | Dropping the load **(gameplay; owner, details by the agent)** | A world order `drop` (a dominated creep: **"Largar carga"** in its panel) and an autopilot action `drop`: the whole load becomes **spoils on the creep's cell** (slice A's spoils: seen through the fog, remembered, picked up by anyone). Refused with an empty load or in a battle (the arena has its own drop). **During an extortion, dropping is a refusal:** the battle opens with the victim empty, and the spoils stay on the world cell for whoever gets there | Owner. A demand on a load that is gone cannot be paid; the case needs a rule |
| D25 | The hostile sign **(gameplay; owner, details by the agent)** | A creep or wanderer with an **attack or extortion approach** (chasing, before the encounter opens) shows a **red sign** over it on the map: a sword's silhouette for an attack, a red purse for an extortion. Every team that sees the aggressor sees the sign; **the target's team also sees a red line** from the aggressor to its creep. **This changes the fog's view** (fog spec D7): another team's creep in sight now shows its hostile intent and its target, where today only an opened encounter shows. The bots read it from their view, like a human (fog spec B-1) | Owner: the target sees the threat coming, and the bot can react |
| D26 | The bot's difficulty **(gameplay; owner, the levels by the agent)** | **Per bot**, chosen when the world is created (the lobby, `dev:multi --bot-difficulty`, the harness's strategist option); **default hard**. The battle's three names: **hard:** the static posture (D17), the encounter reactions (D27), defense, groups and escort, its creeps' battle reaction `hard`; **normal:** the static posture, defense and groups, no D27, battle reaction `normal`; **easy:** slice D's posture (the triangle pays, the circle flees), no defense, groups or escort, battle reaction `easy`. **R tunes hard;** normal and easy are measured, not tuned | Owner: the hardest by default, for now, configurable. The battle already has the three reaction levels |
| D27 | The bot reacts to each encounter **(gameplay; owner, the strategy by the agent)** | At hard, when a creep of the bot is targeted (D25) or an encounter opens on it, the bot decides **on the next world tick**, from its view. **The estimated risk** weighs the enemies near the spot against the bot's creeps that can reach it before the fight is likely over, by DNA and HP (the weights from the junction matrix, in the strategist's settings; the plan writes the formula). **Help is coming** → keep the load, refuse, fight, and send the helper (`follow` or `joinBattle`). **No help, the enemy stronger** → pay a demand of at most 250‰ of the load, otherwise drop (D24) and flee lighter. **No help, even or stronger** → drop and fight with no carry brake, and pick the spoils up afterwards | Owner: a fitting strategy per encounter, by difficulty and estimated risk |
| D28 | Pausing a battle **(gameplay; owner, details by the agent)** | In a real-time battle, a human who **controls a participant** presses **P**: everyone on the battle screen sees a 3 s countdown, then the battle stops (no battle ticks; the world keeps its pace and the participants stay locked, junction D3). **Any human who controls a participant** presses P to resume: 3 s, then it runs. Watchers cannot pause; P during a countdown does nothing; no limit on the number or length of pauses in R (a limit is parked). When no human controls a participant on the screen any more, a paused battle resumes after 3 s on the world clock (junction D13), so no battle freezes forever. The opening pause (D6) and this one are one state of the host. P is already the lab's pause key | Owner. Friends can talk a pause over; a limit can come after P |
| D29 | Formations go to slice G **(agent; scope)** | Not in R: **formations in the world** (the default formation by DNA, the side each DNA engages from), **tactical formations in battle** for humans and the battle bots, and the **battle bot's load experiment** (drop, or hold the load when help is coming, world → battle). They form slice **G — Groups and formations**, proposed after K and before P, lab first, with its own design round (ROADMAP). R's "follow" keeps followers within 2 cells, with no slot | The engaging side changes where a joiner is born in the arena (junction D6); the battle formation is built on K's kits (the triangle's guard shields whoever is behind it). R is already M2's largest slice. Alternative: G after P, with P playing "follow" without formations |

## 4. Scope

### In
- **Params:** the 2-hour default world (D1, D2, §6); `pauseMs` for the opening countdown (D6); the 72-hour world kept
  as a params file.
- **`sim`:** the `follow` order and action (D8), `allyInBattle` and `joinBattle` (D10), `buildRoad` without a cell
  (D12), the presets with the help rule (D11) and the new road builder; the strategist's defense, replacement, groups,
  escort and posture (D14–D18); `drop` (D24); the hostile intent in the view (D25); the bot's difficulty and its
  encounter reactions (D26, D27).
- **Junction and server:** the paused opening (D6) and the humans' pause (D28): the host's third state of a battle,
  the server's decision from the connected humans and their pause commands, recovery of a paused battle (on the world
  clock, as junction N-3); the bot's difficulty stored with the world (D26).
- **Protocol:** the `follow` and `drop` orders; the pause command; the pauses in the battle stub of the view (the
  alert's and the screen's countdowns); the hostile intent in the view (D25).
- **Client:** the alert, the countdown and "Entrar" (D6, D7); "Seguir" in the right-click menu and in the rules
  editor (D8, D9); the road builder without a target and its plan (D12, D13); the destination on the map (D19); the
  estimated time (D20); selecting a wanderer (D21); the actors' list (D23); "Largar carga" (D24); the hostile sign and
  line (D25); P on the battle screen with its countdowns (D28); the lobby's default ×N and the bot's difficulty (D1,
  D26).
- **Harness:** real time in the reports at a given ×N; the §7 targets checked in `geo sim` and `geo sweep`; the
  recovery scenario; the bot's difficulty per team; the strategist's new metrics (help joins, groups, defense,
  payments, drops, its encounter choices); `dev:multi`'s default ×N and `--bot-difficulty`.
- **Playtest:** R's groups in [PLAYTEST.md](../../PLAYTEST.md).
- **The final balance pass after K's merge** (ROADMAP): the §7 sweeps again with the DNA kits, as R's last phase.

### Out
Combat stats and the kits (slice K, except R's final pass on top of them); formations in the world and in battle,
the side a creep engages from, and the battle bot's load experiment (slice G, D29); a limit on pauses; the end of the match, concession and the
end screen (slice E-min); the role of cristal, a sink, the deposit tie-break, the empty-deposit memory (GDD 03, 07);
the corridor AI (GDD 06, parked); who picks up spoils (GDD 07, open); the 72-hour world's balance; the bot filling a
human's empty seat; spectators of other teams, the tunnel and the lobby for friends (P); more than two teams (T);
the soak's memory growth (not investigated, dashboard); translating the UI.

## 5. Behavior

Format: *When [trigger], the system shall [response].*

### Pace (params and harness)
- **PA-1** The default params shall describe a world whose duration at the default ×N is 2 real hours (± 5 minutes).
- **PA-2** `geo sim` and `geo sweep` shall report, for a given ×N, every §7 metric in real minutes beside world time,
  with each target's pass or fail.
- **PA-3** The extortion answer window shall last at least 10 real seconds at the default ×N (D3).

### Opening countdown (junction, server, client)
- **OC-1** When a battle opens and some team in it has a human player connected, the battle shall not advance for
  `pauseMs` real milliseconds, on either clock, while the world keeps its pace (D6).
- **OC-2** When no team in a new battle has a human player connected, the battle shall advance from its opening as in
  junction T-1, with no pause.
- **OC-3** During the pause, each connected player of a team in the battle shall see an alert on the map with the
  countdown and "Entrar"; "Entrar" shall dominate the creep chosen by D7 and open the battle screen.
- **OC-4** When the pause ends, the battle shall take the pace of junction T-1/T-2, and its 3 s countdown shall run.
- **OC-5** A join shall not pause a battle.
- **OC-6** After a server restart, a battle that was paused shall resume on the world clock (junction N-3).

### Follow (`sim`)
- **F-1** A dominated creep given a `follow` order on an allied creep shall walk to stay within 2 cells of it (D8);
  a `follow` rule shall do the same for a free creep while its target lives.
- **F-2** When the target is in a battle, the follower shall approach an enemy participant of it to attack and join on
  its target's side (junction D6), dominated or not.
- **F-3** When the target opens an attack encounter or a battle opens from its extortion, the follower shall join that
  battle when it reaches the bubble.
- **F-4** When the target dies or is no longer of the team, a `follow` order shall end (`stop`) and a `follow` rule
  shall not match.
- **F-5** A `follow` on itself, on another team's creep, on a wanderer, or one that would close a cycle shall be
  refused.
- **F-6** A loaded follower whose target enters a fight shall obey H-4.

### Helping an ally (`sim`)
- **H-1** `allyInBattle` shall hold when a creep of the team is in a battle whose cell is within the rule's radius and
  in the team's sight.
- **H-2** `joinBattle` shall approach the nearest enemy participant of the nearest such battle to attack; reaching the
  bubble shall join it (junction J-1), or wait when the side is full (junction J-3).
- **H-3** Every preset shall carry the D10 rule of its DNA, after the reaction rules and before gathering (D11).
- **H-4** A loaded creep whose help rule fires shall deliver first when its path's cost to its core is lower than to
  the battle's cell, and help otherwise (D10).

### Dropping the load (`sim`)
- **DR-1** A `drop` order or action shall turn the creep's whole load into spoils on its cell (D24).
- **DR-2** A `drop` with an empty load, or by a creep in a battle, shall be refused.
- **DR-3** A `drop` by the victim of an extortion shall refuse it: the battle shall open with the victim empty, and
  the spoils shall stay on the world cell.

### The hostile sign (`sim`, client)
- **HS-1** A team that sees a creep or wanderer with an attack or extortion approach shall see its intent in its view;
  the target's team shall also see the target (D25).
- **HS-2** The map shall draw the red sign over that creep, and the red line to the target for the target's team.
- **HS-3** A team shall not learn of an approach whose aggressor it does not see (fog spec).

### The road builder (`sim`, client)
- **RB-1** The `roadBuilder` preset shall take no target; its `buildRoad` rule shall build toward `roadTarget` of the
  team's knowledge, re-resolved each time the autopilot decides (D12).
- **RB-2** With no target or no stock for the next segment, the preset shall gather matéria and deliver.
- **RB-3** With a road builder selected, the map shall draw its plan and the panel its total cost against the paid
  part (D13).

### The strategist (`sim`)
- **S-1** While the team sees an enemy creep inside its core zone, the bot shall give its free creeps inside the zone
  the defense rule, and take it back when no enemy is left there (D14).
- **S-2** With its population below its peak, the bot shall produce before buying the upgrade (D15).
- **S-3** With at least the D16 population, the bot shall keep a raid group of a raider and its followers, and an
  escort on a cristal collector; members whose leader died shall return to gathering.
- **S-4** The bot's gatherers shall carry the D17 posture.
- **S-5** The bot's decisions shall come from its team's view and the params alone, as before (fog spec B-1), and
  hold for any number of teams (D18).
- **S-6** A bot shall play by the difficulty its world gave it, hard by default (D26).
- **S-7** At hard, when one of its creeps is targeted or an encounter opens on it, the bot shall choose on the next
  world tick by D27 (keep and fight with help coming; pay a small demand, or drop and flee, against a stronger enemy;
  drop and fight otherwise).

### Pausing a battle (junction, server, client)
- **BP-1** When a human who controls a participant of a real-time battle presses P, the battle shall stop after a
  3 s countdown shown to everyone on its screen (D28).
- **BP-2** When a human who controls a participant presses P on a paused battle, it shall resume after a 3 s
  countdown.
- **BP-3** P from a watcher, or during a countdown, shall change nothing.
- **BP-4** When no human controls a participant on the screen of a paused battle any more, it shall resume after 3 s
  on the world clock.

### Client
- **U-1** The selected own creep shall show its destination on the map by D19; another team's creep and a wanderer
  shall show none.
- **U-2** The inspector shall show the current action's estimated time in real seconds by D20.
- **U-3** A left click on a wanderer shall select it and show it like an enemy creep (D21).
- **U-4** The world's diff property test shall stay green with follow orders, drops, hostile intents, paused battles
  and the new rules (junction N-4).
- **U-5** A left click shall list every inspectable actor in the click's area, with its key reading, and select it
  at once when it is alone (D23).

## 6. Initial parameters (guesses, made to be broken)

The first sweep's starting point, at **×8** (the middle of the owner's ×6 to ×12). The sweeps of §7 move them; the
chosen set replaces this table in `tasks.md`.

| Parameter | Now (72 h) | First guess (2 h at ×8) | Real time at ×8 |
|---|---|---|---|
| World duration | 259,200 s (72 h) | 57,600 s (16 h) | 2 h |
| Default ×N (lobby, `dev:multi`) | 36 | 8 | — |
| Map | 64 × 64 | 64 × 64; 48 × 48 swept | — |
| DNA speed, cells per world minute (■ ▲ ●) | 2 · 3 · 5 | 3 · 5 · 8 | ▲ crosses 64 cells in ~1.6 min (was ~3.5 at ×6) |
| Creep cost | 3,000 matéria + 10 cristal | 1,500 matéria + 5 cristal | — |
| Production time | 600 s | 300 s | ~38 s |
| Road segment | 150 matéria, 120 s | unchanged, swept | 15 s per segment |
| Capacity upgrade | 150 cristal | unchanged, swept | — |
| Deposit regeneration | 8 matéria per 60 s | unchanged, swept | — |
| HP regeneration (map · core zone) | 10‰ · 100‰ per world minute | unchanged, swept | full in ~12.5 min · ~75 s |
| Extortion answer window | 60 s | 80 s (D3) | 10 s |
| Flee bonus · safe-conduct · its block · wanderers' spare time | 60 · 600 · 1,800 · 600 s | unchanged, swept | 7.5 s · 75 s · 3.75 min · 75 s |
| Wanderers: first | 3,600 s | 2,400 s | 5 min |
| Wanderers: interval, start → end | 3,600 → 900 s | 1,200 → 600 s | 2.5 min → 75 s |
| Wanderers: cap alive | 4 | 4 | — |
| Opening pause (`pauseMs`) | — | 5,000 ms (owner) | 5 s |
| Pause and resume countdowns (D28) | — | 3,000 ms each (owner) | 3 s |
| Bot difficulty (D26) | — | hard (owner) | — |
| The risk's weights per DNA (D27) | — | from the junction matrix's win rates (the strategist's settings) | — |
| Help rule radius (■ ▲ ●) · HP floor | — | 6 · 6 · 8 cells · 400‰, 500‰, 500‰ (D10) | — |
| Follow distance | — | 2 cells (D8) | — |
| Raid group · escort (D16) | 1 raider per 6 creeps | 1 raider + 2 followers from 8 creeps · 1 escort from 10 | — |
| Bot posture (D17) | ■ fights, ▲ pays, ● flees | pays ≤ 250‰ of the load, flees < 400‰ HP, fights otherwise | — |

## 7. Harness and acceptance criteria

The targets are guesses written in **real time at the chosen ×N**, made for a group of friends' evening. When one
fails, the owner decides at the checkpoint. The baseline is `main` at the slice's start (the 72-hour world), measured
in F1 and printed in real time at ×6, as checkpoint C2 played it.

| Criterion | Target | How it is measured |
|---|---|---|
| Length | The world's duration ÷ the default ×N is 2 h ± 5 min | Params check (PA-1) |
| Crossing | A triangle walks from its core to the enemy core in 1.5 to 2.5 real min | Computed from the map and the params, per seed |
| The opening | Each team's first extra creep is born between real minute 8 and 15 | `geo sweep` (seeds 1–20), bot × bot, the full match |
| Exploring | Each team has seen 80% of the reachable map between real minute 20 and 60 | Same runs |
| The wanderers | The first born between real minute 4 and 6; at least one alive during 70% of the match after it; never more than 4 | Same runs |
| Fights | Battles per team per real 10 minutes, the share with a join by help or follow, and how they end, in the report; at least one help join per team per real 30 minutes | Same runs |
| No snowball | On every seed, both teams end with creeps and delivering matéria; the median creep gap at the end is at most 3 | Same runs |
| Recovery | A team that loses 4 of its creeps at real minute 30 is back to its count within 15 real minutes, on at least 18 of 20 seeds | The recovery scenario: the harness kills them, bot × bot otherwise |
| The bot's posture | The bot pays at most 30% of the extortions against it; its loaded creeps flee in at most half of the battles they enter | Same runs, and the junction matrix |
| Difficulty | Hard against easy, bot × bot: hard ends with more creeps and more matéria delivered on at least 15 of 20 seeds; hard against normal, reported | `geo sweep` with a difficulty per team |
| The bot's encounter choices | At hard, per encounter on its creeps: kept and fought, paid, dropped and fled, dropped and fought, and the outcome of each, in the report | Same runs |
| Drops | Loads dropped per team and how much of them came back to their team (picked up again) | Same runs |
| Population | Each team ends with 10 to 24 creeps and does not hit the cap before real minute 90 | Same runs |
| Human windows | The extortion window is at least 10 real s | Params check (PA-3) |
| Determinism | 2 runs and snapshot → restore give the same hash, with follow orders and the new rules | `geo verify` in CI |
| Paused battles | A paused opening, a human's pause and resume, a restart during a pause and an "Entrar" during the opening pause keep both logs agreeing | Server tests and `npm run soak` |
| Nothing leaks | A team's view has no hostile intent whose aggressor it does not see | `sim` test with a hand-built world |
| Diff correctness | Property test green (U-4) | CI, seeds 1, 42, 649 |
| Tick cost | `geo sim` of the full match, through the host, at most 1.5× the baseline's per world tick | Harness |
| Rules | Each §5 rule with a test, on text maps | `npm run check` |

The sweeps do not play humans: real-time battles, the pause and the lock a human battle puts on its creeps are
judged in the owner's sessions, which also choose the ×N among the candidates that pass.

## 8. Test protocol

1. **Tests** (`sim`, `junction`, `protocol`, `server`, `client`): the §5 rules on text maps: following on a path and
   into a battle, a cycle refused, the target dying; `allyInBattle` at the radius's edge and through the fog; the
   road builder re-resolving its target after a road is done; the strategist's defense, group and posture on
   hand-built views; the bot's D27 choices on hand-built threats; a drop, and a drop during an extortion; the hostile
   intent through the fog; the opening pause with and without a connected human; P and its countdowns, and the
   pause released when the humans leave; the actors' list under a click on a deposit with creeps; the ETA against a
   hand-computed path.
2. **Harness:** the §7 sweeps over the ×N candidates and the map sizes, the recovery scenario, the junction matrix
   with the new posture, the soak.
3. **The owner's sessions**, at the chosen ×N, in groups in the PLAYTEST:
   - a full match alone against the bot (`dev:multi --clients 1 --bot`): the opening, the first wanderers, the bot's
     help and defense, being raided by a group;
   - two tabs on one team (co-op) against the bot: "Seguir" on a dominated ally, a group with "Seguir…" in the rules
     editor, "Entrar" from the alert;
   - two tabs on opposite teams: a fight drawing help from both sides;
   - reading: the destination and the estimated time, the road builder's plan, the actors' list on a busy deposit,
     the hostile sign of an enemy coming;
   - a battle paused with P and resumed by the other tab; "Largar carga" before a fight;
   - one match at each difficulty, to feel the difference.

   Questions such as: "did 2 hours feel like a match, with an end in sight?", "could you rebuild after losing
   creeps?", "did help arrive, yours and the bot's?", "did the 5 seconds let you get into the fight?", "did you know
   where each creep was going and when it would get there?", "did you see the attack coming?", "did the bot's
   choices in each encounter make sense?".
4. **After K's merge:** the §7 sweeps again with the kits; the numbers that move go to `tasks.md` (ROADMAP).

## 9. Prerequisites before the `plan.md`

- The owner's acceptance of D1–D29; the gameplay ones go into the GDD (01, 03, 05, 06, 07). The owner's items of the
  review are in the GDD already (03, 06, 07); the agent's details go in with the acceptance.
- **The fog spec's D7 changes** with the hostile sign (D25): another team's creep in sight shows its hostile intent.
  Not an ADR: a view field under the fog's rules.
- **No new ADR expected.** The pause is a third state of a battle's pace inside the host and the server, beside the
  two of [ADR-0010](../../adr/0010-world-side-of-the-battle-contract.md); if the plan finds that it changes the
  contract (the world log or the battle log), it drafts an amendment with the `adr` skill.

## 10. Open questions

None. The owner answered the draft's two (2026-11-25): a loaded creep delivers first when the core is the cheaper
path (D10), and "Seguir…" is in the rules editor (D9).
