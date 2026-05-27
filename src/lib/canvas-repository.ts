/**
 * Abstract repository surface for Canvas + Note persistence.
 *
 * Lets `ensureInitialCanvas` stay testable without depending on Supabase's
 * chainable query builder. Implementations live next to this file: an
 * in-memory one used in tests, and a Supabase-backed one wired up in main.
 */

export type Depth = "back" | "mid" | "front";

export type CanvasRow = {
  id: string;
  owner_id: string;
  name: string;
  camera_x: number;
  camera_y: number;
  camera_z: number;
  camera_zoom: number;
  camera_focused_depth: Depth;
  created_at: string;
  updated_at: string;
};

export type NoteRow = {
  id: string;
  canvas_id: string;
  owner_id: string;
  x: number;
  y: number;
  depth: Depth;
  width: number;
  height: number;
  body: string;
  color_id: string;
  created_at: string;
  updated_at: string;
};

export type NewNote = Omit<NoteRow, "id" | "created_at" | "updated_at">;

export interface CanvasRepository {
  listCanvases(userId: string): Promise<CanvasRow[]>;
  insertCanvas(owner_id: string, name: string): Promise<CanvasRow>;
  listNotes(canvas_id: string): Promise<NoteRow[]>;
  insertNote(note: NewNote): Promise<NoteRow>;
}
