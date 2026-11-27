# 02 — Creeps, domination and progression

## Decided
- **Hero = a dominated allied creep.** There is no fixed hero.
- Each player has at most **1 active domination**. A creep can only be dominated by one player at a time.
  **Revised by slice G's design round** (2026-11-25, below): the one domination is the player's **embodied** creep;
  the player also leads a squad of several creeps.
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
    and micro, not on DNA alone ([06](06-battles.md)). **Revised on 2026-11-25:** the DNA kits enter M2 (below);
    level, XP, evolution and leveled skills still come later.
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
- **M2 slice D, the junction** (owner, 2026-11-24; [junction spec](../specs/m2-junction/spec.md) D9, D12): **the
  world owns max HP and capacity** (capacity has the upgrade, so it is the creep's); the battle receives them with each
  participant and keeps only combat stats. HP crosses in whole points. **Domination in battle:** dominating a creep of
  one's team in a battle takes it from its gambits, with no countdown; releasing it gives it back; the domination goes
  on in the world after the battle.

- **DNA kits** (owner, R and E-min design round, 2026-11-25; slice K, before P; a direction validated in the lab
  first, numbers provisional): unique combat mechanics per DNA, **innate to the DNA** (nothing unlocked by level), so
  that combat feels like a 2D MOBA-lite on a grid, with interesting micro. Why: in the junction's matrix a circle beats
  a square in every case; the square never reaches a kiting circle (checkpoint C1b).
  - **Every DNA: a dodge** (esquiva), with a cooldown.
  - **■ The square's charged strike:** its melee hit causes a micro-stun on the victim's movement, whose duration and
    damage grow as the attack is charged, with a bar that fills up to the strike's limit. **The charge** (investida):
    holding Space speeds up the square while it moves, and the attack goes out by itself when it collides with an
    enemy creep during the charge.
  - **▲ The triangle's frontal guard:** holding Space (below), it stands still facing one direction and blocks the
    projectiles that come from the front; the square's charged strike breaks the guard; the flank stays open. It
    shields the allies behind it.
  - **● The circle's fan:** three projectiles at once, in the front lane and the two next to it, with a long cooldown.
- **The kits' details** (owner, slice K's spec round, 2026-11-25; [kits spec](../specs/m2-kits/spec.md) D3–D7;
  numbers provisional, in the params):
  - **One key, Space:** there is no separate skill key. A **tap** is the DNA's basic attack; **held**, Space fills the
    DNA's bar up to its limit, in a time set per DNA, and the hold is the DNA's skill: the square charges its strike,
    the **triangle guards while the bar fills**, the **circle charges its fan's range**. "Segurar barra de espaço
    carrega a habilidade (...), tudo configurável, não precisa de outra tecla."
  - **■ The strike:** the basic hit (a tap) also stuns; the longer Space is held, the larger the damage, the stun's
    duration **and the square's walking speed**. The strike can be charged while walking; the charge's collision
    strikes **with the bar built while running**.
  - **■ The charge's limit:** it lasts at most a configurable duration and has no cooldown of its own: it comes back
    with the attack's cooldown after the strike.
  - **The dodge:** a **double tap of a direction** (arrow or WASD) dashes 2 cells that way, fast, **untouchable**
    during the dash. **The dodge has priority** and resets the bar.
  - **The load acts as in walking:** the charge multiplies the speed the load already slows; the dodge keeps its
    distance and its cooldown grows with the load.
