import { describe, expect, test } from "vitest";
import { isReaction } from "../src/autopilot.ts";
import type { Command } from "../src/commands.ts";
import {
  collectorRules,
  raiderRules,
  helpRule,
  presetRules,
  roadBuilderRules,
  withHelp,
} from "../src/presets.ts";
import { mirrorCell, Terrain } from "../src/map.ts";
import { canonicalJson, serialize } from "../src/serialize.ts";
import { step } from "../src/step.ts";
import { roadTarget } from "../src/roads.ts";
import type { Difficulty } from "../src/domination.ts";
import {
  defenseRule,
  postureRules,
  standRules,
  strategistCommands,
  teamDifficulty,
} from "../src/strategist.ts";
import { view } from "../src/view.ts";
import { createWorld, type WorldState } from "../src/world.ts";
import {
  addWanderer,
  loadTestParams,
  placeWorld,
  revealWorld,
  textWorld,
  type Placed,
} from "./helpers.ts";

const params = loadTestParams();

/**
 * The seed-42 world after one bot per team joined at tick 0 at `difficulty`
 * (easy: slice D's strategist, R spec D26), all revealed, its materia
 * collectors already with the bot's posture.
 */
function joined(difficulty: Difficulty = "easy"): WorldState {
  const world = createWorld(42, params);
  step(world, [
    { playerId: 1, command: { type: "join", team: 0, bot: true, difficulty } },
    { playerId: 2, command: { type: "join", team: 1, bot: true, difficulty } },
  ]);
  revealWorld(world);
  for (const creep of world.creeps) {
    const posture =
      difficulty === "easy" ? postureRules(creep.dna) : standRules();
    creep.rules = withHelp(
      [...posture, ...collectorRules("materia")],
      creep.dna,
    );
  }
  return world;
}

/**
 * The world of joined() with one passable cell left never seen by each team,
 * mirrored: there is something to explore, so the bot keeps raiders.
 */
function withDark(difficulty: Difficulty = "easy"): WorldState {
  const world = joined(difficulty);
  const size = world.map.width * world.map.height;
  const cell = world.map.terrain.findIndex((t) => t === Terrain.jungle);
  world.memory[0]!.explored[cell] = 0;
  world.memory[1]!.explored[size - 1 - cell] = 0;
  return world;
}

/** The balanced bot's commands for the team, from its view as the harness. */
const decide = (world: WorldState, team: number) =>
  strategistCommands("balanced", view(world, team), world.map, world.params);

/** What both bots send on this tick, as the harness would. */
const botInputs = (world: WorldState) =>
  [0, 1].flatMap((team) =>
    decide(world, team).map((command) => ({
      playerId: team + 1,
      command,
    })),
  );

const teamCreeps = (world: WorldState, team: number) =>
  world.creeps.filter((c) => c.team === team);

/**
 * The role each command gives a creep, as a preset id: applyPreset names it;
 * a gatherer's setRules has its preset's rules behind the posture.
 */
const assignments = (
  commands: Command[],
): { creepId: number; role: string }[] =>
  commands.flatMap((c) => {
    if (c.type === "applyPreset") {
      return [{ creepId: c.creepId, role: c.preset }];
    }
    if (c.type !== "setRules") return [];
    const actions = canonicalJson(
      c.rules.filter(
        (r) => !isReaction(r.then) && r.then.type !== "joinBattle",
      ),
    );
    const role =
      actions === canonicalJson(collectorRules("materia"))
        ? "materiaCollector"
        : actions === canonicalJson(collectorRules("cristal"))
          ? "cristalCollector"
          : actions === canonicalJson(roadBuilderRules())
            ? "roadBuilder"
            : "unknown";
    return [{ creepId: c.creepId, role }];
  });

const presetsOf = (commands: Command[]) =>
  assignments(commands).map((a) => [a.creepId, a.role] as const);

/** How many creeps the commands make road builders. */
const builders = (commands: Command[]) =>
  assignments(commands).filter((a) => a.role === "roadBuilder").length;

