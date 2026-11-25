# M2 plan — Groups and formations

**Status:** Draft · **Date:** 2026-11-25
**Spec:** [spec.md](spec.md) · **ADRs:** [0002](../../adr/0002-every-action-is-a-command.md) (command vocabulary),
[0003](../../adr/0003-typescript-node-pure-integer-simulation.md) (determinism),
[0008](../../adr/0008-battle-package.md) (battle package),
[0010](../../adr/0010-world-side-of-the-battle-contract.md) (the world side of the contract)

The decisions that need the owner's OK are marked **(P*n*)** and listed in §13. The plan is written against **the
approved plans of R and K** (G's code comes after their merges, §11): it uses R's `follow`, the strategist's groups and
difficulty, the presence tracker, the pauses and "Entrar", and K's kits and carrier preset.

## 1. What the code does today and what changes

| Today (after R and K: `SIM_VERSION` 12, `BATTLE_VERSION` 7, `PROTOCOL_VERSION` 9; E-min may take the next) | In slice G |
|---|---|
| `Creep.dominatedBy`: at most one creep per player; dominating is the only way to command a creep (`orderRefusal` → `notDominating`) | `WorldState.squads` and `Creep.squad` (P1); `dominatedBy` stays, for the embodied creep only, always its squad's number 1. An order to a free creep is one-shot (P2); an order to another player's squad's creep is refused |
| The autopilot skips a dominated creep and runs every other one every tick, overwriting any order | It skips squad creeps (except an anchor whose leader is a bot or away) and creeps with a one-shot order until it is done (P2) |
| `release` frees the dominated creep; the server emits it after a 15 s disconnect or 5 min without input | `leave` takes one creep (or all) out of the squad, keeping its order as one-shot; the server emits `presence` instead of releases (P5) |
| The encounter window only for the dominated victim | For any squad creep whose leader is not away (D14) |
| The world has no notion of a group: `follow` (R) is a pair | A squad's followers walk to formation slots around the anchor's heading (P6); `squadOrder` follow, hold, attack (P3, P7) |
| The strategist's groups are `follow` rules (R D16) | Squads of the bot (`formSquad`), walking in formation (D19) |
| A battle side spawns on its fixed entry stretch (0 left, 1 right, 2 top, 3 bottom); a joiner on its side's stretch, at a drawn cell | Each side's stretch chosen by the world direction; a joiner placed at its world cell's block (P10) |
| A participant is `human` or `gambits` | Plus its squad command (form, hold, free, fall back) and, for the bot's creeps, the squad AI (P8, P9) |
| The side cap is 5 (`battle.sideCap`, `limits.maxPerSide`) | 8 (D7) |
| The world client selects one actor; the right click orders the dominated creep; Tab and 0 in battle move and release the domination | A selection of several (drag box, Shift+click, N, Tab, 0); Ctrl builds the squad; Shift+N dominates; Z's options; C's panel; symbols, glow and names (P13, P14) |

## 2. Where each thing lives

```text
params/
  default.json       squads (maxSize, symbols, activeSeconds, formation), battle.sideCap 8, battle.helpComing (§3)
  battle.json        limits.maxPerSide 8, squad (formMaxCells, fallBackPermille) (§3)
packages/sim/src/
  world.ts           Squad, WorldState.squads, Creep.squad, Creep.oneShot, Creep.heading, Player.presence;
                     SIM_VERSION (next)
  squads.ts          new: add, leave, reorder, formSquad, the cap (P4), succession of the anchor, symbols (§4)
  formation.ts       new: the slots around the anchor's heading, the DNA's engage cell (P6, P7)
  domination.ts      dominate through the squad and the cap; orderRefusal by status (own squad, free, other's)
  commands.ts        addToSquad, leaveSquad, reorderSquad, formSquad, squadOrder, setSymbol, presence (P3)
  orders.ts          the one-shot "done" test per order (P2); follow-in-formation and hold; approach with a `via` cell
  autopilot.ts       which creeps it skips (P2)
  encounter.ts       the window for squad creeps (D14)
  movement.ts        Creep.heading on each step (P6)
  battle.ts          joining by squad (W-5)
  strategist.ts      the bot's squads (D19)
  view.ts            the team's squads; Creep.squad and oneShot; the foreign creep's symbol and embodier (D4)
packages/battle/src/
  state.ts           Participant.order, Participant.squadAi; BATTLE_VERSION (next)
  setup.ts           a side's entry and a participant's cell hint; placement at the hint (P10)
  commands.ts        squadOrder, help (P8, P12)
  mind.ts, actions.ts the orders' behaviors (P8); the squad AI (P9); the helpComing condition
  presets.ts         the squad AI's list
packages/junction/src/
  setup.ts, arena.ts each side's entry by direction; a joiner's cell from its world cell (P10)
  host.ts            controller by squad and presence (D16); the bot's creeps marked for the squad AI; the help count
packages/protocol/src/
  index.ts           the new commands and view fields; activity; battleSquadOrder; PROTOCOL_VERSION (next)
apps/server/src/
  presence.ts        presence commands instead of releases (P5); activity from the client
  world-host.ts      battleSquadOrder routed by D16; inputs for the embodied participant (unchanged)
  ws.ts              the activity and battleSquadOrder messages
apps/client/src/
  store.ts           the selection as a list (P13); the panel's and Z's open state
  interaction.ts     the keys and the mouse of §8
  activity.ts        new: visible tab + input in activeSeconds → activity messages
  map/selection-box.tsx, map/squad-layer.tsx   new: the drag box; symbols, glow and names
  panels/squad-panel.tsx, panels/formation-menu.tsx   new: C's panel and Z's options (world and battle)
  panels/inspector.tsx   several selected, the squad and its leader, "Liberar"
  map/labels.ts      the embodied creep's name at every zoom
  battle/input.ts, battle-screen.tsx, battle/arena-view.tsx   the battle's selection, Shift+N, Z, C, the marks
  lobby.tsx          the symbol
apps/client/src/lab/
  setup-form.tsx     squads in the setup, the help count; the squad AI in the editor
apps/cli/src/
  junction-matrix.ts, report.ts, pace harness   squad scenarios (H-1), squads' counters (H-2)
docs/PLAYTEST.md     the G1 lab group and the G2 world script
```

## 3. Params

All guesses (spec §6); each with its schema entry and `checkConsistency` where related.

| File | Path | Value | Check |
|---|---|---|---|
| `default.json` | `squads.maxSize` | 4 | ≤ `battle.sideCap` |
| | `squads.symbols` | 8 | the client has as many drawings |
| | `squads.activeSeconds` | 15 | read by the client (activity), not by the `sim` |
| | `squads.formation.front` / `flank` / `back` | 1 / 1 / 2 | ≥ 1 |
| | `battle.sideCap` | 8 (from 5) | = the battle's `limits.maxPerSide`; ≤ a zone's cells (3 × 5) |
| | `battle.helpComing.enabled` / `radius` | 0 / 12 | radius in world cells |
| `battle.json` | `limits.maxPerSide` | 8 (from 5) | |
| | `squad.formMaxCells` | 2 | how far a "form" participant leaves its slot |
| | `squad.fallBackPermille` | 500 | the squad AI's threshold |

The bot's squad counts (hard 2, normal 1, easy 0) are strategist settings in `BALANCED`, like R's group sizes, not
world params (R plan §5).

## 4. State (`sim`)

- **`Squad`** `{ id, player, symbol, members: number[], command: "follow" | "hold" }`, in `WorldState.squads` ordered
  by id, ids from `nextId`. `members` is the list's order; **`members[0]` is the anchor** (P1). A human's squad is
  created by `join` (with the first free symbol of the team) and never removed; a bot's by `formSquad`, removed when
  empty.
- **`Creep.squad: number | null`**: kept in step with `members` by the functions of `squads.ts` only (an invariant test
  on every mutation). A human's anchor is the creep with `dominatedBy === player`; a bot's anchor has none.
- **`Creep.oneShot: boolean`** (P2): the current order came from a player and the autopilot leaves it until done.
- **`Creep.heading: Dir`**: the direction of the creep's last step, for the formation (P6); initial value the
  direction from the team's core toward the map's center, so both sides of the mirrored map start equivalent.
- **`Player.presence: "active" | "idle" | "away"`** (P5), initial `"away"` until the server says otherwise.
- **The cap** is computed, not stored (P4).
- `serialize` refuses nothing new (arrays and records only); the fixed hashes are rebuilt (`implement-phase`).

### The rules of `squads.ts`

- **add** (from `addToSquad`, `dominate` of a free creep, "Entrar"): refused for another squad's creep
  (`inOtherSquad`), at the cap (`squadCap`), in a battle (`inBattle`, as orders today) or in an encounter (`engaged`);
  appends to `members`; the domination params apply; if the squad was empty, the creep becomes the anchor, and for a
  human it is dominated.
- **dominate** of a squad creep: swaps it with `members[0]` and moves `dominatedBy`.
- **leave** (one creep, or `all`): removes it; its order becomes one-shot unless it is the formation's follow or hold,
  which become `stop` (D9); if it was the anchor, `members[0]` is the next (D3) and, for a human, it is dominated. The
  same on a death (in the step that removes the dead creep).
- **reorder** `{creepId, index}`: moves a creep within `members[1..]`; the anchor stays first.
- **The cap** (P4, D26): `total` = the team's living creeps; `n` = the team's players whose presence is not `away`
  (at least 1); `base = ⌊total ÷ n⌋`, `r = total mod n`; the `r` players with `presence === "active"` and the fewest
  members (ties by player id) get `base + 1`; every cap is at most `squads.maxSize`. Checked only by **add**.
- **A bot** may hold several squads; `formSquad {creepIds}` creates one with those creeps (the first the anchor),
  under the same cap (a bot alone in its team has `total`).

## 5. The squad in the world

- **The autopilot** (P2) skips: a squad creep, unless it is the anchor and its leader is a bot or `away`; a creep with
  `oneShot`. It runs again on a creep whose one-shot order is done (`oneShot` cleared in `resolveOrders`).
- **"Done"** per order (P2): `moveTo`/`explore` arrived or impossible; `gather` full or the deposit gone; `deliver`
  empty; `buildRoad` the segment finished or impossible; `approach` the encounter opened or the target lost; `pickup`
  picked or gone; `drop` done; `follow` the target dead; `stop` at once.
- **The order command by status** (D9): own squad's creep → detaches (its formation is replaced by the order; when
  done it goes back to `follow`); free → one-shot; another's squad → `inOtherSquad`. With no creep named (the client
  always names one), nothing.
