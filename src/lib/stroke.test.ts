import { describe, expect, it } from "vitest";
import { STROKE_WIDTH_IDS, strokeWidthMeters } from "./stroke";

describe("Stroke width palette (issue #35, ADR-0014)", () => {
  it("enumerates the four width ids in order from thinnest to thickest", () => {
    expect(STROKE_WIDTH_IDS).toEqual(["fine", "medium", "bold", "marker"]);
  });

  it("strokeWidthMeters maps each id to its real-world width in metres", () => {
    // From the issue's implementation notes:
    //   fine = 1 mm, medium = 2.5 mm, bold = 5 mm, marker = 10 mm.
    expect(strokeWidthMeters("fine")).toBeCloseTo(0.001, 6);
    expect(strokeWidthMeters("medium")).toBeCloseTo(0.0025, 6);
    expect(strokeWidthMeters("bold")).toBeCloseTo(0.005, 6);
    expect(strokeWidthMeters("marker")).toBeCloseTo(0.01, 6);
  });
});
