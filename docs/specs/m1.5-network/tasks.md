# M1.5 network tasks — Deltas of each team's view

**Status:** all phases done (2026-11-14). Condensed history. **Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)

| Phase | Delivered |
|---|---|
| F0 — Spike, spec and plan | hand-written diff and Colyseus spike (plan §1); spec and plan approved (R1–R7) |
| F1 — View in the `sim` | 6 h bot × bot hash lock; `view.ts` (`CreepView`, `TeamView`, `view`); structural types for the strategist's helpers (R3); the strategist reads the team view; the "rules are replaced whole" convention (R4) |
| F2 — Delta in `protocol` | `delta.ts` (`Sent`, `diffView`, `applyDelta`, `viewJson`); property test 6 h × seeds 1, 42, 649; `geo net`. **Checkpoint:** 227 B/s, 83 µs per send, 0 divergences, hash unchanged |
| F3 — Server | stream per team with `seq`, buffer, periodic hash, resumption with the stream id, resync |
| F4 — Client | applies deltas, resumption, resync, protocol version, `?net=1` panel |
| F5 — Viability | soak with headless clients; [viability.md](viability.md); the owner's session. **Checkpoint:** approved, on to fog |
