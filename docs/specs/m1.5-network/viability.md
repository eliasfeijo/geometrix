# M1.5 network — ADR-0006 viability

**Date:** 2026-11-14 · **Status:** approved by the owner (2026-11-14): on to the fog slice · **Spec:** [§7](spec.md) ·
**ADR:** [0006](../../adr/0006-world-sync.md), rule 10

ADR-0006 rule 10 asks that each team's view deltas be validated locally against the spec §7 criteria. **If any
failed, the ADR would be reopened.** This document gathers the measurements of phases F2–F5.

## 1. Criteria

| Criterion (spec §7) | Target | Measured | | Where |
|---|---|---|---|---|
| Bandwidth per client, ×1, 60 creeps | ≤ 2 KB/s on average | **227 B/s** (median 111 B, p95 601 B, peak 4.6 KB per delta) | ✓ | `geo net`, 3 days, seed 42 |
| View + diff CPU, 2 teams | ≤ 250 µs per send, median | **83 µs** (70.5 µs + 12.9 µs amortized hash) | ✓ | `geo net`, 3 days, seed 42 |
| Diff correctness | applied view = new view, every tick, 2 teams | **0 divergences** in 518,400 checks (3 days); in CI, 6 h × seeds 1, 42 and 649 | ✓ | `geo net`; `packages/protocol/test/delta-property.test.ts` |
| No gameplay change | 3-day hash of seed 42 = `10662729…` | **equal**, with the strategist reading the team view | ✓ | `geo verify --ticks 259200`, `geo net` |
| No divergence with crashes | 0 divergent hashes; each client's final view = the server's | **0 divergent** in 14,372 checked hashes (4 clients) | ✓ | `npm run soak` |
| Resumption | a short drop within the buffer resumes without a full view; after a restart, a full view | **11–13 resumptions per client** without a full view; after each of the 6 restarts, a reconnection `welcome` | ✓ | server and client tests; `npm run soak` |

**Owner's decision (2026-11-14):** session with `dev:multi` and reconnection ok; **on to the fog slice**, with
ADR-0006 as is and the stream id in the URL approved (plan R5 and ADR rule 5 updated).

## 2. Bandwidth and CPU (`geo net`)

`npm run geo -- net --seed 42 --days 3`. One send per tick, as the server at ×1; the bytes are the whole `delta`
message.

| Window | Creeps | Bytes/delta, mean | Bytes/delta, max | CPU per send, median | p95 |
|---|---|---|---|---|---|
| 0–6 h | 12 | 161 | 1,577 | 36.7 µs | 75.5 µs |
| 18–24 h | 30 | 207 | 2,548 | 50.6 µs | 90.2 µs |
| 36–42 h | 60 | 266 | 4,561 | 81.6 µs | 136.4 µs |
| 66–72 h | 60 | 249 | 4,614 | 87.4 µs | 143.3 µs |

- **Send breakdown** (medians, 2 teams): view 11 µs, diff 58 µs, `JSON.stringify` 1 µs.
- **Peaks:** 0.8% of deltas exceed 2 KB, all on the tick the deposits regenerate (~50 waiting creeps resume at once).
- **View hash** (`viewJson` + SHA-256): ~390 µs each, hence only every 60 ticks. At ×360 one send covers 72 ticks and
  almost every send carries a hash: ~0.8 ms per world per send.
- **`welcome`:** the full view is ~23 KB at the end of the world (60 creeps). Sent only on connect, on reconnections
  the buffer does not cover and on `resync`.
- **Before (M1):** 26.5 KB per message with 60 creeps. Bandwidth dropped ~115× and CPU per send halved.

## 3. Crashes, resumptions and restarts (`npm run soak`)

×360, seed 42, 3 world days in 12.4 real minutes: 5 `kill -9` + 1 SIGTERM of the server, and **2 headless WebSocket
clients per team** connected the whole world, each dropping its own connection every 60 s (staggered). All 4 final
views equal the server's; 3,593 hashes checked per client, 0 divergent; no `resync` needed. Server: replay rebuilt in
Node with the server's hash; back from each crash in 1.3–8.9 s; memory up to ~200 MB per process; final SQLite
55.2 MB.

## 4. In the browser

Headless Chromium, ×36, seed 42, `?net=1`: after `kill -9` and a server restart, resumption is refused (new stream),
a reconnection `welcome` arrives and the hashes keep matching. The screen is M1's. Main client bundle: 111 KB (40 KB
gzip).

## 5. Points of attention

1. **Bandwidth at high speeds.** The target is ×1. At ×36 the browser receives ~2.9 KB/s, and at ×360 the soak
   measures 12.9 KB/s per client: each send covers several ticks. Irrelevant for the real game (×1); relevant for
   accelerated test worlds.
2. **The stream id in the URL** prevents an old `seq` from falling into the new buffer after a restart.
3. **The hash cost** grows with the view. Fog shrinks the view.
4. **What the fog slice changes:** only `view(state, team)` in the `sim`.
