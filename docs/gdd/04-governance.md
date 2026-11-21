# 04 — Governance and voting

**Parked:** no milestone. The first multiplayer playtest has up to 3 humans per team with no voting; this file keeps
the original direction for when team decisions matter.

## Decided
- A team's collective decisions go through a **vote**, with rules that depend on the **authority level** required:
  bots may decide / humans only / unanimity.
- The tax rate and the use of the public treasury are collective decisions.
- Teams larger than 3v3 may have formal **representatives**.

## Proposal
- A **decision × authority level** matrix defines the rules for each kind of decision.
- The **vote is asynchronous**, with a deadline, because the world is persistent and players are online at different
  hours.
- An absent player may **delegate the vote** to an autopilot policy ("vote like X", "always for fortifying").

## Open questions
- Which decisions exist in v1? (tax, treasury spending, war/peace with tribes, …)
- In "bots may decide", who is the bot: an absent player's autopilot, or the creeps themselves?
- Quorum, deadline and tie-break.
- How a representative is elected and removed.
