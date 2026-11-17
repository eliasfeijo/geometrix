// The battle view (plan sections 9, 13): what the lab's page renders and what
// the gambits decide on. There is no fog in a battle (spec D3), so it is the
// whole arena; it leaves out what only the simulation needs (the rng, the
// intents, the movement points, the AI's memory). It is a copy: the AI
// decides every participant on the view of the start of stage 2, so one
// decision never sees another's turn, and the worker can post it as is.

import type { Dir } from "./arena.ts";
import type { Dna } from "./params.ts";
import type { BattleState, Carry, Controller, Pile } from "./state.ts";

export type ViewParticipant = {
  id: number;
  side: number;
  name: string;
  dna: Dna;
  cell: number;
  facing: Dir;
  hp: number;
  carry: Carry;
  controller: Controller;
  cooldownTicks: number;
  /** Ticks on an exit cell without being hit (the escape count, spec L-8). */
  exitTicks: number;
  /** Ticks since the last damage dealt or taken (the idle clock, spec L-8). */
  idleTicks: number;
};

export type ViewProjectile = {
  id: number;
  owner: number;
  side: number;
  cell: number;
  dir: Dir;
  cellsLeft: number;
};

export type BattleView = {
  tick: number;
  participants: ViewParticipant[];
  projectiles: ViewProjectile[];
  piles: Pile[];
  ended: { tick: number; winnerSide: number | null } | null;
};

export function battleView(state: BattleState): BattleView {
  return {
    tick: state.tick,
    participants: state.participants.map((p) => ({
      id: p.id,
      side: p.side,
      name: p.name,
      dna: p.dna,
      cell: p.cell,
      facing: p.facing,
      hp: p.hp,
      carry: { materia: p.carry.materia, cristal: p.carry.cristal },
      controller: p.controller,
      cooldownTicks: p.cooldownTicks,
      exitTicks: p.exitTicks,
      idleTicks: p.idleTicks,
    })),
    projectiles: state.projectiles.map((p) => ({
      id: p.id,
      owner: p.owner,
      side: p.side,
      cell: p.cell,
      dir: p.dir,
      cellsLeft: p.cellsLeft,
    })),
    piles: state.piles.map((p) => ({ ...p })),
    ended: state.ended === null ? null : { ...state.ended },
  };
}
