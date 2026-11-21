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
  3 days, the harmed team delivers 20–25% less matéria. The owner left it for a balancing round.
- **The road-builder preset** (owner session, 2026-11-20): it does not build (see the
  [dashboard](../dashboard/current-status.md)). Bug or rule?
