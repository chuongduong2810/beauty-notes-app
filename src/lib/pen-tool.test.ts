import { describe, expect, it } from "vitest";
import {
  appendStrokePoint,
  beginStroke,
  endStroke,
  initialPenState,
  setCurrentTool,
} from "./pen-tool";

describe("Pen-tool reducer — in-progress Stroke state machine (issue #35)", () => {
  it("starts in Note mode with no in-progress Stroke", () => {
    expect(initialPenState.currentTool).toBe("note");
    expect(initialPenState.inProgressStroke).toBeNull();
  });

  it("setCurrentTool flips the mode and clears any half-drawn Stroke", () => {
    const after = setCurrentTool(
      {
        ...initialPenState,
        currentTool: "pen",
        inProgressStroke: {
          surface_id: "surf-1",
          points: [{ u: 0.1, v: 0.1, p: 0.5, t: 0 }],
        },
      },
      "note",
    );
    expect(after.currentTool).toBe("note");
    expect(after.inProgressStroke).toBeNull();
  });

  it("beginStroke captures the first point on a Surface", () => {
    const after = beginStroke(
      { ...initialPenState, currentTool: "pen" },
      "surf-1",
      { u: 0.2, v: 0.3, p: 0.7, t: 0 },
    );
    expect(after.inProgressStroke).not.toBeNull();
    expect(after.inProgressStroke!.surface_id).toBe("surf-1");
    expect(after.inProgressStroke!.points).toEqual([
      { u: 0.2, v: 0.3, p: 0.7, t: 0 },
    ]);
  });

  it("beginStroke is a no-op when the current tool isn't 'pen'", () => {
    const after = beginStroke(initialPenState, "surf-1", {
      u: 0.5,
      v: 0.5,
      p: 0.5,
      t: 0,
    });
    expect(after.inProgressStroke).toBeNull();
  });

  it("appendStrokePoint appends to the active Stroke", () => {
    const started = beginStroke(
      { ...initialPenState, currentTool: "pen" },
      "surf-1",
      { u: 0.1, v: 0.1, p: 0.5, t: 0 },
    );
    const next = appendStrokePoint(started, {
      u: 0.2,
      v: 0.2,
      p: 0.5,
      t: 16,
    });
    expect(next.inProgressStroke!.points).toEqual([
      { u: 0.1, v: 0.1, p: 0.5, t: 0 },
      { u: 0.2, v: 0.2, p: 0.5, t: 16 },
    ]);
  });

  it("appendStrokePoint is a no-op when no Stroke is in progress", () => {
    const next = appendStrokePoint(initialPenState, {
      u: 0.5,
      v: 0.5,
      p: 0.5,
      t: 0,
    });
    expect(next).toBe(initialPenState);
  });

  it("endStroke returns the committable Stroke shape and clears the in-progress state", () => {
    const state = {
      ...initialPenState,
      currentTool: "pen" as const,
      pen: { color_id: "blush", width_id: "medium" as const },
      inProgressStroke: {
        surface_id: "surf-1",
        points: [
          { u: 0.1, v: 0.1, p: 0.5, t: 0 },
          { u: 0.2, v: 0.2, p: 0.5, t: 16 },
        ],
      },
    };
    const { next, committed } = endStroke(state, { index: 0 });
    expect(next.inProgressStroke).toBeNull();
    expect(committed).not.toBeNull();
    expect(committed!.surface_id).toBe("surf-1");
    expect(committed!.color_id).toBe("blush");
    expect(committed!.width_id).toBe("medium");
    expect(committed!.index).toBe(0);
    expect(committed!.points).toHaveLength(2);
  });

  it("endStroke drops a Stroke with fewer than 2 points (a tap, not a Stroke)", () => {
    const state = {
      ...initialPenState,
      currentTool: "pen" as const,
      inProgressStroke: {
        surface_id: "surf-1",
        points: [{ u: 0.1, v: 0.1, p: 0.5, t: 0 }],
      },
    };
    const { next, committed } = endStroke(state, { index: 0 });
    expect(committed).toBeNull();
    expect(next.inProgressStroke).toBeNull();
  });
});
