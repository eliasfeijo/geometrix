# ADR-0002: Every action in the simulation is a command

**Status:** Accepted (2026-11-13) · **Date:** 2026-11-12

## Context
Many sources act on the same creeps: the human dominating a creep, client macros, the autopilot (declarative or
scripted) on the server, test bots, vote delegation. If each source had its own path into the simulation, the result
would be duplicated rules and loopholes for cheating.

## Decision
The simulation (world and battle) only changes through **commands** validated by the server (`moveTo`, `cast`,
`gather`, `deliver`, `build`, `vote`, …). Every control source produces commands, and the simulation does not know
who produced them. Dominating a creep only changes the source of its commands.

## Consequences
- A script or the autopilot can never do more than a human could. This is the structural anti-cheat.
- Replays and reproducible tests become cheap: initial state + seed + command log. That requires a deterministic
  simulation (fixed tick, seeded RNG, no `Math.random`).
- Test bots use the same interface. That is what makes a headless balancing harness possible.
- The command vocabulary becomes a contract that must be documented and versioned.
