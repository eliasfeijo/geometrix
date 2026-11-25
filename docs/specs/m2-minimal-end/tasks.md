# M2 tasks — The minimal end

**Status:** F0 in progress (the plan waits for the owner). Branches `m2/emin-f<n>-<slug>` (skill `commit`).
**Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)

## F0 — Spec and plan

- [x] Design round with the owner (2026-11-25, with slice R), recorded in GDD 01
- [x] Spec approved (2026-11-25), with the owner's answers (the bot reads only the stock; the five events are the
      match's) and the first blood (D15); the gameplay in GDD 01, 07 and 08
- [ ] **Checkpoint:** the owner approves the plan (P1–P13)

## F1 — The end in the world

- [ ] State: `Team.out`, `WorldState.result` and `highlights`, `Battle.entered`, the team counters; `createWorld`;
      `end.highlights` in the params (P2, P6, P7)
- [ ] `concede` and its refusals (`teamOut`, `worldEnded`); a team out's players refused; leaving the match releases
      dominations and drops the repeat; production refused (L-2, L-3, L-4, F-4; P3, P4)
- [ ] `checkEnd` between regeneration and vision: elimination, the result, the clock (L-1, F-1..F-3; P1)
- [ ] `step` and `stepJunction` refuse an ended world; the instances left as they are (F-5, X-1; P8)
- [ ] Events: `teamOut` and `worldEnded` to every team; `died.firstBlood`; `battleEnded.entered` and `spoiled`
      (K-1, K-2, K-4; P5)
- [ ] The counters (born, lost, battles won and lost) and the highlights' ranking; `endSummary` (D10; P6)
- [ ] The view: `ForeignTeam.out`, `TeamView.result` and `summary`, in `fullView` too (K-3)
- [ ] A hand-built three-team world: one concedes, the world goes on (D7, X-2), then ends; nothing leaks
- [ ] `SIM_VERSION` (P13), the fixed hashes; the protocol and the client compile against the new types

## F2 — The bot and the harness

- [ ] The strategist's concession with no human in its team; nothing after its team left (B-1, B-2)
- [ ] `runBots` stops at the end; the End section in `geo sim`; the ends table in `geo sweep`
- [ ] `--concede team@minute` in `geo sim` and `geo verify` (P12); `geo verify` with an end by concession and at the
      clock on its three paths
- [ ] The bot × bot ends: `geo sim` 3 days (seed 42) and `geo sweep` (seeds 1–20), recorded here

## F3 — Network and server

- [ ] Protocol: `concede`, `teamOut`, `result` and `summary` in the delta, `ForeignTeam.out`; `PROTOCOL_VERSION` (P13)
- [ ] `WorldHost` ends from `state.result`; no strategist for a team out; the real-time clock skips an ended world
- [ ] The lobby's result; an ended world restarts ended, without its battle instances (N-1; P8)
- [ ] The export of an ended world reaches the same result, summary and hash (N-2); the diff property green (N-3);
      `geo net` within the targets
- [ ] `dev:multi --set path=value` (P11)

## F4 — Client

- [ ] "Desistir" and its confirmation (D3, S-5)
- [ ] The end screen over the map and the battle screen; "Ver o mapa", "Ver o replay"; entering an ended world
      (D9, S-1, S-2; P9)
- [ ] The spectator of a team out (D7)
- [ ] The chronicle sentences: a team leaving, the world's end, the first blood (D8, D15)
- [ ] The result in the lobby (S-4)
- [ ] The replay markers: the scan pass, the marks, the toggles, the hover, the jump; the end screen at the last tick
      (D11, S-3; P10)

## F5 — Soak and playtest

- [ ] The soak checks the end against the export and reports when and how the world ended
- [ ] The PLAYTEST E-min group (spec §8), with the `--set` overrides for short sessions
- [ ] **Checkpoint C1:** the owner's sessions (against the bot until it concedes, a concession between two tabs, the
      clock's draw, the replay's marks), the hypothesis questions and the tone of the sentences