describe("balanced at easy: slice D's strategist (R spec D26)", () => {
  test("splits 6 creeps into 2 cristal, 1 road builder, 1 raider and 2 materia, lowest ids first", () => {
    const world = withDark();
    const [a, b, c, d] = teamCreeps(world, 0);
    const commands = decide(world, 0);
    expect(presetsOf(commands)).toEqual([
      [a!.id, "cristalCollector"],
      [b!.id, "cristalCollector"],
      [c!.id, "roadBuilder"],
      [d!.id, "raider"],
    ]);
    expect(roadTarget(world, world.teams[0]!)).not.toBeNull();
  });

  test("leaves a team that already has the split alone", () => {
    const world = joined();
    for (const input of botInputs(world)) {
      step(world, [input]);
      world.tick -= 1;
    }
    expect(presetsOf(decide(world, 0))).toEqual([]);
  });

  test("keeps one raider for every 6 creeps, rounded down (spec D15, plan P8)", () => {
    const world = withDark();
    const raiders = () =>
      teamCreeps(world, 0).filter(
        (c) =>
          canonicalJson(c.rules) ===
          canonicalJson(withHelp(raiderRules(), c.dna)),
      );
    const settle = () => {
      for (const input of botInputs(world)) {
        step(world, [input]);
        world.tick -= 1;
      }
    };
    settle();
    expect(raiders()).toHaveLength(1);
    // 12 creeps: a second raider, taken from the lowest-id materia creeps.
    const extra = teamCreeps(world, 0).map((c) => ({
      ...structuredClone(c),
      id: c.id + 1000,
      rules: collectorRules("materia"),
    }));
    world.creeps.push(...extra);
    settle();
    expect(raiders()).toHaveLength(2);
    // 5 creeps: none.
    const keep = new Set(
      teamCreeps(world, 0)
        .slice(0, 5)
        .map((c) => c.id),
    );
    world.creeps = world.creeps.filter((c) => c.team !== 0 || keep.has(c.id));
    settle();
    expect(raiders()).toEqual([]);
  });

  test("sends the raiders back to gathering once there is nothing to explore (F3 checkpoint, C1)", () => {
    const world = withDark();
    const raider = teamCreeps(world, 0)[3]!;
    raider.rules = withHelp(raiderRules(), raider.dna);
    expect(presetsOf(decide(world, 0))).not.toContainEqual([
      raider.id,
      "materiaCollector",
    ]);
    // Every cell seen: no raider.
    world.memory[0]!.explored.fill(1);
    expect(presetsOf(decide(world, 0))).toContainEqual([
      raider.id,
      "materiaCollector",
    ]);
  });

  test("gives the gatherers their posture by DNA, and the raider its own (F3 checkpoint, C2)", () => {
    const world = withDark();
    const creeps = teamCreeps(world, 0);
    // A newborn: the materia preset without the posture.
    const newborn = creeps.at(-1)!;
    newborn.rules = presetRules("materiaCollector", newborn.dna);
    const commands = decide(world, 0);
    const rulesOf = (id: number) =>
      commands.find(
        (c): c is Extract<Command, { type: "setRules" }> =>
          c.type === "setRules" && c.creepId === id,
      )?.rules;
    expect(rulesOf(newborn.id)).toEqual([
      ...postureRules(newborn.dna),
      helpRule(newborn.dna),
      ...collectorRules("materia"),
    ]);
    for (const creep of creeps.slice(0, 3)) {
      expect(
        rulesOf(creep.id)!.slice(0, postureRules(creep.dna).length),
      ).toEqual(postureRules(creep.dna));
    }
    expect(commands).toContainEqual({
      type: "applyPreset",
      creepId: creeps[3]!.id,
      preset: "raider",
    });
    expect(postureRules("square").map((r) => r.then.type)).toEqual([
      "flee",
      "fight",
    ]);
    expect(postureRules("triangle")).toEqual([
      { when: { type: "always" }, then: { type: "pay" } },
      { when: { type: "always" }, then: { type: "flee" } },
    ]);
    expect(postureRules("circle")).toEqual([
      { when: { type: "always" }, then: { type: "flee" } },
    ]);
  });

  test("produces the DNA the team has fewest of, ties in ■ ▲ ● order", () => {
    const world = joined();
    world.teams[0]!.stock = { materia: 100, cristal: 20 };
    expect(decide(world, 0)).toContainEqual({
      type: "produce",
      dna: "square",
      repeat: false,
    });
    world.creeps = world.creeps.filter(
      (c) => !(c.team === 0 && c.dna === "circle"),
    );
    expect(decide(world, 0)).toContainEqual({
      type: "produce",
      dna: "circle",
      repeat: false,
    });
  });

  test("buys the capacity upgrade with what is left after producing", () => {
    const world = joined();
    const team = world.teams[0]!;
    const types = () => decide(world, 0).map((c) => c.type);
    team.stock = { materia: 40, cristal: 159 };
    expect(types()).toContain("produce");
    expect(types()).not.toContain("buyUpgrade");
    team.stock = { materia: 40, cristal: 160 };
    expect(types()).toEqual(expect.arrayContaining(["produce", "buyUpgrade"]));
    team.upgrades.capacity = true;
    expect(types()).not.toContain("buyUpgrade");
  });

  test("moves cristal collectors back to materia once the map has no cristal", () => {
    const world = joined();
    const [a, b] = teamCreeps(world, 0);
    a!.rules = withHelp(collectorRules("cristal"), a!.dna);
    b!.rules = withHelp(collectorRules("cristal"), b!.dna);
    for (const d of world.deposits) if (d.kind === "cristal") d.amount = 0;
    revealWorld(world);
    // Freed first, a is then the lowest-id materia creep: it fills the
    // builder. With every cell seen, there is no raider (C1).
    expect(presetsOf(decide(world, 0))).toEqual([
      [a!.id, "roadBuilder"],
      [b!.id, "materiaCollector"],
    ]);
  });

  test("sends cristal collectors to explore while there is map left to see (fog spec A-4)", () => {
    const cristalCollectors = (world: WorldState) =>
      presetsOf(decide(world, 0)).filter(([, p]) => p === "cristalCollector");
    // No cristal known, but cells never seen within reach: the split holds.
    const wide = textWorld(["A..m...............B"]);
    expect(wide.memory[0]!.explored).toContain(0);
    expect(cristalCollectors(wide)).toHaveLength(2);
    // The core has seen every cell: there is no cristal to look for.
    const small = textWorld(["A..m....B"]);
    expect(small.memory[0]!.explored).not.toContain(0);
    expect(cristalCollectors(small)).toEqual([]);
  });

  test("the road target is the nearest deposit without a road, then the next", () => {
    const world = joined();
    const team = world.teams[0]!;
    const first = roadTarget(world, team)!;
    const deposit = world.deposits.find(
      (d) => d.x === first.x && d.y === first.y,
    )!;
    const distance = (d: { x: number; y: number }) =>
      Math.abs(d.x - team.core.x) + Math.abs(d.y - team.core.y);
    for (const d of world.deposits) {
      expect(distance(d)).toBeGreaterThanOrEqual(distance(deposit));
    }
    const cell = first.y * world.map.width + first.x;
    world.map.road[cell] = 1;
    world.memory[0]!.road[cell] = 1;
    const second = roadTarget(world, team)!;
    expect(second).not.toEqual(first);
    // The builder is the plain preset: the strategist leaves it be, and its
    // autopilot resolves the new target (R spec D12).
    const builder = teamCreeps(world, 0)[2]!;
    builder.rules = withHelp(
      [...postureRules(builder.dna), ...roadBuilderRules()],
      builder.dna,
    );
    expect(assignments(decide(world, 0)).map((a) => a.creepId)).not.toContain(
      builder.id,
    );
  });

  test("breaks a road target tie by the cell in the team's frame, so the teams mirror", () => {
    // Two materia deposits 3 cells from each core; the ids are in map order,
    // so they are not mirrored between the teams.
    const world = textWorld([
      "m.....",
      "..A..m",
      "......",
      "......",
      "m..B..",
      ".....m",
    ]);
    const targets = [0, 1].map((t) => roadTarget(world, world.teams[t]!));
    expect(targets[0]).toEqual({ x: 0, y: 0 });
    expect(targets[1]).toEqual(mirrorCell({ x: 0, y: 0 }, world.map));
  });

  test("decides from the view alone, without changing the state", () => {
    const world = joined();
    world.teams[0]!.stock = { materia: 100, cristal: 200 };
    const before = serialize(world);
    const first = decide(world, 0);
    expect(serialize(world)).toBe(before);
    expect(decide(world, 0)).toEqual(first);
  });

  test("plans on the terrain the view knows, unseen cells as jungle (fog spec B-1)", () => {
    const world = textWorld(["A..m.......B"]);
    const seen = view(world, 0);
    const count = () =>
      builders(strategistCommands("balanced", seen, world.map, world.params));
    expect(count()).toBe(1);
    // A view that knows a rock at x = 1 walls the materia off: no builder,
    // whatever the world's map says.
    seen.known = seen.known.map((t, i) => (i === 1 ? Terrain.rock : t));
    expect(count()).toBe(0);
    // A cell never seen counts as jungle: the deposit looks reachable again.
    seen.known = seen.known.map((t, i) => (i === 1 ? -1 : t));
    expect(count()).toBe(1);
  });

  test("sees roads through the view: no builder once every deposit has one", () => {
    const world = textWorld(["A..m.......B"]);
    const seen = view(world, 0);
    expect(
      builders(strategistCommands("balanced", seen, world.map, world.params)),
    ).toBe(1);
    seen.roads = [...seen.roads, 3].sort((a, b) => a - b);
    expect(
      builders(strategistCommands("balanced", seen, world.map, world.params)),
    ).toBe(0);
  });
});

