# geometrix

**A persistent multiplayer strategy game for the browser, drawn only with geometry.** Your creeps haul wealth
across a fogged jungle for days, even while you sleep. On the way, someone may stop them and ask for a toll.

[Leia em português](README.pt-BR.md) · [Project overview (PT-BR)](docs/OVERVIEW.md) ·
[How a match plays (PT-BR)](docs/GAMEPLAY.md) · [Current status (PT-BR)](docs/dashboard/current-status.md)

![A world on day 3: the blue team's roads, creeps and core, with the river and its fords in the middle](docs/img/world-day3.png)

> **Pre-alpha.** The world, the economy, the autopilot, the fog of war and the roadside encounters are playable
> locally, against bots or with friends on the same machine; real-time battles are playable in a local battle lab.
> There is no public server yet. Joining battles to the world is the next step.

## Why it might be your kind of game

- **The world keeps going without you.** A match lasts days (three, for now). When you log off, your creeps keep
  working by the rules you left them: an ordered list of `condition → action`, like the gambits of Final Fantasy XII.
  "Deliver when full; gather crystal; explore while you know no crystal; otherwise go home."
- **Wealth is physical.** Matter and crystal sit somewhere on the map and must be carried home, one bag at a time.
  A loaded creep is slower, and it is a target. Roads are built cell by cell, and they are neutral: the enemy walks
  on yours too.
- **Ambush, extortion, flight.** An enemy creep can approach yours and attack, or demand a toll. Pay and walk away
  with a safe-conduct, refuse and fight, or drop the bag and run. Whether you get away depends on speed, load and
  terrain: good luck crossing a ford with a fully loaded square. The roadside encounters of Mount & Blade, played out
  by autopilot rules when nobody is watching.
- **Short real-time battles on a grid** *(in the battle lab today; in the world next)*. Directional attacks,
  projectiles you can dodge, squares that block the way, a three-second countdown, and fleeing through the edge of
  the arena, with or without the bag. The creeps you don't control fight by their gambits, and a battle with no
  humans resolves itself with the same simulation.
- **Stories, not spreadsheets.** Creeps have names and die for good. A chronicle narrates what happened, the toll
  paid at the ford, the scout that never came back, in the spirit of RimWorld and Dwarf Fortress.
- **Any creep can be the hero.** There is no fixed hero: take direct control of any creep on your team, play it,
  then release it back to its autopilot.
- **Build your own bot.** Everything that changes the world is a command, and the house bots use the same
  validated commands a player does. Planned: a command line in the chat, with BYOND-style verbs, client macros
  and, later, sandboxed scripts on the server, so you can program your creeps beyond the built-in presets.
- **Fog of war, enforced by the server.** Each team only ever receives what it sees and remembers. The terrain
  arrives as you explore, and a command about something your team has never seen gets the same refusal as a
  nonexistent id.
- **Shape is meaning.** A square is a slow, sturdy hauler; a circle is a fast, far-sighted scout; a triangle sits in
  between. No art pipeline, just geometry.

![The start of a match: the core, a first road and two crystal haulers, surrounded by the black of the never-seen](docs/img/world-fog-start.png)

## What you can play today

- A procedurally generated map, mirrored for both teams, with a river, a few fords and rocks that block sight.
- Gathering, hauling and delivering matter and crystal; building roads; producing creeps; a cargo upgrade.
- An autopilot editor with presets (collector, scout, road builder), and direct control of one creep at a time.
- Fog of war in three states (never seen, remembered, in sight), with the team's memory of what it has seen.
- Roadside encounters: approach, extort, pay, refuse or flee; HP that carries over, permanent death, loot left on
  the ground, and a chronicle of what happened. In the world, the fight itself is still settled by a placeholder roll.
- A battle lab (`npm run lab`): grid battles against the AI, with up to four sides, editable gambits, three arenas
  and simulated latency.
- Bots that play a whole match by the same rules, and an in-browser replay of any finished world.

## What comes next

| Milestone | Question it answers | Status |
|---|---|---|
| **M1 · The wealth cycle** | Is gathering, hauling and investing interesting on its own? | ✅ Done |
| **M1.5 · The fog** | Does hiding information create decisions without making the map unreadable? | ✅ Done |
| **M2 · The ambush** | Can a fight change the course of the world without dominating the game? | 🟡 Building: the encounter ✅ and the battle lab ✅; next, battles joined to the world, then siege and repair |
| **The items** | Does an item you can win and lose give a reason to fight and to come back? | Next milestone (candidate) |
| **Theme bank** | Creeps with traits and titles, the players as gods in the chronicle, leagues led by a creep, the world's secret arc and its game master, living tribes, pacts between gods, legends that invade other worlds | Ideas, not yet numbered |

Each milestone is a hypothesis tested in playtests before the next one starts; the other ideas wait in a theme bank
until the owner picks the next milestone ([roadmap](docs/ROADMAP.md) and the illustrated
[match guide](docs/GAMEPLAY.md), in Portuguese).

## Under the hood

The interesting engineering is not the graphics but a world that runs for days and can be replayed exactly:

- **One deterministic simulation** (`packages/sim`, TypeScript, no dependencies) runs on the server, in a headless
  CLI and in the browser. Integer math only: positions in cells, speeds in per-mille, no `Math.random`, no
  floating-point literals. The linter enforces it.
- **Replay = seed + command log.** A three-day bot-vs-bot world logs about 140 commands. Replays give the same state
  hash in V8 (Chromium) and JavaScriptCore (WebKit).
- **Server-authoritative, per-team view deltas** over WebSocket: about 200 bytes per second per client at real
  speed, numbered, checked by hash and resumable after a drop.
- **SQLite with snapshots and a command log.** A soak test kills the server with `kill -9` five times during a whole
  world and checks that every client ends with the server's exact view.
- **A separate battle simulation** (`packages/battle`), just as deterministic, at 20 ticks per second. A whole
  3-vs-3 battle resolved by the AI takes about 40 ms, so a sweep runs thousands of battles in under a minute.
- **A headless harness** runs three days of world in about 13 seconds, so balance is tuned with data from dozens of
  seeds before anyone plays.
- **Stack:** Node 26, TypeScript, Preact + signals with SVG, Vite, `ws`, `better-sqlite3`, zod, Vitest. About 2,700
  tests.

The [architecture overview](docs/OVERVIEW.md) (in Portuguese) explains the decisions, the costs and the trade-offs,
including why it is not built on Unity or Godot.

## Quick start

```bash
nvm use                                  # Node 26
npm install
npm run dev:multi -- --clients 2         # builds, starts a server and opens one tab per player
npm run geo -- sim --seed 42 --days 3    # a whole bot-vs-bot world, with a report in runs/
npm run check                            # typecheck, lint, format and tests (what CI runs)
```

More commands (server, replay, network and soak tests) are listed in [CLAUDE.md](CLAUDE.md).

## How it is built

Design and code move through explicit gates: pillars and a game design document, then a spec, a plan and tasks for
each slice, with the owner approving every step, architecture decisions recorded as ADRs, and small phases merged one
at a time. Development is done with [Claude Code](https://claude.com/claude-code): the owner decides the design and
approves each gate, and the workflow lives in [`CLAUDE.md`](CLAUDE.md) and `.claude/skills/`.

**Language:** code, identifiers and commit messages are in English. The design documents (pillars, GDD, specs, ADRs,
roadmap) are in Brazilian Portuguese.

| To… | Read (PT-BR) |
|---|---|
| Understand the game | [Match guide](docs/GAMEPLAY.md) → [Pillars](docs/PILLARS.md) → [GDD](docs/gdd/README.md) → [Glossary](docs/GLOSSARY.md) |
| See where the project is | [Status dashboard](docs/dashboard/current-status.md) |
| Understand the technical decisions | [ADRs](docs/adr/README.md) |
| See how a slice is specified | [Specs](docs/specs/README.md) |
| Run a playtest | [PLAYTEST.md](docs/PLAYTEST.md) |

## Contributing

The project is early and the design moves fast. Issues and discussions are welcome, in English or Portuguese:
ideas, playtest impressions and questions about the architecture are the most useful right now.

## License

[GNU Affero General Public License v3.0](LICENSE). You can play, study, modify and host the game; if you run a
modified version for others over a network, you must offer them its source code.
