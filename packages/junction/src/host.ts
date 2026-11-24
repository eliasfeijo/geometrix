// The junction host (junction plan section 4, P1, P5; ADR-0010): the battle
// instances next to the world. It opens one for each battleOpened, steps the
// world-paced ones by one world second before each world step, feeds them
// the joins and the domination changes, and turns their results into the
// world's system commands. JSON data plus pure functions, like the sim and
// the battle, so a run's snapshot is the world's plus the host's.

import {
  createLog,
  createBattle,
  stepLogged,
  validateCommand,
  BATTLE_VERSION,
  type BattleCommand,
  type BattleEvent,
  type BattleLog,
  type BattleParams,
  type BattleState,
  type Controller,
} from "@geometrix/battle";
import {
  canonicalJson,
  step,
  SYSTEM_PLAYER_ID,
  type BattleWindow,
  type Command,
  type CommandInput,
  type SimEvent,
  type WorldState,
} from "@geometrix/sim";
import { tickResults, type LateJoiner, type Member } from "./results.ts";
import { battleHp, battleSetup, participantSetup } from "./setup.ts";

/**
 * How a battle advances (D4, D13): on the world clock, one world second per
 * world tick, or in real time, stepped by the server every battle tick.
 */
export type Pace = "world" | "real";

/** A creep the world joined that the battle has not placed yet (J-3). */
export type PendingJoin = { creep: number; side: number };

export type Instance = {
  /** The world stub's id. */
  battleId: number;
  window: BattleWindow;
  pace: Pace;
  state: BattleState;
  log: BattleLog;
  /** Every world creep that entered, by participant id. */
  members: Member[];
  /**
   * The world side of each battle side, by battle side id: a world side whose
   * participants all left is a new battle side when someone joins it.
   */
  sideOf: number[];
  /** Joins waiting for room, first come first placed. */
  pending: PendingJoin[];
  /** The world commands it sent so far, in order. */
  sent: Command[];
};

export type JunctionHost = {
  battleParams: BattleParams;
  /** By battle id. */
  instances: Instance[];
  /** Results of real-time battles, for the next world step (P5). */
  results: Command[];
  /**
   * World creeps whose dominating player has the battle screen open (D13):
   * set by the server, never in a snapshot (after a restart, the battles go
   * on with the world clock until a human is back, N-3).
   */
  screens: number[];
};

/** A battle that left the host, with what replays it (geo verify). */
export type FinishedBattle = {
  battleId: number;
  window: BattleWindow;
  log: BattleLog;
  members: Member[];
  sideOf: number[];
  /** The joins still waiting when it ended, as the world had them. */
  late: LateJoiner[];
  /** The world commands it sent, in order. */
  results: Command[];
};

export type JunctionStep = {
  /** The world tick's events. */
  events: SimEvent[];
  /** The battles' results the world step applied, after `commands`. */
  results: CommandInput[];
  /** Battles that ended in this tick. */
  finished: FinishedBattle[];
};

export class JunctionError extends Error {
  constructor(message: string) {
    super(`junction: ${message}`);
    this.name = "JunctionError";
  }
}

export function createHost(battleParams: BattleParams): JunctionHost {
  return { battleParams, instances: [], results: [], screens: [] };
}

/** Battle ticks in one world tick (T-1): 20 per world second. */
export function battleTicksPerWorldTick(
  world: WorldState,
  host: JunctionHost,
): number {
  return host.battleParams.tick.ticksPerSecond * world.params.world.tickSeconds;
}

function creepOf(world: WorldState, id: number) {
  const creep = world.creeps.find((c) => c.id === id);
  if (creep === undefined) throw new JunctionError(`no creep ${id}`);
  return creep;
}

/** The controller a participant should have (D11, D12, D13). */
function wantedController(
  world: WorldState,
  host: JunctionHost,
  creepId: number,
): Controller {
  const creep = world.creeps.find((c) => c.id === creepId);
  return creep !== undefined &&
    creep.dominatedBy !== null &&
    host.screens.includes(creepId)
    ? "human"
    : "gambits";
}

/**
 * Real time while a participant is in a human's hands on the screen; the
 * world clock otherwise (D13).
 */
