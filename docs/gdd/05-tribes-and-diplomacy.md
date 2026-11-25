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
- **The wanderers in the junction spec** (owner, 2026-11-24, approving the agent's proposals; numbers provisional):
  a side that is not a team, built only for them (no core, stock, player or domination; seen through the fog like an
  enemy); born in the jungle band along the river (rows within 8 of it), outside the core zones; they roam between
  random reachable cells of the band; the first at world hour 1, then one every 60 world minutes shrinking linearly to
  one every 15 by the end of day 3, at most 4 alive; HP 60 and damage 12, the rest of the circle's kit; they join a
  battle between teams they see, on their own side; teams may attack them, not extort them.
- **The wanderers' gaps** (owner, 2026-11-25, F6 of the junction; numbers provisional):
  - a wounded wanderer **regenerates on the map like a creep** (the map rate; it is never in a core zone);
  - it joins **any battle with a team in it** that it sees, not only one between two teams, on the one wanderers'
    side (up to the side cap): wanderers gang up on the same creep;
  - it chases a loaded creep while it sees it, also out of the band, but **never enters a core zone**: a creep that
    reaches home is safe from them.
  - after a battle, a wanderer **leaves alone the creeps that were in it with it** for a while (10 world minutes,
    provisional), like slice A's extortion block; it still attacks other loaded creeps. Without it, a creep that
    escaped by the border came back a few cells from the wanderer and was attacked again at once (owner,
    2026-11-25, after a bot × bot run with 638 battles of one wanderer against one gatherer in 6 h).
- **The wanderers in the new pace** (owner, R and E-min design round, 2026-11-25; slice R): **early and regular**:
  the first around 5 real minutes into the match, then at short intervals, at most 4 alive (numbers provisional, set
  by the sweeps). At checkpoint C2, 3 were born in 3.9 world hours, the first at world hour 1 (10 real minutes at
  ×6).
- **The wanderers' kit in slice K** (owner, slice K's spec round, 2026-11-25; [kits spec](../specs/m2-kits/spec.md)
  D8): the wanderers get **the circle's kit** (the dodge and the fan), with their own stats, until their own DNA and kit
  (below) have their design round.

## Proposal

## Parked (the owner's ideas, no milestone)
- **The wanderers' own DNA and kit** (owner, 2026-11-25): "os errantes poderiam ter um DNA e kit únicos, inclusive a
  forma geométrica poderia ser um círculo com moicano (ex: espinhos triangulares no topo do círculo), e deve propor um
  combate desafiador do início ao fim do jogo". The owner chose **its own design round** for it, outside slice K.
- **The wanderers attack in groups** (owner, slice G's design round, 2026-11-25): "Wanderers devem atacar em grupo do
  meio pro final da partida, e agir como uma squad com um bot estrategista" (the squads,
  [02](02-creeps-and-domination.md)). Placed by the agent in the wanderers' own design round above, after P: a group's
  size depends on their kit and stats, and slice R has just set their curve.
- **The wanderers' stash** (owner, slice G's design round, 2026-11-25): a "secret" spot where a wanderer drops what it
  loots. Two variants: **one stash per team** ("ex: 2 times 2 stashes"), at mirrored positions relative to the
  matching cores, or **specific spots generated on the map**, for instance among the trees
  ([01](01-world.md)). Same placement as the groups: it changes slice D's rule that a wanderer carries its loot until
  it dies, and so what makes a full wanderer worth hunting.
- **Bosses:** they live at a spot on the map, are slow and respawn slowly; buff bosses give the team that defeats them
  a temporary buff and sit on the enemy's path; a stronger river boss drops a rare item. Whoever lands the last hit
  takes the buff or item.
- **Tribes:** a dialogue with the tribe (fight or talk), quests paid from the tribe's physical stock, a relationship
  per creep and per team, and a secret happy ending in which the tribes' quest saves the whole world.

## Open questions
- **The stash's loot** (above): with one stash per team, does the loot taken from a team go to the stash near that
  team's core, or to another? Who may raid a stash, and is it seen through the fog like spoils?
- How a relationship with a tribe goes up or down; what an allied tribe does; whether diplomacy is a team decision.
