import { describe, expect, it } from "vitest";
import {
  NAME_FONT_MAX_PX,
  NAME_FONT_MIN_PX,
  nameFontSize,
} from "../src/map/labels.ts";

describe("nameFontSize", () => {
  it("hides names whose slot is under 22 px on screen", () => {
    expect(nameFontSize(1, 21)).toBeNull();
    expect(nameFontSize(1, 22)).not.toBeNull();
    // Four creeps in a cell sit in half-cell slots.
    expect(nameFontSize(4, 40)).toBeNull();
    expect(nameFontSize(4, 44)).not.toBeNull();
  });

  it("keeps the text between 10 and 13 px on screen", () => {
    expect(nameFontSize(1, 22)! * 22).toBeCloseTo(NAME_FONT_MIN_PX);
    expect(nameFontSize(1, 35)! * 35).toBeCloseTo(11.2);
    expect(nameFontSize(1, 200)! * 200).toBeCloseTo(NAME_FONT_MAX_PX);
  });
});
