import { describe, it, expect } from "vitest";
import {
  notebookCoverRotation,
  NOTEBOOK_COVER_OPEN_RAD,
  NOTEBOOK_COVER_CLOSED_RAD,
} from "./notebook-pose";

describe("notebookCoverRotation — front-cover hinge angle (issue #56)", () => {
  it("closed → flat on the page stack (0 rad)", () => {
    expect(notebookCoverRotation(false)).toBe(NOTEBOOK_COVER_CLOSED_RAD);
    expect(notebookCoverRotation(false)).toBe(0);
  });

  it("open → cover fully open, flat to the left (180°)", () => {
    expect(notebookCoverRotation(true)).toBe(NOTEBOOK_COVER_OPEN_RAD);
    expect(notebookCoverRotation(true)).toBeCloseTo(Math.PI, 6);
  });

  it("opens past vertical so the cover falls open rather than standing up", () => {
    expect(notebookCoverRotation(true)).toBeGreaterThan(Math.PI / 2);
  });
});
