import type { CanvasRepository, NoteRow } from "./canvas-repository";
import { DEFAULT_PALETTE_COLOR_ID } from "./palette";

const DEFAULT_WIDTH = 240;
const DEFAULT_HEIGHT = 160;

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
