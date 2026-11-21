# M1 tasks — The wealth cycle

**Status:** all phases done (2026-11-14). Condensed history; the commit history has the detail. References:
[plan.md](plan.md) · [spec.md](spec.md).

| Phase | Delivered |
|---|---|
| F0 — Bootstrap | npm workspaces, `.nvmrc`, `tsconfig.base.json` (`strict`, `erasableSyntaxOnly`, ESM; the `sim` with no DOM and no `@types/node`), ESLint + Prettier with the determinism rules (plan §2), Vitest, CI |
| F1 — `sim` core | seeded xoshiro128** RNG with serializable state; params schema + `params/default.json`; `WorldState` and `createWorld`; point-symmetric map generation with river, crossings, rocks and deposits + connectivity property test (500 seeds); canonical `serialize`/`restore`; empty `step`; minimal `geo verify` in CI |
| F2 — Movement | movement points with terrain, road and load modifiers in ‰; 4-direction A* with deterministic ties and a path cache; `moveTo` and `stop` |
| F3 — Economy | gathering with capacity (DNA × upgrade); delivery and team stock; materia regeneration and cristal depletion; creep production (cost, time, cap, "repeat"); capacity upgrade; `buildRoad` (connected segments, materia debit, build time, path invalidation) |
| F4 — Autopilot and domination | `validate` for every external command; `dominate`/`release` (D-1..D-4); rules interpreter with the P-2 vocabulary; the three presets; `setRules` and `applyPreset` |
| F5 — Harness | stats accumulators + pure `sampleMetrics`; `balanced` strategist; `geo sim`, `geo sweep`, full `geo verify`; 6 h CI budget. **Checkpoint:** first 3-day bot × bot report reviewed with the owner → [balance.md](balance.md) |
| F6 — Server | SQLite schema and persistence; `world-host` tick loop with multiplier, queue and snapshots; HTTP (create, join, static); WebSocket with ack/reject and a 5/s broadcast cap; automatic `release` on disconnect (15 s grace) or idleness (5 real min); optional bots per team; 3 humans per team; recovery test (same hash) |
| F7 — Client | Vite + Preact; connection, `welcome`, reconnect; SVG map with static and dynamic layers, pan and zoom; creeps by DNA and team, load ring, domination halo, interpolation; creep inspector; core panel; rules editor and presets; direct control. **Checkpoint:** the owner's session |
| F8 — Replay and multi-client | replay in the browser (the `sim` runs on the client); replay hash checked on Safari/JSC; `npm run dev:multi -- --clients K` |
| F9 — Readability and playtest | `npm run soak`; road and rock distinguishable; road cost feedback; full-load signal; delivery feedback; creep names on the map; `docs/PLAYTEST.md`. **Checkpoint:** human readability and mechanics playtest |

Left out of M1 (owner, 2026-11-14): Dockerfile, `compose.yml`, Caddyfile, `litestream.yml`, the deploy workflow and
the compressed fun playtest. See the [ROADMAP](../../ROADMAP.md) for where the first multiplayer playtest now sits.