- **Formation** (`formation.ts`, P6): each tick, for a squad in `follow`, the slots around the anchor: squares at
  `front`, triangles at `flank` on each side, circles at `back`, a second of a DNA one cell further along its rank;
  turned to the anchor's `heading`; a slot on rock, river or off the map takes the nearest walkable cell (ties in the
  team's frame). Members are assigned to slots in `members` order. Each follower walks toward its slot by the cached
  path keyed on the slot cell (as the approach); within the slot it halts. `hold` keeps the cell where the command
  found the follower.
- **squadOrder** `{ squadId, creepIds?, order: "follow" | "hold" | "attack", targetId? }`: with `creepIds`, only those
  (the selection), else the whole squad. `attack` gives each named creep (the anchor too) an `approach attack` with a
  **`via` cell** (P7): the square none (the nearest), a triangle the flank cell next to the target perpendicular to
  the line from the anchor (the nearer flank; the other when a triangle already took it), the circle the cell beyond
  the squad's highest-HP ally on the line from the target. The approach walks to `via` first, then to the target; the
  encounter opens on adjacency as today.
- **Joining** (W-5): a follower in `follow` gets, when its anchor or another squad creep within the bubble has a
  battle, the same step as R's follower (the nearest enemy participant as an attack approach), so the junction's
  `battleToJoin` takes it in. R's load rule applies.
