/**
 * Abstract repository surface for Canvas + Note persistence (v1) and
 * Room + Surface persistence (v2, ADR-0008). Implementations live next
 * to this file: an in-memory one used in tests, and a Supabase-backed
 * one wired up in main.
 *
 * The v1 Canvas/Note methods are kept until the "drop v1" issue lands
 * (#21) so the v1 codepaths still compile during the transition.
 */

import type { Room, Surface } from "./room";

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
  /**
   * Delete every Note whose id is in `ids` in a single batched operation.
   * Returns the deleted rows so callers (e.g. the undo stack) can restore
   * them.
   */
  deleteNotes(ids: readonly string[]): Promise<NoteRow[]>;
  /**
   * Commit a batch of `{ id, x, y }` position updates in a single
   * round-trip. Returns the updated rows (order is the database's, not
   * necessarily the input order — index by id, not by position).
   */
  updateNotePositions(
    updates: ReadonlyArray<{ id: string; x: number; y: number }>,
  ): Promise<NoteRow[]>;

  // --- v2 (ADR-0008 / ADR-0010): Room + Surface ----------------------
  /** Insert a Room and seed its six Surfaces. */
  insertRoom(owner_id: string, name: string): Promise<Room>;
  /** List the User's Rooms, most-recently-updated first. */
  listRooms(userId: string): Promise<Room[]>;
  /** List the six Surfaces of a Room. */
  listSurfaces(roomId: string): Promise<Surface[]>;
}
