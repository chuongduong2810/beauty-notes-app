import type {
  CanvasRepository,
  CanvasRow,
  NoteRow,
} from "./canvas-repository";
import { DEFAULT_PALETTE_COLOR_ID } from "./palette";

const SEED_NOTE_BODY = "Welcome to Beauty Notes";
// Matches the new-Note default in create-note.ts; the PRD §5.3 resize
// range (~120–800 px) leaves plenty of room for the user to grow it.
const SEED_NOTE_WIDTH = 160;
const SEED_NOTE_HEIGHT = 120;

/**
 * Idempotent first-run bootstrap. Called after anonymous sign-in.
 *
 * If the user already owns at least one Canvas, returns the most recently
 * updated one along with its Notes. Otherwise creates an "Untitled" Canvas
 * and a single seed Note placed at the origin in the mid depth layer.
 */
export async function ensureInitialCanvas(
  repo: CanvasRepository,
  userId: string,
): Promise<{ canvas: CanvasRow; notes: NoteRow[] }> {
  const existing = await repo.listCanvases(userId);
  if (existing.length > 0) {
    const canvas = existing[0];
    const notes = await repo.listNotes(canvas.id);
    return { canvas, notes };
  }

  const canvas = await repo.insertCanvas(userId, "Untitled");
  const note = await repo.insertNote({
    canvas_id: canvas.id,
    owner_id: userId,
    x: 0,
    y: 0,
    depth: "mid",
    width: SEED_NOTE_WIDTH,
    height: SEED_NOTE_HEIGHT,
    body: SEED_NOTE_BODY,
    color_id: DEFAULT_PALETTE_COLOR_ID,
  });

  return { canvas, notes: [note] };
}
