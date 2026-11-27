import { describe, expect, it } from "vitest";
import { collectorRules, presetRules, raiderRules } from "@geometrix/sim";
import { namesOf, orderText, ruleText } from "../src/format.ts";
import { alliesIn } from "../src/map/pick.ts";
import { cellOrderText } from "../src/panels/approach-menu.tsx";
import { withFollow } from "../src/rules-draft.ts";

describe('"Seguir" and "Seguir…" (R spec D8, D9)', () => {
  it("offers the team's other creeps under the click", () => {
    const creeps = [
      { id: 1, team: 0 },
      { id: 2, team: 0 },
      { id: 3, team: 1 },
    ];
    expect(alliesIn([1, 2, 3], creeps, 0, 1)).toEqual([2]);
  });

  it("keeps the cell's order on the menu", () => {
    expect(cellOrderText({ type: "gather", depositId: 1 })).toBe(
      "Coletar aqui",
    );
    expect(cellOrderText({ type: "moveTo", x: 1, y: 1 })).toBe("Ir até aqui");
  });

  it("puts the follow rule after the reactions, on top of the rest", () => {
    const follow = { when: { type: "always" }, then: { type: "follow" } };
    expect(withFollow(collectorRules("materia"), 7)[0]).toMatchObject(follow);
    const raider = withFollow(raiderRules(), 7);
    expect(raider[2]!.then).toEqual({ type: "follow", creepId: 7 });
    expect(raider.length).toBe(raiderRules().length + 1);
    // Before the help rule of a preset.
    const preset = withFollow(presetRules("raider", "circle"), 7);
    expect(preset[2]!.then.type).toBe("follow");
    expect(preset[3]!.then.type).toBe("joinBattle");
  });

  it("names the ally followed", () => {
    const names = namesOf([{ id: 7, name: "Bo" }]);
    const rules = withFollow([], 7);
    expect(ruleText(rules[0]!, names)).toBe("sempre → seguir Bo");
    expect(orderText({ type: "follow", targetId: 9 }, [], names)).toBe(
      "seguir o creep #9",
    );
  });
});
