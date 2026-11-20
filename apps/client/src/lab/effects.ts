// The arena's signals of the attack (spec L-8, plan C6): short-lived marks
// drawn over the battle from the events of each frame, in the page's own
// time (they keep fading while paused). Who attacks pulses; whoever is hit
// flashes, with the damage rising over it; a shot that vanishes without a
// hit leaves a spark where it did. Who dies bursts where it fell, and who
// flees leaves an arrow out of the arena, both with its name (C13).

import type { BattleEvent, BattleParams, Dir, Dna } from "@geometrix/battle";

export type Effect =
  | {
      kind: "attack";
      /** The attacker: the pulse follows it while it is in the arena. */
      id: number;
      side: number;
      dir: Dir;
      melee: boolean;
      at: number;
    }
  | {
      kind: "hit";
      /** The target, drawn where it is; `cell` once it left (it died). */
      id: number;
      cell: number;
      damage: number;
      at: number;
    }
  | { kind: "miss"; side: number; cell: number; dir: Dir; at: number }
  | {
      kind: "death";
      id: number;
      side: number;
      dna: Dna;
      name: string;
      /** Where the blow landed, or its last cell. */
      cell: number;
      at: number;
    }
  | {
      kind: "escape";
      id: number;
      side: number;
      dna: Dna;
      name: string;
      reason: "edge" | "idle";
      /** Its last cell. */
      cell: number;
      at: number;
    };

/** How long each signal stays on the screen, in ms. */
export const EFFECT_MS: Record<Effect["kind"], number> = {
  attack: 300,
  hit: 900,
  miss: 600,
  death: 1400,
  escape: 1400,
};

/**
 * The signals of a frame's events, arrived at `at` (performance.now).
 * `lastCells` has where each creep stood in the frame before (the events of
 * a death or a flight carry no cell): a death is drawn where its blow landed,
 * and else there; one with no cell is left out.
 */
export function effectsOf(
  events: readonly BattleEvent[],
  at: number,
  params: BattleParams,
  lastCells: ReadonlyMap<number, number> = new Map(),
): Effect[] {
  const effects: Effect[] = [];
  const blows = new Map<number, number>();
  for (const event of events) {
    if (event.type === "hit") blows.set(event.target.id, event.cell);
  }
  for (const event of events) {
    if (event.type === "died" || event.type === "escaped") {
      const { id, side, dna, name } = event.participant;
      const cell =
        event.type === "died"
          ? (blows.get(id) ?? lastCells.get(id))
          : lastCells.get(id);
      if (cell === undefined) continue;
      effects.push(
        event.type === "died"
          ? { kind: "death", id, side, dna, name, cell, at }
          : {
              kind: "escape",
              id,
              side,
              dna,
              name,
              reason: event.reason,
              cell,
              at,
            },
      );
      continue;
    }
    if (event.type === "attacked") {
      const kit = params.dna[event.participant.dna];
      effects.push({
        kind: "attack",
        id: event.participant.id,
        side: event.participant.side,
        dir: event.dir,
        melee: kit.projectileCellsPerSecond === 0,
        at,
      });
    } else if (event.type === "hit") {
      effects.push({
        kind: "hit",
        id: event.target.id,
        cell: event.cell,
        damage: event.damage,
        at,
      });
    } else if (event.type === "missed") {
      effects.push({
        kind: "miss",
        side: event.by.side,
        cell: event.cell,
        dir: event.dir,
        at,
      });
    }
  }
  return effects;
}

/** How far along an effect is at `now`: 0 when it starts, 1 when it is over. */
export function effectProgress(effect: Effect, now: number): number {
  return Math.min(1, Math.max(0, (now - effect.at) / EFFECT_MS[effect.kind]));
}

/** The effects still on the screen at `now`. */
export function liveEffects(effects: readonly Effect[], now: number): Effect[] {
  return effects.filter((effect) => effectProgress(effect, now) < 1);
}
