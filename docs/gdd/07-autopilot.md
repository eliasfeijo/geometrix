# 07 — Autopilot and macros

## Decided
- Creeps have a **configurable** and, possibly, **scriptable** autopilot.
- The configuration persists after the domination ends.
- Client macros, customizable by the player, automate tasks.
- **M1** (2026-11-13; details in the [M1 spec §5](../specs/m1-wealth-cycle/spec.md)): a declarative autopilot per
  creep. The first rule with a true condition and a possible action becomes the order; with no valid rule, the creep
  keeps what it was doing. Creeps are born with the *matéria gatherer* preset.
- **Gathering with depleted deposits** (2026-11-14; revised by the owner in M1.5 session 2): the creep picks the
  non-empty deposit it reaches fastest (travel time over the map the team knows, counting roads) and stays with it
  until full. If the deposit runs dry, it **only waits there for regeneration if that pays off** compared with walking
  to the nearest known deposit with enough matéria. Depleted cristal: picks another.
- **The autopilot respects the fog** (M1.5, 2026-11-14): conditions and deposit choice use only what the team knows
  ([01](01-world.md)). A creep does not gather from a deposit the team has never seen.
- **The "explore" action** (M1.5, 2026-11-14): go to the nearest never-seen cell. The gatherer preset gets "explore"
  right after "gather", valid only when the team knows no deposit of the resource; a new **scout** preset only
  explores and, with nothing left, returns to the core (fog spec, D3). Target (D4, plan N4): the nearest never-seen
  cell no other team creep targets; **among the equally near, the one that would reveal the most never-seen cells**
  (owner, 2026-11-14).
- **Encounter stances** (owner, 2026-11-15; [encounter spec](../specs/m2-encounter/spec.md) D13, D14): since almost
  every encounter happens with no human watching, the reaction comes from the autopilot.
  - The **enemy in sight** condition (radius, DNA, minimum load); the **approach** (attack or extort the nearest
    enemy in sight that passes the filter) and **pick up spoils** actions.
  - **Reaction rules**, evaluated only in the encounter and the fight: "demand up to X‰ of the load" and "HP below
    X‰"; actions pay, fight and flee.
  - **With no valid reaction rule:** pays extortion, tries to flee an attack and, mid-fight, keeps fighting.
  - **The raider preset:** extort a loaded enemy in sight → pick up spoils in sight → deliver if full → explore;
    fights when attacked and flees with low HP. **Minimum target load 10** (owner, 2026-11-17), the circle's
    capacity; provisional. On seed 42 over 3 days, encounters fell from 112 to 23
    ([encounter plan](../specs/m2-encounter/plan.md) §11.1, C11).
- **Battle gambits** (owner, 2026-11-15; [lab spec](../specs/m2-battle-lab/spec.md) D14, D15): in battle, each
  non-dominated creep follows an ordered condition → action list, like the world autopilot. Presets per DNA
  (frontline, marksman, skirmisher, carrier), editable in the lab. The AI decides with a **reaction time** (250 ms ±
  100 ms, provisional; lab plan, P12). At the lab checkpoint: "it does its job".
- **Reactions at the junction** (owner, 2026-11-24; [junction spec](../specs/m2-junction/spec.md) D1, D2): the roll
  and its flee leave. A free creep whose reaction rule says **flee** enters the battle with the **carrier** gambits;
  with **fight**, or with no rule, with its DNA's preset. Extortion still ends in pay or refuse. World creeps fight
  with the **normal** reaction; **no battle gambits editor in the world client** in slice D (spec D10, owner with the
  spec).

- **"Follow" an allied creep** (owner, checkpoint C2 and the R and E-min design round, 2026-11-25; slice R): a creep
  follows another to walk in a group, and the follower joins the fight by itself when its target attacks or is
  attacked. A right click on an ally gives "Seguir" (a dominated ally too); when the target dies, the follower goes back
  to its next rules. The bots' strategist uses it to escort and to attack in a group.
- **Helping an ally in battle** (owner, R and E-min design round, 2026-11-25; slice R): a new condition, **an ally in
  battle in sight**, with the action to join it, with a radius and a posture per DNA, in the presets by default, for
  the creeps of human teams and of the bot alike, and editable like any rule. Why: at checkpoint C2 no creep on
  autopilot ever helped a fight, the bot's or a human team's.
