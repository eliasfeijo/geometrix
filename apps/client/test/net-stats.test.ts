import { describe, expect, it } from "vitest";
import { keepNetPanel, showNetPanel } from "../src/net-panel.tsx";
import { BYTES_WINDOW_MS, NetStats } from "../src/net-stats.ts";

describe("NetStats", () => {
  it("averages the bytes of the last 10 s", () => {
    const stats = new NetStats();
    stats.received(5_000, 0);
    stats.received(3_000, 4_000);
    expect(stats.bytesPerSecond(5_000)).toBe(800);
    // The first message leaves the window.
    expect(stats.bytesPerSecond(BYTES_WINDOW_MS + 1)).toBe(300);
    expect(stats.bytesPerSecond(30_000)).toBe(0);
    expect(stats.totalBytes).toBe(8_000);
  });
});

describe("showNetPanel", () => {
  it.each([
    ["?net=1", true],
    ["?seed=3&net=1", true],
    ["?net=0", false],
    ["", false],
  ])("%s → %s", (search, shown) => {
    expect(showNetPanel({ search })).toBe(shown);
  });
});

describe("keepNetPanel", () => {
  it("keeps ?net=1 when the page moves", () => {
    expect(keepNetPanel("?world=3&slot=1", "?slot=1&net=1")).toBe(
      "?world=3&slot=1&net=1",
    );
    expect(keepNetPanel("", "?net=1")).toBe("?net=1");
    expect(keepNetPanel("?world=3", "?slot=1")).toBe("?world=3");
  });
});
