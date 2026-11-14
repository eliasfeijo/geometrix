// The team stream's runtime part (M1.5 plan sections 4-6): the protocol
// version and the view deltas. Kept apart from index.ts, whose zod schemas
// would otherwise enter the client's main bundle: the client imports values
// from "@geometrix/protocol/stream" and types from "@geometrix/protocol".

export * from "./delta.ts";

/**
 * Version of the messages in index.ts. A client of another version reloads
 * the page (M1.5 spec D6). 1: M1, the whole state each time. 2: view deltas.
 */
export const PROTOCOL_VERSION = 2;
