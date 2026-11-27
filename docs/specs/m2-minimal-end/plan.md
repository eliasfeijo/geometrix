# M2 plan — The minimal end

**Status:** Approved (2026-11-25) · **Date:** 2026-11-25
**Spec:** [spec.md](spec.md) · **ADRs:** [0002](../../adr/0002-every-action-is-a-command.md) (command vocabulary),
[0003](../../adr/0003-typescript-node-pure-integer-simulation.md) (determinism),
[0004](../../adr/0004-persistence-sqlite-command-log.md) (log and snapshots), [0006](../../adr/0006-world-sync.md)
(view deltas), [0007](../../adr/0007-sim-events.md) (`sim` events),
[0010](../../adr/0010-world-side-of-the-battle-contract.md) (the junction host)

The decisions the owner approved with the plan (2026-11-25) are marked **(P*n*)** and listed in §11; P14 was added
on 2026-11-27 with the owner's revision of the concession.

## 1. What the code does today and what changes

| Today (`SIM_VERSION` 11, `PROTOCOL_VERSION` 7; R bumps both) | In slice E-min |
|---|---|
| The world ends only in the server: `WorldHost.tick` sets `status = "ended"` when `state.tick` reaches `world.durationSeconds`; the CLI just runs that many ticks | The `sim` decides the end on every tick (elimination, concession, the clock) and keeps it in `state.result`; the server, the CLI and the replay stop on it (P1, P8) |
| Every team plays until the clock | `Team.out`: a team leaves the match by elimination or concession and never returns (P2) |
| No way to give up | The `concede` command (P3) |
| The strategist never stops | It concedes at its threshold, at every difficulty, with no human in its team (D4) |
| `Stats` count deliveries, trips, activity, commands | Plus born, lost, battles won and lost per team, and the match's main events (P6) |
| A `died` event like any other | The first one of a team's creep carries `firstBlood` (P5) |
| An ended world: a "encerrado · só leitura" tag in the top bar, the team view frozen | The end screen, "Ver o mapa", "Ver o replay"; the result in the lobby |
| The replay timeline is a plain range input | The D11 marks on it, from a scan pass when the replay opens (P10) |

## 2. Where each thing lives

```text
params/default.json      end.highlights (5)
packages/sim/src/
  end.ts          new: concede and its refusal, a team leaving, the elimination check, the clock, the result, the
                  highlights' ranking, endSummary (P1, P3, P4, P6)
  world.ts        Team.out, WorldState.result and highlights, Battle.entered; SIM_VERSION (P13)
  step.ts         checkEnd between regeneration and vision; step refuses an ended world (P8)
  commands.ts     concede; teamOut for a team out's players; worldEnded for late concessions
  events.ts       teamOut and worldEnded (public audience, D8); died.firstBlood; battleEnded.entered and spoiled
  stats.ts        born, lost, battlesWon, battlesLost per team
  hp.ts           the first blood mark at a team creep's death (P5)
  battle.ts       Battle.entered at opening and joins; battles won and lost at applyBattleEnd
  production.ts   born counted at spawn; a team out produces nothing and its repeat drops
  view.ts         ForeignTeam.out; TeamView.result and summary
  strategist.ts   the concession (D4), BALANCED.concedeAtCreeps (1)
  params.ts       end.highlights in the schema
packages/junction/src/
  host.ts         stepJunction refuses an ended world; the instances are left as they are (P8)
packages/protocol/src/
  index.ts        concede in ClientCommand; teamOut in RejectReason; worldEnded comes from the sim; PROTOCOL_VERSION
  delta.ts        result and summary in the delta; ForeignTeam.out
apps/server/src/
  world-host.ts   ended = state.result !== null; no strategist after its team left
  http.ts         the result in the lobby list
  worlds.ts       an ended world restores without battle instances (P8)
  dev-multi.ts    --set path=value overrides (P11)
  soak.ts         the end reached checked against the export
apps/cli/src/
  harness.ts      runBots stops at the end; --concede (P12)
  sim.ts, sweep.ts, report.ts, verify.ts   the ends in the reports; verify with an end
apps/client/src/
  end-screen.tsx  new: the end screen (D9)
  concede.tsx     new: "Desistir" and its confirmation (D3)
  top-bar.tsx     "Desistir"; the spectator tag (D7)
  game-layout.tsx the end screen over the map and the battle screen (S-1)
  chronicle/      the sentences of teamOut, worldEnded and the first blood
  replay/markers.ts new: the marks from the events (D11); replay-screen.tsx draws them, the toggles, the hover, the jump
  lobby.tsx       the result of an ended world
```

