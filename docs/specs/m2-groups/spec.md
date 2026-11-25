# M2 spec — Groups and formations

**Status:** Draft · **Date:** 2026-11-25 · **Milestone:** M2 — The ambush ([ROADMAP](../../ROADMAP.md)), slice G
**Related GDD:** [02](../../gdd/02-creeps-and-domination.md) (squads, the embodied creep, the roster),
[06](../../gdd/06-battles.md) (squads in battle, the load experiment), [07](../../gdd/07-autopilot.md) (the squad in
the world, formations, the bots' squads) · **ADR:** [0002](../../adr/0002-every-action-is-a-command.md) (every action
is a command), [0008](../../adr/0008-battle-package.md) (battle package),
[0010](../../adr/0010-world-side-of-the-battle-contract.md) (the world side of the contract); no new ADR expected (§9)

## 1. Hypothesis

> Does the battle change the course of the world without dominating the game? (ROADMAP, M2)

Slice R gives creeps "follow", so a human can walk in a group, and the bot attacks in groups. But a group with no owner
leaves three problems for the friends' playtest. Dominating is an extra step whose only gain is control, and a new
player has to learn it before doing anything. Two humans of one team who bring followers into the same battle have no
rule for who commands which creep. And a group that walks as a pile and enters a battle wherever its side's zone is
plays like five single creeps. This slice gives each player a **squad**, picks the **embodied creep** by domination,
and gives squads **formations** in the world and in battle (G's design round, 2026-11-25). It asks:

1. **Does the squad remove domination's friction?** A player who has never seen the game commands creeps by giving them
   orders, without learning a "Dominar" step, and always knows which creeps are theirs.
2. **Do formations make group fights better?** A squad that walks in its DNA formation and enters a battle from the side
   it came from plays a different fight than the same creeps in a pile: the square in front, the triangle on the
   flank, the circle behind the tank.
3. **Do two humans share a team's battle without stepping on each other?** Each commands their own squad, sees whose
   creep is whose, and the battle never asks "who controls this?".
4. **Is the bot a group opponent?** The bot's squads arrive together and fight with the same commands a human has.

After this slice, P (the friends' playtest) plays with squads and formations.

## 2. What the owner already decided (GDD, 2026-11-25)

A summary; the source is GDD 02, 06 and 07 (the R spec's review and G's design round, both 2026-11-25).

| Topic | Decision |
|---|---|
| Three layers | **Selecting only inspects**, any creep of any side. **The squad** is the set of creeps a player commands: a free creep of the team **joins it when the player gives it an order**, with no "Dominar" button in between, and takes commands **only from that player until it is released**. **The embodied creep** is the hero of pillar 3: **dominating is how a player picks it**, at most one per player |
| Tab | Tab (Shift+Tab backwards) dominates the squad's next creep and centers the map on it, in the world as in battle |
| Seen by everyone | A **glow** on the embodied creep and **its player's name at every zoom level**, for allies and enemies, humans and bots, in the world and in battle |
| The symbol | Each player picks a symbol for their squad from a predefined list of SVGs; every creep of the squad shows it. It names the squad in the formation commands |
| Disconnecting | The player keeps the squad: the embodied creep goes back to its autopilot rules, the others keep following it, and everything is as it was on reconnecting |
| The bots | The bots' strategists lead **several squads**, how many and how they behave by the difficulty, configurable |
| The roster | A key toggles a **fixed panel** with the team's creeps, open while the player clicks; each line can **select, dominate and center on the map** |
| In the world | The squad's other creeps **follow the embodied creep in the default formation**: **squares in front, triangles in the middle and on the flanks, circles behind**. An **individual order detaches a member**, which goes back to the formation when the order is done |
| World orders | A minimal set for P: **follow in formation**, **hold position**, **attack a target** (the whole squad engages, **each DNA from its side**: the square from any direction, the triangles by the flanks, the circle from the side of the ally with the highest HP) and **release**. Formation shapes come later |
| In battle | Among the players active in the battle, **the squad's leader has priority** over its creeps; **the number keys** command the squad's other participants: **1 form on me, 2 hold position, 3 attack freely, 4 fall back**; **the battle bots use the same commands** |
| The load experiment | Attacked while loaded, a battle bot drops the load to fight or flee, or holds it when help is coming (a proposal "to experiment"; in G, lab only, cuttable) |
| Out of G | The wanderers' groups and stash (their own design round, after P); trees and climbing (a slice of their own after P) |

## 3. Scope decisions this spec assumes

Those marked **(owner)** restate G's design round. The others are **the agent's proposals**, which hold only with the
owner's acceptance; **(gameplay)** goes into the GDD, **(interpretation)** fills a detail the round did not cover. The
numbers are in §6 and are guesses.

| # | Decision | Default | Why |
|---|---|---|---|
| D1 | The squad as state **(agent)** | A **squad** is a world entity: an id from `nextId`, its leader player, its symbol and its **anchor** (the creep the others follow). A creep has a `squad` (an id, or none). **A human player has exactly one squad**, created when the player joins; **a bot has several** (D19). The embodied creep is the human squad's anchor, and `dominatedBy` keeps meaning "the embodied creep of this player": a dominated creep is always in its player's squad | Several squads per bot (owner) need an identity apart from the player. Keeping `dominatedBy` for the embodied creep keeps the junction's "human controller" and the battle screen's opening as they are |
| D2 | Joining by an order **(owner; interpretation)** | A world order from a player to a **free creep of the team** (no squad) puts it in the player's squad, then applies the order. A creep of another player's squad refuses (`inOtherSquad`). **When the squad has no embodied creep, the creep that joins becomes it.** The domination params (cost, cooldown, distance, all 0) apply when a creep joins a squad; changing the embodied creep inside the squad is free. A full squad refuses the order (`squadFull`) | Owner: no "Dominar" step. The first creep being embodied is what makes "click a creep, right-click the map" work the first time |
| D3 | The embodied creep **(owner; interpretation)** | **Dominating** a creep of one's squad makes it the embodied creep; dominating a free creep of the team also puts it in the squad. **Tab / Shift+Tab** go to the squad's next / previous creep by id. **The squad keeps an embodied creep while it has creeps:** when the embodied creep dies or is released, the next one by id becomes it. **0** releases the embodied creep, in the world as in battle (the battle's 0 today) | Owner: dominating picks the embodied creep, Tab cycles it. A squad with no anchor would have nobody to follow |
| D4 | The glow and the name **(owner; interpretation)** | The embodied creep of a human shows a **glow** and **its player's name at every zoom level**, on the map and in the arena. An enemy sees them **only for a creep it sees** (the fog holds): the team view of a foreign creep in sight gains its squad's symbol and, if embodied, its player's name (a revision of the fog spec's D7) | Owner: visible to all. The fog's rule (GDD 01) stays: no glow through the black |
| D5 | The symbols **(owner; agent)** | **Eight** geometric symbols (a star, a cross, a crescent, a ring, a bolt, an arrow, a diamond, a hex), none of them a DNA's shape (pillar 6: the shape tells the role). Picked **in the lobby** and changeable in the match by a command; **unique within a team**; a player who does not pick gets the first free one. The bots' squads take free symbols too | Owner: a predefined list. A symbol shaped like a square or circle would read as a DNA |
| D6 | Disconnecting **(owner; agent)** | The server stops releasing a disconnected player's creep. It logs a system command that marks the player **away** (and **back** on reconnecting). While away, the embodied creep runs its autopilot rules, the squad follows it, and its encounter windows (D14) are answered by the rules at once. Nothing is released. **Timeouts:** the server's domination timeout ends; a squad lasts until it is released or empty | Owner: the squad stays. Presence must be in the log, since the autopilot is in the `sim` and the world is replayed from the log |
| D7 | The squad's size and the battle's side **(agent)** | A squad has at most `squads.maxSize` creeps (§6: 4). The battle side cap rises from 5 to **8** in the world's params, so two full squads of one team fit on one side; the lab measures the cost of 8 × 8 (§7). Above the cap, joiners wait at the bubble's edge (junction D6) | Two humans' squads in one battle (owner) would overflow 5 |
| D8 | The formation in the world **(owner; interpretation)** | Each follower has a **slot**: an offset from the anchor, turned to the anchor's **heading** (the direction of its last step). **Squares in front** (1 cell ahead), **triangles on the flanks** (1 cell to each side), **circles behind** (2 cells back); more of a DNA take the next cell of that rank. A slot on rock or river takes the nearest walkable cell to it. A follower walks to its slot; in the world creeps do not collide, so slots are targets, not bodies. **Each member walks at its own pace:** the squad does not slow down to its slowest member | Owner: the default formation by DNA. The pace: a squad that slows to its square makes the embodied circle feel stuck; the alternative (the slowest sets the pace, as in Mount & Blade) is open to the owner |
| D9 | Who gets an order **(owner; interpretation)** | A right click orders **the selected creep** when it is of the player's squad or free (it joins, D2), else the embodied creep. An order to the embodied creep moves the squad; an order to a follower **detaches** it: it does the order, and when its order ends it goes back to its slot. Slice R's "Seguir" (a right click on an ally) stays an order like the others | Owner: an individual order detaches a member |
| D10 | The world's squad orders **(owner; agent)** | **Follow in formation** (the default; **1**), **hold position** (**2**): the followers stop where they stand and keep that place until "follow" or another order; **attack a target** (**3**, then a click on an enemy creep or wanderer in sight): every creep of the squad, the embodied one too, gets an attack approach on it, each from its DNA's side (D11); **release** (a button in the inspector and the roster, for one creep or the whole squad; **0** for the embodied creep). The same keys as in battle where the meaning is the same | Owner: the minimal set. One meaning per key in both screens is easier to learn |
| D11 | Engaging from the DNA's side **(owner; interpretation)** | An attack approach that comes from "attack a target" heads for a cell next to the target, chosen by DNA: **the square** the nearest one (any direction); **the triangle** a flank cell (perpendicular to the line from the squad's anchor to the target), the nearer flank, the other when a triangle already took it; **the circle** the cell beyond the squad's ally of the highest HP, on the line from the target through that ally. The encounter opens when the first creep arrives; the others join the battle by the bubble (junction D6) | Owner: each DNA from its side. In the world, the side shows only in where each creep reaches the bubble; D15 turns that into the arena |
| D12 | Squads join their battles **(agent)** | A follower in "follow" joins a battle its anchor is in or opens, like slice R's `follow` (R D8), and also a battle another creep of its squad is in, within the bubble. In "hold", a follower joins only a battle opened on itself. A loaded follower obeys R's load rule (deliver first when the core is nearer) | The squad fights together; "hold" means hold |
| D13 | The autopilot and the squad **(agent)** | A creep in a squad does **not** run its autopilot rules (as a dominated creep today); released, it goes back to them. The anchor of an away player (D6) is the exception. The rules editor keeps working on squad creeps; its rules apply once released. R's `follow` rule and "Seguir…" for a free creep stay: they serve the bots and a human leaving an escort behind | A squad creep obeys one player. Today's domination already works this way |
| D14 | The encounter window **(agent)** | An encounter on any creep of a squad gives its leader the human's window (encounter D6, at least 10 real seconds by R D3); with no answer, the creep's reaction rules apply | Today only the dominated creep has a window; the squad's creeps are the player's too |
| D15 | Where a creep is born in the arena **(gameplay; agent)** | **A joiner** is born **in the arena block of the world cell it stands on** when it joins (the bubble is the arena's window, junction D5), on the free floor cell of that block nearest to the battle's center and **off the exit ring**; when the block has none, in its side's zone as today. **At the opening**, each side's zone is the one **toward where its creeps stand in the world**, and its creeps are born there **in formation** (D8, facing the enemy's zone). This replaces "born in its side's zone" for joiners (junction D6) | The ROADMAP's "the side each DNA engages from revises where a joiner is born": a triangle that flanks in the world flanks in the arena |
| D16 | Who commands a participant **(owner; interpretation)** | A player is **active in a battle** when they control a participant of it on the battle screen. The leader of a squad commands its participants when active in the battle (playing the embodied one, or by Tab into the squad's participants there). **With the leader not active**, the squad's participants follow the last command (D17), and another active player of the team may play one of them on **loan**: a battle-only control (the creep stays in its squad in the world). **When the leader becomes active, the loan ends** and the borrower goes to their own next participant, or to watching | Owner: the leader has priority. The loan keeps a human in the fight when the leader is elsewhere |
| D17 | The battle's keys 1–4 **(owner; interpretation)** | Sent to the player's squad's participants other than the one they play. **1 form on me:** each takes its D8 slot around the played participant, facing its facing, and attacks enemies in reach without leaving its slot more than 2 cells. **2 hold position:** stay on the current cell, turn and attack in reach. **3 attack freely:** the DNA's gambits preset (today's behavior). **4 fall back:** the carrier's flight to the nearest exit, dropping the load if an enemy is near (K's carrier). **The default is 3**, so a squad with no command fights as today. A command is one battle command naming the participants (ADR-0002) | Owner: the keys. Attack freely as the default keeps every battle without a human as today |
| D18 | The battle bots' commands **(owner; interpretation)** | A side whose squad has no active human gets its commands from a **squad AI**, a short ordered list like the gambits: **fall back** when the side's HP is below `fallBackPermille` of the enemy sides' HP, **hold** when help is coming (D23, when on), **attack freely** otherwise. Easy sends none; normal and hard use it (R D26's levels) | Owner: the bots use the same commands. The list is the gambits' shape, so the lab's editor can show it |
| D19 | The bots' squads **(owner; agent)** | Slice R's raid group (a raider and 2 followers) and escort become **squads of the bot**, with the raider (the escorted collector) as the anchor; they walk in formation and attack a target by D11. **How many:** hard 2 (raid and escort), normal 1 (raid), easy none, in the strategist's settings. A bot's anchor shows its squad's symbol and **no glow**: the glow means a human plays that creep | Owner: several squads by difficulty. Telling a human from a bot is information the other side uses |
| D20 | The roster **(owner; agent)** | **C** toggles the panel; Esc closes it. Lines grouped: **the player's squad** (the embodied creep first), **the teammates' squads** (by symbol), then the **free creeps**. Each line: the DNA icon, name, HP, load, the current action, the squad's symbol and leader, and "em batalha". Actions: **select**, **dominate** (refused for another player's squad), **center**, **release** (own squad), and **"Entrar"** for a creep in a battle | Owner: select, dominate, center. The rest is what P's new player asks first: where is it, what is it doing |
| D21 | "Entrar" with squads **(agent)** | It plays **the player's squad's participant of lowest id**; with none, **a free participant of the team** (it joins the squad, D2); with none, a loan (D16); with none, it opens the screen to watch. Revises R's D7 | R's D7 rule, with the squad first |
| D22 | Selecting several **(agent; cuttable)** | Shift+click and a drag box select several of the team's creeps; a right click gives each the order (each joins, up to the squad's size). The inspector shows the list (R's D23 actors' list) | Building a squad one click at a time is slow. Cut first if G runs long |
| D23 | The load experiment **(owner's proposal; agent; lab only, cuttable)** | A battle side gets a **"help coming"** count from the host (world → battle): its team's creeps in the world with an attack approach on a participant or a follow on one, within `helpRadius` cells of the battle. A gambits condition `helpComing` and a squad AI one (D18); the carrier preset gets "hold the load while help is coming, drop otherwise". **Off in the world's params** (`gambits.helpComing.enabled` 0); the lab sets the count by hand in its setup | GDD 06: lab only, cut first. R's D27 already decides keep or drop in the world |
| D24 | Versions | `SIM_VERSION` (squads, their orders and commands, presence, the autopilot skipping squad creeps, the formation, the view's new fields); `BATTLE_VERSION` (the squad command, formation and hold behaviors, the birth cells, the squad AI, `helpComing`); `PROTOCOL_VERSION` (the new commands, the view and battle frame fields); fixed hashes. Old snapshots and replays become invalid (ADR-0004) | The project's rule (CLAUDE.md) |
| D25 | Two checkpoints | **G1, in the lab:** keys 1–4, birth in formation and by entry, the squad AI, the load experiment; the owner plays a squad. **G2, in the world:** squads, the embodied creep, the roster, Tab, formation walking, attack a target, and **two humans of one team in one battle** with their squads (P's J6) | Lab first (ROADMAP). G2 is the closest rehearsal of P |

## 4. Scope

### In
- **`@geometrix/sim`:** squads (D1), joining by an order and the embodied creep (D2, D3), the squad orders and their
  validation (D9, D10), the formation slots (D8), engaging from the DNA's side (D11), squads joining battles (D12), the
  autopilot skipping squad creeps (D13), the encounter window (D14), presence (D6), the symbol command (D5), the view's
  fields (D4), the bots' squads in the strategist (D19), `SIM_VERSION`.
- **`@geometrix/battle`:** the squad command and its behaviors (D17), the birth cells (D15), the squad AI (D18),
  `helpComing` (D23), the side cap (D7), `BATTLE_VERSION`.
- **`@geometrix/junction`:** the leader's priority and the loan (D16), the birth cell of a joiner from its world cell
  and the opening's zones (D15), the "help coming" count (D23).
- **Protocol and server:** the new commands, presence instead of the disconnect's release (D6), inputs and squad
  commands routed by D16, `PROTOCOL_VERSION`.
- **Client:** the three layers on the map (D2, D3, D9), the glow, name and symbol (D4, D5), Tab and 0, the keys 1–3
  and the target pick (D10), the roster (D20), "Entrar" (D21), several selected (D22), the symbol in the lobby, the
  keys 1–4 and the squad's marks on the battle screen.
- **Lab:** squads in the setup (a leader and its participants), keys 1–4, a joiner's entry cell, the squad AI in the
  editor, the "help coming" count.
- **CLI:** squad scenarios in `geo junction matrix` (§7); the squads' counters in R's pace harness.
- **Playtest:** a PLAYTEST lab group for G1 and a world script for G2 (two clients on one team).
- **GDD and glossary:** the accepted decisions.

### Out
Formation shapes (line, column, wedge); a squad slowed to its slowest member (D8, open); more than one squad per human;
the commander (GDD 06, parked); the wanderers' groups and stash (GDD 05, their own round); trees and climbing (GDD 01,
their own slice); squad pings, chat and macros (slice C); a battle gambits editor in the world client (junction D10);
client prediction (ADR-0009, P); the load experiment in the world (D23); renaming squads.

## 5. Behavior

Format: *When [trigger], the system shall [response].* "The team" is the player's team; "free" means in no squad.

### Squads (`sim`)
- **S-1** When a human player joins, the system shall create their squad, empty, with the first free symbol of the team.
- **S-2** When a player orders a free creep of their team, the system shall put it in the player's squad (refusing
  with `squadFull` at `maxSize`), apply the domination params, and then the order; with no embodied creep, it shall
  become the embodied one (D2).
- **S-3** An order or a dominate from a player to a creep of another player's squad shall be refused (`inOtherSquad`).
- **S-4** When a player dominates a creep of their squad or a free one of the team, it shall become their embodied
  creep; the previous one shall stay in the squad as a follower.
- **S-5** When the embodied creep dies or is released, the squad's next creep by id shall become the embodied one;
  with none left, the squad is empty (D3).
- **S-6** Releasing a creep shall take it out of the squad and hand it back to its autopilot rules; releasing the
  squad does it for every creep.
- **S-7** A squad creep shall not run its autopilot rules, except the anchor of an away player (D6, D13).
- **S-8** The server shall log a player's going away and coming back as system commands, and shall release nothing on
  a disconnect (D6).
- **S-9** A symbol command shall be refused for a symbol another squad of the team holds.

### The squad in the world (`sim`)
- **W-1** While its squad follows, each follower shall walk toward its slot (D8) by the team's known map, recomputed
  when the anchor moves or turns.
- **W-2** When a follower's individual order ends, it shall go back to its slot (D9).
- **W-3** On "hold", the followers shall stop and keep their cells until "follow" or another order.
- **W-4** On "attack a target", every creep of the squad shall get an attack approach on the target, heading for its
  DNA's cell (D11); a target the team no longer sees ends the approach as today.
- **W-5** A follower in "follow" shall join a battle its anchor, or another creep of its squad within the bubble, is
  in or opens; in "hold", only one opened on itself (D12).
- **W-6** An encounter on a squad creep shall give its leader the window (D14), unless the leader is away.

### The battle (`battle`, `junction`)
- **B-1** A joiner shall be born on the free floor cell of its world cell's block nearest the arena's center, off the
  exit ring, else in its side's zone (D15).
- **B-2** At the opening, each side's zone shall be the one toward its creeps' world cells, and a side with several
  creeps shall be born in formation, facing the enemy (D15).
- **B-3** The squad command shall set the named participants' behavior: form, hold, free or fall back (D17); a
  participant played by a human ignores it.
- **B-4** A side with no active human shall get its squad AI's commands (D18) on the gambits' reaction time.
- **B-5** The host shall give a participant to its squad's leader when the leader is active, else keep the last
  command; another active player of the team may play it on loan until the leader becomes active (D16).
- **B-6** With `helpComing` on, the host shall send each side its help count on change, and the gambits and squad AI
  conditions shall read it (D23).
- **B-7** With the squad command never sent and `helpComing` off, a battle shall play as before G (the sweep, §7).

### Screens (client)
- **U-1** The map and the arena shall draw each squad creep's symbol, and the embodied creep's glow and player name at
  every zoom level (D4).
- **U-2** Tab / Shift+Tab shall dominate the squad's next / previous creep and center on it; 0 shall release the
  embodied creep; 1, 2 and 3 (then a click on a target) shall send the world's squad orders (D10).
- **U-3** C shall toggle the roster (D20); its actions shall send the same commands as the map.
- **U-4** The battle screen's 1–4 shall send the squad command for the player's other participants, and show the
  squad's current command (D17).
- **U-5** The lobby shall offer the symbol; the inspector shall show a creep's squad and leader, and "Liberar".
- **U-6** "Dominar" shall stay on a selected creep's panel as the way to pick the embodied creep; the right click
  shall order without it (D2, D3).

### Harness
- **H-1** `geo junction matrix` shall add squad scenarios: a 3-creep squad attacking a 3-creep side in formation
  (D11, D15) against the same creeps by plain follow and zone birth, and report wins, duration and the time until the
  whole squad is in the battle.
- **H-2** R's pace harness shall report, per bot difficulty, its squads formed, the share of its raids where the squad
  reaches the fight together, and the squad AI's commands per battle.
- **H-3** `geo verify --seed 42`, `geo battle verify` and `npm run soak` shall stay green; the soak adds a
  disconnect and a reconnect of a player with a squad (D6).

## 6. Initial parameters (guesses, made to be broken)

| Where | Parameter | Guess | Note |
|---|---|---|---|
| `sim` | `squads.maxSize` | 4 | the embodied creep and 3 |
| | formation: front / flank / back | 1 / 1 / 2 cells | D8 |
| | bots' squads: hard / normal / easy | 2 / 1 / 0 | the strategist's settings (D19) |
| `battle` | `limits.maxPerSide` (the world's) | 8 (from 5) | the lab keeps 5 by default (D7) |
| | form: the farthest from the slot | 2 cells | D17 |
| | squad AI `fallBackPermille` | 500‰ | the side's HP against the enemies' (D18) |
| `junction` | `helpComing.enabled` / `helpRadius` | 0 / 12 cells | the bubble is 9 × 5 cells (D23) |
| client | the symbols | 8 | D5 |

## 7. Harness and acceptance criteria

The targets are guesses; when one fails, the owner decides at the checkpoint.

| Criterion | Target | How it is measured |
|---|---|---|
| The squad arrives together | Median time from the opening to the whole 3-creep squad in the battle at most 5 battle seconds, against plain follow's, reported | H-1 |
| Formation matters | The squad in formation wins more than the same creeps in a pile and zone birth, reported (no target: the owner judges at G1) | H-1 |
| No regression | With no squad command and `helpComing` off, `geo battle sweep` gives the same wins and durations as before G | B-7 |
| The bot's groups | At hard, at least half of its raids reach the fight with 2 or more squad creeps within 10 world seconds | H-2 |
| Auto-resolve cost | A 3 × 3 of 120 battle seconds still at most 50 ms median; an 8 × 8 reported, at most 4× that | `geo battle sweep` |
| The network | The view delta with squad fields within the M1.5 spec §7 targets; the battle frame within the watcher budget (16 KB/s) | `geo net` |
| Determinism | H-3 | CI |
| Rules | Each §5 rule with a package test, on text maps and arenas | `npm run check` |
| Fun | The owner answers hypothesis questions 1–4 at G1 and G2 | Checkpoints |

## 8. Test protocol

1. **Tests** (`sim`, `battle`, `junction`, `protocol`, `server`, `client`): joining by an order, a full squad, another
   player's squad; the embodied creep by dominate, Tab, death and release; presence and the away anchor's autopilot;
   the slots by heading and around rock; detaching and coming back; hold; attack a target from each DNA's cell; joining
   by squad; the window to the leader; the birth cell of a joiner and the opening's zones in formation; each squad
   command; the leader's priority and the loan; the squad AI; `helpComing`; the symbols' uniqueness; the keys and the
   roster in the client.
2. **Harness:** H-1 to H-3; the sweep with no commands (B-7).
3. **G1, the owner's lab session** (a new PLAYTEST lab group): a squad of 3 against the AI's 3 with keys 1–4; the AI's
   squad commands; a joiner from a flank; the load experiment with help coming and not.
4. **G2, the world session:** `npm run dev:multi -- --clients 2 --bot` (both humans on one team against the bot): each
   builds a squad by orders, picks a symbol, walks in formation, attacks a target, and both squads meet in one battle;
   one player disconnects and comes back.

### Criteria to close the slice
- §7 criteria green, or the owner decides what to do with what failed.
- The owner answers hypothesis questions 1–4 at G1 and G2.

## 9. Prerequisites before the `plan.md`

- The owner's acceptance of the agent's proposals (D1–D25 where marked).
- **R and K merged, or their plans as the base:** G builds on R's `follow`, groups, difficulty, pause and "Entrar",
  and on K's kits and carrier preset. The plan is written against both approved plans and rebased on their merges.
- **No new ADR expected:** dominating still only changes who emits a creep's commands (ADR-0002); the squad command and
  the help count are host commands inside the battle's log (ADR-0010). If the plan finds the help count changes the
  world → battle contract, it drafts one.

## 10. Open questions

- **The squad's pace** (D8): each member at its own pace (the proposal) or the squad at its slowest member's pace,
  as in Mount & Blade?
