# ADR-0003: TypeScript + Node LTS, with a pure, integer-math simulation

**Status:** Accepted (2026-11-13) · **Date:** 2026-11-13
**Related:** ADR-0001 (world × battle), ADR-0002 (everything is a command), M1 spec

## Context
The simulation has to run in three places:
- on the **server**, as the authority over the world and the battles;
- in a **headless CLI**, for bots, parameter sweeps and the determinism test;
- in the **browser**, for replays (M1) and for predicting the dominated creep in battle (M2).

Running in the browser limits the real options to JS/TS or WASM.

Expected orders of magnitude:
- **M1 world:** about 60 creeps, a 64×64 grid, 1 tick/s. Headless, about 430 ticks/s (3 days in under 10 minutes).
- **M2 battle:** tens to hundreds of entities at 20–30 ticks/s.

## Alternatives
- **A. TypeScript everywhere; Node LTS on the server** (chosen).
  - Pros: the same simulation on the server, in the browser and in the CLI, with no bridge; one language; the best
    iteration speed and DX with AI; native debugging in the browser; enough performance for the numbers above.
  - Cons: GC pauses and less raw performance; determinism depends on discipline.
- **B. A Rust core compiled to WASM, UI in TS.**
  - Pros: easier performance and determinism; the same binary on client and server.
  - Cons: two languages and an extra toolchain; friction at the JS↔WASM border; slower iteration. Premature
    optimization at the game's scale.
- **C. Go server, TS client.**
  - Pros: affinity with a friend's control plane; server performance.
  - Cons: a duplicated simulation, or Go→WASM (a ~2 MB+ bundle, with GC); rules out the shared prediction of M2.
- **Bun instead of Node.**
  - Pros: TS, SQLite, WebSocket with pub/sub, tests and a bundler built in.
  - Cons: less track record for processes that run for days; less mature observability (OTel). A cheap swap later.

## Decision
**Option A**, with Node LTS on the server and the rules below.

### Simulation rules
1. **A pure module:** no I/O, no DOM, no runtime APIs. A function `state + commands → new state`, runtime-agnostic.
2. **Integer or fixed-point math:** positions in cells, integer quantities, time in ticks.
3. **Forbidden in the simulation:** `Math.random` (use a seeded RNG that is part of the state); transcendental
   functions (`Math.sin`, `Math.exp`…), whose results can differ between V8 and JavaScriptCore; `Date.now` and other
   clocks; iterating structures without a guaranteed order.
4. **TS with erasable syntax only** (`erasableSyntaxOnly`: no `enum` or `namespace`), so Node runs `.ts` without a
   build. The client uses Vite/esbuild, the only build step.

## Consequences
- The determinism test (same seed + commands ⇒ same state hash) runs in CI. Ideally it also runs on a second JS
  engine, to catch V8 vs JSC differences.
- **Performance escape hatch:** a hot path (pathfinding, collision in battles) can be ported to WASM on its own,
  without changing the architecture.
- Only the server adapter (network, persistence) knows about Node. Moving to Bun only touches it.
- Integration with the Go control plane, when it comes, happens through a contract (REST/HTTP), not a shared
  language.
