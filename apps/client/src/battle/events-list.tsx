// The events of the battle as a plain list (spec D19, L-8): no narrated
// chronicle, only who did what and when, newest first.

import type { BattleEvent, ParticipantRef } from "@geometrix/battle";
import { LAB_SIDES, type SideStyle } from "./arena-view.tsx";
import { DNA_GLYPHS } from "./labels.ts";

/** One event as a line of text, or null for the ones the list leaves out. */
export function eventText(
  event: BattleEvent,
  sides: SideStyle = LAB_SIDES,
): string | null {
  const who = (p: ParticipantRef) =>
    `${p.name} (${sides.tag(p.side)} ${DNA_GLYPHS[p.dna]})`;
  switch (event.type) {
    case "attacked":
    case "missed":
      return null;
    case "hit":
      return `${who(event.by)} acerta ${who(event.target)}: −${event.damage} (${event.hp})`;
    case "died":
      return event.by === null
        ? `${who(event.participant)} morre`
        : `${who(event.participant)} morre, por ${who(event.by)}`;
    case "dropped":
      return `${who(event.participant)} larga a bolsa`;
    case "picked":
      return `${who(event.participant)} cata ${event.carry.materia + event.carry.cristal}`;
    case "joined":
      return `${who(event.participant)} entra na arena`;
    case "escaped":
      return event.reason === "edge"
        ? `${who(event.participant)} foge pela borda`
        : `${who(event.participant)} foge por inatividade`;
    case "controlChanged":
      return event.controller === "human"
        ? `você domina ${who(event.participant)}`
        : `${who(event.participant)} volta aos gambits`;
    case "ended":
      return event.winnerSide === null
        ? "fim: ninguém vence"
        : `fim: ${sides.name(event.winnerSide)} vence`;
  }
}

export type EventLine = { key: string; seconds: number; text: string };

/** The lines of some events, newest first, with the time of each. */
export function eventLines(
  events: readonly BattleEvent[],
  ticksPerSecond: number,
  sides: SideStyle = LAB_SIDES,
): EventLine[] {
  const lines: EventLine[] = [];
  for (const event of events) {
    const text = eventText(event, sides);
    if (text === null) continue;
    lines.push({
      key: `${event.tick}.${event.index}`,
      seconds: (event.tick + 1) / ticksPerSecond,
      text,
    });
  }
  return lines.reverse();
}

export function EventsList({ lines }: { lines: EventLine[] }) {
  return (
    <section class="battle-panel">
      <h2>Eventos</h2>
      {lines.length === 0 ? (
        <p class="battle-hint">Nada ainda.</p>
      ) : (
        <ol class="battle-events">
          {lines.map((line) => (
            <li key={line.key}>
              <span class="battle-time">{line.seconds.toFixed(1)} s</span>
              {line.text}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