- **Squads and the embodied creep** (owner, slice G's design round, 2026-11-25; slice G, before P). Why: the
  difference between a *dominated* and a *selected* creep was vague, and dominating was an extra step whose only gain
  was control. Three layers:
  - **selecting only inspects** (any creep, of any side), as today;
  - **the squad** is the set of creeps a player commands. **The player builds it with Ctrl:** a drag box with Ctrl
    adds the selected creeps, **Ctrl+click toggles** a creep in or out, with the squad's symbol appearing or
    disappearing on it; dominating a free creep also adds it. A squad creep takes commands **only from that player
    until it is released**. Each player has their own squad, and a creep is in at most one. **A plain order to a free
    creep is one-shot:** the creep does it and goes back to its autopilot rules, never joining the squad (owner, G's
    spec review, 2026-11-25, revising the design round, in which an order put the creep in the squad: creeps left on
    autopilot take an occasional order without following the squad);
  - **the embodied creep** (o encarnado) is the hero of pillar 3: the squad's creep the player plays directly.
    **Dominating is how a player picks the embodied creep**, at most one per player, by **Shift+N** (the squad's
    creep N) or "Dominar"; it is always **number 1** of the squad's list (owner, G's spec review; in the design round
    Tab dominated the next creep).
  - **Selecting and the keys** (owner, G's spec review, 2026-11-25): a click selects, a **drag box** selects several,
    **Shift+click toggles** a creep in the selection, **N** (1–9) selects the squad's creep N, **Tab** moves the
    selection along the squad and **0** clears it, in the world as in battle. **Z** opens the formation options (1 to
    9, 0 cancels), for the selected creeps of the squad or, with none, the whole squad.
  - **The embodied creep is visible to everyone** (allies and enemies, humans and bots): a **glow** on the creep and
    **the player's name, visible at every zoom level**, in the world and in battle. ("cada encarnado tem um efeito de
    'glow' no creep e o nome do jogador visível em todos os níveis de zoom, e o mesmo se aplica durante a batalha.")
  - **The squad's symbol:** each player picks a symbol from a predefined list of SVGs for their squad, and every creep
    of the squad shows it, in the world and in battle. It tells which squad a creep belongs to and names the squad in
    the formation commands ([07](07-autopilot.md)).
  - **A player who disconnects keeps the squad:** the embodied creep goes back to its autopilot rules, the others keep
    following it, and on reconnecting everything is as it was.
  - **The bots' strategists lead several squads**, how many and how they behave by the difficulty, configurable
    ([07](07-autopilot.md)). **A bot's squad shows its symbol but no glow** (owner, G's spec review, 2026-11-25): the
    glow means a human plays that creep.
- **The squad's cap and who controls what** (owner, G's spec review, 2026-11-25):
  - each player has a **maximum of creeps in their squad**, by the number of players in the team and the free
    creeps: the team's living creeps divided by its connected players, rounded down, and **the remainder, one each,
    to the active players with the fewest creeps in their squad** (formula by the agent, accepted); a player is
    **active** with the game's tab visible and some input in the last 15 s (provisional);
  - **creeps that die do not affect the creeps already in a squad**: the cap is checked only when adding, and only a
    manual release takes a creep out;
  - **a player controls only their own squad's creeps or free ones** (no loan in battle, [06](06-battles.md));
  - **new creeps**, paid with resources, are **born free**, on autopilot with the default preset, as the first
    generation.
- **The panel** (owner, slice G's design round and spec review, 2026-11-25): **C** toggles one **fixed panel**, in
  the world and in battle, which stays open while the player clicks its actions (Esc closes it): **the squad on top,
  numbered 1 to 9** like the number keys, in an order the player changes (drag and drop, or Shift+↑/↓), the embodied
  creep always 1; the rest of the team below. Each line has actions: **select, dominate, center on the map**.

- **A left click lists everything in its area** (owner, slice R's review of 2026-11-25 and R F6's opening,
  2026-11-27; slice R): creeps of any team, wanderers, the deposit, the core, a spoil, a battle. **Any two or more
  open the list**, even on a click right on one creep (this ends the fog slice's direct selection of the creep
  clicked in its middle); one alone is selected at once.

## Proposal
- **Slice G's control details** (agent, slice G's design round, 2026-11-25; to approve in
  [G's spec](../specs/m2-groups/spec.md)): the panel's line also shows the DNA, name, HP, load, current action, squad
  symbol and who leads it, and an **"Entrar"** for a creep in a battle; the symbol is
  picked in the lobby and can be changed in the match, one per squad within a team; an enemy sees the embodied
  creep's glow and name only when the creep is in its sight (the fog holds); the squad's size is a param, tuned in
  the lab with the battle's side cap (5 today, `maxPerSide`): two squads of one team in one battle exceed it.
  "Liberar" releases one creep or the whole squad.
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
