// Client <-> server messages (plan section 7). The client's messages are
// checked structurally here, with zod; whether a command makes sense in the
// world is the sim's validate (plan section 4). Server messages are plain
// types: the server builds them, so there is nothing to check.

import type {
  Cell,
  Command,
  Creep,
  Deposit,
  Params,
  Player,
  Refusal,
  RoadJob,
  Team,
  WorldState,
} from "@geometrix/sim";
import { z } from "zod";

const id = z.number().int().nonnegative();
const coord = z.number().int();
const cell = z.object({ x: coord, y: coord });
const resource = z.enum(["materia", "cristal"]);

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
]);

const action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("gather"), resource }),
  z.object({ type: z.literal("deliver") }),
  cell.extend({ type: z.literal("buildRoad") }),
  cell.extend({ type: z.literal("moveTo") }),
  z.object({ type: z.literal("stop") }),
]);

const rule = z.object({ when: condition, then: action });

const orderInput = z.discriminatedUnion("type", [
  z.object({ type: z.literal("stop") }),
  z.object({ type: z.literal("deliver") }),
  z.object({ type: z.literal("gather"), depositId: id }),
  cell.extend({ type: z.literal("moveTo") }),
  cell.extend({ type: z.literal("buildRoad") }),
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
    preset: z.enum(["materiaCollector", "cristalCollector", "roadBuilder"]),
    target: cell.optional(),
  }),
  z.object({
    type: z.literal("produce"),
    dna: z.enum(["square", "triangle", "circle"]),
    repeat: z.boolean(),
  }),
  z.object({ type: z.literal("stopRepeat") }),
  z.object({ type: z.literal("buyUpgrade"), upgrade: z.enum(["capacity"]) }),
]);

export type ClientCommand = z.infer<typeof clientCommand>;

/** Client -> server. `ref` comes back in the ack or reject. */
export const clientMessage = z.object({
  type: z.literal("command"),
  ref: z.number().int().nonnegative(),
  command: clientCommand,
});

export type ClientMessage = z.infer<typeof clientMessage>;

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
  seed: number;
  multiplier: number;
  status: WorldStatus;
  tick: number;
  durationTicks: number;
  players: { id: number; team: number; name: string; bot: boolean }[];
};

/** What changes tick by tick; the whole of it goes out each time (plan P3). */
export type DynamicState = {
  tick: number;
  teams: Team[];
  /** Without the cached path, which only the sim needs. */
  creeps: Omit<Creep, "path">[];
  deposits: Deposit[];
  /** Cell indices (y * width + x) that have a road. */
  roads: number[];
  roadJobs: RoadJob[];
  players: Player[];
};

/**
 * The dynamic part of `state`, as the server sends it. It shares objects with
 * the state: serialize it before the next tick.
 */
export function toDynamicState(state: WorldState): DynamicState {
  const roads: number[] = [];
  state.map.road.forEach((road, i) => {
    if (road === 1) roads.push(i);
  });
  return {
    tick: state.tick,
    teams: state.teams,
    creeps: state.creeps.map((creep) => {
      const sent: Partial<Creep> = { ...creep };
      delete sent.path;
      return sent as Omit<Creep, "path">;
    }),
    deposits: state.deposits,
    roads,
    roadJobs: state.roadJobs,
    players: state.players,
  };
}

/** The static map, sent once in the welcome. */
export function toStaticMap(state: WorldState): WelcomeMessage["map"] {
  const { width, height, terrain } = state.map;
  return { width, height, terrain: [...terrain] };
}

export type WorldStatus = "running" | "ended";

/** Server -> client, once per connection. The static map goes only here. */
export type WelcomeMessage = {
  type: "welcome";
  worldId: number;
  playerId: number;
  team: number;
  status: WorldStatus;
  multiplier: number;
  params: Params;
  map: { width: number; height: number; terrain: number[] };
  cores: Cell[];
  state: DynamicState;
};

export type ServerMessage =
  | WelcomeMessage
  | { type: "state"; state: DynamicState; status: WorldStatus }
  | { type: "ack"; ref: number; tick: number }
  | { type: "reject"; ref: number; reason: RejectReason };

/** A sim refusal, or one from the server before the sim sees the command. */
export type RejectReason = Refusal | "invalidMessage" | "worldEnded";

// Compile-time check that the client vocabulary matches the sim's commands.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const sameVocabulary: Same<
  ClientCommand,
  Exclude<Command, { type: "join" }>
> = true;
void sameVocabulary;
