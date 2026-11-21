# M1.5 spec — Network: deltas of each team's view

**Status:** Done (2026-11-14) · **Date:** 2026-11-14 · **Milestone:** M1.5 — The fog ([ROADMAP](../../ROADMAP.md)), slice 1 of 2
**ADR:** [0006](../../adr/0006-world-sync.md) (`Accepted`, 2026-11-14) · **Related GDD:**
[01](../../gdd/01-world.md) (fog of war, the next slice)

## 1. Hypothesis

> Sending each client only **what changed in its team's view** brings the bandwidth per client within the ADR-0005
> estimate, at a CPU cost that fits hundreds of worlds per process, **with no divergence** between what the server
> believes the client sees and what it sees, including crashes, reconnections and server restarts.

This slice **does not change gameplay**: what each player sees on screen stays as in M1. It answers:
1. Is ADR-0006 viable in practice (bandwidth, CPU, correctness)? If not, the ADR is reopened (ADR rule 10).
2. Is the **team view** as a pure `sim` function ready for the fog of war slice to filter what is hidden?

## 2. Context

Today (M1 plan P3) the server sends the full dynamic state as JSON after each tick, at most 5 times per second:
26.5 KB per message with 60 creeps. The ADR-0006 measurements (seed 42, `default.json`, naive version):

| | Per message, 60 creeps | CPU per world per send |
|---|---|---|
| Full state (today) | 26.5 KB | ~0.12 ms (`JSON.stringify`) |
| Per-field view delta, without `movePoints`/`trip`/`path` | ~0.4 KB per team | ~0.8 ms (build the 2 views + 2 diffs) |

Bandwidth is already proven. CPU and correctness (the "patch applied over the wrong base" bug class) are what this
slice must validate.

## 3. Scope decisions this spec assumes

Accepted by the owner with the spec (2026-11-14).

