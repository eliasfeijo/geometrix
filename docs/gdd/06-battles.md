# 06 — Real-time battles

## Decided
- The **world state** and the **battle state** are separate concepts
  ([ADR-0001](../adr/0001-world-and-battle-as-separate-simulations.md)).
- A battle is a **dedicated instance** of real-time combat, MOBA-style. It does not sync in real time with the world
  and emits to it only the events that matter.
- Battles win clashes, not the war (pillar 1).
- **M2 design round** (owner, 2026-11-15):
  - **The encounter triggers the battle.** When creeps of opposing sides meet, an approach opens with a dialogue: the
    aggressor picks the first action, and the victim reacts if the action does not open a battle at once. The
    aggressor attacks or extorts; the victim pays, refuses (battle) or flees.
  - **Sides, not groups.** An encounter is at least 1×1 and can have more than two sides (teams, wanderers). One can
    join a battle already started.
  - **Who wins:** stats and the micro of whoever plays, human or bot. DNA and load do not decide alone. In M2, only
    base stats per DNA ([02](02-creeps-and-domination.md)).
  - **Experimental, configurable combat:** different combat rules behind the ADR-0001 contract, without one blocking
    another. M2 builds the encounter in the world and a local **battle lab** in parallel, and joins them later. Until
    the junction, the encounter's fight is decided by a **throwaway roll** nobody balances.
  - **Safe-conduct after paying extortion:** the victim is immune only to new approaches by the extorting team, for a
    while or until it reaches its own core's zone (encounter spec, D9), and loses it if it approaches someone.
  - **Fleeing: drop the purse and run.** The victim drops part or all of its load as spoils
    ([03](03-economy-and-logistics.md)) and gets faster; the aggressor chooses between picking up and chasing.
  - **Losses count in the world:** death is permanent, and HP persists after the battle.
- **M2 slice A, the encounter** (owner, 2026-11-15; [encounter spec](../specs/m2-encounter/spec.md), with the
  provisional numbers): approaching with the intent in the order (D5); a dialogue even for an attack, with a 60 s window
  for a dominated creep (D6); the throwaway roll (D7); fleeing by relative speed, dropping 50–100% of the purse (D10);
  mutual encounters (D12); the safe-conduct ending by time or at one's own core zone (D9). **Each combat rule tried has
  its own escape mechanic.**
- **M2 slice B, the battle lab** (owner, 2026-11-15; [lab spec](../specs/m2-battle-lab/spec.md)). **The first rule
  is the grid:**
  - **directional attack** (D4): the creep faces one of 4 directions; the square hits the cell in front; the circle
    and the triangle shoot a projectile that moves cell by cell and hits the first enemy, and can be dodged. No
    friendly fire. One cell, one creep: the square blocks the way (D5). In the same tick, the hit goes out before the
    step, and the projectile moves after the creeps (lab plan, P3);
  - **escape by the border** (D7): the arena is the bubble; whoever stays on the exit ring for a moment without being
    hit leaves the battle. Load slows the creep; it can drop the purse as a pile anyone can pick up (D8);
  - **the end** (D9): **no duration clock**. A **battle-wide** inactivity clock resets when anyone deals or takes
    damage; when it runs out, everyone flees at once, with no winner. The battle ends when at most one side is left;
  - **sides** (D10, D11): 2 to 4, hostile to each other; one can join mid-fight, with no dialogue;
  - **gambits AI** (D14, D15): an ordered condition → action list per creep, with presets per DNA, editable in the
    lab; it is the lab's opponent and the auto-resolve.
