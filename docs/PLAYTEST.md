# Playtest

How to run a geometrix playtest session. The earlier sessions (M1 readability, the M1.5 fog, the M2 encounter, the
lab groups 1–6 and 8) are done; their scripts are summarized below, and their findings live in each slice's
`tasks.md`. The junction groups J1–J5 were played freely at slice D's checkpoint C2 (2026-11-25; J6 left to P).
**Pending:** lab group 7 (the movement options).
**Next:** the friends' playtest (slice P, [ROADMAP](ROADMAP.md)), whose script is written in P's spec.

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

## The junction: the world with battles (checkpoint C2) — played 2026-11-25

Slice D's sessions ([spec §8](specs/m2-junction/spec.md)): the encounter now opens a real battle instead of the roll.
Two worlds, at ×6 and on seed 42: first alone against the bot (J1–J5, ~50 min), then three tabs with no bot (J6,
~15 min). The groups go in this order because the wanderers are born only after the first world hour (10 real
minutes at ×6) and multiply after that, and because J6 needs a fresh world without the bot.

**What is recorded by itself:** every battle (who, how it opened, how long, how it ended, each human input) is in the
server's database (`data/geometrix.db`); Claude reads it after the session and builds the tables. Note only what you
felt and the answers.

How a battle works in the world (the lab's rules, plus):

- **Attacking** opens the battle at once; an **extortion refused** ("Recusar e lutar", refuse and fight) opens it too.
  A creep in a battle stands still in the world (crossed blades over it) until it dies, escapes or the battle ends.
- **Your dominated creep in a battle opens the battle screen by itself**, over the map, with the 3 s countdown. The
  battle then runs in **real time** ("tempo real" in the bar) while you play; with nobody playing it runs on the
  world clock ("relógio do mundo"), a battle second per world second (at ×6, six per real second).
- **"Voltar ao mapa"** (back to the map) or **Esc** goes back to the map; the banner **"Voltar à batalha"** brings
  it back. The keys in the arena are the lab's: arrows or WASD, Shift + arrow turns, space attacks, Q drops the purse,
  E picks up. Tab, 0, R and P do nothing here.
- On the map, a battle is a **bubble** with a **sign** split in its sides' colors; clicking the sign selects the
  battle, and the inspector offers **"Assistir"** (watch). The chronicle tells the openings, joins, escapes, deaths
  and ends.
- **Joining:** right-click an enemy that is in a battle with a dominated creep and choose **"Atacar"**: the creep
  walks to the bubble and enters on its team's side (it waits at the edge while the side's zone is full).
- **Wanderers** (sand-colored circles, "andarilhos"): born in the jungle band along the river after the first world
  hour, up to 4 alive. They attack only **loaded** creeps in sight, join battles they see, carry what they loot and
  leave it as spoils when they die. A right click on one offers only "Atacar" (they do not pay).
