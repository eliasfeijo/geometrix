# Playtest

How to run a geometrix playtest session. The earlier sessions (M1 readability, the M1.5 fog, the M2 encounter, the
lab groups 1–6 and 8) are done; their scripts are summarized below, and their findings live in each slice's
`tasks.md`. **Pending:** lab group 7 (the movement options). **Next:** the friends' playtest (slice P,
[ROADMAP](ROADMAP.md)), whose script is written in P's spec.

The game's interface is in Portuguese; the labels below are quoted as they appear on screen, with a gloss.

## The world: setup (owner)

Node 26 and `npm install` done. At the repo root:

```sh
npm run dev:multi -- --clients 2 --mult 36
```

Builds the client, starts the server at `http://localhost:8080`, creates a world and opens one tab per player
(Blue and Orange alternating), already inside the world.

| Option | What for |
|---|---|
| `--clients 1` | One person alone, against the empty other side |
| `--bot` | A bot on Orange and every player on Blue |
| `--mult 6` | ×6: the encounter's 60 s reaction window lasts 10 real seconds; an hour of world takes 10 real minutes |
| `--mult 12` | Slow enough to see a road job (2 world minutes = 10 s real) |
| `--seed 42` | The same map for every session (compare answers) |
| `--no-open` | Only prints the URLs (to open in another browser or machine) |
| `--net` | The network panel (`?net=1`) |

### Access

- **Same machine:** the tabs `dev:multi` opens. Each tab is one player.
- **Another machine on the local network:** the server listens on every interface, so `http://<machine-ip>:8080`
  works outside WSL. **On WSL2** the port does not show on the network without `networkingMode=mirrored` in
  `.wslconfig` or a `netsh interface portproxy` on Windows. Not tested yet.
- **Over the internet (slice P, not tested yet):** a free tunnel to the local server
  ([ADR-0005](adr/0005-mvp-deploy-vps-websocket.md)): Cloudflare Tunnel (`cloudflared tunnel --url
  http://localhost:8080`, a temporary `trycloudflare.com` address, WebSocket included) or Tailscale Funnel. Slice P
  validates one of them from outside the owner's network and writes the steps here.
- The player token goes in the URL fragment and leaves the address bar after joining: to send a link to another
  machine, use `--no-open` and copy the printed URL.

### Earlier world sessions (done)

| Session | Hypothesis | Script (summary) | Findings |
|---|---|---|---|
| M1 readability (F9) | Is gathering, transporting and investing interesting on its own? Is the map readable? | Look without touching; ten tasks (core, full load, names, dominate, gather cristal, build a road, produce, upgrade, release); 10 min free play; a 1–5 questionnaire | [M1 tasks](specs/m1-wealth-cycle/tasks.md) |
| M1.5 fog | Does hiding information create decisions without making the map unreadable? | Black × remembered × visible; how far the team sees; find cristal; the last value seen; the enemy and its core; a road into the dark | [fog tasks](specs/m1.5-fog/tasks.md) |
| M2 encounter | Does the encounter create conflict and story, change what the player does, without dominating the game? | `--mult 6 --seed 42 --bot`; read an encounter in the chronicle; HP; extort and attack while dominating; the reaction panel; spoils; the raider preset; what changed after the first ambush | [encounter tasks](specs/m2-encounter/tasks.md) |

## The battle lab

The battle has its own page, with no world and no game server: a battle is set up by hand, played dominating a creep
(or watched), with a simulated network between the page and the battle. Groups 0–6 and 8 were played at the lab
checkpoint (2026-11-18 to 20; results in the [lab tasks](specs/m2-battle-lab/tasks.md)). Group 7 is pending.

### Setup

```sh
npm run lab
```

Opens the lab on Vite (`/lab.html`). Without Vite: `npm run build` and `npm run server`, then
`http://localhost:8080/lab`. The page does not talk to the game server: everything runs in the browser.

- **Use a single tab at the same address** from start to end: the session record lives in this browser, per address
  (5173 and 8080 have separate records).
- In the **"Sessão"** (session) panel: export and **"Limpar"** (clear) old battles before a new session.
- In the **"Rede simulada"** (simulated network) panel: RTT and the **"Movimento"** (movement) selector.

Keys (on the whole page, unless a form field has focus): **arrows or WASD** move, **Shift + arrow** turns, **space**
attacks, **Q** drops the purse, **E** picks up, **Tab** dominates the next creep, **0** releases, **R** restarts,
**P** or **Esc** pauses and resumes.

