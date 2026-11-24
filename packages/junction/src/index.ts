// Public API of @geometrix/junction (ADR-0010, junction plan section 4): the
// junction host, which runs the battle instances next to the world and turns
// their results into world commands. Pure and deterministic like the sim and
// the battle, which it imports; the server and the CLI drive it.
export * from "./arena.ts";
export * from "./host.ts";
export * from "./results.ts";
export * from "./setup.ts";
export * from "./replay.ts";
