import { describe, expect, test } from "vitest";
import {
  DevMultiError,
  isWsl,
  openCommand,
  parseDevMultiArgs,
  playerOf,
  tabUrl,
} from "../src/dev-multi.ts";

describe("parseDevMultiArgs", () => {
  test("defaults: 2 clients, the params' ×N, server-picked seed, build and open", () => {
    expect(parseDevMultiArgs([])).toEqual({
      clients: 2,
      seed: undefined,
      multiplier: undefined,
      build: true,
      open: true,
      net: false,
      bot: false,
      botDifficulty: undefined,
    });
  });

  test("reads every option", () => {
    expect(
      parseDevMultiArgs([
        "--clients",
        "4",
        "--seed",
        "7",
        "--mult",
        "600",
        "--no-build",
        "--no-open",
        "--net",
        "--bot",
        "--bot-difficulty",
        "easy",
      ]),
    ).toEqual({
      clients: 4,
      seed: 7,
      multiplier: 600,
      build: false,
      open: false,
      net: true,
      bot: true,
      botDifficulty: "easy",
    });
  });

  test.each([
    [["--clients", "0"]],
    [["--clients", "two"]],
    [["--mult", "10001"]],
    [["--seed", "-1"]],
    [["--teams", "3"]],
    [["--bot", "--bot-difficulty", "insane"]],
    [["--bot-difficulty", "easy"]],
  ])("refuses %j", (args) => {
    expect(() => parseDevMultiArgs(args)).toThrow(DevMultiError);
  });
});

describe("players and tabs", () => {
  test("players alternate Blue and Orange", () => {
    expect([1, 2, 3, 4].map((i) => playerOf(i))).toEqual([
      { name: "Jogador 1", team: 0 },
      { name: "Jogador 2", team: 1 },
      { name: "Jogador 3", team: 0 },
      { name: "Jogador 4", team: 1 },
    ]);
  });

  test("with a bot on Orange, every player is Blue", () => {
    expect([1, 2].map((i) => playerOf(i, true))).toEqual([
      { name: "Jogador 1", team: 0 },
      { name: "Jogador 2", team: 0 },
    ]);
  });

  test("a tab URL has the world and slot in the query, the session in the fragment", () => {
    const url = new URL(
      tabUrl("http://localhost:8080", 3, 2, {
        playerId: 5,
        team: 1,
        name: "Jogador 2",
        token: "a-b_c",
      }),
    );
    expect(url.pathname).toBe("/");
    expect(url.search).toBe("?world=3&slot=2");
    expect(
      new URL(
        tabUrl(
          "http://localhost:8080",
          3,
          2,
          { playerId: 5, team: 1, name: "J", token: "t" },
          true,
        ),
      ).search,
    ).toBe("?world=3&slot=2&net=1");
    const fragment = new URLSearchParams(url.hash.slice(1));
    expect(Object.fromEntries(fragment)).toEqual({
      token: "a-b_c",
      player: "5",
      team: "1",
      name: "Jogador 2",
    });
  });
});

describe("opening tabs", () => {
  test("detects WSL from /proc/version", () => {
    expect(isWsl("Linux version 5.15.167.4-microsoft-standard-WSL2")).toBe(
      true,
    );
    expect(isWsl("Linux version 6.8.0-45-generic")).toBe(false);
  });

  test("on WSL goes through cmd.exe with & escaped", () => {
    expect(openCommand("linux", true, "http://h/?a=1&b=2#t=%25")).toEqual({
      command: "cmd.exe",
      args: ["/c", "start", "http://h/?a=1^&b=2#t=^%25"],
    });
  });

  test("elsewhere uses the platform's opener, or none", () => {
    expect(openCommand("linux", false, "u")).toEqual({
      command: "xdg-open",
      args: ["u"],
    });
    expect(openCommand("darwin", false, "u")?.command).toBe("open");
    expect(openCommand("win32", false, "u")?.command).toBe("cmd");
    expect(openCommand("aix", false, "u")).toBeNull();
  });
});