function paceOf(
  world: WorldState,
  host: JunctionHost,
  instance: Instance,
): Pace {
  return instance.state.participants.some((p) => {
    const member = instance.members.find((m) => m.participant === p.id)!;
    return wantedController(world, host, member.creep) === "human";
  })
    ? "real"
    : "world";
}

/** The host's commands for the next battle tick: control changes, then a join. */
function hostCommands(
  world: WorldState,
  host: JunctionHost,
  instance: Instance,
): BattleCommand[] {
  const commands: BattleCommand[] = [];
  for (const p of instance.state.participants) {
    const member = instance.members.find((m) => m.participant === p.id)!;
    const controller = wantedController(world, host, member.creep);
    if (p.controller !== controller) {
      commands.push({ type: "control", id: p.id, controller });
    }
  }
  const join = joinCommand(world, instance);
  if (join !== null) commands.push(join);
  return commands;
}

/**
 * The first pending join as a battle command, when the battle can place it
 * now (J-3): on the battle side of its world side, or a new one if that side
 * has nobody left in the arena. One join per battle tick, so the joined
 * event names whom it placed.
 */
function joinCommand(
  world: WorldState,
  instance: Instance,
): BattleCommand | null {
  const head = instance.pending[0];
  if (head === undefined) return null;
  const stub = world.battles.find((b) => b.id === instance.battleId)!;
  const stance = stub.participants.find((p) => p.id === head.creep)!.stance;
  const current = instance.sideOf.lastIndexOf(head.side);
  const alive =
    current >= 0 && instance.state.participants.some((p) => p.side === current);
  const command: BattleCommand = {
    type: "join",
    side: alive ? current : instance.state.sides.length,
    participant: participantSetup(world, creepOf(world, head.creep), stance),
  };
  return validateCommand(instance.state, command) === null ? command : null;
}

/** The pending joins as the world has them, for an end (LateJoiner). */
function lateJoiners(world: WorldState, instance: Instance): LateJoiner[] {
  return instance.pending.map(({ creep, side }) => {
    const c = creepOf(world, creep);
    return {
      creep,
      side,
      hp: battleHp(c),
      cargo: { materia: c.cargo.materia, cristal: c.cargo.cristal },
      cell: { x: c.x, y: c.y },
    };
  });
}

/**
 * One battle tick of `instance` with the host's commands and `extra` (a
 * human's, in real time). Its results go to `out`; when it ends, it leaves
 * the host and its record goes to `finished`.
 */
function stepInstance(
  world: WorldState,
  host: JunctionHost,
  instance: Instance,
  extra: readonly unknown[],
  out: Command[],
  finished: FinishedBattle[],
): BattleEvent[] {
  const commands = [...hostCommands(world, host, instance), ...extra];
  const join = commands.find(
    (c): c is Extract<BattleCommand, { type: "join" }> =>
      (c as BattleCommand).type === "join",
  );
  const events = stepLogged(instance.state, instance.log, commands);
  for (const event of events) {
    if (event.type !== "joined" || join === undefined) continue;
    const head = instance.pending.shift()!;
    instance.members.push({
      participant: event.participant.id,
      creep: head.creep,
    });
    instance.sideOf[event.participant.side] = head.side;
  }
  const ended = instance.state.ended !== null;
  const late = ended ? lateJoiners(world, instance) : [];
  const results = tickResults(world, instance, instance.state, events, late);
  out.push(...results);
  instance.sent.push(...results);
  if (ended) {
    host.instances = host.instances.filter((i) => i !== instance);
    finished.push({
      battleId: instance.battleId,
      window: instance.window,
      log: instance.log,
      members: instance.members,
      sideOf: instance.sideOf,
      late,
      results: instance.sent,
    });
  }
  return events;
}

/** Opens an instance for a stub the world just opened. */
function openInstance(world: WorldState, host: JunctionHost, battleId: number) {
  const stub = world.battles.find((b) => b.id === battleId);
  if (stub === undefined) throw new JunctionError(`no battle ${battleId}`);
  const { setup, placed } = battleSetup(world, stub);
  const state = createBattle(setup, host.battleParams);
  const instance: Instance = {
    battleId,
    window: { ...stub.window },
    pace: "world",
    state,
    log: createLog(setup, host.battleParams),
    members: placed.map((creep, i) => ({ participant: i + 1, creep })),
    sideOf: stub.sides.map((_, side) => side),
    pending: [],
    sent: [],
  };
  host.instances.push(instance);
  host.instances.sort((a, b) => a.battleId - b.battleId);
}

