// What a world creep takes into a battle (junction spec O-3, D2, D9, D10):
// its whole HP points (at least 1), its max HP and capacity from the world's
// params, its load, its DNA's preset (or the carrier's, entering as a flee)
// and its team's bot difficulty as the reaction, normal without a bot (R plan
// P8). And the battle's seed, derived from the world seed
// and the stub id by an integer mix, so opening a battle never draws from the
// world's rng (plan section 4).

import {
  defaultGambits,
  presetGambits,
  type BattleSetup,
  type ParticipantSetup,
  type Reaction,
} from "@geometrix/battle";
import {
  findFighter,
  fighterCapacity,
  fighterMaxHp,
  isWanderer,
  type Battle,
  type Fighter,
  type Stance,
  type WorldState,
} from "@geometrix/sim";
import { arenaOf } from "./arena.ts";

/** HP in whole points for the battle: the thousandths drop, at least 1 (D9). */
export function battleHp(fighter: Pick<Fighter, "hp">): number {
  return Math.max(1, Math.floor(fighter.hp / 1000));
}

/**
 * A wanderer enters as a circle with its own max HP and damage (D14), the
 * circle's preset (the marksman) and capacity.
 */
export function participantSetup(
  state: WorldState,
  fighter: Fighter,
  stance: Stance,
): ParticipantSetup {
  return {
    name: fighter.name,
    dna: fighter.dna,
    hp: battleHp(fighter),
    maxHp: fighterMaxHp(state, fighter),
    carry: { materia: fighter.cargo.materia, cristal: fighter.cargo.cristal },
    capacity: fighterCapacity(state, fighter),
    ...(isWanderer(fighter) ? { damage: state.params.wanderers.damage } : {}),
    gambits:
      stance === "flee"
        ? presetGambits("carrier")
        : defaultGambits(fighter.dna),
    reaction: isWanderer(fighter)
      ? "normal"
      : teamReaction(state, fighter.team),
  };
}

/**
 * The battle reaction of a team's creeps: the difficulty of its first bot
 * player by id, or normal when the team has none (R plan P8).
 */
export function teamReaction(state: WorldState, team: number): Reaction {
  const bot = state.players.find((p) => p.team === team && p.bot);
  return bot?.difficulty ?? "normal";
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
        const creep = findFighter(state, p.id)!;
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
