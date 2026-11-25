# 03 — Economy, transport and taxes

## Decided
- There are two levels of economy:
  - **individual:** each creep's inventory;
  - **the team's:** the public treasury.
- Every resource and currency must be **physically transported** to the base, by creeps or mules.
- The base's "state" charges a **tax**, with a rate voted by the team, and the value goes to the public treasury.
  *(Not built yet; parked with governance, [04](04-governance.md).)*
- Wealth can be invested in upgrades, fortifications, individual items and creep production.
- **Two resources: matéria + cristal** (described below). The values are provisional.
- **Slower cristal gathering** (owner, M1.5 session 2, 2026-11-14): gathering pace is per resource, and cristal is
  gathered more slowly than matéria: **1 unit every 5 s** (matéria, 1 per second), provisional. Measured at the fog F6
  checkpoint, the pace barely delays depletion (1 s → 8.7 h; 5 s → 9.1 h; 30 s → 12.6 h, seeds 1–3): the bots gather
  all the map's cristal and end with ~68% of it idle in stock. The owner kept the 5 s and left depletion and the role
  of cristal for later.
- **M1 economy rules** (2026-11-13; details in the [M1 spec §5](../specs/m1-wealth-cycle/spec.md)): the capacity
  counts both resources summed; instant delivery at the core; matéria regenerates up to its initial value; the core
  produces one creep at a time, with a "repeat" that waits for resources; roads are neutral (both teams walk on them),
  built cell by cell from the network, never on a river crossing.
- **Loot and spoils** (owner, 2026-11-15): if nobody flees, the winning side keeps the resources of the losers who
  died in the battle. The **spoils** are a pile on the ground any creep can pick up: they keep the loot that did not
  fit in the winner's load and the purse dropped when fleeing ([06](06-battles.md)).
- **M2 slice A, the encounter** (owner, 2026-11-15; [encounter spec](../specs/m2-encounter/spec.md)):
  - **Physical extortion** (D8): the demand is the victim's load up to the aggressor's free capacity, cristal first;
    paying moves the demand from the victim's load to the aggressor's. Nobody extorts an empty creep, nor while full.
    DNA weighs with no new number: the square extorts a lot and is slow; the circle extorts little and catches up.
  - **Loot and spoils** (D11): the winner collects the dead creep's load up to its free capacity, cristal first, and
    the rest becomes spoils; spoils on the same cell add up; spoils **do not expire** in slice A and stay in the
    team's memory like a deposit.
  - **What drops when fleeing** (D10): whoever escapes drops 50% to 100% of each resource (rolled), provisional.
- **Buildings only recover through paid repair** (owner, 2026-11-15; slice E).
- **The snowball** (owner, R and E-min design round, 2026-11-25): at checkpoint C2 the bot lost 5 of its 6 creeps and
  could not replace them (a creep costs 3,000 matéria, and a team's first extra creep comes at about world hour 3).
  Slice R tries **only the rescale of the pace**, with no new rule: a creep then costs less of a session. The sweeps
  measure whether it is enough.
- **Dropping the load in the world** (owner, slice R's spec review, 2026-11-25): a creep can **drop its load** on the
  map (a world order for a dominated creep and an autopilot action), which leaves it as spoils on its cell. It opens
  new behaviors for the bots' strategist, which reacts to each encounter by its difficulty and the estimated risk
  ([07](07-autopilot.md)).

## Proposal

### Resources are defined by axes, not by name
First we choose which **logistics problems** we want to create. The name and theme come later.

| Axis | Question |
|---|---|
| Origin | Where is it born? Near the base, in the jungle, only in contested territory? |
| Renewal | Does it regenerate or deplete? |
| Weight | How much inventory does it take? (sets how many trips or mules are needed) |
| Value per unit | Is it worth an ambush? |
| Perishability | Does it spoil in transit or idle? |
| Use | What does it unlock? |

The minimal set, with opposite problems:
- **Matéria:** heavy, low value, abundant near the base and renewable. Builds and produces creeps. *Problem: volume.*
- **Cristal:** light, valuable, rare, at contested jungle spots and depletable. *Problem: risk; the natural target of
  ambushes.* Its uses are still open (below).

A candidate for later: **energy**, perishable, the creeps' upkeep and the population limiter. *Problem: continuous
flow.*

### Resource × currency (the owner is not convinced yet)
- Currency only exists after the base "mints" it: resources delivered to the state become currency (the tax is
  charged on that conversion). Light and easy to carry; pays for creeps, items and trade.

### Sinks
A match of days needs sinks so the economy does not inflate: upkeep, structure wear, cristal spent on evolutions.

## Parked (the owner's ideas, no milestone)
- **Depleted cristal as the seed of the world's end** (2026-11-15): each depleted cristal deposit becomes a focus of
  corruption that grows over the map ([01](01-world.md)). The depleted deposit stays in the state with `amount` 0.
- **Bridges and river buildings:** a built crossing that lets a road cross the river.
- **Trade between teams** (barter as an encounter action).

## Open questions
- Validate the resource axes.
- Resource × currency: minted currency, or are resource and currency the same thing?
- Can a creep spend its own inventory without going through the treasury?
- **The role of cristal.** Each team needs ~390 cristal and gathers ~1,200, depleted in ~8–9 h; the contested deposits
  are barely contested. More uses, richer contested deposits, or a slower depletion? Matters for the junction: cristal
  is what makes a load worth ambushing.
- **A sink.** After the population cap, the stock grows unused in the last ~20–30 h of the world ([balance pass 1](../specs/m1-wealth-cycle/balance.md) §6).
  Postponed by the owner (2026-11-14) until there is a human playtest.
- **Tie-break on a contested deposit.** When creeps of both teams gather at the same nearly empty deposit, the lower
  id takes the unit. With the fog, on seed 42 team 0 pulls ahead after ~15 h (151k × 140k matéria in 3 days).
  Accepted for now; to revisit in a balancing round (owner, 2026-11-14); not in slice R (2026-11-25).
