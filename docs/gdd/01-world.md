# 01 — Persistent world and map

## Decided
- The match is a **persistent world that lasts days**: the sandbox, building and the RTS layer live here.
- It starts with teams of up to 3 players and may grow (which leads to representatives, see [04](04-governance.md)).
- **Victory: destroy the enemy base.** The definition will be deepened (slice E).
- **Match start direction: "foundation"** (described below). The details will be tuned as playtests reveal what is
  fun.
- **Duration: an initial hypothesis of 3 days**, with a plausible range of 1 day to 1 week. The final value is only
  fixed after controlled, observed tests.
- **Fog of war (M1.5, design round of 2026-11-14).** No client, and no bot, sees the full state; only what its own
  team sees and remembers. The sync of [ADR-0006](../adr/0006-world-sync.md) (a per-team view delta, computed on the
  server) was chosen for this.
  - **Who gives sight:** the core and each team creep, within a Manhattan radius. The creep's radius depends on its
    DNA ([02](02-creeps-and-domination.md)): circle 6, triangle 4, square 3; the core sees 8. Provisional, in the
    params.
  - **Rocks block sight** (fog spec, D1): the rock is seen, what is behind it is not. River and fords do not block.
  - **Black fog:** outside its own sight, the team knows nothing at the start of the match: not the terrain, the
    deposits or the enemy core.
  - **Of the enemy, in sight:** creeps (position, DNA and load), roads and road jobs. Enemy stock, production,
    upgrades, autopilot rules and orders stay hidden.
  - **Team memory:** deposits keep the last value seen; roads and jobs seen stay on the map; enemy creeps disappear
    when they leave sight.
  - **Paths by what the team knows:** a never-seen cell counts as passable jungle; on discovering rock or river on
    the way, the creep recomputes. No order reveals hidden terrain.
  - **What was seen and does not change stays known:** explored terrain and, once seen, the enemy core position.
  - **Three states on screen:** never seen (black), remembered (dimmed, with the last value) and visible now.
  - The autopilot also decides only by what the team knows ([07](07-autopilot.md)).
- **Buildings with HP** (owner, 2026-11-15): the **core**, **finished roads** and **road jobs in progress** have HP
  and can be destroyed. HP persists and only recovers through paid repair ([03](03-economy-and-logistics.md)). Roads
  are neutral, so any side can bring them down, including the one the enemy uses. Slice E.
- **The enemy in sight** (owner, 2026-11-15; [M2 encounter spec](../specs/m2-encounter/spec.md) D18): besides
  position, DNA and load, the enemy creep in sight shows its **name**, its **HP** and whether it is in an encounter or
  a fight. Wounded, it becomes a target.
- **No safe zone** (owner, 2026-11-15; encounter spec D21): nobody is safe near the core; the harness measures
  whether creeps camp outside the enemy core.
- **The minimal end** (owner, 2026-11-15; slice E): bringing down the core ends the world, and the end gets a screen
  with the result and a summary of the chronicle, and the replay gets markers for the main events. **When the clock
  runs out with no core brought down, it is a draw** (provisional; kept by the owner in the R and E-min design round,
  2026-11-25).
