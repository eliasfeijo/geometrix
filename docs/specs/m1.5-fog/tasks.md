# M1.5 fog tasks — Fog of war

**Status:** all phases done (2026-11-14). Condensed history. **Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)

| Phase | Delivered |
|---|---|
| F0 — Design, spec and plan | design round (GDD 01, 02, 07), spec D1–D12, plan N1–N10 |
| F1 — Sight and memory in the `sim` | sight params; `TeamMemory`, `updateVision` with integer Bresenham line of sight in the team's frame; filtered `view` and `fullView`; leak test; `SIM_VERSION` 3 |
| F2 — By what the team knows | known map; paths and roads in the dark; autopilot by memory; `explore` order/action, `resourceUnknown`, `scout` preset; refusals without leaks; strategist from the view only; exploration metrics. **Checkpoint:** match start ✅, economy accepted, tick 2.2× accepted |
| F3 — Network and server | delta with `known`/`visible` and foreigners; `welcome` without terrain or cores; hidden seed; replay only of finished worlds; `PROTOCOL_VERSION` 3; `geo net` within targets |
| F4 — Client | the three fog states; foreigners; cursor and route by the known map; new rules in the editor; replay with `fullView` |
| F5 — Soak and readability | soak; fog questions in `PLAYTEST.md`; the owner's session 2; explore tie-break by gain (`SIM_VERSION` 4) |
| F6 — Playtest adjustments | E1 travel-time deposit choice and wait-or-go (`SIM_VERSION` 5); E2 gathering rate per resource; E3 click area and stack list; E4 action cursor. **Checkpoint:** closes M1.5 |
