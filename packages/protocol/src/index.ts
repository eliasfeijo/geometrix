// Client <-> server messages (plan section 7). The client's messages are
// checked structurally here, with zod; whether a command makes sense in the
// world is the sim's validate (plan section 4). Server messages are plain
// types: the server builds them, so there is nothing to check. The replay file
// is here too, at the end: it is checked like a client message. The battle
// screen's messages (junction plan section 7, P9) carry the battle package's
// types as they are: its view, events, arena and params.

import type {
  Arena,
  BattleCommand,
  BattleEvent,
  BattleParams,
  BattleView,
} from "@geometrix/battle";
import type { BattleViewDelta } from "./battle-delta.ts";
import { parseParams, ParamsError, SIM_VERSION } from "@geometrix/sim";
import type {
  BattleSide,
  Command,
  Params,
  Refusal,
  TeamEvent,
  TeamView,
  WorldState,
} from "@geometrix/sim";
import { z } from "zod";
import type { Delta } from "./delta.ts";

const id = z.number().int().nonnegative();
const coord = z.number().int();
const cell = z.object({ x: coord, y: coord });
const resource = z.enum(["materia", "cristal"]);
const dnaList = z.array(z.enum(["square", "triangle", "circle"])).max(3);
const permille = z.number().int().nonnegative().max(1000);
const intent = z.enum(["attack", "extort"]);

const condition = z.discriminatedUnion("type", [
  z.object({ type: z.literal("always") }),
  z.object({ type: z.literal("cargoFull") }),
  z.object({ type: z.literal("cargoEmpty") }),
  z.object({
    type: z.literal("resourceInRange"),
    resource,
    radius: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("stockBelow"),
    resource,
    amount: z.number().int().nonnegative(),
  }),
  z.object({ type: z.literal("resourceUnknown"), resource }),
  z.object({
    type: z.literal("enemyInSight"),
    radius: z.number().int().nonnegative(),
    dna: dnaList.optional(),
    minCargo: z.number().int().nonnegative(),
  }),
  z.object({ type: z.literal("hpBelow"), permille: permille }),
  z.object({ type: z.literal("demandAtMost"), permille: permille }),
  z.object({
    type: z.literal("allyInBattle"),
    radius: z.number().int().nonnegative(),
  }),
]);

const action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("gather"), resource }),
  z.object({ type: z.literal("deliver") }),
  cell.extend({ type: z.literal("buildRoad") }),
  cell.extend({ type: z.literal("moveTo") }),
  z.object({ type: z.literal("stop") }),
  z.object({ type: z.literal("explore") }),
  z.object({ type: z.literal("pickup") }),
  z.object({
    type: z.literal("approach"),
    intent,
    radius: z.number().int().nonnegative(),
    dna: dnaList.optional(),
    minCargo: z.number().int().nonnegative(),
  }),
  z.object({ type: z.literal("follow"), creepId: id }),
  z.object({ type: z.literal("joinBattle"), minHpPermille: permille }),
  z.object({ type: z.literal("pay") }),
  z.object({ type: z.literal("fight") }),
  z.object({ type: z.literal("flee") }),
]);

const rule = z.object({ when: condition, then: action });

const orderInput = z.discriminatedUnion("type", [
  z.object({ type: z.literal("stop") }),
  z.object({ type: z.literal("deliver") }),
  z.object({ type: z.literal("gather"), depositId: id }),
  cell.extend({ type: z.literal("moveTo") }),
  cell.extend({ type: z.literal("explore") }),
  cell.extend({ type: z.literal("buildRoad") }),
  z.object({ type: z.literal("approach"), targetId: id, intent }),
  z.object({ type: z.literal("pickup"), spoilId: id }),
  z.object({ type: z.literal("follow"), targetId: id }),
]);

/**
 * Commands a client may send: every external command but join, which only
 * the server emits (plan section 4). Rules are capped far above
 * autopilot.maxRules just to bound the message; the sim enforces the limit.
 */
