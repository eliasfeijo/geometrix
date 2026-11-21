# ADR-0001: World and battle as separate simulations

**Status:** Accepted (2026-11-13) · **Date:** 2026-11-12

## Context
The game has a persistent world that lasts days (economy, building, governance) and real-time MOBA-style fights.
They have opposite requirements:

| World | Battle |
|---|---|
| Low tick rate, runs 24/7 | 20–30 ticks per second, lasts minutes |
| Must be durable (days of play cannot be lost) | Can be ephemeral |
| Many entities, little activity each | Few entities, a lot of activity |

## Alternatives
- **A. One simulation with a variable tick per region** (regions with active humans tick faster).
  - Pros: no border between the two modes.
  - Cons: the durable part and the real-time part share one process; hard to scale and keep consistent.
- **B. Separate battle instances** (chosen): a snapshot of the participants goes in, result events come out.
  - Pros: each side has its own tick and its own persistence model; battles run in parallel, in other processes;
    auto-resolve reuses the same simulation.
  - Cons: border semantics (bubble, reinforcements, locking participants, passage of time).
- **C. Everything in real time.**
  - Cons: high cost, and a world of days does not need it.

## Decision
Option B, following the model in [`gdd/06-battles.md`](../gdd/06-battles.md).

## Consequences
- The world-battle contract (the snapshot and the result events) is the most important interface in the game. It
  must be versioned.
- The world must be durable and recoverable after a crash: a command/event log plus periodic snapshots.
- The battle simulation must run with or without a client, and accelerated (auto-resolve, tests, balancing).
- Left open for design: the battle trigger, the bubble and reinforcements, the passage of time.