- **Lab F3 checkpoint** (owner, 2026-11-17): **raw combat is not balanced** (basic attacks only) before skills, levels
  and stats; the lab is for trying and validating candidate rules. Arenas 2× larger, with spawn zones halfway between
  the border and the center, away from the exit. A hit resetting the escape count is fine, as long as **the bot's
  difficulty is configurable** (in the lab, each AI participant's reaction).
- **The starting countdown** (owner, 2026-11-17): a battle starts with a **3 s countdown** (provisional) in which
  everyone may turn but not move or attack, the AI included. It is a battle rule: it applies in the lab, the world and
  auto-resolve. **At the end of the countdown, only what is held at that instant counts** (2026-11-20): what was
  pressed and released during it is discarded.
- **Lab F5 checkpoint** (owner, 2026-11-18): **the first step is immediate** (a standing creep moves on the tick after
  the command, then at its DNA's pace); **inactivity is the battle's, not each creep's** (15 s with no damage to
  anyone, provisional).
- **Lab F5 checkpoint, part 2** (owner, 2026-11-19 and 20):
  - **the grid rule is fun:** "I really liked the result we reached for combat", above all after the attack, hit and
    miss signs on screen;
  - **no new combat rule before the junction:** "let's join what we have"; the grid is good enough to see how combat
    affects a real (and simulated) match;
  - **deploy and prediction wait for the junction:** acceptable latency and client prediction are decided after the
    whole cycle is joined (the world opens the instance, the channel stays open for reinforcements and third parties,
    the result returns to the world). Client prediction may come in;
  - **movement is tried before becoming a rule:** the lab compares four ways of drawing movement (PLAYTEST group 7).
- **M2 slice D, the junction: design round** (owner, 2026-11-24; [junction spec](../specs/m2-junction/spec.md)):
  - **the roll leaves:** an attack always opens the battle; on extortion, the victim pays or refuses, and refusing
    opens the battle. **Fleeing is only in the arena** (the border, dropping the purse); a free creep whose reaction
    rule says flee enters with the carrier gambits;
  - **world time:** the world keeps its pace (its ×N); a battle with a human playing runs in real time, and its
    participants stay locked in the world while it lasts;
  - **auto-resolve on the world clock:** with no human, 1 battle second = 1 world second, so reinforcements and a
    human taking over have time to arrive;
  - **only who chooses joins:** a creep that approaches a participant to attack, inside the bubble, enters on its
    team's side or on a new side; an ally helps by approaching the enemy;
  - **the arena from the terrain, enlarged:** the world cells around the encounter become blocks of the arena, at the
    lab's size; rock stays rock, river, ford and road become floor; spawn zones as in the lab;
  - **the loot:** at the end, the winning side's survivors collect up to their free capacity, cristal first, and the
    rest becomes spoils in the world (slice A's rule);
  - **the battle screen opens by itself** when the creep you dominate enters a battle, in place of the map, with a
    button back to the map; teammates get a button to watch;
  - **taking over mid-fight:** a player may dominate a creep of their team that is already in a battle; it leaves its
    gambits for the human, and the battle switches to real time.

## Proposal
See [ADR-0001](../adr/0001-world-and-battle-as-separate-simulations.md). The world side of the contract is
[ADR-0010](../adr/0010-world-side-of-the-battle-contract.md) (`Proposed`): battle instances next to the world, run by
a junction host; the world log keeps only the results.
- **Exit:** a participant that dies or escapes leaves the battle in the world on the same tick; an escapee comes back
  on the world cell under the border it left by, with slice A's run home ([junction spec](../specs/m2-junction/spec.md)
  D7, D8; agent).
- **The bubble is the arena's window** (agent, junction spec D5, D6): 9 × 5 world cells around the battle's cell, each
  a 5 × 5 block of arena (provisional); whoever enters it with an attack approach on a participant joins.
- **Short battles** (agent): 1 to 2 minutes; each human controls only the creep they dominate.
- **Dialogue only at the opening** (agent): whoever joins mid-fight skips the conversation; the chronicle records the
  entry ([08](08-chronicle-chat-and-console.md)).

```mermaid
sequenceDiagram
    participant W as World (low tick)
    participant B as Battle (real time)
    W->>B: participants + terrain
    Note over W: participants are locked in the world
    W-->>B: late arrivals (reinforcements, third parties)
    B-->>B: combat (humans dominating and/or gambits)
    B->>W: result events
    W->>W: applies the events and releases the participants
```

## Parked (the owner's ideas, no milestone)
- **Battle sound and kill announcements** (2026-11-18 and 19): a sound for the shot and the hit; "double kill" style
  announcements for spectators. No priority.
- **The commander** (2026-11-20): in group battles, a player who sets the team's tactics in the arena, and whoever
  joins mid-fight follows them.
- **A learning AI** (2026-11-17): the bot starts dumb and gets smarter, up to a "nightmare mode". Agent's path: an
  offline search for gambit lists that beat the previous best, using auto-resolve. Lab finding: the ● still picks the
  same corridors, and a human learns the route.
- **Battle terrain from the surroundings** (2026-11-15): battles near the river, trees, rocks, roads and structures get
  their own terrain, with obstacles, walls and towers.
- **Other combat rules** (2026-11-15): free movement (MOBA-lite), a forge layer (physical weapons with durability).
  None before the junction (C9).

## Open questions
- How movement is drawn in the game (the four lab options). After PLAYTEST group 7.
- **Critical hits?** (owner, 2026-11-18): a hit that sometimes deals more damage. With stats and skills; not in M2.
