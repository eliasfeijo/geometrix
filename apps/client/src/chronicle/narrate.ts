// Events as sentences (M2 encontro spec K-3, D17, plan section 9): each event
// of the sim becomes one sentence of the phrase bank, picked by a number of
// the event itself, (tick × 7919 + index) mod n, so every client and the
// replay read the same one. The sentence comes as segments, so the panel can
// make the creeps' names clickable.

import type { CreepRef, Stock, TeamEvent } from "@geometrix/sim";
import { stockText, teamName } from "../format.ts";
import { TEMPLATES } from "./templates.ts";

/** A piece of a sentence: plain text, or a creep to name (and click). */
export type Segment = string | { creep: CreepRef };

/** The variant of an event in a list of n (plan section 9). */
export function variant(event: Pick<TeamEvent, "tick" | "index">, n: number) {
  return (event.tick * 7919 + event.index) % n;
}

const pick = (event: TeamEvent, list: readonly string[]) =>
  list[variant(event, list.length)]!;

/** The template of an event and what fills its placeholders. */
function template(event: TeamEvent): {
  text: string;
  creeps: Record<string, CreepRef>;
  values: Record<string, string>;
} {
  switch (event.type) {
    case "encounter": {
      const voice = TEMPLATES.encounter[event.intent][event.aggressor.dna];
      const prefix = event.mutual ? pick(event, TEMPLATES.mutual) : "";
      return {
        text: prefix + pick(event, voice),
        creeps: { aggressor: event.aggressor, victim: event.victim },
        values: { demand: stockText(event.demand ?? zero) },
      };
    }
    case "reaction":
      return {
        text: pick(event, TEMPLATES.reaction[event.choice][event.creep.dna]),
        creeps: { creep: event.creep },
        values: {},
      };
    case "paid":
      return {
        text: pick(event, TEMPLATES.paid),
        creeps: { from: event.from, to: event.to },
        values: { amount: stockText(event.amount) },
      };
    case "battleOpened":
      return {
        text: pick(event, TEMPLATES.battleOpened),
        creeps: {
          first: event.sides[0]!.creeps[0]!,
          second: event.sides[1]!.creeps[0]!,
        },
        values: {},
      };
    case "battleJoined":
      return {
        text: pick(event, TEMPLATES.battleJoined),
        creeps: { creep: event.creep },
        values: {},
      };
    case "battleLeft":
      return {
        text: pick(event, TEMPLATES.battleLeft[event.reason]),
        creeps: { creep: event.creep },
        values: {},
      };
    case "battleEnded":
      return {
        text: pick(event, TEMPLATES.battleEnded[event.reason]),
        creeps: {},
        values: { team: teamName(event.winner?.team ?? -1) },
      };
    case "died":
      return {
        text: pick(
          event,
          event.by === null ? TEMPLATES.died.alone : TEMPLATES.died.killed,
        ),
        creeps:
          event.by === null
            ? { creep: event.creep }
            : { creep: event.creep, by: event.by },
        values: {},
      };
    case "pickedUp":
      return {
        text: pick(event, TEMPLATES.pickedUp),
        creeps: { creep: event.creep },
        values: { taken: stockText(event.taken) },
      };
    case "born":
      return {
        text: pick(event, TEMPLATES.born[event.creep.dna]),
        creeps: { creep: event.creep },
        values: {},
      };
  }
}

const zero: Stock = { materia: 0, cristal: 0 };

/** The sentence of an event, as segments; a placeholder left over stays as is. */
export function narrate(event: TeamEvent): Segment[] {
  const { text, creeps, values } = template(event);
  const segments: Segment[] = [];
  let rest = text;
  for (;;) {
    const match = /\{(\w+)\}/.exec(rest);
    if (match === null) break;
    const [placeholder, name] = match as unknown as [string, string];
    const before = rest.slice(0, match.index);
    rest = rest.slice(match.index + placeholder.length);
    const creep = creeps[name];
    const value = values[name];
    if (creep !== undefined) {
      push(segments, before);
      segments.push({ creep });
    } else {
      push(segments, before + (value ?? placeholder));
    }
  }
  push(segments, rest);
  return capitalized(segments);
}

/** Appends text, merging it into the text before. */
function push(segments: Segment[], text: string): void {
  if (text === "") return;
  const last = segments[segments.length - 1];
  if (typeof last === "string") segments[segments.length - 1] = last + text;
  else segments.push(text);
}

/** The sentence with a capital first letter (a mutual prefix, an amount…). */
function capitalized(segments: Segment[]): Segment[] {
  const [first] = segments;
  if (typeof first !== "string") return segments;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...segments.slice(1)];
}

/** The sentence as plain text, names included: for tests and titles. */
export function plainText(segments: readonly Segment[]): string {
  return segments
    .map((s) => (typeof s === "string" ? s : s.creep.name))
    .join("");
}