- In the battle screen's roster, **"dominar"** takes another participant of your team and **"soltar"** releases
  yours (the world's dominate and release, with their cooldown).

### Setup (J1–J5)

```sh
npm run dev:multi -- --clients 1 --bot --mult 6 --seed 42
```

One tab, Blue, with the bot playing Orange. Open the chronicle on the right and keep it visible.

### Group J1: ambush (~10 min)

1. Dominate a **Blue triangle** ("Dominar" in the inspector) and walk it toward the middle of the map, where the
   Orange creeps gather.
2. When an Orange creep is in sight, **right-click** it and choose **"Atacar"**. The battle screen opens by itself:
   wait for the countdown and fight.
3. At the end, read the end table and press **Esc**. Look at the map and the chronicle: where did your creep come
   back, what happened to the loads?
4. If an Orange raider **extorts** one of your creeps (the reaction panel appears while you dominate it), answer
   **"Recusar e lutar"** and fight the battle that opens.

```
GROUP J1
Q1 Did the fight pay off the risk? Would you attack again with the same creep, or not?
Q2 Did the screen open at the right moment? Was the countdown long, short, fine?
Q3 After Esc, did you understand from the map and the chronicle how it ended?
```

### Group J2: taking over and reinforcing (~10 min)

1. Release your creep ("Liberar"). Watch the map and the chronicle until a battle opens with a Blue creep in it
   (a bubble with a blue arc in the sign; the chronicle tells it).
2. Click the battle's **sign**, then **"Assistir"** in the inspector: the screen opens watching ("Assistindo").
3. In the roster, click **"dominar"** on the Blue participant: you take it mid-fight, with no countdown, and the bar
   changes to "tempo real".
4. In the next battle you see (or the same one, if it lasts): before it ends, **Esc** to the map, **dominate a free
   Blue creep nearby** and right-click an **enemy participant** → **"Atacar"**: a reinforcement. See it walk into the
   bubble and enter; open the screen ("Voltar à batalha" or "Assistir") and fight with it.

```
GROUP J2
Q4 Taking a creep mid-fight: did it feel like control, or like arriving late?
Q5 Did the reinforcement arrive in time? How long from the order to entering the arena?
Q6 Did the locked time bother you (your creep standing still in the world while the battle runs)?
```

### Group J3: watching from outside (~5 min)

Without dominating anyone in it, follow a battle of your team from the map: the bubble, the sign, the crossed blades,
the chronicle. Then open it with "Assistir" and go back with Esc.

```
GROUP J3
Q7 Without opening it: did you know a battle was happening, where, and who was in it?
Q8 Does the chronicle tell enough to follow it (who started, who joined, who fled, who won)? Is the tone right?
```

### Group J4: the wanderers (after ~10 real minutes; ~15 min)

1. When the chronicle says a wanderer was born ("surge na mata do rio"), find it on the map (a sand circle in the
   band along the river).
2. **Being attacked loaded:** dominate a Blue collector carrying a load and make it cross the band near the wanderer.
   Fight, or run for the border.
3. **Hunting a full one:** when a wanderer carries a load (a colored dot inside its circle; the right-click menu says
   "leva …"), right-click it with a dominated creep → **"Atacar"**. If it dies, pick up its spoils (right-click the
   pile).

```
GROUP J4
Q9 Being attacked loaded: fair, unfair, too frequent, too rare? Did fleeing work?
Q10 Hunting a loaded wanderer: was it worth it? Did you find one carrying something?
Q11 Did the wanderers change your routes or how you carry loads?
```

### Group J5: closing alone (~5 min)

```
GROUP J5
Q12 What did you change after the first battle?
Q13 Does the battle change the course of the world without dominating it (too many, too few, about right)?
Q14 The square against the circle (an open question in GDD 06): did one DNA feel stronger in the world's battles?
```

### Group J6: three tabs, no bot (~15 min)

```sh
npm run dev:multi -- --clients 3 --mult 6 --seed 42
```

Three tabs: **Jogador 1** (Blue), **Jogador 2** (Orange), **Jogador 3** (Blue). Stop the J1–J5 server first
(Ctrl+C).

1. In tab 1, dominate a Blue creep; in tab 2, an Orange creep; walk both toward the middle until they see each other.
2. In tab 1, right-click the Orange creep → "Atacar". Both screens open; fight one against the other, switching tabs
   (each tab keeps its own creep).
3. In tab 3, click the battle's sign → **"Assistir"**: a teammate watching.
4. Still in tab 3: Esc, dominate another Blue creep near the battle, right-click the Orange participant → "Atacar": a
   third creep joining. Play it from tab 3.
5. Optional, with `?net=1` in a tab's address (or `--net` at the start): the network panel's **"Movimento"** selector
   in a battle, as in lab group 7.

```
GROUP J6
Q15 Human against human: did it feel like a fight between people? Did either side keep control all the time?
Q16 The teammate watching: did the screen show enough to understand who was winning?
Q17 The third creep joining: did it enter in time, in a sensible place?
Interpretations to validate (junction tasks): F4 record 1–9 and F5 record 1–14, yes or no for each (Claude reads
them out one by one in the session).
```

### After J6: the checkpoint questions

```
C2-1 The hypothesis (spec §1): does the battle pay off the risk, change the course of the world, without dominating
     the game? Is the world readable with battles in it?
C2-2 The order of E (siege and repair) against P (the friends' playtest): E first, P first, or P with E's minimum?
```

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
