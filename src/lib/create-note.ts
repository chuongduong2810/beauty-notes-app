import type { CanvasRepository, NoteRow } from "./canvas-repository";
import { DEFAULT_PALETTE_COLOR_ID } from "./palette";

// Default size for a freshly-created Note, in screen pixels at 1× zoom.
// The PRD §5.3 resize range is ~120–800 px, so this sits a notch above
// the floor — comfortably readable without dominating the viewport.
const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 120;

export type CreateNoteAtInput = {
  canvasId: string;
  ownerId: string;
  x: number;
  y: number;
};

/**
 * Insert a new Note at the given world coordinates with PRD defaults
 * (mid depth, default palette colour, empty body). Used by the
 * double-click-empty-Canvas gesture.
 */
export function createNoteAt(
  repo: CanvasRepository,
  { canvasId, ownerId, x, y }: CreateNoteAtInput,
): Promise<NoteRow> {
  return repo.insertNote({
    canvas_id: canvasId,
    owner_id: ownerId,
    x,
    y,
    depth: "mid",
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    body: "",
    color_id: DEFAULT_PALETTE_COLOR_ID,
  });
}
