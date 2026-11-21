# M2 encounter tasks — Slice A

**Status:** all phases done (2026-11-17). Condensed history; branches were `m2/encontro-f<n>-<slug>`.
**Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)

| Phase | Delivered |
|---|---|
| F0 — Design, spec and plan | interactive round (D1–D21, recorded in the GDD); ADR-0007; plan P1–P11 |
| F1 — Identity, HP and events | names and `births` in the `sim`; HP in thousandths, regeneration, `kill`; event collector, audience and `eventsFor`; new view fields; `SIM_VERSION` 6 |
| F2 — The encounter in the `sim` | `Encounter` and `Spoil`; `approach`/`pickup`/`flee`; the encounters stage; extortion, safe-conduct, pair block; escape; loot and spoils; mutual encounter; reaction vocabulary and `react`; raider preset; refusals without leaks; events |
| F3 — Bots and harness | raiders in the strategist; event metrics in `geo sim`/`geo sweep`; `geo verify` with events. **Checkpoint:** C1–C10 (plan §11.1) |
| F4 — Network and server | zod, `Delta` with encounters and spoils, events in the delta, chronicle in the `welcome`, `PROTOCOL_VERSION` 4; `chronicle` table and recovery; `geo net` within targets |
| F5 — Client | HP bars, names, spoils, map marks, right-click menu, reaction panel, chronicle and sentence bank, inspector, rules editor, replay. C11 decided after it |
| F6 — Soak and playtest | soak with the chronicle; encounter questions in the PLAYTEST; raider `minCargo` 10 (`SIM_VERSION` 9). **Checkpoint:** C12–C14, the slice closes |
