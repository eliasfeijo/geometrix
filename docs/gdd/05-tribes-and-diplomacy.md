# 05 — Neutral tribes, monsters and diplomacy

## Decided
- The jungle has **monsters** and **neutral tribes**.
- A tribe can become an **ally or rival** of any team and decide the outcome of the match.
- Diplomacy with the tribes affects the team's economy.
- **The wanderers** (owner, 2026-11-15; M2, slice D, the junction): hostile creeps by nature that roam fast, fragile
  and weak, and respawn more and more often as the match goes on. They can join a battle between teams that is
  nearby ([06](06-battles.md)). They are the first neutral faction: a side that is not a team.
- **The wanderers at the junction** (owner, 2026-11-24; [junction spec](../specs/m2-junction/spec.md) D14):
  - a wanderer is a **circle with its own stats** (HP and damage below the circle's, in the params), in a neutral
    color: no new shape;
  - it **always attacks**, with no dialogue or extortion;
  - it targets only **loaded** team creeps in sight;
  - it **carries what it loots until it dies**, when the load becomes spoils: a full wanderer is worth hunting.

## Proposal
- **A side that is not a team** (agent): the junction's ADR on the neutral side builds only the wanderers, without
  generalizing for factions that do not exist yet (first the concrete).
- **The wanderers' respawn curve** is a function of world time, in the params (agent).
- **Where and how many** (agent, junction spec D14 and §6): born in the jungle band along the river, outside the core
  zones; they roam between random cells of that band; the first at world hour 1, then one every 60 world minutes
  shrinking to 15 by day 3, at most 4 alive; HP 60 and damage 12 (provisional). Teams may attack them, not extort them.

## Parked (the owner's ideas, no milestone)
- **Bosses:** they live at a spot on the map, are slow and respawn slowly; buff bosses give the team that defeats them
  a temporary buff and sit on the enemy's path; a stronger river boss drops a rare item. Whoever lands the last hit
  takes the buff or item.
- **Tribes:** a dialogue with the tribe (fight or talk), quests paid from the tribe's physical stock, a relationship
  per creep and per team, and a secret happy ending in which the tribes' quest saves the whole world.

## Open questions
- How a relationship with a tribe goes up or down; what an allied tribe does; whether diplomacy is a team decision.