/** The setRules a command list gives the creep, if any. */
const rulesGiven = (commands: Command[], id: number) =>
  commands.find(
    (c): c is Extract<Command, { type: "setRules" }> =>
      c.type === "setRules" && c.creepId === id,
  )?.rules;

describe("the posture at normal and hard (R spec D17, S-4)", () => {
  test.each(["normal", "hard"] as const)(
    "every DNA's gatherer pays a demand of at most 250‰, flees below 400‰ HP and fights otherwise (%s)",
    (difficulty) => {
      const world = withDark(difficulty);
      const creeps = teamCreeps(world, 0);
      for (const creep of creeps) {
        creep.rules = presetRules("materiaCollector", creep.dna);
      }
      const commands = decide(world, 0);
      expect(standRules()).toEqual([
        {
          when: { type: "demandAtMost", permille: 250 },
          then: { type: "pay" },
        },
        { when: { type: "hpBelow", permille: 400 }, then: { type: "flee" } },
        { when: { type: "always" }, then: { type: "fight" } },
      ]);
      const gatherers = creeps.filter((c) => rulesGiven(commands, c.id));
      expect(new Set(gatherers.map((c) => c.dna))).toEqual(
        new Set(["square", "triangle", "circle"]),
      );
      for (const creep of gatherers) {
        const rules = rulesGiven(commands, creep.id)!;
        expect(rules.slice(0, 3)).toEqual(standRules());
        expect(rules[3]).toEqual(helpRule(creep.dna));
      }
    },
  );

  test("easy keeps slice D's posture: the triangle pays, the circle flees", () => {
    const world = withDark("easy");
    const triangle = teamCreeps(world, 0).find((c) => c.dna === "triangle")!;
    triangle.rules = presetRules("materiaCollector", "triangle");
    expect(rulesGiven(decide(world, 0), triangle.id)!.slice(0, 2)).toEqual(
      postureRules("triangle"),
    );
  });
});