export const clientCommand = z.discriminatedUnion("type", [
  z.object({ type: z.literal("dominate"), creepId: id }),
  z.object({ type: z.literal("release") }),
  z.object({ type: z.literal("order"), creepId: id, order: orderInput }),
  z.object({
    type: z.literal("setRules"),
    creepId: id,
    rules: z.array(rule).max(100),
  }),
  z.object({
    type: z.literal("applyPreset"),
    creepId: id,
    preset: z.enum([
      "materiaCollector",
      "cristalCollector",
      "roadBuilder",
      "scout",
      "raider",
    ]),
    target: cell.optional(),
  }),
  z.object({
    type: z.literal("produce"),
    dna: z.enum(["square", "triangle", "circle"]),
    repeat: z.boolean(),
  }),
  z.object({ type: z.literal("stopRepeat") }),
  z.object({ type: z.literal("buyUpgrade"), upgrade: z.enum(["capacity"]) }),
  z.object({
    type: z.literal("react"),
    creepId: id,
    choice: z.enum(["pay", "refuse"]),
  }),
]);

export type ClientCommand = z.infer<typeof clientCommand>;

const dir = z.enum(["up", "right", "down", "left"]);

/**
 * The battle commands a client may send (junction spec C-2): only those a
 * participant takes from whoever controls it, for the participant the player
 * dominates (the server checks the id). The host's own (control, join) and
 * the lab's (setGambits) never come from a client.
 */
export const battleInputCommand = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("intent"),
    id,
    move: dir.nullable(),
    attack: z.boolean(),
    bag: z.enum(["drop", "pickup"]).nullable().optional(),
  }),
  z.object({ type: z.literal("attackOnce"), id }),
  z.object({ type: z.literal("face"), id, dir }),
  z.object({ type: z.literal("drop"), id }),
  z.object({ type: z.literal("pickup"), id }),
]);

export type BattleInputCommand = z.infer<typeof battleInputCommand>;

/**
 * Client -> server: a command, whose `ref` comes back in the ack or reject,
 * or a request for the full view (spec S-6, C-2, C-3) after a gap in the
 * sequence or a view hash that did not match.
 */
export const clientMessage = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("command"),
    ref: z.number().int().nonnegative(),
    command: clientCommand,
  }),
  z.object({
    type: z.literal("resync"),
    reason: z.enum(["seqGap", "hashMismatch"]),
    seq: z.number().int().nonnegative(),
  }),
  /** A battle command for the participant the player dominates (C-2). */
  z.object({
    type: z.literal("battleInput"),
    ref: z.number().int().nonnegative(),
    battleId: id,
    command: battleInputCommand,
  }),
  /**
   * The battle screen this socket shows, or null when it shows the map
   * (junction plan section 7): frames go only to open screens (N-2).
   */
  z.object({
    type: z.literal("battleScreen"),
    ref: z.number().int().nonnegative(),
    battleId: id.nullable(),
  }),
]);

export type ClientMessage = z.infer<typeof clientMessage>;
export type ResyncMessage = Extract<ClientMessage, { type: "resync" }>;
export type ResyncReason = ResyncMessage["reason"];
export type BattleInputMessage = Extract<
  ClientMessage,
  { type: "battleInput" }
>;
export type BattleScreenMessage = Extract<
  ClientMessage,
  { type: "battleScreen" }
>;

/** The parsed message, or null when it is not a valid client message. */
export function parseClientMessage(raw: string): ClientMessage | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = clientMessage.safeParse(json);
  return result.success ? result.data : null;
}

/** POST /api/worlds. Without a seed the server picks one (it is stored). */
export const createWorldRequest = z.object({
  seed: z
    .number()
    .int()
    .nonnegative()
    .max(2 ** 32 - 1)
    .optional(),
  multiplier: z.number().int().positive().max(10_000).optional(),
  /** Teams that get a balanced bot (spec section 5, F6 details). */
  botTeams: z.array(z.number().int().nonnegative()).max(8).optional(),
});

export type CreateWorldRequest = z.infer<typeof createWorldRequest>;

/** POST /api/worlds/:id/join. The answer carries the session token. */
export const joinRequest = z.object({
  name: z.string().trim().min(1).max(32),
  team: z.number().int().nonnegative(),
});

export type JoinRequest = z.infer<typeof joinRequest>;

export type JoinResponse = { playerId: number; team: number; token: string };

