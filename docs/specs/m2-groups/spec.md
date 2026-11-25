# M2 spec — Groups and formations

**Status:** Approved (2026-11-25) · **Date:** 2026-11-25 · **Milestone:** M2 — The ambush ([ROADMAP](../../ROADMAP.md)), slice G
**Related GDD:** [02](../../gdd/02-creeps-and-domination.md) (squads, the embodied creep, the panel),
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
| Three layers | **Selecting only inspects**, any creep of any side. **The squad** is the set of creeps a player commands; **the player adds creeps to it with Ctrl** (a Ctrl drag box adds the selected creeps, Ctrl+click toggles one in or out, the squad's symbol appearing or disappearing on it), or by dominating one, and a squad creep takes commands **only from that player until it is released**. **A plain order to a free creep is one-shot:** it does the order and goes back to its autopilot rules, never joining the squad. **The embodied creep** is the hero of pillar 3: **dominating is how a player picks it**, at most one per player (revised at the spec's review, 2026-11-25: in the design round an order put the creep in the squad) |
| Selecting and the keys | A click selects, a drag box selects several, **Shift+click toggles** a creep in the selection, **N** (1–9) selects the squad's creep N, **Tab** moves the selection along the squad, **0** clears it; **Shift+N dominates** the squad's creep N, which becomes number 1. The same in the world and in battle. **Z** opens the formation options (1 to 9, 0 cancels) for the selected creeps of the squad or, with none, the whole squad (owner, the spec's review, 2026-11-25; in the design round Tab dominated and the numbers were the battle's commands) |
| Seen by everyone | A **glow** on the embodied creep and **its player's name at every zoom level**, for allies and enemies, humans and bots, in the world and in battle |
| The symbol | Each player picks a symbol for their squad from a predefined list of SVGs; every creep of the squad shows it. It names the squad in the formation commands |
| Disconnecting | The player keeps the squad: the embodied creep goes back to its autopilot rules, the others keep following it, and everything is as it was on reconnecting |
| The bots | The bots' strategists lead **several squads**, how many and how they behave by the difficulty, configurable |
| The cap and control | Each player has a **maximum of creeps in their squad**, by the number of players in the team and the free creeps; when a squad creep dies, the others stay (only a manual release takes a creep out). **A player controls only their own squad's creeps or free ones.** **New creeps** (paid with resources) **are born free**, on autopilot with the default preset, as the first generation; **the player with the fewest creeps in their squad has preference when active** (owner, the spec's review, 2026-11-25) |
| The panel | **C** toggles one fixed panel, in the world and in battle: **the squad on top, numbered 1 to 9** like the number keys, in an order the player changes (drag and drop, or Shift+↑/↓), **the embodied creep always 1**; the rest of the team below. Each line can **select, dominate and center on the map** (owner, design round; one panel and the numbers at the spec's review, 2026-11-25) |
| In the world | The squad's other creeps **follow the embodied creep in the default formation**: **squares in front, triangles in the middle and on the flanks, circles behind**. An **individual order detaches a member**, which goes back to the formation when the order is done |
| World orders | A minimal set for P, through Z: **follow in formation**, **hold position**, **attack a target** (the whole squad engages, **each DNA from its side**: the square from any direction, the triangles by the flanks, the circle from the side of the ally with the highest HP) and **release**. Formation shapes come later |
| In battle | Among the players active in the battle, **the squad's leader has priority** over its creeps; through **Z**, the squad's other participants (the selected ones, or all) take **1 form on me, 2 hold position, 3 attack freely, 4 fall back**, attack freely being the default; **the battle bots use the same commands** |
| The load experiment | Attacked while loaded, a battle bot drops the load to fight or flee, or holds it when help is coming (a proposal "to experiment"; in G, lab only, cuttable) |
| Out of G | The wanderers' groups and stash (their own design round, after P); trees and climbing (a slice of their own after P) |

## 3. Scope decisions this spec assumes

Those marked **(owner)** restate G's design round. The others are **the agent's proposals**, which hold only with the
owner's acceptance; **(gameplay)** goes into the GDD, **(interpretation)** fills a detail the round did not cover. The
numbers are in §6 and are guesses.

| # | Decision | Default | Why |
|---|---|---|---|
| D1 | The squad as state **(agent)** | A **squad** is a world entity: an id from `nextId`, its leader player, its symbol and its **anchor** (the creep the others follow). A creep has a `squad` (an id, or none). **A human player has exactly one squad**, created when the player joins; **a bot has several** (D19). The embodied creep is the human squad's anchor, and `dominatedBy` keeps meaning "the embodied creep of this player": a dominated creep is always in its player's squad | Several squads per bot (owner) need an identity apart from the player. Keeping `dominatedBy` for the embodied creep keeps the junction's "human controller" and the battle screen's opening as they are |
| D2 | Joining the squad **(owner, the spec's review, 2026-11-25; interpretation)** | **Ctrl** adds: a drag box with Ctrl held adds every selected free creep of the team (up to `maxSize`), **Ctrl+click toggles** one creep in or out, and **dominating** a free creep adds it too; the symbol appears or disappears on the creep at once. A creep of another player's squad is refused (`inOtherSquad`); a squad at the player's cap refuses (`squadCap`, D26). **When the squad has no embodied creep, the first creep added becomes it.** The domination params (cost, cooldown, distance, all 0) apply when a creep joins; changing the embodied creep inside the squad is free. On macOS, ⌘ stands for Ctrl (Ctrl+click is a right click there) | Owner: building a squad is explicit, so creeps left on autopilot can take an occasional order without following the squad. The first creep being embodied keeps the squad's anchor |
| D3 | The embodied creep **(owner, the spec's review, 2026-11-25; interpretation)** | **Shift+N** dominates the squad's creep N; the panel's and the inspector's "Dominar" too. The embodied creep is **always number 1** of the squad's list: the dominated creep N **swaps places** with the previous number 1. **The squad keeps an embodied creep while it has creeps:** when it dies or leaves the squad, **number 2** becomes it. **The list's order lives in the squad's state** (a reorder command), so the panel, the numbers and that succession agree, also for an away player | Owner: dominating has its own key, the numbers select. A swap keeps every other creep's number |
| D4 | The glow and the name **(owner; interpretation)** | The embodied creep of a human shows a **glow** and **its player's name at every zoom level**, on the map and in the arena. An enemy sees them **only for a creep it sees** (the fog holds): the team view of a foreign creep in sight gains its squad's symbol and, if embodied, its player's name (revising the fog spec's D7, the enemy in sight, and its D8, under which who dominates an enemy creep stayed hidden) | Owner: visible to all. The fog's rule (GDD 01) stays: no glow through the black |
| D5 | The symbols **(owner; agent)** | **Eight** geometric symbols (a star, a cross, a crescent, a ring, a bolt, an arrow, a diamond, a hex), none of them a DNA's shape (pillar 6: the shape tells the role). Picked **in the lobby** and changeable in the match by a command; **unique within a team**; a player who does not pick gets the first free one. The bots' squads take free symbols too | Owner: a predefined list. A symbol shaped like a square or circle would read as a DNA |
| D6 | Disconnecting **(owner; agent)** | The server stops releasing a disconnected player's creep. It logs a system command that marks the player **away** (and **back** on reconnecting). While away, the embodied creep runs its autopilot rules, the squad follows it, and its encounter windows (D14) are answered by the rules at once. Nothing is released. **Timeouts:** the server's domination timeout ends; a squad lasts until it is released or empty | Owner: the squad stays. Presence must be in the log, since the autopilot is in the `sim` and the world is replayed from the log |
| D7 | The squad's size and the battle's side **(agent)** | A squad has at most `squads.maxSize` creeps (§6: 4). The battle side cap rises from 5 to **8** in the world's params, so two full squads of one team fit on one side; the lab measures the cost of 8 × 8 (§7). Above the cap, joiners wait at the bubble's edge (junction D6) | Two humans' squads in one battle (owner) would overflow 5 |
| D8 | The formation in the world **(owner; the pace by the owner at the spec's review; slots by the agent)** | Each follower has a **slot**: an offset from the anchor, turned to the anchor's **heading** (the direction of its last step). **Squares in front** (1 cell ahead), **triangles on the flanks** (1 cell to each side), **circles behind** (2 cells back); more of a DNA take the next cell of that rank. A slot on rock or river takes the nearest walkable cell to it. A follower walks to its slot; in the world creeps do not collide, so slots are targets, not bodies. **Each member walks at its own pace:** the squad does not slow down to its slowest member | Owner: the default formation by DNA; at the spec's review (2026-11-25), each at its own pace rather than the slowest's, as in Mount & Blade, so the embodied creep never waits |
| D9 | Who gets an order **(owner, the spec's review, 2026-11-25; interpretation)** | A right click orders **every selected creep of the team that can take it**, by its status: a **squad creep detaches** (it does the order and goes back to its slot); **a free creep takes it one-shot** (it does it and, when the order ends, goes back to its rules: the autopilot does not overwrite a one-shot order while it lasts); with nothing selected (or only creeps of others), **the embodied creep** takes it and the squad follows. Slice R's "Seguir" (a right click on an ally) is an order like the others. **Leaving the squad** (Ctrl+click, "Liberar") keeps the creep's current order until it ends, as a one-shot one, except the formation's follow and hold, which end at once | Owner: an individual order detaches a member; a plain order does not build the squad. A creep released mid-walk does not stop dead |
| D10 | The world's squad orders **(owner; the keys by the owner at the spec's review, 2026-11-25)** | **Z** opens the options; **1 follow in formation** (the default), **2 hold position** (the creeps stop where they stand and keep that place until "follow" or another order), **3 attack a target** (then a click on an enemy creep or wanderer in sight: each creep gets an attack approach on it from its DNA's side, D11, the embodied one too); **0 or Esc** cancels; 5–9 stay free for the formation shapes after P. The command goes to **the selected creeps of the squad or, with none selected, the whole squad**. **Release** is Ctrl+click or "Liberar" in the panel and the inspector (one creep or the whole squad) | Owner: Z for the formation options, the selection says who. 4 (fall back) is the battle's |
| D11 | Engaging from the DNA's side **(owner; interpretation)** | An attack approach that comes from "attack a target" heads for a cell next to the target, chosen by DNA: **the square** the nearest one (any direction); **the triangle** a flank cell (perpendicular to the line from the squad's anchor to the target), the nearer flank, the other when a triangle already took it; **the circle** the cell beyond the squad's ally of the highest HP, on the line from the target through that ally. The encounter opens when the first creep arrives; the others join the battle by the bubble (junction D6) | Owner: each DNA from its side. In the world, the side shows only in where each creep reaches the bubble; D15 turns that into the arena |
| D12 | Squads join their battles **(agent)** | A follower in "follow" joins a battle its anchor is in or opens, like slice R's `follow` (R D8), and also a battle another creep of its squad is in, within the bubble. In "hold", a follower joins only a battle opened on itself. A loaded follower obeys R's load rule (deliver first when the core is nearer) | The squad fights together; "hold" means hold |
| D13 | The autopilot and the squad **(agent)** | A creep in a squad does **not** run its autopilot rules (as a dominated creep today); released, it goes back to them. The anchor of an away player (D6) is the exception. The rules editor keeps working on squad creeps; its rules apply once released. R's `follow` rule and "Seguir…" for a free creep stay: they serve the bots and a human leaving an escort behind | A squad creep obeys one player. Today's domination already works this way |
| D14 | The encounter window **(agent)** | An encounter on any creep of a squad gives its leader the human's window (encounter D6, at least 10 real seconds by R D3); with no answer, the creep's reaction rules apply | Today only the dominated creep has a window; the squad's creeps are the player's too |
| D15 | Where a creep is born in the arena **(gameplay; agent)** | **A joiner** is born **in the arena block of the world cell it stands on** when it joins (the bubble is the arena's window, junction D5), on the free floor cell of that block nearest to the battle's center and **off the exit ring**; when the block has none, in its side's zone as today. **At the opening**, each side's zone is the one **toward where its creeps stand in the world**, and its creeps are born there **in formation** (D8, facing the enemy's zone). This replaces "born in its side's zone" for joiners (junction D6) | The ROADMAP's "the side each DNA engages from revises where a joiner is born": a triangle that flanks in the world flanks in the arena |
| D16 | Who commands a participant **(owner; no loan by the owner at the spec's review, 2026-11-25)** | A player is **active in a battle** when they control a participant of it on the battle screen. The leader of a squad commands its participants when active in the battle (playing the embodied one, or by Shift+N into the squad's participants there). **With the leader not active**, the squad's participants play their gambits under the last command (D17; attack freely by default), and **no other player may play them**: a player controls only their own squad's creeps or free ones (D28) | Owner: the leader has priority; at the review the owner dropped the loan the agent had proposed (another player playing an absent leader's creep), since it broke "only your squad or free creeps" |
| D17 | The battle's formation commands **(owner; Z and the default by the owner at the spec's review, 2026-11-25)** | **Z** then **1 form on me:** each takes its D8 slot around the played participant, facing its facing, and attacks enemies in reach without leaving its slot more than 2 cells; **2 hold position:** stay on the current cell, turn and attack in reach; **3 attack freely:** the DNA's gambits preset (today's behavior); **4 fall back:** the carrier's flight to the nearest exit, dropping the load if an enemy is near (K's carrier); 0 cancels. Sent to **the selected participants of the squad**, else to all but the one played; a participant a human plays ignores it. **The default is 3**, so a squad with no command fights as today. One battle command naming the participants (ADR-0002) | Owner: the commands through Z; attack freely as the default (over "form on me"), which keeps every battle without a human as today |
| D18 | The battle bots' commands **(owner; interpretation)** | A side whose squad has no active human gets its commands from a **squad AI**, a short ordered list like the gambits: **fall back** when the side's HP is below `fallBackPermille` of the enemy sides' HP, **hold** when help is coming (D23, when on), **attack freely** otherwise. Easy sends none; normal and hard use it (R D26's levels) | Owner: the bots use the same commands. The list is the gambits' shape, so the lab's editor can show it |
| D19 | The bots' squads **(owner; the glow by the owner at the spec's review; the rest by the agent)** | Slice R's raid group (a raider and 2 followers) and escort become **squads of the bot**, with the raider (the escorted collector) as the anchor; they walk in formation and attack a target by D11. **How many:** hard 2 (raid and escort), normal 1 (raid), easy none, in the strategist's settings. A bot's anchor shows its squad's symbol and **no glow**: the glow means a human plays that creep | Owner: several squads by difficulty; no glow for a bot (spec review, 2026-11-25): telling a human from a bot is information the other side uses |
| D20 | The panel **(owner; agent)** | **C** toggles it, in the world and in battle; Esc closes it. **The squad** on top, numbered 1–9 in its order (drag and drop or Shift+↑/↓ reorders; number 1 stays the embodied creep); **the teammates' squads** (by symbol); then **the free creeps**. Each line: the DNA icon, name, HP, load, the current action, the squad's symbol and leader, and "em batalha". Actions: **select**, **dominate** (refused for another player's squad), **center**, **add or release** (own squad), and **"Entrar"** for a creep in a battle. In battle, the squad's creeps outside the battle are greyed | Owner: one panel, the numbers, select, dominate, center. The rest is what P's new player asks first: where is it, what is it doing |
| D21 | "Entrar" with squads **(agent)** | It plays **the player's squad's participant highest in the list**; with none, **a free participant of the team** (it joins the squad, as a dominate does, within the cap, D26); with none, it opens the screen to watch. Revises R's D7 | R's D7 rule, with the squad first and no loan (D16) |
| D22 | Selecting several **(owner, the spec's review, 2026-11-25)** | A **drag box** selects the team's creeps in it, **Shift+click** toggles one in the selection, **0** clears it; in battle, N, Tab and a click on a participant select. The inspector lists a multiple selection (R's D23 actors' list). With Ctrl, the same gestures build the squad (D2) | Owner: the selection is who takes an order or a command; it is no longer cuttable |
| D23 | The load experiment **(owner's proposal; agent; lab only, cuttable)** | A battle side gets a **"help coming"** count from the host (world → battle): its team's creeps in the world with an attack approach on a participant or a follow on one, within `helpRadius` cells of the battle. A gambits condition `helpComing` and a squad AI one (D18); the carrier preset gets "hold the load while help is coming, drop otherwise". **Off in the world's params** (`gambits.helpComing.enabled` 0); the lab sets the count by hand in its setup | GDD 06: lab only, cut first. R's D27 already decides keep or drop in the world |
| D24 | Versions | `SIM_VERSION` (squads, their orders and commands, presence, the autopilot skipping squad creeps, the formation, the view's new fields); `BATTLE_VERSION` (the squad command, formation and hold behaviors, the birth cells, the squad AI, `helpComing`); `PROTOCOL_VERSION` (the new commands, the view and battle frame fields); fixed hashes. Old snapshots and replays become invalid (ADR-0004) | The project's rule (CLAUDE.md) |
| D25 | Two checkpoints | **G1, in the lab:** the Z commands, birth in formation and by entry, the squad AI, the load experiment; the owner plays a squad. **G2, in the world:** squads built with Ctrl, one-shot orders, the embodied creep, the panel, the selection keys, formation walking, attack a target, and **two humans of one team in one battle** with their squads (P's J6) | Lab first (ROADMAP). G2 is the closest rehearsal of P |
| D26 | The squad's cap **(owner; the formula by the agent, accepted at the spec's review, 2026-11-25)** | When a player adds a creep (Ctrl, a dominate, "Entrar"), the system checks the player's **cap**: with **total** the team's living creeps and **n** the team's connected players, each player's cap is **⌊total ÷ n⌋**, plus **1 for each of the r = total mod n active players with the fewest creeps in their squad** (ties: the player who joined first), and never above `squads.maxSize`. A squad at its cap refuses the add (`squadCap`). **The cap is checked only on adding:** a death, a birth or a player joining never releases anyone. A player with a cap of 0 still gives one-shot orders to free creeps | Owner: a maximum by players and free creeps; deaths do not touch the squads; preference to the active player with the fewest. With 2 players and 7 creeps: 3 each, and the 7th for the active one with the fewest |
| D27 | Active **(owner; details by the agent)** | A player is **active** while connected, with the game's tab **visible** and **some input** (a key, a click, a mouse movement) in the last `squads.activeSeconds` (§6: 15 s). The client tells the server only when that changes; the server logs it as a system command (active, idle), next to D6's away and back, since the cap is computed in the `sim`. Idle changes nothing else: the squad and the embodied creep stay as they are (D6 applies only to a disconnect) | Owner: "aba do jogo aberta e com qualquer atividade/input observado nos últimos 15s". A visible tab and the mouse movement keep a player who is reading the map active |
| D28 | Only one's own squad or free creeps; new creeps free **(owner)** | Any command from a player to a creep of **another player's squad** is refused (`inOtherSquad`): an order, a dominate, an add, a squad command, a battle input, **and the rules editor**. A creep the team produces is **born free**, on autopilot with the default preset, as the first generation (today the matéria collector for every DNA, with slice R's help rule; a default per DNA would be a new decision) | Owner. The rules editor is the agent's reading of "control": editing another squad's creep would change what it does once released |

## 4. Scope

### In
- **`@geometrix/sim`:** squads (D1), joining with the add command, the list's order and the embodied creep (D2, D3), one-shot orders (D9), the squad orders and their
  validation (D9, D10), the formation slots (D8), engaging from the DNA's side (D11), squads joining battles (D12), the
  autopilot skipping squad creeps (D13), the encounter window (D14), presence (D6), the symbol command (D5), the view's
  fields (D4), the bots' squads in the strategist (D19), `SIM_VERSION`.
- **`@geometrix/battle`:** the squad command and its behaviors (D17), the birth cells (D15), the squad AI (D18),
  `helpComing` (D23), the side cap (D7), `BATTLE_VERSION`.
- **`@geometrix/junction`:** the leader's priority (D16), the birth cell of a joiner from its world cell
  and the opening's zones (D15), the "help coming" count (D23).
- **Protocol and server:** the new commands, presence instead of the disconnect's release (D6), inputs and squad
  commands routed by D16, `PROTOCOL_VERSION`.
- **Client:** the three layers on the map (D2, D3, D9), the glow, name and symbol (D4, D5), the selection keys and
  Ctrl (D2, D3, D22), Z and the target pick (D10), the panel (D20), "Entrar" (D21), several selected (D22), the symbol in the lobby, the
  the selection, Z, C and the squad's marks on the battle screen.
- **Lab:** squads in the setup (a leader and its participants), the selection, Z and C, a joiner's entry cell, the squad AI in the
  editor, the "help coming" count.
- **CLI:** squad scenarios in `geo junction matrix` (§7); the squads' counters in R's pace harness.
- **Playtest:** a PLAYTEST lab group for G1 and a world script for G2 (two clients on one team).
- **GDD and glossary:** the accepted decisions.

### Out
Formation shapes (line, column, wedge); a squad slowed to its slowest member (D8, the owner chose each at its own pace); more than one squad per human;
the commander (GDD 06, parked); the wanderers' groups and stash (GDD 05, their own round); trees and climbing (GDD 01,
their own slice); squad pings, chat and macros (slice C); a battle gambits editor in the world client (junction D10);
client prediction (ADR-0009, P); the load experiment in the world (D23); renaming squads.

## 5. Behavior

Format: *When [trigger], the system shall [response].* "The team" is the player's team; "free" means in no squad.

### Squads (`sim`)
- **S-1** When a human player joins, the system shall create their squad, empty, with the first free symbol of the team.
- **S-2** When a player adds a free creep of their team to the squad (the add command, sent by Ctrl+click, a Ctrl
  drag box or a dominate), the system shall put it at the end of the squad's list (refusing with `squadCap` at the
  player's cap, D26) and apply the domination params; with no embodied creep, it shall become the embodied one (D2).
- **S-3** An add, order, dominate, squad command, battle input or rules edit from a player to a creep of another
  player's squad shall be refused (`inOtherSquad`) (D28).
- **S-4** When a player dominates a creep of their squad, it shall become their embodied creep and swap places in the
  list with the previous number 1, which stays in the squad as a follower (D3).
- **S-5** When the embodied creep dies or leaves the squad, number 2 shall become the embodied one; with none left,
  the squad is empty (D3). A reorder command shall move a creep in the list, never off number 1 for the embodied one.
- **S-6** Releasing a creep shall take it out of the squad, keep its current order until it ends as a one-shot order
  (the formation's follow and hold end at once), then hand it back to its autopilot rules; releasing the squad does it
  for every creep (D9).
- **S-6b** An order to a free creep shall not add it to the squad: it is one-shot, the autopilot does not overwrite it
  while it lasts, and when it ends the creep's rules apply (D9).
- **S-7** A squad creep shall not run its autopilot rules, except the anchor of an away player (D6, D13).
- **S-8** The server shall log a player's going away and coming back as system commands, and shall release nothing on
  a disconnect (D6).
- **S-9** A symbol command shall be refused for a symbol another squad of the team holds.
- **S-10** On an add, the player's cap shall be ⌊total ÷ n⌋ plus one for the r active players with the fewest squad
  creeps, at most `maxSize` (D26); no death, birth or join shall take a creep out of a squad.
- **S-11** The server shall log a player's going active and idle (D27); a produced creep shall be born free (D28).

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
- **B-5** The host shall give a participant to its squad's leader when the leader is active, else keep its last
  command on gambits; no other player shall play it (D16).
- **B-6** With `helpComing` on, the host shall send each side its help count on change, and the gambits and squad AI
  conditions shall read it (D23).
- **B-7** With the squad command never sent and `helpComing` off, a battle shall play as before G (the sweep, §7).

### Screens (client)
- **U-1** The map and the arena shall draw each squad creep's symbol, and the embodied creep's glow and player name at
  every zoom level (D4).
- **U-2** In the world and in battle, N shall select the squad's creep N, Tab / Shift+Tab shall move the selection
  along the squad, 0 shall clear it, a drag box shall select several and Shift+click toggle one, and Shift+N shall
  dominate creep N (D3, D22).
- **U-2b** Ctrl+click shall toggle a creep in or out of the squad and a Ctrl drag box shall add the creeps in it, with
  the symbol appearing or disappearing at once (D2); on macOS, ⌘.
- **U-3** C shall toggle the panel (D20): numbered, reorderable by drag and drop or Shift+↑/↓; its actions shall
  send the same commands as the map.
- **U-4** Z shall open the formation options and 1–3 (the world, then a click for the target) or 1–4 (the battle)
  shall send them to the selected squad creeps or the whole squad; 0 or Esc cancels; the battle screen shows each
  participant's current command (D10, D17).
- **U-5** The client shall report the player's activity changes (D27) and show the squad's cap in the panel ("3 / 4");
  the lobby shall offer the symbol; the inspector shall show a creep's squad and leader, and "Liberar".
- **U-6** "Dominar" shall stay on a selected creep's panel next to Shift+N; the right click shall order the selection
  by D9 without adding anything to the squad.

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
| | `squads.activeSeconds` | 15 s | the owner's (D27) |
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

1. **Tests** (`sim`, `battle`, `junction`, `protocol`, `server`, `client`): adding with Ctrl, a full squad, another
   player's squad; one-shot orders and the autopilot after them; release keeping the order; the embodied creep by
   Shift+N, the swap, the list's order, death and release; presence and the away anchor's autopilot;
   the slots by heading and around rock; detaching and coming back; hold; attack a target from each DNA's cell; joining
   by squad; the window to the leader; the birth cell of a joiner and the opening's zones in formation; each squad
   command; the leader's priority with no loan; the cap with its
   remainder for the active player with the fewest, and no release on a death; activity; another squad's creep
   refused everywhere, the rules editor included; the squad AI; `helpComing`; the symbols' uniqueness; the selection, Ctrl,
   Z and the panel in the client.
2. **Harness:** H-1 to H-3; the sweep with no commands (B-7).
3. **G1, the owner's lab session** (a new PLAYTEST lab group): a squad of 3 against the AI's 3 with Z's commands; the AI's
   squad commands; a joiner from a flank; the load experiment with help coming and not.
4. **G2, the world session:** `npm run dev:multi -- --clients 2 --bot` (both humans on one team against the bot): each
   builds a squad with Ctrl, gives one-shot orders to free creeps, picks a symbol, walks in formation, attacks a target, and both squads meet in one battle;
   one player disconnects and comes back.

### Criteria to close the slice
- §7 criteria green, or the owner decides what to do with what failed.
- The owner answers hypothesis questions 1–4 at G1 and G2.

## 9. Prerequisites before the `plan.md`

- The owner's acceptance of the agent's proposals (D1–D28 where marked) ✅ with the spec (2026-11-25); D8's pace, D16 with no loan, D17's default,
  D19's glow, D26's cap and D28 are the owner's answers at the review (2026-11-25).
- **R and K merged, or their plans as the base:** G builds on R's `follow`, groups, difficulty, pause and "Entrar",
  and on K's kits and carrier preset. The plan is written against both approved plans and rebased on their merges.
- **No new ADR expected:** dominating still only changes who emits a creep's commands (ADR-0002); the squad command and
  the help count are host commands inside the battle's log (ADR-0010). If the plan finds the help count changes the
  world → battle contract, it drafts one.

## 10. Open questions

None in this spec: the owner answered the squad's pace, the loan, the battle's default command, the bot's glow and the
squad's cap at the spec's review (2026-11-25; D8, D16, D17, D19, D26–D28).
