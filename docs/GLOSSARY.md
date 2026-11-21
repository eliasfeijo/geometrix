# Glossary

| Term | Meaning |
|---|---|
| **World** (world state) | The persistent, long-running simulation (`packages/sim`): map, bases, resources, creeps. One tick per world second. |
| **Battle** (battle state) | A dedicated, temporary real-time combat instance (`packages/battle`), 20 ticks per second. It does not sync with the world in real time; it returns only the events that matter. |
| **Creep** | Any unit of a team. It has its own identity (name), HP, load and autopilot configuration. |
| **DNA** | The creep's innate shape/archetype (square, circle, triangle), as opposed to individual evolution. |
| **Core** | The heart of a team's base. It produces creeps and receives deliveries; destroying it wins the match (slice E). |
| **Matéria / cristal** | The two resources. Matéria: heavy, abundant, renewable. Cristal: light, rare, depletable. |
| **Dominate / release** | Take direct control of a free allied creep / end that control. At most 1 active domination per player. |
| **Autopilot** | The configured behavior (ordered condition → action rules) a creep follows when nobody dominates it. |
| **Preset** | A ready-made autopilot rule list (gatherer, scout, road builder, raider; in battle: frontline, marksman, skirmisher, carrier). |
| **Command** | The only way to act in a simulation. Humans, macros, autopilot and bots emit the same commands ([ADR-0002](adr/0002-every-action-is-a-command.md)). |
| **Fog** (fog of war) | What the team does not see now. Only the core and the team's creeps give sight; outside it, the team knows only its memory (black fog at the start). |
| **Team memory** | What the team has seen and keeps knowing out of sight: deposits (with the last value), roads, road jobs, spoils. Enemy creeps do not stay in memory. |
| **Encounter** | An approach between creeps of opposing sides in the world: the aggressor attacks or extorts; the victim pays, refuses (fights) or flees. |
| **Extortion** | The aggressor demands the victim's load, up to its own free capacity. |
| **Spoils** | A pile of resources on the ground anyone can pick up: loot that did not fit, or a purse dropped when fleeing. |
| **Safe-conduct** | After paying extortion, the victim's immunity to new approaches by that team, for a while or until its core zone. |
| **Stance** | The autopilot's encounter rules: whom to approach, and when to pay, fight or flee. |
| **Throwaway roll** | The encounter's fight today: rounds decided by HP × DNA with the `rng`. The junction replaces it with the battle. |
| **Battle lab** | The local page (`npm run lab`) where a battle is set up by hand and played against the AI, with simulated latency. |
| **Gambits** | The battle AI: an ordered condition → action list per creep, evaluated with a reaction time. |
| **Auto-resolve** | A battle run headless by the gambits AI alone, at full speed, with the same simulation. |
| **Junction** | M2 slice D: the encounter opens a battle instance instead of the roll, and the result returns to the world. |
| **Wanderers** | Hostile neutral creeps that roam fast and respawn more often as the match goes on; the first side that is not a team (slice D). |
| **Mule** | A transport creep that carries resources to the base. *(Not built.)* |
| **Public treasury / tax** | The team's collective economy, funded by a voted tax on what reaches the base. *(Parked, GDD 04.)* |
| **Neutral tribe** | A jungle faction that may become an ally or rival of any team. *(Parked, GDD 05.)* |