export type WorldSummary = {
  id: number;
  /**
   * Null while the world runs (fog spec D9): with the seed and the params, a
   * client rebuilds the whole map and the fog is gone.
   */
  seed: number | null;
  multiplier: number;
  status: WorldStatus;
  tick: number;
  durationTicks: number;
  players: { id: number; team: number; name: string; bot: boolean }[];
};

/**
 * The map size, the only part of the map in the welcome: the terrain comes in
 * the view, as far as the team explored it (fog spec N-1).
 */
export function mapSize(state: WorldState): WelcomeMessage["map"] {
  return { width: state.map.width, height: state.map.height };
}

export type WorldStatus = "running" | "ended";

/**
 * Server -> client: the start of a team stream (M1.5 plan section 4), on
 * connecting and on a resync. With fog of war (fog plan section 8) it tells
 * only the map size: no terrain, no cores and no seed, which would rebuild the
 * whole map; the view brings what the team knows.
 */
export type WelcomeMessage = {
  type: "welcome";
  protocol: number;
  worldId: number;
  playerId: number;
  team: number;
  status: WorldStatus;
  multiplier: number;
  params: Params;
  map: { width: number; height: number };
  /**
   * The team stream, new in each server process. A client resuming after a
   * drop sends it back with its seq: a seq of another stream (the server
   * restarted) gets a welcome (spec S-5).
   */
  stream: string;
  /** The seq of `view`; the next delta is seq + 1. */
  seq: number;
  /** The last view sent to the team (spec S-1), not the state now. */
  view: TeamView;
  /**
   * The team's latest events up to `view` (M2 encontro spec N-1), oldest
   * first: the chronicle a client starts from. The next delta carries the
   * events after them.
   */
  chronicle: TeamEvent[];
};

/**
 * Server -> client: the changes of the team's view since seq - 1. `status`
 * only when it changes; `hash` every few world ticks: the SHA-256 of viewJson
 * of the view after this delta.
 */
export type DeltaMessage = {
  type: "delta";
  seq: number;
  delta: Delta;
  status?: WorldStatus;
  hash?: string;
  /**
   * The team's events since the previous delta (M2 encontro plan section 8),
   * in (tick, index) order; left out when there are none. A send at high
   * speed covers several ticks.
   */
  events?: TeamEvent[];
};

/** A world creep in a battle: its battle participant id (junction). */
export type BattleMember = { participant: number; creep: number };

/**
 * Who is who in a battle: the world creep of each participant that ever
 * entered, and the world side of each battle side, by battle side id (a
 * team, or the wanderers).
 */
export type BattleRoster = { members: BattleMember[]; sides: BattleSide[] };

/**
 * Server -> client: a battle screen opened (junction plan section 7, P9),
 * once per opening: what never changes in the battle (the arena, its params),
 * the roster and the battle view now, which the frames' deltas build on.
 */
export type BattleOpenMessage = {
  type: "battleOpen";
  battleId: number;
  arena: Arena;
  params: BattleParams;
  roster: BattleRoster;
  view: BattleView;
};

/**
 * Server -> client: the battle after one battle tick in real time, or after
 * a world tick's battle second on the world clock: the changes of its view
 * since the previous frame (applyBattleDelta), with the events of the ticks
 * it covers. `roster` only when someone joined. A frame whose view gets
 * `ended` is the battle's last: the screen closes on the server.
 */
export type BattleFrameMessage = {
  type: "battleFrame";
  battleId: number;
  delta: BattleViewDelta;
  events: BattleEvent[];
  roster?: BattleRoster;
};

export type ServerMessage =
  | WelcomeMessage
  | DeltaMessage
  | BattleOpenMessage
  | BattleFrameMessage
  | { type: "ack"; ref: number; tick: number }
  | { type: "reject"; ref: number; reason: RejectReason };

/**
 * A sim refusal, or one from the server before the sim sees the command. A
 * battle screen of a battle the team has no side in is `notYourBattle`; a
 * battle input for a participant the player does not dominate is
 * `notYourParticipant` (C-2).
 */
export type RejectReason =
  | Refusal
  | "invalidMessage"
  | "worldEnded"
  | "notYourBattle"
  | "notYourParticipant";

