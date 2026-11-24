// What a world creep takes into a battle (junction spec O-3, D2, D9, D10):
// its whole HP points (at least 1), its max HP and capacity from the world's
// params, its load, its DNA's preset (or the carrier's, entering as a flee)
// and the normal reaction. And the battle's seed, derived from the world seed
// and the stub id by an integer mix, so opening a battle never draws from the
// world's rng (plan section 4).

import {
  defaultGambits,
  presetGambits,
  type BattleSetup,
  type ParticipantSetup,
} from "@geometrix/battle";
import {
  capacity,
  teamOf,
  type Battle,
  type Creep,
  type Stance,
  type WorldState,
} from "@geometrix/sim";
import { arenaOf } from "./arena.ts";

/** HP in whole points for the battle: the thousandths drop, at least 1 (D9). */
export function battleHp(creep: Creep): number {
  return Math.max(1, Math.floor(creep.hp / 1000));
}

export function participantSetup(
  state: WorldState,
  creep: Creep,
  stance: Stance,
): ParticipantSetup {
  return {
    name: creep.name,
    dna: creep.dna,
    hp: battleHp(creep),
    maxHp: state.params.hp.dna[creep.dna].max,
    carry: { materia: creep.cargo.materia, cristal: creep.cargo.cristal },
    capacity: capacity(creep, teamOf(state, creep), state.params),
    gambits:
      stance === "flee" ? presetGambits("carrier") : defaultGambits(creep.dna),
    reaction: "normal",
  };
}

/**
 * The battle's seed in [0, 2^32): murmur3's fmix32 over the world seed and
 * the stub id (a Weyl step apart), integer math only.
 */
export function battleSeed(worldSeed: number, battleId: number): number {
  let z = (worldSeed + Math.imul(battleId + 1, 0x9e3779b9)) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
  return (z ^ (z >>> 16)) >>> 0;
}

/**
 * The setup of a battle the world just opened: its arena, its seed and, per
 * side, its participants in creep id order. Returns the world ids in the
 * order the battle places them (its participant ids 1, 2, …).
 */
export function battleSetup(
  state: WorldState,
  battle: Battle,
): { setup: BattleSetup; placed: number[] } {
  const placed: number[] = [];
  const sides = battle.sides.map((_, side) =>
    battle.participants
      .filter((p) => p.side === side)
      .map((p) => {
        const creep = state.creeps.find((c) => c.id === p.id)!;
        placed.push(creep.id);
        return participantSetup(state, creep, p.stance);
      }),
  );
  return {
    setup: {
      rule: "grid",
      arena: arenaOf(state, battle.window),
      seed: battleSeed(state.seed, battle.id),
      sides,
    },
    placed,
  };
}
