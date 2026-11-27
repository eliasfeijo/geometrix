import { createWorldRequest } from "@geometrix/protocol";
import { describe, expect, it } from "vitest";
import { worldRequest } from "../src/lobby.tsx";

describe("the lobby's new world (R spec D26)", () => {
  it("sends a difficulty per bot team only", () => {
    const request = worldRequest({
      seed: " ",
      multiplier: "8",
      bots: [false, true],
      difficulties: ["easy", "normal"],
    });
    expect(request).toEqual({
      multiplier: 8,
      botTeams: [1],
      botDifficulty: { "1": "normal" },
    });
    expect(createWorldRequest.safeParse(request).success).toBe(true);
  });
});
