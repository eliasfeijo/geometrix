# M2 spec — The junction

**Status:** Draft · **Date:** 2026-11-24 · **Milestone:** M2 — The ambush ([ROADMAP](../../ROADMAP.md)), slice D
**Related GDD:** [02](../../gdd/02-creeps-and-domination.md) (HP, domination), [03](../../gdd/03-economy-and-logistics.md)
(loot, spoils), [05](../../gdd/05-tribes-and-diplomacy.md) (the wanderers), [06](../../gdd/06-battles.md) (the
instance, the bubble, world time), [07](../../gdd/07-autopilot.md) (reactions, gambits),
[08](../../gdd/08-chronicle-chat-and-console.md) (chronicle) ·
**ADR:** [0010](../../adr/0010-world-side-of-the-battle-contract.md) (the world side of the contract, `Accepted`);
[0001](../../adr/0001-world-and-battle-as-separate-simulations.md), [0008](../../adr/0008-battle-package.md)

## 1. Hypothesis

> Does the battle change the course of the world without dominating the game? (ROADMAP, M2)

Slices A and B answered each half on its own: the encounter creates conflict and story with a throwaway roll, and
the grid rule is fun in a lab with no world. This slice joins them and asks:

1. **Does the real battle pay off the risk?** With the roll gone, does an ambush feel like a fight worth taking or
   avoiding (the encounter's session found the roll did not pay off)?
2. **Does the battle change the course of the world?** Escorts, routes, reinforcements, who carries cristal: the
   world's decisions change because a battle can be won by micro and by numbers arriving in time.
3. **Without dominating the game:** in a bot × bot world, battles happen often enough to matter, last little in world
   time, and no team collapses by snowballing.
4. **Is the world readable with battles in it?** A player who is not in a battle understands, from the map and the
   chronicle, where one is happening, who is in it and how it ended.
5. The network, the server and determinism hold with battles: replay, recovery after a crash and the soak test.

After this slice comes P, the friends' playtest. The order of slice E (siege and repair) against P is decided at this
slice's checkpoint (ROADMAP).

## 2. What the owner already decided

A summary; the source is the GDD.

| Topic | Decision |
|---|---|
| Separation | World and battle are separate simulations; the battle receives the participants and returns events (ADR-0001). The battle package does not import the world (ADR-0008) |
| The encounter | An approach with a dialogue: the aggressor attacks or extorts; the victim pays or not (GDD 06, slice A) |
| The combat rule | The grid, as the lab left it (slice B): directional attack, bodies block, escape by the border, the battle inactivity clock, 2 to 4 sides, joining mid-fight with no dialogue, the gambits AI, the 3 s countdown. **No new combat rule before the junction** (lab checkpoint, C9) |
| Losses | Death is permanent; HP persists after the battle |
| The wanderers | Hostile creeps by nature that roam fast, fragile and weak, and respawn more and more often; they can join a nearby battle between teams; the first neutral faction, a side that is not a team (GDD 05) |
| Prediction and deploy | Wait for the joined junction (lab checkpoint, C10): the friends' playtest (P) measures the real network |

## 3. Scope decisions this spec assumes

Decisions marked **owner** were chosen by the owner in the interactive round of 2026-11-24 and are in the GDD. The
others are the **agent's proposal**, which only holds with the owner's acceptance of this spec. Those marked
**(gameplay)** complete the GDD. The numbers are in §6 and are guesses.

| # | Decision | Default | Why |
|---|---|---|---|
| D1 | The battle replaces the roll **(gameplay; owner)** | The encounter's fight is the battle instance. **An attack always opens the battle**, right after the aggressor's declaration (no window: the 3 s countdown is the victim's time to react). **An extortion** keeps the dialogue: the victim **pays** or **refuses**, and refusing opens the battle. The roll (`fightRound`) and the dominated creep's mid-fight flee button leave | Owner: the roll did not pay off the risk (encounter session); the grid is the combat |
| D2 | Fleeing is in the arena **(gameplay; owner)** | The dialogue's **flee** (the slice A speed roll) leaves: escaping is the grid's, by the border, dropping the purse if one wants. A free creep whose reaction rule says **flee** enters the battle with the **carrier** gambits (drop the purse with an enemy near, flee); with **fight**, or with no rule, it enters with its DNA's preset | Owner: each combat rule has its own escape (GDD 06); two escapes in the game would confuse |
| D3 | World time during a battle with a human **(gameplay; owner)** | **The world keeps its pace** (its ×N). A battle in which a human controls a participant runs in **real time**, and its participants stay **locked in the world** while it lasts: they do not walk, gather, deliver, regenerate or take world orders | Owner. At ×6, 30 s of battle lock the creeps for 3 world minutes; at ×36, for 18 |
| D4 | World time with no human (auto-resolve) **(gameplay; owner)** | A battle with no human in control runs **on the world clock: 1 battle second = 1 world second** (20 battle ticks per world tick). It is the same simulation, with every participant on the gambits. When a human takes over (D12), it switches to real time; when no human controls anyone any more, it goes back to the world clock (agent) | Owner: reinforcements and a human taking over have time to arrive; at ×36 a bot battle still resolves in about a real second |
| D5 | The arena from the terrain **(gameplay; owner, numbers by the agent)** | The arena is a **window of world cells** around the battle's cell (the victim's cell when it opened), each world cell drawn as a **k × k block** of arena cells: **rock stays rock**; river, ford, road, deposits and jungle become floor (battle terrain from the surroundings is parked, GDD 06). North stays up, so the map and the arena read the same way. Near the map's edge the window shifts to stay inside the map. **Spawn zones as in the lab**, always floor (rock in them becomes floor) | Owner: the arena reflects the place. A world cell cannot be an arena cell: the lab's arena (43 × 27) is two thirds of the 64 × 64 map |
| D6 | The bubble and who joins **(gameplay; owner, details by the agent)** | **The bubble is the window** (D5). **Only who chooses joins:** a creep with an **attack** approach on a participant that enters the bubble joins the battle, on its team's side, or on a new side if its team has none there. An ally helps by approaching the enemy. Extorting a participant is refused (no extortion mid-battle). The autopilot joins with the rule "enemy in sight → approach (attack)" as today. Whoever joins skips the dialogue and is born in its side's zone (lab D11). A side whose zone is full (§6) refuses the join: the joiner waits at the bubble's edge and tries again on each tick (agent) | Owner: joining is a decision, never a trap |
| D7 | Leaving the battle mid-fight **(gameplay; agent)** | A participant that leaves the arena leaves the battle in the world **on the same world tick**. **Death** is slice A's (permanent, the domination ends). **Escape by the border:** the creep comes back on the world cell under the arena cell it left from (the nearest walkable one, if that is rock), with the HP and load it has and slice A's **run home with the speed bonus**. Its order ends and the autopilot decides again | The border it flees by matters in the world: fleeing towards home or into the river. Slice A's bonus keeps the aggressor from catching it again a tick later |
| D8 | The end and the loot **(gameplay; owner, details by the agent)** | When the battle ends with a winner, the **winning side's survivors collect the piles** left in the arena up to their free capacity, cristal first, in id order (slice A's D11 rule); **the rest becomes spoils** on the world cell under each pile. The survivors come back on the world cell under their arena cell. An **end by inactivity** (no winner) is an escape for everyone, without the speed bonus (agent) | Owner: keeps slice A's loot. The grid ends as soon as one side is left, so nobody could pick up in the arena |
| D9 | One source for max HP and capacity **(agent; ADR-0010)** | The **world's params** own max HP and capacity (capacity has the M1 upgrade, so it is the creep's, not the DNA's). The setup carries each participant's max HP and capacity; the battle params keep only what is combat (damage, range, cooldowns, speeds). HP crosses in whole points: the world's thousandths are dropped on entry (at least 1) and come back as whole points | ADR-0008 left the choice to this slice. Capacity cannot be per DNA in the battle when the world upgrades it |
| D10 | Gambits and difficulty of world creeps **(gameplay; agent)** | A world creep enters with its DNA's preset (frontline, marksman, skirmisher), or the carrier (D2), with the **normal** reaction (§6). **No battle gambits editor in the world client** in this slice | The lab's presets were enough (lab F5 checkpoint, group 4: "hard to edit the rules during combat"). Editing in the world is a later decision |
| D11 | The battle screen **(gameplay; owner, details by the agent)** | When the creep a player dominates enters a battle, **the battle screen opens by itself** in the world client, in place of the map: the lab's arena, signs and keyboard, with the 3 s countdown at the battle's start. A button goes back to the map; on the map, the creep plays by its gambits (still dominated) and the button returns to the battle. **Teammates** of a participant's team get a **watch** button (agent: spectators of other teams come with P) | Owner: the human must not miss the start of the fight |
| D12 | Taking over mid-fight **(gameplay; owner)** | A player may dominate a creep of their team that is already in a battle: it leaves its gambits and plays with the human, with no countdown. Releasing it (or dominating another creep) gives it back to its gambits. The domination goes on in the world after the battle | Owner. GDD 06 proposal: "humans who arrive mid-fight can dominate a creep and take over" |
| D13 | When the battle is real time **(agent)** | Real time while at least one participant is controlled by a human with the battle screen open; otherwise the world clock (D4). Watching does not change the pace. A human who disconnects counts as off the screen | The pace follows whoever plays; an absent player does not freeze an entire battle in real time at ×36 |
| D14 | The wanderers **(gameplay; owner, details by the agent)** | **Owner:** a wanderer is a **circle with its own stats** (HP and damage below the circle's, in the params) and a neutral color; it **always attacks**, with no dialogue or extortion; it targets only **loaded** team creeps in sight; it **carries what it loots until it dies**, when the load becomes spoils. **Agent:** they are born in the jungle band along the river, outside the core zones; they roam between random reachable cells of that band; the first is born after a while and the respawn interval shrinks with world time, with a cap of living wanderers (§6); they join a battle between teams they see, on their own side; teams may attack them, not extort them. A side that is not a team: no core, stock, player or domination; seen through the fog like an enemy creep | GDD 05 asks for them in slice D. Built only for the wanderers, with no generic faction (GDD 05 proposal) |
| D15 | Events and chronicle **(gameplay; agent)** | New `sim` events: battle opened (with its sides), joined, escaped (by the border or by inactivity), battle ended (winner, loot and spoils), wanderer born. Death stays slice A's. The chronicle narrates them with the slice A templates and voice; the battle's blow-by-blow (hits, misses) stays on the battle screen. The agent writes the sentences; the owner reviews the tone at the checkpoint | GDD 08. A player off the battle understands it through the chronicle (hypothesis 4) |
| D16 | The battle in the world view **(gameplay; agent)** | The team view shows a battle like a creep, through the fog: its cell, the bubble, the participants marked "in battle" and their sides. The map draws the bubble and a battle sign; clicking it selects the battle and offers "watch" (D11). Battle frames go only to whoever has the battle screen open | Hypothesis 4: where a battle is and who is in it, without opening it |
| D17 | Determinism, persistence and recovery **(agent; ADR-0010)** | A battle is an **instance next to the world**, run by a junction host. The world log keeps only the battle's **results** (exits and the end); each battle has its own log (setup + commands per tick), written in the same transaction as the world tick. The world replays alone; each battle log replays to the results the world applied. A restart in the middle of a battle rebuilds it from its log and resumes it, on the world clock until a human comes back to the screen | ADR-0001: the world must be recoverable after a crash. A battle change must not invalidate the log of a world that lasts days (owner, 2026-11-24) |
| D18 | What changes on purpose | `SIM_VERSION`, `PROTOCOL_VERSION`, `BATTLE_VERSION` (the setup carries max HP and capacity), the command vocabulary (`react` loses `flee`/`fight`; the mid-fight `flee` leaves; new battle commands) as a `BREAKING CHANGE`; the fixed hashes | New gameplay: old snapshots and replays become invalid (ADR-0004) |
| D19 | The movement drawing **(agent)** | The battle screen offers the lab's four movement drawings in the network panel (`?net=1`), starting from the lab's default. Choosing one for the game waits for PLAYTEST group 7; client prediction waits for P | ADR-0009 and the lab checkpoint (C10, C11): decided after playing, not in the spec |

## 4. Scope

### In
- **`sim`:** the battle stub and the result inputs (ADR-0010); opening the battle from the encounter (D1, D2);
  locking the participants (D3); detecting who joins (D6); applying exits and the end (D7, D8); domination in battle
  (D12); the wanderers, their side, birth, roaming and behavior (D14); the events (D15); the view (D16); the params;
  `react` and `flee` changing (D18).
- **Junction host** (ADR-0010), shared by the server and the CLI: the setup from the world, the arena from the
  terrain and the spawn zones (D5); HP and capacity on entry and exit (D9); the gambits per creep (D10); both paces
  (D4, D13); joins and control; turning the battle's events into result inputs; the battle logs.
- **`battle`:** max HP and capacity in the participant setup (D9); whatever the world needs to drive a battle tick by
  tick from outside (ADR-0010; the plan says what).
- **Bot strategist:** wanderers counted as enemies; nothing else changes.
- **Protocol:** battle commands from the client; battle frames; battles in the team's delta; the new events.
- **Server:** the host's real-time pace for battles with a human on the screen (D13); presence on the battle screen;
  the frames to watchers; the battle logs in the same transaction as the world tick; recovery in the middle of a
  battle (D17).
- **Client:** the battle screen in the world client, from the lab's arena view and keyboard (D11, D19); opening it by
  itself, going back to the map, watching; the battle on the map (D16); the wanderers on the map; the chronicle
  sentences (D15); the reaction panel without flee and the mid-fight flee button removed (D1, D2).
- **Harness:** battle metrics in `geo sim` and `geo sweep`; `geo verify` with battles; `geo net` with battle frames;
  the soak test with a `kill -9` in the middle of a battle.
- **Playtest:** junction questions in [PLAYTEST.md](../../PLAYTEST.md).

### Out
A new combat rule, skills, level and XP (C9); client prediction and the movement drawing decision (P, after PLAYTEST
group 7); the deploy and the tunnel (P); spectators of other teams (P); a battle gambits editor in the world client;
terrain from the surroundings in the arena (river, trees, structures; parked); the commander (parked); siege, building
HP and repair (E); bosses and tribes (parked); alliances between sides; extorting a wanderer; translating the UI; the
road-builder preset bug (a separate fix session, dashboard).

## 5. Behavior

Format: *When [trigger], the system shall [response].*

### Opening (`sim` and host)
- **O-1** When an attack encounter opens (slice A's E-3), after the declaration event, the battle shall open on the
  same tick with the aggressor and the victim on two sides (D1).
- **O-2** When the victim of an extortion refuses (by the player's answer, by its rules, or by the end of the window),
  the battle shall open; when it pays, slice A's E-6 holds.
- **O-3** Each world participant shall enter the setup the host builds with its DNA's preset, or the carrier's when its reaction rule says flee
  (D2, D10), the normal reaction, its whole HP points (at least 1), its max HP, its capacity and its load (D9).
- **O-4** The arena shall be the D5 window: rock where the world has rock, floor elsewhere, floor in the spawn zones,
  shifted to stay inside the map.
- **O-5** While in a battle, a creep shall not walk, gather, deliver, regenerate, open an encounter or take a world
  order; domination may start and end (D3, D12).

### Pace (host and server)
- **T-1** With no human in control (D13), each world tick shall advance the battle by the battle ticks of one world
  second (D4), synchronously, so a world with no human stays deterministic.
- **T-2** With a human in control on the screen, the battle shall advance in real time, independently of the world's
  ×N, and stop advancing on the world clock; when no human controls anyone on the screen any more, it shall go back
  to T-1.
- **T-3** The battle's 3 s countdown shall run only at its opening, in either pace.

### Joining (`sim` and host)
- **J-1** When a creep with an attack approach on a participant enters the bubble (D6), it shall join the battle on
  its team's side, or on a new side; the battle shall get a `join` with its HP, load, max HP, capacity and gambits.
- **J-2** An extort approach on a participant shall be refused with slice A's refusal for an impossible extortion.
- **J-3** When the side's zone is full, the join shall wait: the creep stays at the bubble's edge and tries again on
  the next tick, while its approach holds.
- **J-4** A creep that sees no participant of the battle shall not learn of it from a refusal (slice A's D19).

### Leaving and the end (`sim` and host)
- **X-0** Every exit and every end shall reach the world as a result input in the world log, on the first world tick
  after the battle tick it happened on.
- **X-1** When a participant dies in the battle, it shall die in the world on the same world tick, by slice A's death
  rule (H-3, D4), with its load left in the arena as a pile.
- **X-2** When a participant escapes by the border, it shall come back to the world on the D7 cell with its HP and load
  and the run-home bonus, and its order shall end.
- **X-3** When the battle ends with a winner, the piles shall be collected and placed by D8, the survivors shall come
  back to the world on the cell under their arena cell, and the battle shall leave the state.
- **X-4** When the battle ends by inactivity, everyone in it shall come back as in X-2, without the speed bonus, and
  the piles shall become spoils (no winner collects).

### Domination (`sim`)
- **C-1** Dominating a creep in a battle shall put it in the human's control from the next battle tick, without a
  countdown (D12); releasing it, dominating another creep or the player's disconnection shall give it back to its
  gambits.
- **C-2** The battle commands of a player shall be accepted only for the participant that player dominates.

### Wanderers (`sim`)
- **W-1** Wanderers shall be born by the D14 curve on a free walkable cell of the jungle band, outside the core zones,
  chosen by `state.rng`, up to the cap of living ones.
- **W-2** A wanderer shall roam between random reachable cells of the band; with a loaded team creep in sight, it
  shall approach it to attack; with a battle between teams in sight, it shall approach a participant to join.
- **W-3** A wanderer shall carry what it loots (D8) and, when it dies, leave its load as spoils (in the world) or as a
  pile (in the arena).
- **W-4** A team's creep may approach a wanderer to attack; an extortion of a wanderer shall be refused.
- **W-5** A team shall see the wanderers only through its own sight and memory, like enemy creeps (fog spec).

### Events, view and chronicle
- **K-1** Each opening, join, escape, death, end and wanderer birth shall emit a structured event (D15), in the same
  order on any run.
- **K-2** A team shall receive the battle events in which one of its creeps takes part, or whose battle cell it sees.
- **K-3** The team view shall show the battles by D16, through the fog; the battle's internal state shall not enter
  the world delta.

### Network, server and client
- **N-1** The client shall open the battle screen by itself when its dominated creep enters a battle or when it
  dominates a creep in a battle (D11); the button shall go back to the map and return to the battle.
- **N-2** Battle frames shall go only to clients with the battle screen open; a teammate of a participant's team may
  open it to watch.
- **N-3** After a server restart in the middle of a battle, the battle shall resume from the log with the same state
  it had, on the world clock until a human is on the screen again (D17).
- **N-4** The world's diff property test shall stay green with battles, locked participants and wanderers.

## 6. Initial parameters (guesses, made to be broken)

In the `sim` params unless noted (`battle` for the battle params).

| Parameter | Guess |
|---|---|
| Arena window (D5) | 9 × 5 world cells around the battle cell; each world cell a 5 × 5 block: a 45 × 25 arena plus the exit ring (the lab's is 43 × 27) |
| Battle ticks per world second | 20 (the 50 ms battle tick, `battle`) |
| Participants per side | 5 (the lab's maximum; the spawn zone has room for them) |
| Extortion window of a dominated creep | 60 world seconds (slice A, unchanged) |
| Reaction of world creeps in battle (D10) | normal, 250 ms (`battle`) |
| Escape run-home bonus (D7) | slice A's: 1,500‰ speed for 60 world seconds |
| Wanderer stats (D14) | HP 60, damage 12 (half of the circle's); the rest of the circle's kit; capacity 10; world speed and sight of the circle (5 cells per minute, 6 cells) |
| Wanderers' band (D14) | rows within 8 of the river, outside the core zones (radius 8) |
| Wanderers' birth (D14) | the first at world hour 1; then one every 60 world minutes, shrinking linearly to one every 15 by the end of day 3; at most 4 alive |

## 7. Harness and acceptance criteria

The targets are guesses. When one fails, the owner decides at the checkpoint. The comparison baseline is `main` at
the slice's start (slice A's encounter with the roll), measured in F1.

| Criterion | Target | How it is measured |
|---|---|---|
| Battles happen | In the report: battles per team and per world hour; how they opened (attack, refused extortion, wanderer); how they ended (winner, inactivity); participants and joins per battle; duration in battle and world seconds. The owner judges whether the frequency matters | `geo sim` 3 days (seed 42) and `geo sweep` 6 h (seeds 1–20) |
| The risk pays off | Per DNA and load: the win, death and escape rate of aggressors and victims, side by side with the roll's numbers on the baseline | Same runs |
| No snowball | On every seed, both teams end with creeps and delivering materia; the population and delivered-materia gap goes into the report | Same runs |
| Wanderers | Born, alive over time, battles opened and joined, loot carried, spoils left when they die | Same runs |
| Economy | Materia and cristal delivered, deaths, loot, extortion and spoils per team, against the baseline | `geo sim`; the owner judges |
| Determinism | 2 runs and snapshot → restore in the middle of a battle give the same world and battle hashes | `geo verify` in CI |
| Two logs agree | The world log replays alone to the server's hash; each battle log, played by a human on the real-time pace included, gives in `geo battle verify` the results the world log applied | Test with the server, and the soak test |
| Diff correctness | Property test green (N-4) | CI, seeds 1, 42, 649 |
| Bandwidth and CPU | The [network spec §7](../m1.5-network/spec.md) targets for the world delta; battle frames at most 16 KB/s per watcher (guess) | `geo net --seed 42 --days 3`, with a watcher |
| Tick cost | `geo sim` 3 days, through the host, at most 1.5× the baseline | Harness |
| Recovery | A `kill -9` in the middle of a battle, then a restart: the battle resumes from its log, nothing half-applied, and the final hashes match | `npm run soak` |
| Nothing leaks | A team's view and events have no battle, participant or wanderer outside its sight or memory | `sim` test with a hand-built world |
| Rules | Each §5 rule with a test, on text maps | `npm run check` |

## 8. Test protocol

1. **Tests** (`sim`, `battle`, `protocol`, `server`, `client`): the §5 rules on text maps; the arena of a window with
   rock and at the map's edge; the world clock against real time; a join in the bubble; an escape coming back on the
   right cell; the loot at the end; a takeover; the wanderers' birth curve with a fixed `rng`; nothing leaks.
2. **Harness:** the §7 runs and the soak test.
3. **The owner's sessions**, at ×6, in groups in the PLAYTEST:
   - against the bot: ambush and be ambushed dominating a creep; let a bot battle happen and take it over mid-fight;
     send a reinforcement into a battle;
   - two tabs (`dev:multi --clients 2`), Blue and Orange, both dominating: a battle between two humans, with a third
     creep joining;
   - watching: the map and the chronicle of a battle the owner is not in; a teammate's watch button;
   - the wanderers: being attacked loaded, hunting a full one.

   Questions such as: "did the fight pay off the risk?", "did you know a battle was happening, and where?", "did the
   locked time in the world bother you?", "did anyone arrive in time?", "what did you change after the first battle?".
4. **The checkpoint** also decides the order of E against P (ROADMAP).

## 9. Prerequisites before the `plan.md`

- The owner's acceptance of D1–D19 (the agent's ones included).
- **ADR-0010 — The world side of the battle contract** ✅ `Accepted` (2026-11-24).

## 10. Open questions

None in this spec. Pending elsewhere, not blocking: ADR-0009 (prediction in the lab), the provisional
`gambits.meleeBerthSteps` (lab F7) and PLAYTEST group 7, which feeds D19.