| # | Decision | Default | Why |
|---|---|---|---|
| D1 | What the view holds, without fog | Exactly what the client receives today (`DynamicState`), **minus** `movePoints`, `trip` and `path`, which the client does not use. The other team stays visible, as in M1 (M1 spec, D5) | No visible change; the fog slice filters later |
| D2 | One stream per team | Players of the same team see the same thing: one diff and one sequence per team, shared by its sockets | 2 diffs per world per send, not one per player |
| D3 | Bots read the view | The strategist decides from its own team's view plus the static map (which every client gets in the `welcome`), not from the full state | ADR-0006 rule 2: a bot knows no more than a human of the team |
| D4 | No gameplay change | The 3-day hash of seed 42 (`10662729…`) **does not change**, and `SIM_VERSION` stays 2 | Proves D3 changed no decision |
| D5 | Format | Raw JSON, no compression or binary | ADR-0006; binary only if measurement asks for it |
| D6 | Protocol version | The `welcome` carries a protocol version; a client with another version warns and reloads the page | An old tab does not apply deltas in a format it does not know |
| D7 | Library spike | The plan starts with a short spike (ADR-0006 alternative E: Colyseus's schema) before writing the diff by hand; the result goes into the plan | The ADR's recommendation; the most bug-prone part may already exist |
| D8 | Network panel on the client | A discreet panel, only with `?net=1` in the URL: bytes/s received, current `seq`, resumptions and resyncs | Validate locally without opening DevTools; not game UI |

## 4. Scope

### In
- **Team view** in the `sim`: a pure function `state + team → view` (D1).
- The **strategist** reading the view (D3, D4).
- **Diff and patch** of the view: new entities, changed fields, removed ids, new roads.
- **Protocol:** `welcome` with the base view and the `seq`; numbered deltas; periodic hash; resync request;
  resumption on reconnect; protocol version (D6).
- **Server:** the last view sent and a buffer of recent deltas per team; answers to resync and resumption.
- **Client:** applies deltas instead of replacing the state; same interpolation; network panel (D8).
- **Harness:** property test, bandwidth and CPU measurement, and the soak with connected clients (section 7).

### Out
Fog of war (the next slice), restricting the replay export to finished worlds (goes with fog), compression, binary
format, battle sync, deploy, snapshot pruning, gameplay or visual changes.

## 5. Behavior

Format: *When [trigger], the system shall [response].*

### View
- **V-1** Given a state and a team, the view shall always be the same (a pure function, no clock or randomness).
- **V-2** Without fog, the view shall hold everything the M1 `DynamicState` holds, minus `movePoints`, `trip` and
  `path` (D1).
- **V-3** When the bot strategist decides, it shall read only its own team's view and the static map (D3), and a
  3-day bot × bot world shall end with the same hash as before (D4).

### Server
- **S-1** When a client connects, the server shall send in the `welcome` the **last view sent** to its team (not the
  current state) and that view's `seq`, besides what the `welcome` already carries (static map, parameters…) and the
  protocol version.
- **S-2** After each send (the 5 per second cap stays), the server shall send each team a delta with `seq` =
  previous + 1, the `tick` and the view's changes since the previous send.
- **S-3** The delta shall list, per collection, the new entities (whole), the changed fields of existing ones and the
  removed ids, plus the new roads.
- **S-4** Every `N` ticks (a server setting), the delta shall carry the hash of the team's view after it is applied.
- **S-5** When a client reconnects with the last applied `seq`, and that `seq` is still in the team's recent delta
  buffer, the server shall resend the following deltas, in order. If the `seq` is not in the buffer (including after
  a server restart), it shall send the full view, as a `welcome`.
- **S-6** When a client asks for a resync, the server shall send the full view and log the incident (team, tick,
  `seq`, reason).
- **S-7** Commands (`command`, `ack`, `reject`) do not change.

### Client
- **C-1** When a delta with the expected `seq` arrives, the client shall apply it to the view it has. Interpolation
  (the last two states) and everything on screen shall stay as in M1.
- **C-2** When a delta with an out-of-order `seq` arrives on a live connection, the client shall ask for a resync and
  log the incident (over TCP that indicates a bug; ADR-0006, rule 5).
- **C-3** When the delta's hash does not match the client's view, it shall ask for a resync and log the incident.
- **C-4** When the connection drops, the client shall reconnect with the last applied `seq` (S-5).
- **C-5** When the `welcome`'s protocol version differs from its own, the client shall warn and reload the page (D6).
- **C-6** With `?net=1` in the URL, the client shall show the network panel (D8).

## 6. Initial parameters (guesses, made to be broken)

Server configuration (not balancing; outside the `sim` params, as in F6):

| Parameter | Guess |
|---|---|
| View hash every `N` ticks | 60 (1 world minute) |
| Recent delta buffer per team | 30 real seconds |
| Sends per second (cap) | 5 (unchanged) |

## 7. Harness and viability criteria

The criteria below decide ADR-0006 rule 10. **If any fails, the ADR is reopened** before moving on to fog. The
targets are provisional guesses.

| Criterion | Target | How it is measured |
|---|---|---|
| Bandwidth per client, ×1, 60 creeps | ≤ 2 KB/s on average (the ADR-0005 ceiling) | Harness: view + diff on every tick of a 3-day bot × bot world, bytes of the serialized delta |
| View + diff CPU, both teams, 60 creeps | ≤ 0.25 ms per world per send, median (today ~0.12 ms; naive ~0.8 ms) | Harness, same run; the periodic hash amortized |
| Diff correctness | `patch(previous view, diff) = new view`, on every tick, for both teams | Property test: 6 world hours on the CI seeds (1, 42, 649) in CI; 3 days at the checkpoint |
| No gameplay change | The 3-day hash of seed 42 equal to `10662729…` | `geo sim` / `geo verify` |
| No divergence with crashes | 0 divergent hashes; each client's final view with the server's hash | `npm run soak` with connected clients (below) |
| Resumption | A short drop within the buffer resumes without a full view; after a restart, a full view | Server integration test and the soak report |

**Soak with clients:** `npm run soak` keeps headless WebSocket clients (Node) connected for the whole world (guess:
2 per team), applying the deltas like the browser client. The report adds, per client: bytes received (average and
peak per second), resumptions, full views by cause (join, restart, resync), divergent hashes, and whether the final
view matches the server's.

**Recorded metrics:** average and peak bandwidth per client; CPU for view, diff and hash per send (median and p95);
delta size over the world; resync incidents by cause.

## 8. Test protocol

1. **Tests** (`sim`, `protocol`, `server`, `client`): view, diff, patch, sequence, resumption, resync, protocol
   version. The property test runs in CI.
2. **Harness measurement:** bandwidth and CPU on a 3-day world (section 7).
3. **Soak with clients:** the full `npm run soak` (×360, forced crashes), with the section 7 report.
4. **The owner's session:** `npm run dev:multi` with `?net=1`. The screen must be identical to M1; take the server
   down and up in the middle to see the resumption.

### Criteria to move on to the fog slice
- All section 7 criteria green, or the owner decides what to do with what failed.
- The owner reviews the viability report at the checkpoint ([viability.md](viability.md)).

## 9. Prerequisites before the `plan.md`

- [ADR-0006](../../adr/0006-world-sync.md) `Accepted` ✅ (2026-11-14).

## 10. Open questions

None.
