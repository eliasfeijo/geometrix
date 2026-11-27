# CLAUDE.md — geometrix

A multiplayer browser game: a **persistent strategy/economy world (RTS + sandbox + building)** with **real-time,
MOBA-style battles** as the spice. 100% geometric visuals (SVG, shapes as the language).

**Current phase: M2 (The ambush).** Slices A (the encounter, `docs/specs/m2-encounter/`), B (the battle lab,
`docs/specs/m2-battle-lab/`, `packages/battle`, `apps/client/src/lab/`) and D (the junction, `docs/specs/m2-junction/`,
`packages/junction`) are done. **Next: slice R, rebalance and pace, and slice E-min, the minimal end** (each with its
own design round), **then slice P, the friends' playtest** (the local server through a free tunnel, more than one
human, real gameplay to test). Siege and repair (the rest of E) come after P. See `docs/ROADMAP.md`.

## Sources of truth

| What | Where |
|---|---|
| **Where we are and next steps** | `docs/dashboard/current-status.md` (read first) |
| The project for newcomers, with screenshots | `docs/OVERVIEW.md` (and `OVERVIEW.pt-br.md`, the one Portuguese doc, at the owner's request) |
| What the game is and is not | `docs/PILLARS.md` |
| Vocabulary | `docs/GLOSSARY.md` |
| Design per system | `docs/gdd/` (one file per system) |
| Architecture decisions | `docs/adr/` |
| Slice specs (spec → plan → tasks) | `docs/specs/` |
| Build order | `docs/ROADMAP.md` |
| Playtest scripts | `docs/PLAYTEST.md` |
| Workflow skills (commit, phase, ADR, GDD, slice, wave) | `.claude/skills/` (implementing a phase: `implement-phase`; managing a wave of phase sessions: `run-wave`) |
| How we develop with AI agents | `docs/HARNESS.md` |

## Commands

Node 26 (`.nvmrc`). Node runs `.ts` directly; only the client has a build (Vite).

| Command | What |
|---|---|
| `npm install` | Installs every workspace's dependencies |
| `npm run check` | Everything CI runs: typecheck, lint, format:check and tests (the static checks in parallel, then the tests). **Green at the phase's close and before a merge.** |
| `npm run check:fast` | Typecheck, lint, format:check and the tests related to the uncommitted changes (`GEO_FAST=1` skips the protocol's three 6 h worlds). **Green before each task commit**; `npm run check` once at the phase's close and before a merge. |
| `npm run typecheck` | `tsc` in each workspace |
| `npm run lint` | ESLint, including the `sim`, `battle` and `junction` determinism rules |
| `npm run format` | Prettier (does not touch Markdown) |
| `npm test` | Vitest in every workspace |
| `npm test -- --project @geometrix/sim` | Vitest in one workspace |
| `npm run geo -- verify --seed 42` | Determinism: 2 runs + snapshot → restore must give the same hash |
| `npm run geo -- net --seed 42 --days 3` | Bandwidth and CPU of the view deltas against the M1.5 spec §7 targets, with the diff property on every tick. Report in `runs/<id>/net.md` |
| `npm run geo -- battle sweep` | The AI battle matrix (presets × arenas × seeds 1–100, ~45 s): wins, duration, inactivity and the 3 × 3 cost against the target. Report in `runs/<id>/battle.md` |
| `npm run geo -- junction matrix` | The junction's battles without the bots (seeds 1–100, ~10 s): on each seed's world, every aggressor DNA × victim DNA, empty or full, fighting or fleeing, built by `battleSetup`; `--set path=v1,v2` compares a param's values. Report in `runs/<id>/junction.md` |
| `npm run geo -- battle verify` | Battle determinism (seeds 1, 42, 649); `--log <file>` replays a log exported by the lab and checks the hash |
| `npm run lab` | The battle lab (`lab.html`, Vite): the battle in a worker, simulated network, blind sessions |
| `npm run server` | Server at `http://localhost:8080` (`GEO_PORT`, `GEO_DB`, `GEO_PARAMS`, `GEO_BATTLE_PARAMS`); serves the client build |
| `npm run build` | Client build (Vite) into `apps/client/dist`, which the server serves |
| `npm run capture` | Screenshots of the real game and lab for the docs (Playwright, headless): builds, starts a private server on `--port` (8097), drives two bot worlds; `--only <scenes>`. Output in `runs/capture-<id>/`; copy the keepers to `docs/img/` |
| `npm run client` | Vite dev server (port 5173) proxying `/api` and `/ws` to the server on `GEO_PORT` |
| `npm run dev:multi -- --clients 3` | Build + server + a world with K players (Blue/Orange alternating), one tab per player (`--seed`, `--mult` (default `world.multiplier`), `--no-build`, `--no-open`, `--net` for the `?net=1` network panel, `--bot` for the bot on Orange with everyone on Blue, `--bot-difficulty easy|normal|hard`, `--set path=n` (repeatable) to override a world param for the session) |
| `npm run soak` | Endurance test: a whole bot × bot world (×360, ~3 min) with `kill -9` and restart, and 2 WebSocket clients per team following the deltas; the exported replay must give the server's hash and each client the server's view, and the end it reaches must be the one the lobby and the clients show. Report in `runs/soak-<id>/` |

## `sim` and `battle` conventions

`packages/sim` (the world) and `packages/battle` (combat, ADR-0008) are pure and deterministic (ADR-0003), and so is
`packages/junction` (the host that runs battle instances next to the world, ADR-0010), which imports both. The
tsconfig and lint already block runtime APIs, `Math.random`, transcendental functions, `Date`, `for…in` and
floating-point literals. The battle imports neither the `sim` nor the `protocol`. Beyond that:

- **Integer units:** positions in cells, durations in world seconds (battle: ms, multiples of the 50 ms tick),
  modifiers in ‰, movement in points (`CELL_COST`). Every division must give an integer: `Math.floor`, or guaranteed
  divisibility (e.g. `CELL_COST` is a multiple of 60) or validated in the params (e.g. even width).
- **A new parameter:** goes into the `schema` of `params.ts` (the `Params` type derives from it), into
  `params/default.json` (battle: `params/battle.json`) and, if related to others, into `checkConsistency`. A balancing
  number never lives in the code.
- **A new state field:** type in `world.ts`, initial value in `createWorld`, JSON data only (no `Map`, `Set` or
  classes; `serialize` refuses them). Update the fixed hash (see the `implement-phase` skill). A change that makes the
  same log give another result bumps `SIM_VERSION` (battle: `BATTLE_VERSION`).
- **State:** arrays ordered by id; ids from the `nextId` counter, never reused. `step` mutates in place.
- **RNG:** only `state.rng` (`nextInt`/`nextRange`), always in the same call order.
- **A creep's rules are replaced whole, never mutated in place** (`creep.rules = …`, like `setRules` and the presets;
  battle gambits too). The network delta compares rules by reference (M1.5 plan, R4). The order, by contrast, is
  recreated every tick by the autopilot with the same value and is compared by value.
- **Team view** (`view.ts`): what a team sees, and the strategist's only input (with the static map and the params).
  A shallow copy: nested objects are shared with the state, which `step` mutates.
- **Tick pipeline** (M1 plan §5) in `step.ts`; new orders in `orders.ts`. A finished road increments
  `state.roadRevision` (invalidates cached paths). The battle's pipeline is the lab plan §7.
- **Exports:** every public module goes into the package's `src/index.ts`; other packages import from
  `@geometrix/sim` / `@geometrix/battle`.
- **Tests** in `packages/<package>/test/`, with `test/helpers.ts` (`loadTestParams`: the fixed params of
  `test/params.json`, which do not follow balancing). Small test maps and arenas drawn as text (see
  `pathfinding.test.ts`).

## Working rules

- **Decided × proposed × parked × open.** Each GDD file separates `Decided` (the owner approved), `Proposal` (a
  suggestion not approved yet), `Parked` (the owner's ideas with no milestone) and `Open questions`. Never promote a
  proposal or an idea to decided without the owner's explicit OK. When the owner decides something, move the item to
  `Decided` and out of the other sections.
- **Do not invent gameplay.** If something is not in the GDD, ask. Numbers (costs, times, stats) are provisional
  until validated in a playtest or simulation.
- **Stay on the goal.** The current goal is the rebalance, the minimal end and the friends' playtest. A new idea goes into the GDD's
  `Parked` (or a question to the owner), not into the plan; brainstorm documents are not written unless the owner asks.
- **First the concrete, then the generic.** No "engine" abstraction without a game need. Code should be modular so
  parts can become libraries later, but with no speculative generalization.
- **Scope guard.** Every new system enters the GDD with the `ROADMAP.md` milestone it belongs to, or in `Parked`.
  Warn when an idea grows the current milestone's scope instead of just accepting it.
- **ADRs:** on detecting an architectural decision, draft the ADR with status `Proposed`. It only becomes `Accepted`
  with the owner's approval. Update `docs/adr/README.md`.
- **Language:** everything in the repository is in **English** (docs, code, commits, skills). The conversation with
  the owner is in Portuguese. The game's UI text is still in Portuguese (translating it is an open question).
- **Diagrams** in Mermaid, never ASCII art (a folder tree may be a text block).

## Git

- Branches, commits and merges: the `commit` skill. Never push unless the owner asks.
- The machine-specific setup (where each checkout lives, where merges run, who pushes) is not versioned: it lives in
  an untracked `CLAUDE.local.md` when there is one. See `docs/HARNESS.md`.

## External reference

`github.com/vitormartins1/go-multiplayer-control-plane`: a Go control plane (accounts, matchmaking, session,
achievements, ranking, analytics). A candidate for future integration. Do not reimplement what it already offers
without discussing first.