## 3. The world side (`sim`)

### State (P2, P6, P7)

```ts
// Team
out: { tick: number; how: "eliminated" | "conceded"; bot: boolean } | null; // bot: a bot player conceded
// WorldState
result: {
  tick: number;
  how: "lastTeam" | "noTeam" | "clock";
  winner: number | null;   // the team, when how is lastTeam
  teams: number[];         // the winner, or the teams of the draw, by id
} | null;
highlights: Highlight[];   // at most params.end.highlights, best first (P6)
// Battle stub
entered: number;           // participants that ever entered: the opening plus the joins (P7)
// TeamStats
born: number; lost: number; battlesWon: number; battlesLost: number;
```

All JSON, initial values in `createWorld` (`out: null`, `result: null`, `highlights: []`, counters 0). The fixed
hashes change.

### The tick (P1)

`step` gains a stage between the regeneration (6) and the vision (7), `checkEnd(state, log)`: creeps, production and
stocks are final by then, and its events still get their audience at stage 7 and reach the highlights at stage 8:

1. **Elimination (D2, L-1):** each team in the match, by id, with no creep alive (creeps in a battle count), no
   `production` and `!canAfford(stock, creep.cost)` leaves the match with `how: "eliminated"`.
2. **The result (D5, F-1..F-3):** with exactly one team in the match, it wins (`lastTeam`); with none, a draw among the
   teams whose `out.tick` is this tick (`noTeam`); otherwise, when `(tick + 1) * tickSeconds >= durationSeconds`, a draw
   among the teams in the match (`clock`). The tick that sets `result` is the end tick; `state.tick` still advances
   once, as today's last tick does.

Leaving the match (`leave(state, team, how, bot, log)`, shared by the concession and the elimination, L-3, L-4):
`team.out` set; every player of the team that dominates a creep releases it (the host reads `dominatedBy`, so its
participants go back to their gambits, X-2); `team.repeat = null`; the `teamOut` event. A production already running
is left to finish (only an eliminated team has none).

### Commands (P3, P4)

- `concede` (no fields), from any player of the team. Refusals: `teamOut` (the team already left), `worldEnded` (at most
  one team is still in the match, so the world ends on this tick: F-4), `tooEarly` (L-5), `alreadyVoted` and
  `voteCooldown` (L-7). Applied at stage 1 in seq order, so two
  concessions on one tick follow the log.
