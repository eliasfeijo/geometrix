# 08 — Chronicle, chat and console

## Decided
- **M2 design round** (owner, 2026-11-15):
  - **Chronicle:** encounter dialogues ([06](06-battles.md)) and game events appear as text in the match, for players
    and bots.
  - **Free chat** between humans.
  - **A command line in the chat**, BYOND style (where global chat was typed as `OOC:"text"` and a verb invoked a
    command with no interface): the chat field also accepts the commands of the existing vocabulary
    ([ADR-0002](../adr/0002-every-action-is-a-command.md)).
  - **Client macros:** sequences of verbs on a shortcut, with a **rate limit**.
  - **No LLM** generating text at runtime.
- **M2 slice A, the encounter** (owner, 2026-11-15; [encounter spec](../specs/m2-encounter/spec.md) D16, D17):
  - **Text does not live in the `sim`:** the `sim` emits structured events (who, what, how much) and the client
    narrates them from sentence templates, with the variant chosen by the event itself. Everyone reads the same
    sentence, and the text changes without bumping `SIM_VERSION`. Bots read the event, not the text.
  - **Voice by DNA.**
  - The slice A chronicle has encounters (with the aggressor's declaration), escapes, fights, deaths, loot and births.
    A team sees an event one of its creeps takes part in or that happens in its sight.
  - **The agent writes the initial sentence bank and the owner reviews the tone.**
- **M2 slice D, the junction** (owner, 2026-11-24, with the [junction spec](../specs/m2-junction/spec.md) D15): the
  chronicle gains the battle opened (with its sides), joined, escaped (by the border or by inactivity), the battle
  ended (winner, loot and spoils) and the wanderer born; the blow-by-blow stays on the battle screen.
- **M2 slice E-min, the minimal end** (owner, 2026-11-25, with the [E-min spec](../specs/m2-minimal-end/spec.md)): the
  chronicle gains a team leaving the match (eliminated or conceded), the world's end, and the **first blood** (the
  first death of a team's creep in the match) with its own sentence. The end screen shows the match's five main
  events as their chronicle sentences, ordered by importance and headed as the best moments; a battle among them is
  to say its size and load too (owner, 2026-11-27, [01](01-world.md)). **Replay markers:** battles opened and ended, deaths, births, wanderers born, a
  team leaving and the end, each kind with a toggle, its sentence on hover and a jump on click.

Chat, console and macros were slice C of M2, which left the milestone (2026-11-20): they wait for a milestone.

## Proposal
- **One verb, one command** (agent): each console verb becomes a command of the same versioned vocabulary, with the
  same validations and refusals as a click. No verb has more power than the interface.
- **LLM at authoring time** (agent): generate and review the template bank offline, outside the game.

## Open questions
- Which channels exist: team, global (BYOND's `OOC`), whisper? What does a bot "read" in the chat?
- Verb syntax: `say`, `ooc`, `/command`?
- The rate limit: how many messages and commands per window?
- Where macros are stored: only in the browser, or on the server per player?
- With three or more sides in an encounter, who sees its chronicle?
- In a deploy, does free chat need moderation?
