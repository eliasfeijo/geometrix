// The team stream's runtime part (M1.5 plan sections 4-6): the protocol
// version and the view deltas. Kept apart from index.ts, whose zod schemas
// would otherwise enter the client's main bundle: the client imports values
// from "@geometrix/protocol/stream" and types from "@geometrix/protocol".

export * from "./delta.ts";

/**
 * Version of the messages in index.ts. A client of another version reloads
 * the page (M1.5 spec D6). 1: M1, the whole state each time. 2: view deltas.
 * 3: fog of war, a filtered view with the known terrain and a welcome without
 * the map's terrain and the cores. 4: encounters and spoils in the view, the
 * team's events in the delta and its chronicle in the welcome (M2 encontro).
 * 5: the battle stubs in the view and the delta, react with pay or refuse
 * only, the battle events (M2 junction). 6: the wanderers in the view and
 * the delta (M2 junction F6).
 */
export const PROTOCOL_VERSION = 6;
