// A battle's results as world commands (junction spec X-0..X-4, plan P2): a
// death or an escape by the border becomes a battleExit; the end becomes a
// battleEnd with the survivors and the piles, on the world cells under their
// arena cells. Pure over the battle's events: `geo verify` replays a battle
// log through the same functions and must get the commands the world log
// applied (ADR-0010 rule 4).

import type { BattleEvent, BattleState } from "@geometrix/battle";
import type {
  BattleEndCommand,
  BattleExitCommand,
  BattleSurvivor,
  BattleWindow,
  Command,
  Stock,
  WorldState,
} from "@geometrix/sim";
import { worldCellOf } from "./arena.ts";

/** A world creep in a battle, ever: its battle participant id. */
export type Member = { participant: number; creep: number };

/**
 * A creep the world joined to the battle that the battle has not placed yet
 * (J-3), as the world has it when the battle ends.
 */
export type LateJoiner = {
  creep: number;
  /** Its world side. */
  side: number;
  hp: number;
  cargo: Stock;
  cell: { x: number; y: number };
};

/** What the results of a battle need to know about it. */
export type BattleMapping = {
  battleId: number;
  window: BattleWindow;
  members: readonly Member[];
  /** The world side of each battle side, by battle side id. */
  sideOf: readonly number[];
};

function creepOf(mapping: BattleMapping, participant: number): number {
  const member = mapping.members.find((m) => m.participant === participant);
  if (member === undefined) {
    throw new Error(
      `battle ${mapping.battleId}: participant ${participant} has no creep`,
    );
  }
  return member.creep;
}

const stockOf = (carry: { materia: number; cristal: number }): Stock => ({
  materia: carry.materia,
  cristal: carry.cristal,
});

/**
 * The world commands of one battle tick: `events` are what stepBattle
 * returned and `state` the battle after it (its winners still stand there).
 * `late` is only read when the battle ended.
 */
export function tickResults(
  world: WorldState,
  mapping: BattleMapping,
  state: BattleState,
  events: readonly BattleEvent[],
  late: readonly LateJoiner[],
): Command[] {
  const commands: Command[] = [];
  const cell = (arenaCell: number) =>
    worldCellOf(world, mapping.window, arenaCell);
  const exit = (
    fields: Omit<BattleExitCommand, "type" | "battleId">,
  ): BattleExitCommand => ({
    type: "battleExit",
    battleId: mapping.battleId,
    ...fields,
  });
  // Everyone escaping on an end by inactivity comes back with the end (X-4).
  const idle: BattleSurvivor[] = [];
  for (const event of events) {
    switch (event.type) {
      case "died":
        commands.push(
          exit({
            creepId: creepOf(mapping, event.participant.id),
            outcome: "died",
            hp: 0,
            cargo: { materia: 0, cristal: 0 },
            cell: cell(event.cell),
            by: event.by === null ? null : creepOf(mapping, event.by.id),
          }),
        );
        break;
      case "escaped": {
        const back = {
          creepId: creepOf(mapping, event.participant.id),
          hp: event.hp,
          cargo: stockOf(event.carry),
          cell: cell(event.cell),
        };
        if (event.reason === "idle") idle.push(back);
        else commands.push(exit({ ...back, outcome: "escaped", by: null }));
        break;
      }
      case "ended":
        commands.push(...endOf(mapping, state, event, idle, late, cell));
        break;
      default:
        break;
    }
  }
  return commands;
}

/**
 * The end (X-3, X-4, D8). A late joiner of the winning side, or of any side
 * when nobody won, comes back as a survivor where it waited; one of a losing
 * side leaves by a battleExit first, as an escape.
 */
function endOf(
  mapping: BattleMapping,
  state: BattleState,
  event: Extract<BattleEvent, { type: "ended" }>,
  idle: readonly BattleSurvivor[],
  late: readonly LateJoiner[],
  cell: (arenaCell: number) => { x: number; y: number },
): Command[] {
  const commands: Command[] = [];
  const winner =
    event.winnerSide === null ? null : mapping.sideOf[event.winnerSide]!;
  const survivors: BattleSurvivor[] = [
    ...state.participants.map((p) => ({
      creepId: creepOf(mapping, p.id),
      hp: p.hp,
      cargo: stockOf(p.carry),
      cell: cell(p.cell),
    })),
    ...idle,
  ];
  for (const joiner of late) {
    const back = {
      creepId: joiner.creep,
      hp: joiner.hp,
      cargo: joiner.cargo,
      cell: joiner.cell,
    };
    if (winner === null || joiner.side === winner) {
      survivors.push(back);
    } else {
      commands.push({
        type: "battleExit",
        battleId: mapping.battleId,
        ...back,
        outcome: "escaped",
        by: null,
      });
    }
  }
  survivors.sort((a, b) => a.creepId - b.creepId);
  const end: BattleEndCommand = {
    type: "battleEnd",
    battleId: mapping.battleId,
    winnerSide: winner,
    reason: winner !== null ? "won" : survivors.length > 0 ? "idle" : "empty",
    survivors,
    piles: event.piles.map((pile) => ({
      cell: cell(pile.cell),
      cargo: { materia: pile.materia, cristal: pile.cristal },
    })),
  };
  commands.push(end);
  return commands;
}
