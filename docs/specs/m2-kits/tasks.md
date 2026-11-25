# M2 tasks — The DNA kits

**Status:** F0 done (2026-11-25); F1 next. Branches `m2/kits-f<n>-<slug>` (skill `commit`).
**Spec:** [spec.md](spec.md) · **Plan:** [plan.md](plan.md)

## F0 — Spec and plan

- [x] Design round with the owner (2026-11-25), recorded in GDD 02 and 06
- [x] The kits' details answered by the owner (D3–D8) and the spec approved (2026-11-25), in GDD 02, 05, 06 and 07
- [x] **Checkpoint:** the owner approves the plan (P1–P10) (2026-11-25)

## F1 — The bar and the strike

- [ ] The kits-off fixture: today's results (winner, ticks, each participant's outcome, HP and totals) for the
      `battle verify` seeds and a slice of the sweep, recorded before any rule changes, with its test (P6)
- [ ] The `kits` params block in the schema, `params/battle.json` and the test params, with `checkConsistency` (§3)
- [ ] `Participant.kit` in the state and the setup, the view's `kit` fields; `BATTLE_VERSION` 7; the fixed hashes
- [ ] Stage 3a (`kits.ts`): the hold, the release, the tap window; with the kit off, Space as today (B-1, B-2)
- [ ] The square's strike: damage and stun by the charge; the stun stops walking, keeps the longer (SQ-1, SQ-2, B-4)
- [ ] The countdown with the hold (B-3); the kits' events so far (D18); the fixture green with every kit off

## F2 — The charge and the dodge

- [ ] The charge: the bonus by the bar on the braked gain, the limit, its return with the attack's cooldown (SQ-3,
      SQ-5)
- [ ] The charge's collision: the strike in the same tick with the bar's charge (SQ-4, P8)
- [ ] The dodge command and its refusals; the dash before the walkers, one cell per tick (DG-1, P5)
- [ ] Untouchable on the dash's ticks, against projectiles and blows (DG-2, P4); the dash onto an exit cell (DG-4)
- [ ] The dodge's priority: resets the bar, ends the charge (DG-3); the load's cooldown (DG-5); the countdown drops it

## F3 — The guard and the fan

- [ ] The guard: up past the tap window, no walking, turning or attacking, down at a full bar or on release (TR-1,
      P7); the basic shot on release (TR-3); its cooldown (TR-4); the dodge drops it
- [ ] Blocking face to face, the fan's too; the flank and the back hit; a blocked shot is not damage (TR-2)
- [ ] Breaking the guard at half a bar (SQ-6, D13)
- [ ] The fan: three lanes, the bar's range, the rock and the grid's edge, its cooldown and the basic one's (CI-1..CI-3)

## F4 — The gambits and the reports

- [ ] The vocabulary: `charge`, `guard`, `fan`; possible only when ready (G-1); `dodge` with the dash (G-2)
- [ ] The hold and the release by decisions (P2), with tests per action on text arenas
- [ ] The presets (D16, G-3); the wanderers' marksman with the fan
- [ ] `geo battle sweep --kits on,off` and `geo junction matrix --kits on,off`, with each kit's uses per battle (H-1,
      H-2, P9)
- [ ] A first sweep and matrix read with the kits, quoted here (the square against the circle, the AI's use of each
      kit, the 3 × 3 cost)

## F5 — The lab

- [ ] `input.ts`: the hold and its release, the double tap sending the dodge, the first tap still walking (U-1, P3)
- [ ] The drawing: the bar, the charge, the guard, the stun, the dash (U-2); the kits' events in the list
- [ ] `kit-panel.tsx`: the dominated creep's bar and cooldowns
- [ ] The kit switches in the setup form, kept in the exported log (U-3, P10); a lab log with kits in `battle verify`
- [ ] The gambits editor's new actions
- [ ] The PLAYTEST lab group for K1 (each DNA dominated against each, the AI with and without kits, the short blind
      session)
- [ ] **Checkpoint K1:** the owner plays each kit in the lab; each kit passes, changes or stays off

## F6 — The world

- [ ] The protocol: the dodge input, the frame's kit fields, `PROTOCOL_VERSION` (the next after R's)
- [ ] The world's battle screen: the input, the drawing and the panel (U-4)
- [ ] `params/battle.json` with the kits that passed K1
- [ ] `geo net` with a watcher (16 KB/s), `geo sim` 3 days of seed 42 (the wanderers against the square), `geo
      verify --seed 42`, `npm run soak`
- [ ] The K2 world battle script in PLAYTEST
- [ ] **Checkpoint K2:** a world battle against a wanderer and the bot; the spec §7 criteria; K closes