- **The road builder is an autopilot preset** (owner, 2026-11-25; slice R): the autopilot decides where to build (the
  rule the bots' strategist already uses), not a point the player picks on the map. It builds while there is a stretch
  to build and stock for it, and gathers matéria when the stock is short. A human who dominates the creep chooses
  where to build with the action every dominated creep already has in its panel. With the creep selected, the map
  shows the plan: the path from the core to the deposit, with the total cost against what is already paid. Replaces
  the 2026-11-20 "it does not build" bug (the preset asked for a point and nothing happened).
- **The bots' strategist for P** (owner, R and E-min design round, 2026-11-25; slice R): the bot plays in both modes
  of the friends' playtest, humans against humans (the bot only in solo tests and sweeps) and humans in co-op against
  the bot, so it has to be a real opponent (agent, approved): it reinforces fights in sight, defends its core, replaces
  its losses, attacks in a group with "follow", and its posture stops sending every loaded creep fleeing (which also
  ends the almost free extortion against it: its triangle always pays).
- **Helping and following with a load** (owner, slice R's spec review, 2026-11-25; slice R): a loaded creep
  **delivers at the core first when its path there costs less than its path to the fight** (by roads, for instance);
  otherwise it helps. An empty creep helps.
- **"Seguir…" for a creep that is not dominated** (owner, slice R's spec review, 2026-11-25; slice R): the rules editor
  offers it, so a human who dominates one creep brings others along.
- **The bot's difficulty** (owner, slice R's spec review, 2026-11-25; slice R): the strategist reacts **by its
  configured difficulty**; the default is **always the hardest**, for now, but configurable. With the world's
  **"drop the load"** ([03](03-economy-and-logistics.md)) and the hostile sign ([06](06-battles.md)), it **reacts to
  each encounter with a fitting strategy**, by its difficulty and the action's estimated risk.
- **Formations in the world** (owner, slice R's spec review, 2026-11-25; slice G, with its own design round): with
  "follow" comes the chance, "almost the duty", of formation commands, presets and rules in the style of Mount &
  Blade, for humans and the strategist. The default formation: **squares in front, triangles in the middle and on the
  flanks, circles behind**; and **by which side each one engages**: the square from any direction, the triangles from
  the sides, flanking, the circle from a side with the ally of the highest HP.
- **Slice R's autopilot and strategist details** (agent, approved with the [R spec](../specs/m2-rebalance/spec.md) D8–D18,
  D26, D27, 2026-11-25):
  - **follow** is a world order (the dominated creep) and an autopilot action (with the ally's id): the follower stays
    within 2 cells by the target's path, does not gather, deliver or pick up while following, joins a battle its
    target is in or opens on its target's side; it cannot follow itself, another team or a wanderer, and a cycle is
    refused. The rules editor's "Seguir…" puts the rule on top of the creep's rules, after its reaction rules;
  - **helping an ally:** the condition `allyInBattle` (a battle with an ally within the radius, in sight) and the action
    `joinBattle` (approach the nearest enemy participant); the posture per DNA is a radius and an HP floor (■ 6 cells
    and 400‰, ▲ 6 and 500‰, ● 8 and 500‰, provisional); in every preset after the reaction rules;
  - **the road builder:** its `buildRoad` has no cell and resolves to the strategist's `roadTarget` each time; the
    action with a cell stays for the editor and the dominated creep;
  - **the strategist:** defends its core zone (an attack rule on its creeps there while an enemy is inside); produces
    before the upgrade when below its population peak; a raid group of a raider and 2 followers from 8 creeps, an
    escort on a cristal collector from 10; its posture pays a demand of at most 250‰ of the load, flees below 400‰
    HP and fights otherwise; every rule reads any number of teams;
  - **the difficulty**, per bot, chosen at the world's creation, **hard** by default: hard adds the encounter reactions
    and the battle reaction `hard`; normal keeps the posture, defense and groups, with `normal`; easy plays slice D's
    posture with no defense or groups, with `easy`. R tunes hard only;
  - **the encounter reactions** (hard): on the next world tick, from the estimated risk (the enemies near against the
    allies that can arrive, by DNA and HP): help coming → keep the load and fight; a stronger enemy → pay a small
    demand, or drop and flee; even or stronger → drop, fight and pick the load up afterwards.

## Proposal
- Humans, macros, autopilot and bots emit the **same commands** ([ADR-0002](../adr/0002-every-action-is-a-command.md)).
  A script never has more power than a human.
- **Phase 1, declarative:** an ordered list of `condition → action` rules, in the style of Final Fantasy XII's
  *gambits*. Configurable without programming, safe and cheap to run on the server.
- **Phase 2, script:** JS in a server sandbox (QuickJS/WASM or isolated-vm), with CPU and memory limits. References:
  Screeps, Gladiabots.
- The same interface serves the **test bots**: whole matches run headless, for balancing.

## Open questions
- Where does the autopilot live: per creep, per group of creeps, or per player?
- Is the allowed complexity (number of rules, script CPU) a progression mechanic?
- What is the difference between a client macro (only while online) and the autopilot (on the server)?
- **A deposit remembered as empty** (encounter F3 checkpoint, 2026-11-17): the autopilot only picks a deposit with a
  remembered amount above zero, and a depleted deposit out of sight regenerates without the team knowing. On seed 42,
  3 days, the harmed team delivers 20–25% less matéria. The owner left it for a balancing round; not in slice R
  (2026-11-25).
- **The presets and the wanderers** (checkpoint C1b, 2026-11-25): a loaded square fights a wanderer (its DNA's
  posture) and mostly dies; only the raider picks up spoils, so in 3 days of seed 42 37 piles (1,593 matéria) lie on
  the map. The strategist's changes for P are decided above (2026-11-25); who picks up spoils stays open.
