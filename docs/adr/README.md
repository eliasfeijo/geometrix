# ADRs

Flow: a draft enters as `Proposed` and only becomes `Accepted` with the owner's approval. A replaced decision becomes
`Superseded by NNNN`.

| # | Title | Status | Date |
|---|---|---|---|
| [0001](0001-world-and-battle-as-separate-simulations.md) | World and battle as separate simulations | Accepted | 2026-11-12 |
| [0002](0002-every-action-is-a-command.md) | Every action in the simulation is a command | Accepted | 2026-11-12 |
| [0003](0003-typescript-node-pure-integer-simulation.md) | TypeScript + Node LTS, with a pure, integer-math simulation | Accepted | 2026-11-13 |
| [0004](0004-persistence-sqlite-command-log.md) | World persistence: SQLite + snapshots + command log + Litestream | Accepted | 2026-11-13 |
| [0005](0005-mvp-deploy-vps-websocket.md) | MVP deploy: one VPS + Docker Compose + Caddy; WebSocket transport | Accepted | 2026-11-13 |
| [0006](0006-world-sync.md) | World sync: per-field deltas of each team's view | Accepted | 2026-11-14 |
| [0007](0007-sim-events.md) | `sim` events: output derived from `step`, outside the state | Accepted | 2026-11-15 |
| [0008](0008-battle-package.md) | Battle package: its own deterministic simulation and the internal contract v0 | Accepted | 2026-11-15 |
| [0009](0009-prediction-in-the-lab.md) | Predicting your own creep as a lab experiment option | Proposed | 2026-11-20 |
| [0010](0010-world-side-of-the-battle-contract.md) | The world side of the battle contract: battle instances next to the world | Proposed | 2026-11-24 |
