# ADR-0005: MVP deploy: one VPS + Docker Compose + Caddy; WebSocket transport

**Status:** Accepted (2026-11-13) · **Date:** 2026-11-13
**Related:** ADR-0003 (Node), ADR-0004 (SQLite + Litestream), ROADMAP

## Context
For the foreseeable future, the backend is one long-running Node process that hosts several worlds and serves the
static client. Estimated usage in M1, per active world:

| Resource | Estimate |
|---|---|
| CPU | < 1% of a core |
| RAM | a few MB (besides the process baseline, ~100 MB) |
| Disk | a few MB per day |
| Bandwidth | ~1–2 KB/s per client |

In M2, a battle uses ~5–20 KB/s per client, at 20–30 Hz. The world tick runs continuously for days, which rules out
per-request execution models.

## Alternatives
- **A. One small VPS** (2 vCPU / 4 GB) with Docker Compose: app + Caddy + Litestream (chosen).
  - Pros: ~US$ 5–10/month; simple persistent disk; full control; the same environment as local.
  - Cons: a single point of failure (mitigated by continuous backup and automatic restart); we run it ourselves.
- **B. Fly.io** (Machines + volumes).
  - Pros: good deploy DX; regions.
  - Cons: the volume is tied to one machine; more cost and concepts with no gain for an MVP.
- **C. Cloudflare Durable Objects** (one world per object; WebSocket and SQLite built in).
  - Pros: elegant; scales per world.
  - Cons: lock-in; hard to run the same way locally; the headless simulation runs elsewhere anyway.
- **D. Serverless (Lambda and the like).**
  - Cons: incompatible with a continuous tick loop.
- **E. Kubernetes/Agones** (the infrastructure of a friend's control plane).
  - Cons: overkill for now. Kept as the scaling path (below).

**Transport:**
- **WebSocket** (chosen): universal support; enough for the world at 1 Hz and for the M2 battle at small scale.
- **WebTransport or WebRTC DataChannel:** only if measurements in M2 show that TCP head-of-line blocking hurts the
  battle.

## Decision
| Phase | Where it runs |
|---|---|
| Local playtests, including the first ones with friends | The dev machine + a tunnel (Cloudflare Tunnel or Tailscale Funnel), at zero cost |
| Long tests and later milestones | **Option A**: one VPS with Docker Compose (Node app + Caddy with automatic HTTPS + Litestream to object storage) |

The static client is served by the app itself, behind Caddy. A CDN only if needed.

**Backend dependencies, the full list:** Node LTS, `ws`, a SQLite driver, Litestream, Caddy, Docker Compose. Left out
on purpose: managed databases, Redis, queues, Kubernetes, serverless and accounts (login is a guest name with a token
in `localStorage`).

**CI/CD** (GitHub Actions):
1. typecheck, tests, the determinism test and a headless smoke test;
2. build the image and push it to a registry;
3. deploy over SSH: `docker compose pull && docker compose up -d`.

## Consequences
- A VPS restart or a deploy interrupts the worlds for seconds. They resume from the snapshot and the log (ADR-0004).
  Clients must reconnect automatically.
- **Scaling path:**
  1. more worlds per process;
  2. several processes or VPSs with sharded worlds, plus simple "world → server" routing;
  3. a world becomes a game server in an Agones fleet of a friend's control plane.
- Operational observability (OTel/Grafana) is opt-in, when needed. The game metrics already come from the harness
  (ADR-0004).