/**
 * A 30-cell line, team 0's core at x 0 (its zone reaches x 8) and team 1's
 * at x 29, with the creeps placed and both bots joined at `difficulty`.
 */
function line(difficulty: Difficulty, placed: readonly Placed[]) {
  const { world, creeps } = placeWorld(
    ["A" + ".".repeat(28) + "B"],
    placed,
    params,
  );
  step(world, [
    { playerId: 1, command: { type: "join", team: 0, bot: true, difficulty } },
    { playerId: 2, command: { type: "join", team: 1, bot: true, difficulty } },
  ]);
  return { world, creeps };
}

describe("the core zone's defense (R spec D14, S-1)", () => {
  test.each(["normal", "hard"] as const)(
    "while an enemy stands in the zone, the creeps inside it attack on top of their role (%s)",
    (difficulty) => {
      const { world, creeps } = line(difficulty, [
        [0, "square", 2, 0],
        [0, "triangle", 12, 0],
        [1, "circle", 6, 0],
      ]);
      const [inside, outside, enemy] = creeps;
      const commands = decide(world, 0);
      const rules = rulesGiven(commands, inside!.id)!;
      expect(rules[0]).toEqual(defenseRule(world.params));
      expect(defenseRule(world.params).then).toEqual({
        type: "approach",
        intent: "attack",
        radius: 8,
        minCargo: 0,
      });
      expect(rules.slice(1)).not.toContainEqual(defenseRule(world.params));
      expect(rulesGiven(commands, outside!.id)?.[0]).not.toEqual(
        defenseRule(world.params),
      );
      // Taken: the rules stay as they are.
      inside!.rules = rules;
      expect(rulesGiven(decide(world, 0), inside!.id)).toBeUndefined();
      // No enemy left in the zone: the rule leaves, the role stays.
      enemy!.x = 9;
      expect(rulesGiven(decide(world, 0), inside!.id)).toEqual(rules.slice(1));
    },
  );

  test("easy does not defend", () => {
    const { world, creeps } = line("easy", [
      [0, "square", 2, 0],
      [1, "circle", 6, 0],
    ]);
    const rules = rulesGiven(decide(world, 0), creeps[0]!.id);
    expect(rules?.[0]).not.toEqual(defenseRule(world.params));
  });

  test("a wanderer in the zone is an enemy too", () => {
    const { world, creeps } = line("hard", [[0, "square", 2, 0]]);
    addWanderer(world, 7, 0);
    expect(view(world, 0).wanderers).toHaveLength(1);
    expect(rulesGiven(decide(world, 0), creeps[0]!.id)?.[0]).toEqual(
      defenseRule(world.params),
    );
  });
});