- **The minimal end before the siege** (owner, R and E-min design round, 2026-11-25; slice E-min, before the friends'
  playtest). The core only gets HP in slice E, after P, so until then a match ends otherwise:
  - **defeat by elimination in fact:** a team with no creep alive, nothing in production and a stock below one
    creep's cost can no longer come back, and loses;
  - **concession:** any human of a team may concede, with a confirmation;
  - **the bot concedes when it has no chance:** at most 1 creep, nothing in production and a stock below one creep's
    cost;
  - **the clock:** a draw among the teams still in the match;
  - **the world ends when one team remains** and freezes, read-only, with its replay (agent, approved);
  - **the end screen** (agent, approved): the result, the duration and, per team, creeps born and lost, battles won
    and lost, matéria delivered and the five main events of the chronicle. **Replay markers** (agent, approved):
    battles (start and end), deaths, births, wanderers and the end;
  - **written for N teams** (agent, approved): the humans of an eliminated team become spectators; slices R and
    E-min add no new two-team assumption.
  - **The details** (agent, approved with the [E-min spec](../specs/m2-minimal-end/spec.md), 2026-11-25): elimination
    is checked at the end of each tick, after production (a creep born on the tick saves the team); concessions apply
    in the log's order, and the one that leaves a single team ends the world; when the last teams leave on the same
    tick, it is a draw among them; at the world's end open battles stop where they are, with no result; the end is
    public (every team learns that a team left the match, and how); the end screen also shows when each team left and
    offers the frozen map and the replay; the five main events are the match's (owner), ranked by a team leaving, the
    first blood, then the largest battles. **Until slice T**, a team out of a world that goes on keeps its view as a
    spectator, its players can no longer command, and its remaining creeps keep their rules with no player.
  - **First blood** (owner, at the E-min spec's approval, 2026-11-25): the first death of a team's creep in the match,
    by anyone, gets its own chronicle sentence and is always among the end's five main events
    ([08](08-chronicle-chat-and-console.md)).
- **The pace of the friends' playtest** (owner, R and E-min design round, 2026-11-25; slice R): a match lasts **about
  2 real hours**, from the start to the clock. It gets there with a **shorter world at a moderate ×N** (around ×6 to
  ×12), not with a higher ×N on the 72-hour world: the duration, costs, production, regeneration and the wanderers
  are rescaled in world time and the DNAs walk faster on the map. The numbers, the ×N and the map size come from a
  balance pass of sweeps with targets for 2 hours (agent, approved). Why: at ×36 a 60-second human battle locks its
  creeps for 36 world minutes, so anyone on the map arrives in time, and an auto battle goes by in about 2 real
  seconds. The 3-day hypothesis (duration, above) stays for the game itself.
- **More than two teams gets its own slice** (owner, 2026-11-25): **T**, a candidate right after P that competes with
  E for its turn (the order is chosen at P's checkpoint), with its own design round. The first P plays two teams.
  The owner's idea and the agent's analysis are in the proposal below.
- **Slice R's pace details** (agent, approved with the [R spec](../specs/m2-rebalance/spec.md), 2026-11-25): the
  **default params become the 2-hour world** and the 72-hour world stays as a params file for the 3-day hypothesis;
  the lobby and `dev:multi` default to the chosen ×N; a window meant for a human's reaction (the extortion answer)
  keeps **at least 10 real seconds** at that ×N; the targets of the balance pass are written in real minutes (spec §7).
- **The balance pass's candidates** (owner, R's checkpoint C2, 2026-11-27): the 2-hour world at **×6, ×8 (the
  default) and ×12** all go to the playtest sessions, which choose the ×N (numbers provisional; R's F4 record in the
  [tasks](../specs/m2-rebalance/tasks.md)).

## Proposal

### Time as a parameter
- Every duration (gathering, production, siege, the whole match) is a **balancing parameter** in data, never a
  constant in code.
- The world clock has a **multiplier**: a "3-day" match can run in hours with bots and no interface, or at a
  compressed pace in a human playtest. It is what makes controlled duration tests possible.

### Match start: "foundation" (hybrid)
Each team starts with a **core** (the heart of the base; destroying it is victory) and a starting population, in a
start zone. Beyond that, the map is **jungle only**, with a **river** crossing the map horizontally. The base grows
from the core as the team builds.

- **A seeded map, mirrored** on both sides of the river. Each world is different, but both teams get equivalent
  conditions.
- **Lanes are built, not given.** The teams open roads through the jungle and the main routes emerge from their
  choices. The river has few crossings (fords, bridges), which become bottlenecks and natural battlegrounds.
- **Foundation draft** *(optional)*: before the match, each team builds its starting population (a mix of DNAs) with
  the same point budget.

### More than two teams (owner, 2026-11-25; slice T's design round)
The owner: worlds with **up to 4 teams**, with a map that adapts to fit them all with room to explore and gather, and
the number of wanderers adjusted. Besides the owner, three friends could play a collective playtest, but gathering
everyone at the same time is hard.

Agent's analysis (2026-11-25):
- **Already takes N teams:** the state (teams by id), the fog and the per-team views, the battle's sides (up to 4,
  wanderers included). And 4 humans already fit in two teams (`teams.maxHumans` is 3): 2 × 2, 3 × 1, or co-op
  against the bot.
- **Assumes two teams:** the map (point symmetry, one river between the sides; 4 teams need a square map with 90°
  symmetry, e.g. a river in a cross, contested cristal at the center and the wanderers near the cross); the mirrored
  path tie-break (`isRotatedSide`, one rotation for team 1) in pathfinding, vision, roads, the autopilot, the
  strategist and the client's road plan; the client's names, colors, lobby and replay; `dev:multi` and the soak; a
  strategist with several enemies; and a balance pass of its own. About the size of slice R.
- **What the round decides:** alliances or free-for-all; what an eliminated team does while the world goes on; the
  map's shape and size per number of teams; how many wanderers.
- **The schedule problem is not solved by more teams:** a 2-hour match needs everyone online at once either way; the
  bot filling the empty seats helps, and it already does with two teams.

### Victory in a world of days
- **Destroying the base is a process, not an instant.** A siege on the core takes hours and warns the attacked team.
  Without that, a team loses the match while asleep. Slice E's design round decides.
- Offline defense comes from fortifications + defensive autopilot.

## Parked (the owner's ideas, no milestone)
- **The world's end as an arc** (2026-11-15): the world ends in an apocalypse that unfolds during the match (the
  owner's candidate: the corruption of depleted cristal deposits, [03](03-economy-and-logistics.md)), with a
  chronicle and a climax; a pyrrhic victory; legends and invaders from other worlds ([02](02-creeps-and-domination.md)).
- **Destructible trees** that block sight, to deepen the jungle beyond rocks. **Climbing a tree** (owner, slice G's
  design round, 2026-11-25): a creep may use a "climb" command and stay **hidden, for ambushes**, while its sight radius
  grows and **sees across every tree and rock** (a view "from above"). If the tree is destroyed while a creep is
  climbing it, the creep simply comes back to the ground on that cell. The trees could also host the wanderers' stash
  ([05](05-tribes-and-diplomacy.md)). Placed by the agent as **a slice of its own after P**, a candidate next to E: it
  is a new terrain (mirrored map generation, two-level sight, hiding, trees in the arena), and destroying a tree is
  E's question of how a structure is attacked.
- **Camps and neutral structures:** the core as the team's first camp; towers any team can camp in, giving a ranged
  attack; battle terrain taken from the surroundings ([06](06-battles.md)).

## Open questions
- **Repair:** how much it costs, who repairs, and whether one has to be on the spot. Slice E.
- Can the core be moved or rebuilt? Can a team have more than one base?
- Can players join a world already in progress? (Matters for the first friends' playtest.)
- What can be built and where (only near the core, in controlled territory, anywhere)?
- Is the river only an obstacle, or also a transport route?
