# ADR-0004: World persistence: SQLite + snapshots + command log + Litestream

**Status:** Accepted (2026-11-13) · **Date:** 2026-11-13
**Related:** ADR-0001 (the world must be durable), ADR-0002 (everything is a command), ADR-0003 (deterministic
simulation)

## Context
A world lasts days and cannot be lost on a restart or crash. Each world has **a single writer**: the process that
simulates it. The simulation is deterministic, so the state can be rebuilt from a snapshot plus the commands that
follow it. We also need to store the harness metrics and the replay logs.

## Alternatives
- **A. Embedded SQLite, one file per server, with continuous backup through Litestream** (chosen).
  - Pros: zero infrastructure; transactions; local disk latency; fits the single-writer model; backup to object
    storage costs cents.
  - Cons: tied to the machine (scales by sharding worlds, not by write replicas).
- **B. Managed Postgres.**
  - Pros: industry standard; serves several processes.
  - Cons: cost and operations we do not need for a single writer; network latency on every snapshot.
- **C. Files only (JSON snapshot + JSONL log).**
  - Pros: as simple as it gets.
  - Cons: no transactions; metrics and queries are awkward; reinvents durability.
- **D. Full event sourcing** (store every event, including the ones the autopilot generates).
  - Cons: redundant, because the simulation is deterministic; the volume grows for no reason.

## Decision
Option A, with this model:
- **Command log:** only the inputs **external** to the simulation: human commands, autopilot rule edits and world
  creation parameters. Each one carries the tick at which it was applied. What the autopilot decides is recomputed
  from the state and is not stored.
- **Snapshot** of the full state every N ticks (N is a parameter), plus the state hash.
- **Recovery:** load the last snapshot and replay the commands after it. The most that can be lost is what was in
  memory before the write (a few ticks).
- **Harness metrics** in their own tables, in the same file or a separate one.
- **Replay** = initial snapshot + log. The same format as recovery.
- **Backup:** Litestream continuously replicates the SQLite file to S3-compatible object storage.

## Consequences
- The command log becomes a contract, versioned with the command vocabulary (ADR-0002).
- A change to the simulation rules invalidates replays of old worlds. Worlds and replays store the simulation
  version; a running world ends on the version it started with, or goes through an explicit migration.
- Horizontal scale happens by **sharding worlds** across processes and machines, never with two writers on one
  world.
- Driver: `better-sqlite3` (mature and synchronous, which suits the tick loop) or `node:sqlite`, decided in the
  `plan.md`.
