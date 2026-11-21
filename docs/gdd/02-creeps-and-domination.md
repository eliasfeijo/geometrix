# 02 — Creeps, domination and progression

## Decided
- **Hero = a dominated allied creep.** There is no fixed hero.
- Each player has at most **1 active domination**. A creep can only be dominated by one player at a time.
- When **released**, the creep keeps its autopilot configuration and keeps obeying it. It can be dominated again, by
  the same player or another of the team.
- **Creeps are produced with resources.**
- **DNA = the creep's innate shape/archetype:** square = melee tank; circle = ranged glass cannon; triangle =
  medium-high life, medium range.
- Each creep has its own progression: level, stat allocation, DNA (innate) × individual evolution. **Not in M2.**
- Each creep has an **inventory**. Its capacity varies with level, stats and DNA.
- **Death is permanent.** The exception would be a revive skill, spell or ultimate.
- *(From the initial concept)* 3 base skills + 1 ultimate unlocked by leveling up. **Not in M2.**
- **M1** (2026-11-13): dominating is free (cost, cooldown and distance exist as parameters, set to 0). The cost comes
  out of the team stock; the cooldown is per player; the distance is from the team's core to the creep. A dominated
  creep only changes its order by a command from whoever dominates it. Details in the
  [M1 spec §5](../specs/m1-wealth-cycle/spec.md).
- **The DNAs are equivalent in economic impact** (2026-11-14). Capacity × speed gives practically the same
  throughput for the three (30 × 2, 20 × 3, 10 × 5, provisional); the difference shows in other systems, from M2 on.
  Measured in [balance pass 1](../specs/m1-wealth-cycle/balance.md) §5.
- **Sight by DNA** (M1.5, 2026-11-14): the circle sees farthest (radius 6), then the triangle (4) and the square (3),
  provisional. The fast, light one is the natural scout; the heavy-load square is the most blind.
- **M2 design round** (owner, 2026-11-15):
  - **In M2, only base stats per DNA** (life, damage, range, battle speed), in the params. Level, XP, evolution and
    skills come later, to see combat without progression on top. In battle, who wins depends on level, stats, skills
    and micro, not on DNA alone ([06](06-battles.md)).
  - **HP persists in the world:** a creep that leaves a battle wounded returns wounded to the map and recovers HP
    slowly, faster near the core. Wounded, it becomes a target.
  - **Retreating is possible, at a cost:** the encounter's escape is dropping the purse and running ([06](06-battles.md)).
- **M2 slice A, the encounter** (owner, 2026-11-15; [encounter spec](../specs/m2-encounter/spec.md)):
  - **Name in the state** (D1): the creep gets its name at birth, in the `sim`. **No renaming in M2.**
  - **Base stats in slice A** (D2): each DNA gets only max HP and a fight weight for the throwaway roll. Provisional
    HP: square 300, triangle 200, circle 120.
  - **HP regeneration** (D3): in ‰ of max HP per world minute, the same for the three DNAs, slow on the map and
    faster within a radius of one's own core; none during an encounter or a fight. Provisional: 0 to full in 100 min
    on the map and in 10 min near the core (radius 8).
  - **Death of a dominated creep** (D4): the domination ends, like a `release`, with no cooldown.
- **M2 slice B, the battle lab** (owner, 2026-11-15; [lab spec](../specs/m2-battle-lab/spec.md) D6): the base combat
  stats per DNA (max HP, damage, range, cooldown, battle speed, projectile speed, capacity) live in the battle
  package's params until the junction, which picks a single source for what exists on both sides.

## Proposal
- Dominating only changes **who emits the creep's commands**. See [ADR-0002](../adr/0002-every-action-is-a-command.md).
- **Population needs a limiter.** In a world of days, without a limit, the number of creeps grows and weighs on
  performance and balance. Candidates: upkeep, a housing cap, or aging.
- **Renaming a creep:** a new command in the versioned vocabulary, when the creep has a game identity.

## Parked (the owner's ideas, no milestone)
- **Progression:** level, XP, evolution and skills; temperaments at birth.
- **Legends** (2026-11-15): any creep alive at the end of the world becomes a legend that may invade other worlds.
- **Reproduction and generations:** M/F creeps, age, natural death, DNA inheritance, as an elegant population
  limiter.

## Open questions
- Does dominating need a cost, a cooldown or a distance limit? (Free in M1 and M2 so far.)
- Can a creep change shape as it evolves, or is DNA fixed forever?
- Can creeps of allied tribes be dominated?
- **Several creeps on the same cell** (M1 F7, 2026-11-14): in the world, creeps do not collide, and "twins" (same DNA,
  born together) pick the same deposit and walk stacked. Should they spread? It is a game rule: it changes the economy
  and probably the junction's battles. Meanwhile, the client shows each creep and lets the player pick one in a stack.
