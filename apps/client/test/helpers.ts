import type { DynamicState, WelcomeMessage } from "@geometrix/protocol";
import { createWorld, parseParams, type WorldState } from "@geometrix/sim";
import { toDynamicState, toStaticMap } from "@geometrix/protocol";
import params from "../../../packages/sim/test/params.json" with { type: "json" };
import type { KeyValueStore } from "../src/session.ts";

/** A world built from the sim tests' fixed params. */
export function testWorld(seed = 42): WorldState {
  return createWorld(seed, parseParams(params));
}

/** The dynamic state as the server sends it, detached from `state`. */
export function dynamicOf(state: WorldState): DynamicState {
  return JSON.parse(JSON.stringify(toDynamicState(state))) as DynamicState;
}

export function welcomeOf(
  state: WorldState,
  playerId = 1,
  team = 0,
): WelcomeMessage {
  return {
    type: "welcome",
    worldId: 1,
    playerId,
    team,
    status: "running",
    multiplier: 1,
    params: state.params,
    map: toStaticMap(state),
    cores: state.teams.map((t) => t.core),
    state: dynamicOf(state),
  };
}

export function memoryStorage(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}