- **The encounter window** (D14): `deadlineTick` set when the victim has a squad whose leader is a human not `away`;
  the reply comes from the leader's `react` (its refusal now checks the squad's leader, not `dominatedBy`).
- **The strategist** (D19): its R groups become `formSquad` (raid: the raider first; escort: the collector first),
  as many as the difficulty allows; the raider keeps its rules as the anchor; members whose anchor died follow the
  next one (the squad's own succession), and the squad dissolves (`leaveSquad all`) when the strategist's next
  decision no longer wants it. Hard sends `squadOrder attack` on its raid target, so the D11 sides apply.

## 6. The battle (`battle`, `junction`)

- **Birth** (P10): `BattleSetup.sides[i]` gains an optional `entry` (the stretch it spawns on) and each
  `ParticipantSetup` an optional `cell` hint; the `join` command an optional `cell`. `placeParticipant` takes the free
  floor cell nearest the hint that is off the ring (ties by index), and with no hint or none free, its stretch's draw
  as today. No new `rng` call when a hint is given.
- **The junction**: at the opening, the side's entry is the stretch whose direction from the arena's center is
  nearest the side's creeps' summed offset from the battle's cell (integers; ties in the order 0, 1, 2, 3); a side
  with several creeps gets cell hints in its zone by the formation (§5's slots, facing the enemy's zone). A joiner's
  hint is the center of its world cell's block (`arena.ts` gains the inverse of `worldCellOf`).
- **The squad command** (P8): `squadOrder { ids, order: "form" | "hold" | "free" | "fallBack", anchor }` sets
  `Participant.order` (default `free`). The mind, per order: `free` its gambits; `hold` its gambits with the moving
  actions (approach, keep distance, protect, flee, the dodge's step, the charge) skipped; `form` a slot action first
  (walk to the D8 slot around `anchor`, turned to the anchor's facing) and its gambits limited to cells within
  `squad.formMaxCells` of the slot; `fallBack` the carrier preset. A participant whose controller is `human` ignores
  it. A form whose anchor left falls back to `free`.
- **The squad AI** (P9): for participants with `squadAi` (the junction sets it for a bot team's creeps), a side-level
  list on the gambits' reaction cadence of the side's lowest-id such participant: `fallBack` when the side's HP sum is
  below `fallBackPermille` of the enemies', `hold` when `helpComing` (if on), `free` otherwise; easy sends nothing. A
  human team's squad with its leader absent keeps its last command (D16): the AI is only the bot's.
- **Who commands** (D16): `wantedController` stays "the embodied creep of a player with its screen open"; Shift+N in
  battle is a world `dominate` of a squad creep (it applies at the next world tick, as R's "Entrar"). The server routes
  `battleSquadOrder` only for participants whose creeps are in the sender's squad.
- **The help count** (P12, D23): with `battle.helpComing.enabled`, the host sends `help { side, count }` when a side's
  count changes: its team's creeps not in the battle with an attack approach on a participant or a follow on one,
  within `radius`. The gambits gain the condition `helpComing`; the carrier preset gains "hold the load while help is
  coming". The lab sets the count in its setup.
- **The side cap** 8 in both params (D7).

## 7. Network and server

- **Protocol** (next `PROTOCOL_VERSION`): the commands of §4–§5 in the client's command set (`addToSquad`,
  `leaveSquad`, `reorderSquad`, `squadOrder`, `setSymbol`; `formSquad` and `presence` are server-side only); the view's
  squads (own team), `Creep.squad`, `oneShot`, the foreign creep's `symbol` and `embodiedBy` (by value); client
  `activity { active: boolean }`; client `battleSquadOrder { battleId, ids, order }`.
- **Presence** (P5): `PresenceTracker` stops emitting `release`. It emits `presence away` after `reconnectGraceMs`
  disconnected, `presence idle` or `active` from the client's `activity` (only on change, and `active` only while
  connected), `presence active` on a reconnect with activity. The domination timeout is removed from the config.
- **The lobby** sends the symbol with the join; the server emits `setSymbol` after `join` (refused symbols fall back to
  the first free one).
- `geo net` with squads: the view delta and the battle frame within the M1.5 targets and the watcher budget.

## 8. Client

- **Selection** (P13): `store.selection` becomes a list of actors. A click replaces it; a drag box replaces it with
  the team's creeps inside; Shift+click toggles one; **N** selects the squad's creep N; **Tab** / Shift+Tab move it
  along the squad; **0** clears it (Esc as today). **Ctrl** (or ⌘ on macOS) + click toggles squad membership
  (`addToSquad` / `leaveSquad`), Ctrl + drag adds every free creep in the box; the symbol shows at once from the
  optimistic state and settles with the delta. **Shift+N** dominates creep N. `handleKey` stops ignoring Shift on
  digits and reads `event.code` (`Digit1`…) so layouts agree.
- **The right click** orders every selected creep of the team by its status (§5), else the embodied creep.
- **Z** opens the formation menu (world: 1 follow, 2 hold, 3 attack then a click on an enemy; battle: 1–4); 0 or Esc
  closes it. It sends `squadOrder` for the selected squad creeps or the whole squad.
- **C** opens the panel (D20), reorderable by drag and drop and Shift+↑/↓ (`reorderSquad`); it shows the cap ("3 /
  4", computed by the client from the view with the `sim`'s exported function).
- **Marks**: the symbol over every squad creep (own and foreign in sight); the embodied creep's glow and its player's
  name at every zoom (labels exempt from the zoom culling); the same in the arena.
- **The battle screen**: N, Tab and a click select participants of the squad; Shift+N dominates; Z sends
  `battleSquadOrder`; C shows the squad (outside the battle greyed); the participant's command as a small mark. The
  lab's Tab/0 change with it (the lab has no squads: Shift+N there takes the participant N of the side).
- **"Entrar"** (D21): the squad's first participant, else a free one (an `addToSquad` + `dominate`), else watch.
- **Activity** (`activity.ts`): the tab is visible and an input (key, click, mouse move) happened in
  `activeSeconds`; a change sends `activity`.

## 9. Lab

- The setup groups participants in squads with a leader (the human's side) or as bot squads (`squadAi`); the help
  count per side; Shift+N, Z and C as in the world's battle screen; the squad AI's list in the editor, read-only.
- A PLAYTEST lab group for G1 (spec §8.3).

## 10. Harness and tests

- **Unit tests** per §5 rule of the spec, on text maps and arenas: `squads.test.ts` (add, cap with its remainder and
  presence, no release on a death, the succession, reorder, leave keeping the order), `formation.test.ts` (slots by
  heading, around rock, mirrored for both teams), `oneshot.test.ts` (each order's done), the window, the strategist's
  squads; battle tests for each order, the hint placement and the squad AI; junction tests for the entries by
  direction and the joiner's cell; server tests for presence and routing; client tests for the keys and the panel.
- **A no-squad fixture** (B-7): with no `squadOrder`, no hints and `helpComing` off, today's battle results for the
  `battle verify` seeds and a slice of the sweep, recorded in F3 before the battle changes (as K's P6).
- **`geo junction matrix --squads`** (H-1): a 3-creep squad against a 3-creep side, in formation with hints against
  plain follow and zone birth: wins, duration, time until the whole squad is in.
- **R's pace harness** (H-2): per difficulty, squads formed, raids reaching the fight together, the squad AI's
  commands per battle.
- **`geo verify`**, **`geo battle verify`**, **`npm run soak`** with a disconnect and reconnect of a player with a squad
  (H-3).

## 11. Running next to the other slices

- **R** (in progress): G's F1 starts after R's F2 and F3 are in `main` (follow, the strategist's groups, difficulty);
  G's F6 after R's F6 (the actors' list, "Entrar", the battle alert). R's F8 (the final balance pass) does not wait for
  G; G's numbers are measured on R's world.
- **K** (in progress): G's F3 starts after K's merge (the kits' gambits, the carrier preset, the battle screen's
  input). G's battle changes add to K's `BATTLE_VERSION`.
- **E-min**: touches the strategist and the reports; the second to merge rebases. A team out keeps its squads'
  creeps with their rules (E-min's rule); a player of a team out sends no squad commands (refused `teamOut`).
- **Versions**: each of G's bumps takes the next free number at its merge (R's plan §9 rule).

## 12. Risks

- **The client's selection rewrite** touches every map interaction; F6 keeps the single selection's behavior as the
  first test (a click, a right click) before adding the rest.
- **Formation cost**: slots and paths per follower per tick; bounded by the squads' sizes; R's tick-cost target (1.5×)
  catches it.
- **Presence in the log** adds commands on every activity change; at 15 s, a player making many short pauses logs a
  few commands a minute (measured in the soak).
- **8 × 8 battles**: the auto-resolve cost (spec §7) may push `sideCap` back to 5; the lab measures it in F3.

## 13. Decisions (to approve)

| # | Proposal | Alternative |
|---|---|---|
| P1 | **Squads as world state** (`WorldState.squads` with an ordered `members`, `Creep.squad`), `dominatedBy` kept for the embodied creep, always `members[0]` | Squads only on the player (one per player: bots could not hold several) |
| P2 | **`Creep.oneShot`** and a "done" test per order: the autopilot leaves a one-shot order until it is done | The autopilot never overwrites an order a player gave (a gatherer moved by hand would stand idle forever) |
| P3 | **New commands** `addToSquad`, `leaveSquad {creepId \| all}`, `reorderSquad`, `squadOrder`, `setSymbol`; server-side `formSquad` (bots) and `presence`; `release` goes (it becomes `leaveSquad` of the embodied creep) | Overloading `dominate` and `order` with flags (fewer types, murkier validation) |
| P4 | **The cap computed at validation** from the players' presence and the team's creeps, never stored | A stored cap updated on each change (one more state field to keep consistent) |
| P5 | **Presence as system commands** emitted by the server (away after the 15 s grace, active and idle from the client's activity); the domination timeout goes | Presence only in the server (the `sim` could not compute the cap, and a replay would differ) |
| P6 | **`Creep.heading`** from the last step and slots computed each tick, not stored | Stored slots per creep (state to keep in step with every move) |
| P7 | **An approach with a `via` cell** for the DNA's side | A new order type "flank" (another order for the same chase) |
| P8 | **`Participant.order`** set by a `squadOrder` battle command; the mind filters the gambits by it; `free` keeps today's gambits | Sending each command as a `setGambits` list (the command would not be visible, and "free" would need the old list back) |
| P9 | **The squad AI only for the bot's creeps** (`squadAi` from the junction); a human squad with its leader absent keeps its last command | The squad AI for any side with no active human (it would override D16's "last command") |
| P10 | **Cell hints** in the setup and the join, placed at the nearest free floor cell off the ring; the opening's entries by the world direction | Placement computed by the junction and forced into the battle's state (two owners of the arena's cells) |
| P11 | **The side cap 8** in both params at once, measured in F3 | 8 only in the world (the lab would differ from the world) |
| P12 | **`help { side, count }`** as a host command in the battle log, behind `battle.helpComing.enabled` (0) | The count only in the setup (no change while the battle runs) |
| P13 | **The selection as a list** in the store, with Ctrl ≡ ⌘ for the squad gestures and digits read by `event.code` | A separate "squad selection" next to the single selection (two selections to keep apart) |
| P14 | **Eight symbols as SVG paths in the client**; the `sim` keeps an index below `squads.symbols` | Symbols as data in the params (drawings in the params) |
| P15 | **`geo junction matrix --squads`** for H-1, and H-2's counters in R's pace harness report | A separate CLI command for squads |

## 14. Implementation order

| Phase | What | Checkpoint |
|---|---|---|
| **F0** — Spec and plan | The spec (approved 2026-11-25); this plan and P1–P15 | The owner approves the plan |
| **F1** — Squads in the world | §3's `squads` params; `Squad`, `Creep.squad`, `oneShot`, `Player.presence`; `squads.ts` (add, dominate, leave, reorder, the cap, the succession); the commands of P3 with their refusals; the order by status and one-shot orders with "done"; the autopilot's skips; the encounter window; the view's fields; `SIM_VERSION`; the fixed hashes | — |
| **F2** — Formation and the bot's squads | `heading`, `formation.ts`, follow and hold, `squadOrder attack` with `via`, joining by squad; the strategist's squads and H-2's counters; the tick cost | — |
| **F3** — The battle | The no-squad fixture first; hints and entries (P10); `squadOrder` and the four orders; the squad AI; `help` and `helpComing`; the side cap 8; `BATTLE_VERSION`; the junction's entries, joiner cells, `squadAi` and help count; `--squads` in the matrix | — |
| **F4** — The lab | Squads in the setup, Shift+N, Z and C on the shared battle screen, the help count, the PLAYTEST group | **G1:** the owner plays a squad in the lab (spec §8.3); the matrix with squads; the side cap's cost |
| **F5** — Network and server | The protocol (P3's commands, view fields, `activity`, `battleSquadOrder`); presence (P5); routing; the lobby's symbol; `PROTOCOL_VERSION`; `geo net` | — |
| **F6** — The world client | The selection (P13), Ctrl, Shift+N, the right click by status, Z, C's panel, symbols, glow and names, the inspector, "Entrar", the battle screen's keys, activity | — |
| **F7** — Soak and playtest | The soak with a squad's disconnect and reconnect; `geo verify`; the G2 script in PLAYTEST | **G2:** two humans on one team against the bot (spec §8.4); the §7 criteria; G closes |
