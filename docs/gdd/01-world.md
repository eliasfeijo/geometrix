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
  runs out with no core brought down, it is a draw** (provisional).

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

### Victory in a world of days
- **Destroying the base is a process, not an instant.** A siege on the core takes hours and warns the attacked team.
  Without that, a team loses the match while asleep. Slice E's design round decides.
- Offline defense comes from fortifications + defensive autopilot.

## Parked (the owner's ideas, no milestone)
- **The world's end as an arc** (2026-11-15): the world ends in an apocalypse that unfolds during the match (the
  owner's candidate: the corruption of depleted cristal deposits, [03](03-economy-and-logistics.md)), with a
  chronicle and a climax; a pyrrhic victory; legends and invaders from other worlds ([02](02-creeps-and-domination.md)).
- **Destructible trees** that block sight, to deepen the jungle beyond rocks.
- **Camps and neutral structures:** the core as the team's first camp; towers any team can camp in, giving a ranged
  attack; battle terrain taken from the surroundings ([06](06-battles.md)).

## Open questions
- **Repair:** how much it costs, who repairs, and whether one has to be on the spot. Slice E.
- Can the core be moved or rebuilt? Can a team have more than one base?
- Can players join a world already in progress? (Matters for the first friends' playtest.)
- What can be built and where (only near the core, in controlled territory, anywhere)?
- Is the river only an obstacle, or also a transport route?
