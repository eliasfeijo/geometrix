# M2 tasks — The minimal end

**Status:** F0 ✅ (spec and plan approved 2026-11-25) · F1 ✅ (2026-11-27) · F2 ✅ (2026-11-27) · F3 ✅ (2026-11-27); F4 next. Branches `m2/emin-f<n>-<slug>` (skill `commit`).
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

- [x] The strategist's concession with no human in its team; nothing after its team left (B-1, B-2)
- [x] `runBots` stops at the end; the End section in `geo sim`; the ends table in `geo sweep`
- [x] `--concede team@minute` in `geo sim` and `geo verify` (P12); `geo verify` with an end by concession and at the
      clock on its three paths
- [x] The minimum time and the team's vote (L-5 to L-7, P14; owner, 2026-11-27): the three `end.concede*Seconds`
      params, `tooEarly`, `rejectConcede` and its refusals, the vote in the team and its events, the deadline in
      `checkEnd`, the strategist waiting; `SIM_VERSION`, the fixed hashes
- [x] The bot × bot ends: `geo sim` 3 days (seed 42) and `geo sweep` (seeds 1–20), recorded here

### F2 record (2026-11-27)

**What it does.** The balanced bot concedes a lost match (B-1, B-2). `geo sim`, `geo sweep` and `geo verify` stop at
the world's end; the reports have an End section and a table of ends, both from `endSummary`; `--concede team@minute`
logs a real `concede`; `geo verify` takes `--set` and also compares the end summary across its paths. **Added during
the phase** (the owner's revision of the concession, 2026-11-27, relayed by the orchestrator session): the minimum
time and the team's vote with a deadline (L-5 to L-7, P14). `SIM_VERSION` 15.

**Measured.**

- `geo sim --seed 42 --days 3`: ends at the clock (tick 57,599, 120 real minutes at ×8), a draw; born 19 / 19, lost
  6 / 5, battles won/lost 30/7 and 47/4, matéria 22,179 / 22,586. Its simulation time against `main`, three runs each,
  alternated: 5.4–5.6 s here, 5.1–5.9 s there (no regression).
- `geo sweep` (`end.highlights=5`, seeds 1–20): **20 of 20 end at the clock**, a draw. No bot ever concedes or is
  eliminated in bot × bot at hard.
- `geo verify --seed 42`: deterministic, also with `--concede 1@130` (a bot's concession at tick 7,800) and with
  `--set world.durationSeconds=7200` (the clock), the same summary on every path.

**Interpretations to validate** (the agent's, besides the proposals of L-7):

1. In the minimum time and the deadline the current tick counts whole, as the clock does.
2. ~~The minimum time is 7,200 world seconds in every `params/*.json`~~ Answered by the owner (2026-11-27): the
   times count in real minutes at any ×N, so each params file converts them by its `world.multiplier` (×6: 5400, 360,
   1080; ×8: 7200, 480, 1440; ×12: 10800, 720, 2160). The owner also approved L-7's details and that a yes may be
   taken back; the other interpretations wait for the playtest. The tests' fixed params have 0.
3. The `sim` does not stop a bot player from conceding a team that has humans; only the strategist holds back (D4).
4. A `--concede` before the minimum time is a usage error; one after the world ended, or for a team already out, is
   not logged.
5. A forced concession in the harness comes from a bot player, so it reads as "the bot's concession".

**Left for later phases.**

- **F3:** as in the F1 record, and now reachable by the bot: `main`'s server still ends by tick count, so a bot's
  concession on a server world makes the next tick throw. `rejectConcede`'s schema is already in the protocol (the
  vocabulary check needs it). `geo net` steps its own loop and does not stop at the end.
- **F4:** the vote's chronicle sentences are placeholders; the refusal texts of `tooEarly`, `voteCooldown`,
  `alreadyVoted` and `noVote` are in `format.ts`.

## F3 — Network and server

- [x] Protocol: `concede`, `teamOut`, `result` and `summary` in the delta, `ForeignTeam.out`; `PROTOCOL_VERSION` (P13)
- [x] The vote through the network (L-6, L-7): `rejectConcede` (its schema is in since F2) and the refusals, the
      team's vote in the delta, its events
- [x] `WorldHost` ends from `state.result`; no strategist for a team out; the real-time clock skips an ended world
- [x] The lobby's result; an ended world restarts ended, without its battle instances (N-1; P8)
- [x] The export of an ended world reaches the same result, summary and hash (N-2); the diff property green (N-3);
      `geo net` within the targets
- [x] `dev:multi --set path=value` (P11)

### F3 record (2026-11-27)

**What it does.** The server ends a world from `state.result` (an elimination or a concession before the clock no longer
makes the next tick throw), and does not ask the strategist of a team out. The delta carries `result` and `summary`
once, on the end tick; the vote and `out` already travelled with the team entities (now listed as compared by
reference). `PROTOCOL_VERSION` 9; `SIM_VERSION` stays 15. The lobby list has `result` (`how`, `winner`, `teams`); an
ended world restarts ended, without battle instances. `geo net` stops at the end and says so. `dev:multi --set
path=n` (repeatable). The client only compiles and keeps the new fields in its store.

**Measured.** `geo net --seed 42` over the whole world (57,600 ticks, ended at the clock): 202 B/delta (peak 3,990 B),
141 µs per send (target 250), watcher frames 5.5 KB/s in the worst battle, 0 divergences. The diff property covers the
end tick, by concession and by the clock. A world ended by a concession with a battle open: the export reaches the same
result, summary and hash, and the restart keeps it.

**Interpretations to validate** (the plan's most literal reading):

1. `--set` takes one non-negative integer per flag and checks the whole params file; the spawned server reads a
   temporary copy (`GEO_PARAMS`), and the world keeps its params as always.
2. An ended world refuses nothing new: the server's `worldEnded` already covered commands and battle inputs.

**Left for later phases.**

- **F4:** the store has `view.result` and `view.summary`, `WorldSummary.result` is not drawn yet. Until a restart, an
  ended world's open battles stay in memory (X-1), so a battle screen can still open on a frozen one; after a restart
  it is refused with `unknownBattle`. The end screen goes over both.
- **F5:** the soak still places its kills over the world's whole duration and does not report how the world ended.

## F4 — Client

- [x] "Desistir" and its confirmation (D3, S-5), the countdown to the minimum time, the vote panel (who said yes,
      "yes" and "no", the time left; L-5 to L-7), the vote's chronicle sentences
- [x] The end screen over the map and the battle screen; "Ver o mapa", "Ver o replay"; entering an ended world
      (D9, S-1, S-2; P9)
- [x] The spectator of a team out (D7)
- [x] The chronicle sentences: a team leaving, the world's end, the first blood (D8, D15)
- [x] The result in the lobby (S-4)
- [x] The replay markers: the scan pass, the marks, the toggles, the hover, the jump; the end screen at the last tick
      (D11, S-3; P10)

## F5 — Soak and playtest

- [ ] The soak checks the end against the export and reports when and how the world ended
- [ ] The PLAYTEST E-min group (spec §8), with the `--set` overrides for short sessions
- [ ] **Checkpoint C1:** the owner's sessions (against the bot until it concedes, a concession between two tabs, the
      clock's draw, the replay's marks), the hypothesis questions and the tone of the sentences
