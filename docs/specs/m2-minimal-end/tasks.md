# M2 tasks — The minimal end

**Status:** F0 ✅ (spec and plan approved 2026-11-25) · F1 ✅ (2026-11-27) · F2 ✅ (2026-11-27) · F3 ✅ (2026-11-27) · F4 ✅ (2026-11-27); F5 next. Branches `m2/emin-f<n>-<slug>` (skill `commit`).
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

### F4 record (2026-11-27)

**What it does.** The client shows the end: "Desistir" in the top bar with its countdown and confirmation, the team's
vote panel (who said yes, the time left, "Sim"/"Não"), the end screen over the map and the battle screen ("Ver o
mapa", "Ver o resultado" back, "Ver o replay"), a team out as a read-only spectator, an ended world whose battle
screens close and do not reopen, the chronicle sentences of the first blood, a team leaving, the vote and the world's
end, the result in the lobby, and the replay's marks with a scan pass, toggles, hover and jump. No change to `sim`,
`junction`, `battle` or the protocol. Pure logic in `match-end.ts` and `replay/markers.ts`.

**Measured** (headless Chromium on the WSL machine). The replay of `geo sim --seed 42 --days 3` (the whole 2-hour
world, 57,600 ticks): from choosing the file to the scan done 2.6 s (target 10 s, spec §7; the owner's machine is
measured at C1), the hash matches, 329 marks; a click on the end mark opens the end screen in 83 ms, with the F2
record's numbers. In the browser, with `dev:multi`: a concession seen by both tabs, the replay and the lobby; a vote
between two humans on Blue ended by a "Não", then the retry wait. **Not seen in a browser:** a team out as a spectator
(needs 3 teams: only tests) and a battle screen open when the world ends (only tests).

**Interpretations to validate** (the agent's):

1. Real times divide world times by the world's actual ×N (the welcome's multiplier), the same as the params'
   `world.multiplier` unless the world was created with another. The replay of a server world takes its ×N from the
   lobby list; a file, from its params.
2. Who said yes sees "Retirar o meu sim", which ends the vote for the whole team (L-7).
3. Only "Desistir" asks for a confirmation; the vote's "Sim" does not.
4. Before the minimum time and in the retry wait, "Desistir" is disabled and counts down; during a vote it is hidden.
5. The end screen's main events are the chronicle sentences alone: battles read alike ("o time Azul vence"), with no
   size or load.
6. A replay reaching its last tick opens the end screen by itself, without "Ver o replay".
7. A click on a mark shows the tick after the event, so what it did is on the map and in the chronicle.
8. Births and deaths start hidden past 120 of those marks together (seed 42's match has 109).
9. During the scan the play button and the slider are disabled; each frame spends up to 40 ms on it.
10. The vote panel sits over the top right of the map, over the inspector while it is open.
11. The sentences are the agent's: the owner reviews the tone at C1.

**Left for F5.** The PLAYTEST E-min group needs `--set end.concedeAfterSeconds=0` (or a small number) in its short
sessions: the default is 15 real minutes. A vote between humans takes `dev:multi --clients 3` (two on Blue). Questions
for C1: whether the main events need more detail (5), and the tone (11).

## F5 — Soak and playtest

- [x] The soak checks the end against the export and reports when and how the world ended
- [x] The PLAYTEST E-min group (spec §8), with the `--set` overrides for short sessions
- [ ] **Checkpoint C1:** the owner's sessions (against the bot until it concedes, a concession between two tabs, the
      clock's draw, the replay's marks), the hypothesis questions and the tone of the sentences

### F5 record (2026-11-27)

**What it does.** The soak checks the end: the lobby's result and every client's summary against the state the
exported replay reaches, and its report says when and how the world ended. A planned interruption the end came before
is listed, not failed (it fails only when the clock ran its whole time, which leaves room for all of them); a battle
the end stopped open is replayed to its last stored tick (plan §5), and a battle a crash cut through must have gone on
after the restart. PLAYTEST has the groups E1–E5 and the checkpoint questions.

**Measured** (`npm run soak`, one run, alone on the machine, 2.8 min): OK. The world ended at tick 57,599 (120 real
minutes at ×8) by the clock, a draw; the lobby and the 4 clients show the replay's end; 6/6 interruptions before the
end, 5 kills through a battle; 46 battles, 45 ended and 1 stopped open by the end; loop speed median 100%, slowest
95%; server memory up to 220 MB.

**Interpretations** (the agent's):

1. The bots' world only ends at the clock (F2), so the early end's paths of the soak (missed interruptions) are not
   exercised by the run; `checkEnd` and `describeEnd` are tested.
2. The PLAYTEST group's E1 puts the creep's cost out of reach (`creep.cost.materia=99999`), so the bot's concession
   comes in one session; the default cost is not played there.


### C1 sessions (2026-11-27)

**E1, against the easy bot until it concedes** (seed 42, ×8, `creep.cost.materia=99999`, concession from the start).
The bot conceded at world 01:29 (about 11 real minutes). In the owner's words:

- Did the match end when it felt over? "Sim."
- "uns 10 min, depois que eu juntei a tropa de 2 circulos e 1 triangulo no núcleo inimigo, foi rápido". The first try
  stalled: the owner did not know "Seguir" existed (the script did not mention it).
- The end screen's moments: "realmente não tem muita história pra contar em 10 min de jogo que deveria durar 2h,
  talvez o bot estrategista esteja muito passivo durante meu posicionamento agressivo me aproximando dos depósitos
  perto do núcleo dele, com os creeps dele me vendo aproximar com a tropa de 3 e continuou farmando passivamente como
  se fosse um dia lindo para coletar materia". The five were: the bot's concession (01:29), first blood (01:15), and
  battles "O time Azul fica com o campo." (01:20, 01:15) and "A batalha termina com a vitória do time Laranja."
  (00:39).
- "Ver o mapa" / "Ver o resultado": "normal". The replay's marks led to the moments that mattered: "sim".
- "eu só fui construir estradas no segundo terço da partida, e mesmo assim minha economia ultrapassou a do laranja".

Caveats on E1 (the agent's): the script chose the **easy** bot, which by R's D26 has no defense, groups or escort, so
the passivity says nothing about the default (hard) bot; and nobody could produce, which distorts the economy. The
moments are listed by rank, not by time.

**E2, a concession between two tabs** (seed 42, ×8, concession from the start; the script's steps include conceding
with a battle open in the other tab): "tudo ok e confirmado" (one answer for the group, no itemized points).

**E3, the team's vote** (three tabs, two on Blue): "tudo ok, exceto o painel de desistência que disputa o mesmo
espaço do topo do painel do creep na camada inferior, o que não seria se eu pudesso mover os paineis, mas pra
facilitar podemos apenas encontrar um local apropriado para o painel novo sem disputar com nada na tela e se manter
visível". **Fixed at the owner's request:** the vote is a strip of its own under the top bar, above the map and the
battle screen, covering nothing (replaces F4's interpretation 10). Movable panels, which the owner mentioned, were
not asked for.


**E4, the clock's draw** (two tabs, a world of 5 real minutes): "tudo ok...".

**E5, the marks of a whole match** (`geo sim --seed 42 --days 3`, the replay file): "tudo ok, exceto que quando eu
clico num evento específico, a tela de baixo muda aparentemente para aquele momento, mas a linha do tempo (progress
bar) não acompanha a tela de baixo que toca a partir do evento que eu cliquei, a não ser que eu mova a barra
manualmente". **Fixed** (reproduced headless first): `preact/compat`, which the map's layers load, turns an
`onChange` prop on a range input into a second `input` handler that runs before `onInput`, so after a release the
thumb (and the clock) stayed at the pointer's last value. The slider now listens to the native `change`. No client
test runs a DOM, so the fix is checked headless only.