The rules a player needs to know:

- Every battle starts with the **3 s countdown**: everyone stands still and can only turn. At its end, what is
  **held** counts (direction, space, Q or E); what was pressed and released during it is discarded.
- **A standing creep takes its first step at once**, and each tap moves one cell.
- Whoever stays **2 s** on the border ring without being hit escapes. If the whole battle goes **15 s** with no damage
  to anyone, **everyone flees**. The battle ends when at most one side is left.
- **On screen:** an attacker pulses in a ring of its side's color; whoever is hit flashes white, with the damage
  rising in yellow; a shot that vanishes leaves an **x**. A dying creep shatters; a fleeing one leaves an arrow off the
  arena. The time without damage is a discreet line above the arena, red and large over it in the last 5 s.

### Group 7: movement, the four options (~10 min, 8 battles) — pending

Outside blind mode, ▲ dominated × ● at the rocks ("pedras"). The **"Movimento"** selector has four ways of drawing
the same combat (the battle does not change, only the drawing; ADR-0009):

| Option (on screen) | What it does | Measured in Chromium (▲ held; key → first on-screen move, 0 / 150 / 300 ms) |
|---|---|---|
| "sem interpolar" (no interpolation) | each creep jumps to the cell | 52 / 175 / 345 ms; stands ~240 ms between steps |
| "interpolar (1 tick)" | today's default: slides 50 ms, stands the rest of the step | 64 / 231 / 329 ms; stands ~210 ms between steps |
| "deslizar o passo inteiro" (slide the whole step) | slides at the DNA's speed, no pause, up to one step behind | 60 / 239 / 354 ms; no pause |
| "prever o meu creep" (predict my creep) | your creep moves the moment you press, without waiting for the network; the others as in 1 tick | 15 / 16 / 43 ms; no pause |

1. RTT **0 ms**. One battle with each option, in the table's order (4 battles).
2. RTT **150 ms**. One with each again (4 battles).
3. At the end, back to "interpolar (1 tick)" and RTT 0 ms.

What to look at: the pause between steps while holding a direction, whether your creep feels "late" or "sliding",
whether the prediction ever draws the creep where it is not (it corrects when wrong: a block, another creep ahead),
and whether aiming at the ● gets easier or harder.

```
GROUP 7
F6 At 0 ms, which of the four feels best? And worst? Why?
F7 At 150 ms, the same question.
F8 Did the prediction ever fool you (the creep appeared somewhere and went back)? Where?
F9 Which one do you want as the lab default (and, after the junction, as the starting point for the game)?
Interpretations to validate (lab tasks, F7 record): yes or no for each of 1–5.
```

### Earlier lab groups (done)

| # | Group | What it measured |
|---|---|---|
| 0 | Setup | A clean record, RTT 0, "interpolar (1 tick)", ×1, normal AI |
| 1 | Duels dominating (9 battles) | Each DNA against the normal AI in the three arenas ("pedras", "aberta", "corredor") |
| 2 | The AI in your place (27 instant battles) | The same 9 matchups AI × AI, for the "Você × IA" (you × AI) comparison |
| 3 | Watching | A 3 × 3 at the rocks and a 1 × 1 × 1 in the open arena |
| 4 | Changing the fight | Editing gambits and sending a reinforcement mid-fight |
| 5–6 | Blind (~30 battles) | The RTT drawn by the page among 0–300 ms, a 1–5 score before revealing it |
| 8 | Closing | The tables, the hypothesis questions and the next rule (none before the junction) |

## Validating the replay (owner)

Pending since M1 F8. After a session:

1. In the lobby, on a **finished** world, click **"Assistir replay"** (watch replay) or open `/?replay=<id>`. Since
   the fog, a running world has no replay (the log would show the whole world through the fog); for a short world,
   use a high `--mult` in `dev:multi`, or the one from `npm run soak`.
2. **Play**, change the **speed** (1, 60, 600, 3600, max) and drag the **timeline** back and forth.
3. Switch the team in "Ver como" (view as) and check each side's core panel.
4. Let it reach the end (or use "max"): the seal must say **"✓ hash confere"** (hash matches).

## Recording

At the end of each session, the owner (or Claude, with the notes) records:

- **Findings** in `docs/dashboard/current-status.md` and in the slice's `tasks.md`: one item per problem, with the task
  or question that showed it.
- **Suggested gameplay changes:** in the system's GDD as **Proposal**, never as Decided without the owner's OK.