describe("production before the upgrade (R spec D15, S-2)", () => {
  test.each(["easy", "normal", "hard"] as const)(
    "with stock for one only, it produces and leaves the upgrade (%s)",
    (difficulty) => {
      const world = joined(difficulty);
      const team = world.teams[0]!;
      const { creep, upgrade } = world.params;
      // Enough for the creep or for the upgrade, not both.
      team.stock = {
        materia: creep.cost.materia,
        cristal: Math.max(creep.cost.cristal, upgrade.capacity.cost.cristal),
      };
      const types = decide(world, 0).map((c) => c.type);
      expect(types).toContain("produce");
      expect(types).not.toContain("buyUpgrade");
      expect(types.indexOf("produce")).toBe(0);
    },
  );
});

describe("difficulty (R spec D26, S-6)", () => {
  test("plays at its team's first bot player's difficulty, hard by default", () => {
    const world = createWorld(42, params);
    step(world, [
      { playerId: 5, command: { type: "join", team: 0, bot: false } },
      {
        playerId: 7,
        command: { type: "join", team: 0, bot: true, difficulty: "normal" },
      },
      {
        playerId: 3,
        command: { type: "join", team: 0, bot: true, difficulty: "easy" },
      },
      { playerId: 2, command: { type: "join", team: 1, bot: true } },
    ]);
    // Player 3 is team 0's first bot by id; the human does not count.
    expect(teamDifficulty(view(world, 0).players, 0)).toBe("easy");
    expect(teamDifficulty(view(world, 1).players, 1)).toBe("hard");
    // Another team's view has no difficulty of team 0 (P8): hard, unknown.
    expect(teamDifficulty(view(world, 1).players, 0)).toBe("hard");
    expect(teamDifficulty([], 0)).toBe("hard");
  });
});