// Compile-time check that the client vocabulary matches the sim's commands,
// less the system ones: the server's join and the junction host's battle
// results (junction plan P2), which no client may send.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const sameVocabulary: Same<
  ClientCommand,
  Exclude<Command, { type: "join" | "battleExit" | "battleEnd" }>
> = true;
void sameVocabulary;

// The same for the battle inputs: what a participant's controller sends.
const sameBattleInputs: Same<
  BattleInputCommand,
  Extract<
    BattleCommand,
    { type: "intent" | "attackOnce" | "face" | "drop" | "pickup" }
  >
> = true;
void sameBattleInputs;

// Replay file (plan section 8, F8 details): enough to rebuild a world tick by
// tick. The initial state is createWorld(seed, params); the logged commands
// enter on their ticks, in seq order, as the server and the harness applied
// them. `geo sim` writes it (runs/<id>/replay.json) and the server exports it
// (GET /api/worlds/:id/replay); the client replays it with the sim.

/** An accepted command, as the log keeps it (ADR-0004). */
export type LoggedCommand = {
  tick: number;
  seq: number;
  playerId: number;
  command: Command;
};

export type Replay = {
  simVersion: number;
  seed: number;
  params: Params;
  /** Ticks stepped: the replay ends on this tick. */
  ticks: number;
  /** sha256 of serialize(state) at `ticks`. */
  finalHash: string;
  commands: LoggedCommand[];
};

const count = z.number().int().nonnegative();

const stock = z.object({ materia: count, cristal: count });

/**
 * Every command of the log: the client's plus the system ones, the join and
 * the junction host's battle results (junction plan P2).
 */
const loggedCommand = z.object({
  tick: count,
  seq: count,
  playerId: count,
  command: z.union([
    clientCommand,
    z.object({ type: z.literal("join"), team: count, bot: z.boolean() }),
    z.object({
      type: z.literal("battleExit"),
      battleId: id,
      creepId: id,
      outcome: z.enum(["died", "escaped"]),
      hp: count,
      cargo: stock,
      cell,
      by: id.nullable(),
    }),
    z.object({
      type: z.literal("battleEnd"),
      battleId: id,
      winnerSide: count.nullable(),
      reason: z.enum(["won", "idle", "empty"]),
      survivors: z.array(
        z.object({ creepId: id, hp: count, cargo: stock, cell }),
      ),
      piles: z.array(z.object({ cell, cargo: stock })),
    }),
  ]),
});

const replayFile = z.object({
  simVersion: z.number().int().positive(),
  seed: count.max(2 ** 32 - 1),
  params: z.unknown(),
  ticks: count,
  finalHash: z.string().regex(/^[0-9a-f]{64}$/),
  commands: z.array(loggedCommand),
});

export class ReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplayError";
  }
}

/**
 * Validates a parsed replay file: its shape, its params and the log order
 * (ticks before `ticks`, sorted by tick and seq). Throws a ReplayError.
 */
export function parseReplay(input: unknown): Replay {
  const result = replayFile.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0]!;
    const path = issue.path.map(String).join(".") || "(root)";
    // An older file usually fails because the command vocabulary changed.
    const version = (input as { simVersion?: unknown } | null)?.simVersion;
    const note =
      typeof version === "number" && version !== SIM_VERSION
        ? ` (sim version ${version}; this build runs ${SIM_VERSION})`
        : "";
    throw new ReplayError(`invalid replay at ${path}: ${issue.message}${note}`);
  }
  const data = result.data;
  let params: Params;
  try {
    params = parseParams(data.params);
  } catch (error) {
    if (!(error instanceof ParamsError)) throw error;
    throw new ReplayError(`invalid replay params: ${error.issues.join("; ")}`);
  }
  let previous: LoggedCommand | null = null;
  for (const command of data.commands) {
    if (command.tick >= data.ticks) {
      throw new ReplayError(
        `command on tick ${command.tick}, the replay ends at ${data.ticks}`,
      );
    }
    if (
      previous !== null &&
      (command.tick < previous.tick ||
        (command.tick === previous.tick && command.seq <= previous.seq))
    ) {
      throw new ReplayError(
        `commands out of order at tick ${command.tick}, seq ${command.seq}`,
      );
    }
    previous = command;
  }
  return { ...data, params };
}

export * from "./stream.ts";