- In `applyCommand`, a command of a player whose team is out is refused with `teamOut`, before its own checks; the
  system commands (`join`, the host's results) are not players' and pass.
- `productionRefusal` refuses a team out (`teamOut`), so the strategist and the client read the same reason.

### Events (D8, D15)

- `teamOut { team, how, bot }` on the team's core cell, and `worldEnded { result }` on the winner's core (the map's
  center in a draw). `setAudience` gives both **every team** (K-2).
- `died` gains `firstBlood: boolean`: true for a team's creep that dies while every team's `lost` is still 0
  (`hp.ts`, before the counter moves). A wanderer's death is never first blood. The audience is a death's (D15).
- `battleEnded` gains `entered` (from the stub) and `spoiled` (the total stock of the spoils it left), for the ranking.

### The counters and the highlights (P6)

- `born` at spawn (`runProduction`; the initial population is not born in the match), `lost` at a team creep's death,
  `battlesWon` and `battlesLost` at `applyBattleEnd` for each team with a side (a winner's team won, the other teams
  lost; an end by inactivity counts neither).
- **Highlights**, recorded at stage 8 (the stats) from the tick's events, the end's included (`recordHighlights`): candidates are `teamOut`, a `died`
  with `firstBlood`, and `battleEnded`. Ranked by the key `(kind, size, load, -tick, -index)`: kind 3 for `teamOut`,
  2 for first blood, 1 for a battle; size = `entered`; load = the stock collected (`loot`) plus `spoiled`, matéria +
  cristal. The list keeps the best `end.highlights` (5), each as its `TeamEvent` (tick, index and body), so the end
  screen narrates them with the chronicle's templates. In a two-team match: the loser leaving, the first blood and the
  three largest battles.
- `endSummary(state)` (pure): the result, the duration in world seconds, per team (by id) its `out`, `born`, `lost`,
  `battlesWon`, `battlesLost`, `delivered.materia`, and the highlights. The server, the CLI report and the client call
  the same function (§7 "the summary is the same everywhere").

### The view (K-3)

`ForeignTeam` gains `out` (public, D8). `TeamView` gains `result` and `summary` (`endSummary` once `result` is set,
`null` before). `fullView` carries the same, so the replay shows them.

## 4. The bot (strategist)

In `strategistCommands`, before anything else: with its team out, nothing (B-2). With **no human player in its team**
(`players` of the view with `bot: false` and its team), at most `BALANCED.concedeAtCreeps` (1) own creeps, no
`production` and the stock unable to pay `creep.cost`, the strategist sends `concede` and nothing else (B-1). It reads
only its view; the difficulty (R's D26) does not enter the test. With R merged, the threshold sits in R's settings
next to the difficulty's.

### The minimum time and the team's vote (P14, 2026-11-27)

- **State:** `Team.vote: { openedTick, yes } | null` (`yes` by player id; replaced whole, since the delta compares it by
  reference) and `Team.voteRejectedTick`. No "no" list: one "no" ends the vote.
- **Commands:** `concede` leaves at once for a bot or a team's only human, else opens the vote or says yes;
  `rejectConcede` (no fields) ends it, refused with `noVote` without one.
- **Deadline:** first in `checkEnd`, before the eliminations, in team id order: a vote whose
  `openedTick + ceil(concedeVoteSeconds / tickSeconds)` is this tick passes, unless its team is the last in the match
  (F-4). Votes still open when the world ends are dropped there.
- **Events:** `concedeVoteOpened { team, deadlineTick }` and `concedeVoteClosed { team, outcome }` (`passed`,
  `rejected`, `dropped`), to that team alone, whoever sees its core. The view carries the vote in the team's own
  entry; `ForeignTeam` does not have it.
- **Bot:** the strategist concedes only from `end.concedeAfterSeconds` on, playing on until then, so no bot command is
  refused; the harness refuses a `--concede` before it as a usage error.
- **Presence is left out on purpose:** it lives only in the server (`PresenceTracker`); with the deadline, an offline
  human needs no special case and the replay of the log gives the same result.

## 5. The junction host and the frozen world (P8)

- `stepJunction` throws on a world with `result` set (a caller bug, as `step` does). The server's real-time battle
  clock already skips an ended world (`WorldHost` returns early); a test pins it.
- At the end, the instances stay in memory as they are (X-1); their battle logs in the tables end at their last stored
  tick, with no `ended_tick`. `geo battle verify` and the soak's `checkBattles` replay such a log to its last tick only.
- A restart finds the world `ended` (the end tick's snapshot is forced, N-1) and does not rebuild its open battles:
  nothing would step them.

## 6. Network and server

- **Protocol:** `concede` joins `ClientCommand` (the compile-time vocabulary check holds); `teamOut` joins the refusals;
  `worldEnded` becomes a `sim` refusal too (the server's own one stays for commands after the end). The delta carries
  `result` and `summary` when they change (once), and `ForeignTeam.out` with the teams. `PROTOCOL_VERSION` (P13).
- **`WorldHost.tick`:** `ended = state.result !== null` replaces the tick count (the clock is the `sim`'s now); the
  strategist skips a bot whose team is out; the rest of the end (status, forced snapshot, the loop stopping) is
  today's code.
- **Lobby:** `listWorlds` adds the result (`how`, `winner`, `teams`) of an ended world from `host.state.result`; no new
  column (the end tick's snapshot holds it).
- **The real duration** on the end screen is the world duration divided by the world's ×N (P9), so a server restart
  does not count.

## 7. Client

- **"Desistir"** (`concede.tsx`) in the top bar, for a player of a team in the match while the world runs: a dialog
  ("Desistir da partida? O time Laranja perde e o mundo continua para os outros" / "...e a partida acaba"), "Desistir"
  and "Cancelar", the focus on "Cancelar"; only the confirmation sends `concede` (S-5).
- **The end screen** (`end-screen.tsx`) shows in place of the map and the battle screen when `view.result` is set
  (S-1): the result and how, the duration (world and real, P9), a table per team (D9) and the five highlights, each
  through `narrate` like the chronicle. "Ver o mapa" hides it (the frozen map, read-only, with a "Ver o resultado"
  button back); "Ver o replay" goes to `?replay=<world>`. Entering an ended world opens it.
- **A spectator** (D7, three or more teams): the top bar says "seu time saiu da partida"; the panels that send commands
  are read-only, as in an ended world.
- **Chronicle:** templates for `teamOut` (eliminated, conceded by a human, by the bot), `worldEnded` (a winner, a draw
  after the last teams left, a draw at the clock) and the first blood (voiced by the killer's DNA, or "alone" when
  nobody killed). The agent writes them; the owner reviews the tone at the checkpoint.
- **Lobby:** an ended world shows "Azul venceu" or "Empate", beside "encerrado".
- **Replay markers** (`replay/markers.ts`, P10): when the replay opens, a scan pass runs the player to the last tick
  in chunks (the existing `runTo` with a time budget per frame), which takes every checkpoint, keeps every event and
  checks the final hash; then it seeks back to tick 0. The timeline fills in as the pass goes ("marcando…"). The marks
  are `battleOpened`, `battleEnded`, `died` (team creeps and wanderers apart), `born`, `wandererBorn`, `teamOut`,
  `worldEnded`; a layer of ticks over the range input, a color and shape per kind, a toggle per kind (births and deaths
  start hidden past a density the plan sets in code), the sentence on hover, a seek on click. At the last tick, the end
  screen is offered as in a live world (S-3).

## 8. Harness and tests

- **`runBots`** stops on `state.result`; `geo sim` and `geo sweep` add an **End** section: per run how it ended, the
  tick in world time and in real minutes at the run's ×N (R's PA-2 once merged), the result, and each team's
  `endSummary`; sweeps a table of the ends.
- **`--concede team@minute`** (P12) in `geo sim` and `geo verify`: at that world minute, a real `concede` command from
  that team's bot player goes into the log. `geo verify` runs an end by concession and one at the clock (a short
  `world.durationSeconds` through `--set`) on its three paths: two runs, snapshot → restore before the end, the log
  replayed; same result, summary and hash.
- **Elimination** is covered by `sim` tests on text maps (the hand-built teams have no stock and one creep that dies),
  including snapshot → restore across the end tick.
- **Tests:** every §5 rule of the spec on text maps; a creep born on the end tick saving its team; two concessions on
  one tick; the last creeps of both teams dying on one tick (F-2); the clock's draw; a hand-built three-team world in
  which one team concedes and the world goes on (D7, X-2), then ends; nothing about a team out leaks but `out`; the
  first blood once per world, never a wanderer's death; the highlights' ranking with ties; the bot's concession with
  a human in its team (none) and without (one); the server's end from the `sim` and its restart; the summary equal in
  the CLI report and in the end screen's data for one log.
- **Soak:** the world may now end before its clock; the soak checks that the exported replay reaches the server's
  result and summary, and reports when and how the world ended. Its kills keep waiting for an open battle; one that
  cannot happen before the end is reported, not failed.

## 9. Running next to the other slices

- **R** (plan approved 2026-11-25) also bumps `SIM_VERSION` and `PROTOCOL_VERSION`, and touches `strategist.ts`, the CLI's
  `report.ts`/`sim.ts`/`sweep.ts`, `params/default.json`, `world-host.ts`, `dev-multi.ts` and the client's top bar.
  Whoever merges second rebases, takes the next free version numbers and moves its hunks next to the other's. R's
  recovery scenario (`--shock`) can eliminate a team: with E-min in, a shocked run may end early, and R's report says
  so. A bot that concedes shortens R's balance runs: R's targets read the run up to its end.
- **K** and **G** touch the battle and the formations, not the end.

## 10. Risks

- **The scan pass:** a 2-hour match at R's ×N is some 50,000–90,000 world ticks; if the browser steps them slower than
  the 10 s target, the fallback is the markers in the server's export (the alternative of P10).
- **The bot conceding too early or too late** in bot × bot runs: the ends table shows it in F2; the threshold is one
  number in the strategist's settings.
- **Frozen battles:** a restart of an ended world must not try to resume them; a server test pins it.
- **Version clashes with R:** both bump the same constants and touch the same files; the merge order decides the
  numbers, and the fixed hashes are updated by the second.

## 11. Decisions (approved 2026-11-25)

| # | Proposal | Alternative |
|---|---|---|
| P1 | **The end as a stage of `step`** (`end.ts`), after regeneration and before vision: elimination, then the result | The end decided by the server or the junction host (the replay and the CLI would each need a copy) |
| P2 | **`Team.out` and `WorldState.result` in the state**; `out` public in `ForeignTeam` | A separate standings array next to the teams |
| P3 | **`concede` with no fields**, refused with `teamOut` for a team out and `worldEnded` once at most one team remains | A command naming the team (redundant: the player's team) |
| P4 | **A team out's players refused at `applyCommand`** (`teamOut`), their dominations released, its repeat dropped | Removing its players from the state (the replay and the lobby would lose who played) |
| P5 | **First blood as a flag on `died`**, found from the teams' `lost` counters | A separate `firstBlood` event (two chronicle lines for one death) |
| P6 | **The counters and the highlights kept in the state** as they happen, with `endSummary` pure; `end.highlights` (5) in the params | The summary computed from the whole log at the end (a reconnecting client could not get it without the server replaying the world) |
| P7 | **`Battle.entered` and `battleEnded.entered`/`spoiled`** for the ranking | Counting joins from the events in the ranking (needs memory per battle outside the state) |
| P8 | **After the end, `step` and `stepJunction` throw**; open instances are left as they are; an ended world restores without them | Ending the open battles by inactivity at the world's end (an outcome the spec did not decide) |
| P9 | **The real duration = world duration ÷ ×N** | The server's wall clock (counts restarts and downtime) |
| P10 | **Markers by a scan pass in the browser** when the replay opens (it also takes the checkpoints and checks the hash) | The markers in the server's export (the replay format grows; a `geo sim` file would need them too) |
| P11 | **`dev:multi --set path=value`** (the junction matrix's syntax) for the owner's short sessions, the overrides written in the PLAYTEST group; **revises spec §6's "short params file"** | A full params file (a copy of the default that drifts from R's 2-hour world) |
| P12 | **`--concede team@minute`** in the harness: a real, replayable `concede` in the log | Ends covered only by `sim` tests |
| P13 | **One version bump per slice** for `SIM_VERSION` and `PROTOCOL_VERSION`, the next free number at merge time | One bump per phase |
| P14 | **The minimum time and the team's vote in the `sim`** (§4), the deadline in `checkEnd`, with presence left out on purpose. Added 2026-11-27 for the owner's revision of D3 | The vote in the server, which would need presence and would keep it out of the log |

## 12. Implementation order

| Phase | Content | Checkpoint |
|---|---|---|
| **F0** — Spec and plan | The spec (approved 2026-11-25, with the first blood); this plan and its P1–P13 (approved 2026-11-25) | ✅ The owner approved the plan |
| **F1** — The end in the world | State, `concede`, leaving the match, elimination, the result and the clock, the events, the first blood, the counters, the highlights, `endSummary`, the view; `step` and `stepJunction` refusing an ended world; `SIM_VERSION`; the fixed hashes; the protocol types compile | — |
| **F2** — The bot and the harness | The strategist's concession; `runBots` stopping at the end; the End section and the sweep's ends table; `--concede`; `geo verify` with ends; the bot × bot ends recorded in `tasks.md` | — |
| **F3** — Network and server | Protocol (`concede`, `teamOut`, the result, the summary, `out` in the delta); `WorldHost` ending from the `sim`; the lobby's result; an ended world's restart; `geo net` still within targets; `dev:multi --set` | — |
| **F4** — Client | "Desistir"; the end screen; the frozen map; the spectator; the chronicle sentences; the lobby; the replay markers | — |
| **F5** — Soak and playtest | The soak with the end; the PLAYTEST E-min group | **C1:** the owner's sessions (spec §8), the hypothesis questions, the tone of the sentences |
