# M2 tasks — The minimal end

**Status:** F0 ✅ (spec and plan approved 2026-11-25) · F1 ✅ (2026-11-27); F2 next. Branches `m2/emin-f<n>-<slug>` (skill `commit`).
**Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)

## F0 — Spec and plan

- [x] Design round with the owner (2026-11-25, with slice R), recorded in GDD 01
- [x] Spec approved (2026-11-25), with the owner's answers (the bot reads only the stock; the five events are the
      match's) and the first blood (D15); the gameplay in GDD 01, 07 and 08
- [x] **Checkpoint:** the owner approves the plan (P1–P13), 2026-11-25

## F1 — The end in the world

- [x] State: `Team.out`, `WorldState.result` and `highlights`, `Battle.entered`, the team counters; `createWorld`;
      `end.highlights` in the params (P2, P6, P7)
- [x] `concede` and its refusals (`teamOut`, `worldEnded`); a team out's players refused; leaving the match releases
      dominations and drops the repeat; production refused (L-2, L-3, L-4, F-4; P3, P4)
- [x] `checkEnd` between regeneration and vision: elimination, the result, the clock (L-1, F-1..F-3; P1)
- [x] `step` and `stepJunction` refuse an ended world; the instances left as they are (F-5, X-1; P8)
- [x] Events: `teamOut` and `worldEnded` to every team; `died.firstBlood`; `battleEnded.entered` and `spoiled`
      (K-1, K-2, K-4; P5)
- [x] The counters (born, lost, battles won and lost) and the highlights' ranking; `endSummary` (D10; P6)
- [x] The view: `ForeignTeam.out`, `TeamView.result` and `summary`, in `fullView` too (K-3)
- [x] A hand-built three-team world: one concedes, the world goes on (D7, X-2), then ends; nothing leaks
- [x] `SIM_VERSION` (P13), the fixed hashes; the protocol and the client compile against the new types

### F1 record (2026-11-27)

**What it does.** The `sim` ends the world: `concede`, elimination, the result (one team, none, the clock), a frozen
world (`step` and `stepJunction` throw), `teamOut`/`worldEnded` for every team, `died.firstBlood`,
`battleEnded.entered`/`spoiled`, the born, lost and battle counters, the five highlights, `endSummary`, and the result
and summary in every view. `SIM_VERSION` 14; `PROTOCOL_VERSION` stays for F3.

**Measured.** `geo verify --seed 42`: deterministic (2 runs, snapshot mid-battle, replay of 558 commands, 68 battles).
A whole `geo sim --seed 42` match: 5.0 s. The end's stage with 60 creeps and an empty stock (the full scan):
~86 ns/tick, about 0.1% of a tick. `sim` tests of the end: `end.test.ts`, plus the junction's X-1 and X-2.

**Interpretations to validate in the playtest** (the plan's most literal reading):

1. A battle ended as `empty` (nobody left in the arena) counts as neither won nor lost, like one ended by inactivity.
2. A battle the wanderers win is lost by every team with a side in it.
3. `battleEnded.spoiled` is the load by resource left as spoils; the ranking adds matéria and cristal. Every ended
   battle is a candidate, with or without a winner.
4. `Battle.entered` counts every join, so a creep that leaves and joins again counts twice. The team views do not
   carry it (the end's highlights do, through `battleEnded`).
5. An ended world refuses every command with `worldEnded`, the system ones included; before that, only `concede` is
   refused with `worldEnded` once at most one team remains.
6. `stepRealtime` does not refuse an ended world (the plan names `step` and `stepJunction`): F3's server must not call
   it after the end (plan §5, its test).

**Left for later phases.**

- **F2:** `runBots` does not stop on `state.result` yet. A whole match ends on its last tick, but a run in which a team
  is eliminated earlier, or one with `--time` past the duration, throws.
- **F3:** the server still ends a world by its tick count, so an elimination or a concession before the clock makes the
  next tick throw. The deltas do not carry `result` or `summary`: `emptyView` and `sentView` hold `null`, so a client's
  view hash differs from the server's on the end tick. `concede` is already in the protocol's schema (the vocabulary
  check needs it), so a client could send it.
- **F4:** the chronicle's `teamOut` and `worldEnded` sentences are placeholders ("{time} saiu da partida.", "A partida
  acabou."); the first blood has no sentence of its own yet. The core panel and the refusal texts say "Seu time saiu da
  partida." for `teamOut`.

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
