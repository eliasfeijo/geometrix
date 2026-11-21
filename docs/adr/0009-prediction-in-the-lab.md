# ADR-0009: Predicting your own creep as a lab experiment option

**Status:** Proposed · **Date:** 2026-11-20
**Related:** ADR-0008 (item 9: the lab page renders only what it receives, with no prediction; this ADR amends it),
ADR-0002 (everything is a command: authority stays in the simulation), [lab plan](../specs/m2-battle-lab/plan.md)
§15 (C10, C11), [lab spec](../specs/m2-battle-lab/spec.md) (L-3)

## Context

At the F5 checkpoint (2026-11-19 and 20), played blind, the grid rule scored 4 or more up to 100 ms of RTT. What
bothered the owner most was not latency itself but **"the pause between each move"**: the page slides the creep
during one tick (50 ms, plan P8), and the ▲ takes 250 ms per cell, so, holding the key, it slides for 50 ms and
stands still for ~200 ms in each cell. Without interpolation the pause remains, but the creep jumps in the same tick
as the action. The owner asked to compare the options before deciding (C11), and client-side prediction came back
to the table for after the junction (C10).

ADR-0008 (item 9) says the lab page **renders only what it receives, with no prediction**. One of the options to
compare, "predict my creep", draws the dominated creep ahead, before the worker's frame arrives. That contradicts
item 9 literally, although the simulation does not change.

## Alternatives

- **A. A draw-only experiment option in the lab** (recommended).
  - What it is: in the "Movement" selector of the "Simulated network", next to "no interpolation", "interpolate
    (1 tick)" and "slide the whole step", the option "predict my creep": while a direction is held and the cells
    ahead are free in the last frame, the page slides the dominated creep at its DNA's speed without waiting for the
    frame, up to one step behind the battle (which enters each cell at the start of the step), never ahead of it;
    each frame pulls it back if it ran too far or left the path. Released, it stays where it is drawn until the frames
    arrive (a round trip) and slides to them. Authority stays in the worker: the commands, the log, the hash and the
    result do not change, and the other creeps are still drawn only from the frames.
  - Pros: the owner compares the four options on the same page, blind if wanted, with the measured delay; no new
    network or simulation code; nothing is decided for the game.
  - Cons: the page draws something that did not come from the channel (only for this option); the correction can
    "pull" the creep back when the prediction is wrong (blocked by another creep, a contested cell).
- **B. Keep item 9 and compare only the options without prediction.**
  - Pros: nothing changes in ADR-0008.
  - Cons: the owner could not feel the prediction before deciding, and C11 asks for the comparison.
- **C. Real prediction, with reconciliation through the command log (running the simulation on the client).**
  - Pros: what a high-latency deploy may need.
  - Cons: it is the network decision of the junction and the deploy (C10), too big for an experiment; left for later.

## Decision

Proposed: alternative A. ADR-0008 item 9 gains an exception: **in the lab, an experiment option may draw the
dominated creep ahead; simulation and authority stay only in the worker**. Prediction in the game (the junction's
world and battle) is not decided here: it comes back to the table after the junction, with what the owner thinks of
this comparison.

## Consequences

- Lab F7 implements the four options (`apps/client/src/lab/motion.ts`), each battle's record stores the option used,
  and the PLAYTEST gains a group to compare them at 0 and 150 ms.
- If the owner accepts, ADR-0008 (item 9) gains a note pointing to this ADR. If rejected, the "predict my creep"
  option leaves the lab.
- How movement is drawn in the game (which option, or none) is a gameplay decision for the owner, after playing; it
  does not depend on this ADR.