/** Checks that the world applied every result sent (a bug otherwise). */
function checkApplied(world: WorldState, results: readonly Command[]): void {
  for (const command of results) {
    if (command.type === "battleEnd") {
      if (world.battles.some((b) => b.id === command.battleId)) {
        throw new JunctionError(`battle ${command.battleId}: end refused`);
      }
    } else if (command.type === "battleExit") {
      const creep = world.creeps.find((c) => c.id === command.creepId);
      if (creep !== undefined && creep.battle === command.battleId) {
        throw new JunctionError(
          `battle ${command.battleId}: exit of ${command.creepId} refused`,
        );
      }
    }
  }
}

/**
 * One world tick through the host (T-1, X-0, P5): the world-paced battles
 * advance one world second, in id order; then the world steps with
 * `commands` and every result waiting; then the host follows what the world
 * did (new battles, joins).
 */
export function stepJunction(
  world: WorldState,
  host: JunctionHost,
  commands: readonly CommandInput[],
): JunctionStep {
  const finished: FinishedBattle[] = [];
  const ticks = battleTicksPerWorldTick(world, host);
  for (const instance of [...host.instances]) {
    instance.pace = paceOf(world, host, instance);
    if (instance.pace !== "world") continue;
    for (let i = 0; i < ticks && instance.state.ended === null; i++) {
      stepInstance(world, host, instance, [], host.results, finished);
    }
  }
  const results = host.results.map((command) => ({
    playerId: SYSTEM_PLAYER_ID,
    command,
  }));
  host.results = [];
  const events = step(world, [...commands, ...results]);
  checkApplied(
    world,
    results.map((r) => r.command),
  );
  for (const event of events) {
    if (event.type === "battleOpened") {
      openInstance(world, host, event.battle);
    } else if (event.type === "battleJoined") {
      const instance = host.instances.find((i) => i.battleId === event.battle);
      if (instance === undefined) {
        throw new JunctionError(`join of a battle with no instance`);
      }
      instance.pending.push({ creep: event.creep.id, side: event.side });
    }
  }
  return { events, results, finished };
}

/**
 * One real-time battle tick (T-2), with a human's battle commands (already
 * checked by the server, C-2). Its results wait for the next world step.
 */
export function stepRealtime(
  world: WorldState,
  host: JunctionHost,
  battleId: number,
  commands: readonly unknown[],
): { events: BattleEvent[]; finished: FinishedBattle[] } {
  const instance = host.instances.find((i) => i.battleId === battleId);
  if (instance === undefined) throw new JunctionError(`no battle ${battleId}`);
  const finished: FinishedBattle[] = [];
  const events = stepInstance(
    world,
    host,
    instance,
    commands,
    host.results,
    finished,
  );
  return { events, finished };
}

/** Who has the battle screen open (D13): the server's call, not the world's. */
export function setScreen(
  host: JunctionHost,
  creepId: number,
  open: boolean,
): void {
  const without = host.screens.filter((id) => id !== creepId);
  host.screens = open ? [...without, creepId].sort((a, b) => a - b) : without;
}

/** The host as canonical JSON, without the screens (N-3). */
export function serializeHost(host: JunctionHost): string {
  return canonicalJson(
    {
      battleParams: host.battleParams,
      instances: host.instances,
      results: host.results,
    },
    "host",
  );
}

export function restoreHost(json: string): JunctionHost {
  const data = JSON.parse(json) as Omit<JunctionHost, "screens">;
  for (const instance of data.instances) {
    if (instance.state.battleVersion !== BATTLE_VERSION) {
      throw new JunctionError(
        `battle ${instance.battleId} is from version ${instance.state.battleVersion}, this is ${BATTLE_VERSION}`,
      );
    }
  }
  return { ...data, screens: [] };
}
