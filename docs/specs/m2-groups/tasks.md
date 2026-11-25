# M2 tasks — Groups and formations

**Status:** F0 (the plan waits for the owner's approval). Branches `m2/groups-f<n>-<slug>` (skill `commit`).
**Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)

## F0 — Spec and plan

- [x] Design round with the owner (2026-11-25), recorded in GDD 01, 02, 05, 06 and 07
- [x] The spec's review: the pace, the loan, the default command, the bot's glow, the keys (Z, C, N, Shift+N, Ctrl),
      one-shot orders, the cap and "only your squad or free creeps" (owner, 2026-11-25); the spec approved
- [ ] **Checkpoint:** the owner approves the plan (P1–P15)

## F1 — Squads in the world

Starts after R's F2 and F3 are in `main` (plan §11).

- [ ] The `squads` params (maxSize, symbols, activeSeconds, formation) in the schema, `default.json` and the test
      params, with `checkConsistency` (plan §3)
- [ ] `Squad`, `WorldState.squads`, `Creep.squad`, `Creep.oneShot`, `Player.presence` in the state and `createWorld`;
      a human's squad created by `join` with the first free symbol
- [ ] `squads.ts`: add (refusals `inOtherSquad`, `squadCap`, `inBattle`, `engaged`), dominate by swap, leave keeping
      the order as one-shot, reorder, the succession on leave and on death; the invariant test (S-2..S-6, D3)
- [ ] The cap computed at validation with its remainder for the active players with the fewest (S-10, P4); no
      release on a death, a birth or a join
- [ ] The commands `addToSquad`, `leaveSquad`, `reorderSquad`, `setSymbol`, `presence`, `formSquad`; `release`
      removed; the symbol's uniqueness (S-9, P3)
- [ ] The order command by status: detach a squad creep, one-shot for a free one, `inOtherSquad` for another's
      (S-3, S-6b, D9); the rules editor refused on another's squad creep (D28)
- [ ] One-shot orders: the "done" test per order and the autopilot's skips (S-7, P2)
- [ ] The encounter window for squad creeps, answered by the leader (W-6, D14)
- [ ] The view: the team's squads, `Creep.squad`, `oneShot`, the foreign creep's `symbol` and `embodiedBy` (D4);
      `SIM_VERSION`; the fixed hashes

## F2 — Formation and the bot's squads

- [ ] `Creep.heading` on each step; `formation.ts`: the slots by DNA turned to the heading, around rock and river,
      equivalent on both sides of the mirrored map (W-1, D8, P6)
- [ ] Follow in formation and hold; a detached member back to its slot when its order is done (W-2, W-3)
- [ ] `squadOrder attack` with the DNA's `via` cell (W-4, D11, P7)
- [ ] Joining a battle by squad, in follow and in hold (W-5, D12)
- [ ] The strategist's squads by difficulty (`formSquad`, the raid's attack order) and H-2's counters (D19)
- [ ] The tick cost against R's target with squads walking

## F3 — The battle

Starts after K's merge (plan §11).

- [ ] The no-squad fixture: today's results for the `battle verify` seeds and a slice of the sweep, recorded before
      the battle changes (B-7)
- [ ] The battle's `squad` params and `limits.maxPerSide` 8 with `battle.sideCap` 8 (D7, P11)
- [ ] Cell hints in the setup and the join; placement off the ring with no `rng` call (B-1, P10)
- [ ] `squadOrder` and `Participant.order`: form, hold, free, fall back in the mind (B-3, D17, P8)
- [ ] The squad AI for `squadAi` participants (B-4, D18, P9)
- [ ] `help` and the `helpComing` condition, the carrier's hold, behind the param (B-6, D23, P12); cut first if G runs
      long
- [ ] The junction: entries by the world direction, the opening's formation hints, a joiner's cell from its world
      cell, `squadAi` for the bot's creeps, the help count (B-1, B-2, B-5); `BATTLE_VERSION`
- [ ] `geo junction matrix --squads` (H-1, P15); the 3 × 3 and 8 × 8 cost (spec §7); the fixture green with no squads

## F4 — The lab

- [ ] Squads in the setup (a leader's squad, bot squads), the help count per side
- [ ] The shared battle screen: N, Tab and a click select; Shift+N dominates; Z's 1–4; C's squad list; each
      participant's command mark (U-4)
- [ ] The squad AI's list in the editor (read-only); the PLAYTEST lab group for G1
- [ ] **Checkpoint G1:** the owner plays a squad in the lab (spec §8.3); the matrix with squads; the side cap's cost

## F5 — Network and server

- [ ] The protocol: the commands, the view's squad fields, `activity`, `battleSquadOrder`; `PROTOCOL_VERSION`
- [ ] Presence: no more releases; away after the grace, active and idle from the client, back on reconnect (S-8,
      S-11, P5); the domination timeout removed
- [ ] `battleSquadOrder` routed only for the sender's squad's participants (D16, D28)
- [ ] The lobby's symbol and the server's `setSymbol` after `join`
- [ ] `geo net` with squads within the M1.5 targets and the watcher budget

## F6 — The world client

- [ ] The selection as a list: click, drag box, Shift+click, N, Tab, 0 (U-2, D22, P13)
- [ ] Ctrl (⌘) + click and Ctrl + drag build the squad, with the symbol at once (U-2b, D2)
- [ ] Shift+N and "Dominar"; the right click by status (D3, D9, U-6)
- [ ] Z's formation menu with the target pick (U-4, D10)
- [ ] C's panel: numbered, reorderable, the cap, the team below, its actions (U-3, D20)
- [ ] The symbols, the glow and the names at every zoom, on the map and in the arena (U-1, D4, D5)
- [ ] The inspector for several and for a squad creep, "Liberar"; "Entrar" by D21; activity (U-5, D27)
- [ ] The world's battle screen with the F4 keys

## F7 — Soak and playtest

- [ ] The soak with a squad's disconnect and reconnect; `geo verify` and `geo battle verify` (H-3)
- [ ] The G2 script in PLAYTEST (spec §8.4)
- [ ] **Checkpoint G2:** two humans on one team against the bot; the §7 criteria; G closes
