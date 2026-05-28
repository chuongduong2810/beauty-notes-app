/**
 * Pure state machine for the Pen tool's in-progress Stroke (issue #35,
 * ADR-0014). Lives outside the Zustand store so the transitions are
 * trivially testable in isolation.
 *
 * Lifecycle:
 *   pen-down on a Surface →  beginStroke(state, surface_id, point)
 *   pointer-move          →  appendStrokePoint(state, point)
 *   pen-up                →  endStroke(state, { index })
 *                            → returns the committable Stroke shape
 *                              (or null if the gesture was just a tap)
 *
 * The reducer also owns the current tool mode and the pen's
 * `(color_id, width_id)` so that switching tools mid-Stroke cancels it
 * cleanly without partial state lingering.
 */

import { DEFAULT_NOTE_COLOR_ID } from "./palette";
import type { NewStroke, StrokePoint, StrokeWidthId } from "./stroke";

export type Tool = "note" | "pen" | "eraser";

export type InProgressStroke = {
  surface_id: string;
  points: StrokePoint[];
};

export type PenState = {
  currentTool: Tool;
  pen: { color_id: string; width_id: StrokeWidthId };
  inProgressStroke: InProgressStroke | null;
};

export const initialPenState: PenState = {
  currentTool: "note",
  pen: { color_id: DEFAULT_NOTE_COLOR_ID, width_id: "fine" },
  inProgressStroke: null,
};

export function setCurrentTool(state: PenState, tool: Tool): PenState {
  return { ...state, currentTool: tool, inProgressStroke: null };
}

export function beginStroke(
  state: PenState,
  surface_id: string,
  point: StrokePoint,
): PenState {
  if (state.currentTool !== "pen") return state;
  return {
    ...state,
    inProgressStroke: { surface_id, points: [point] },
  };
}

export function appendStrokePoint(
  state: PenState,
  point: StrokePoint,
): PenState {
  if (!state.inProgressStroke) return state;
  return {
    ...state,
    inProgressStroke: {
      ...state.inProgressStroke,
      points: [...state.inProgressStroke.points, point],
    },
  };
}

export function endStroke(
  state: PenState,
  meta: { index: number },
): { next: PenState; committed: (NewStroke & { surface_id: string }) | null } {
  const ip = state.inProgressStroke;
  const next: PenState = { ...state, inProgressStroke: null };
  // Single-point gestures are taps — discard so a stray click on a wall
  // in Pen mode doesn't leave a zero-length blob.
  if (!ip || ip.points.length < 2) return { next, committed: null };
  return {
    next,
    committed: {
      surface_id: ip.surface_id,
      points: ip.points,
      color_id: state.pen.color_id,
      width_id: state.pen.width_id,
      index: meta.index,
    },
  };
}
