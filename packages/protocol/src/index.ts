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

/** What changes tick by tick; the whole of it goes out each time (plan P3). */
export type DynamicState = {
  tick: number;
  teams: Team[];
  creeps: Creep[];
  deposits: Deposit[];
  /** Cell indices (y * width + x) that have a road. */
  roads: number[];
  roadJobs: RoadJob[];
  players: Player[];
};

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
