/**
 * Abstract repository surface for Room + Surface persistence (v2,
 * ADR-0008). Implementations live next to this file: an in-memory one
 * used in tests, and a Supabase-backed one wired up in main.
 *
 * The legacy name `CanvasRepository` is preserved to minimise diff
 * surface — v1 has been abandoned (ADR-0011) so "Canvas" no longer
 * refers to anything in the codebase. A future rename to `Repository`
 * is a trivial cleanup, deliberately out of scope for issue #21.
 */

import type { Room, Surface, Note, NewNote } from "./room";

export interface CanvasRepository {
  /** Insert a Room and seed its six Surfaces. */
  insertRoom(owner_id: string, name: string): Promise<Room>;
  /** List the User's Rooms, most-recently-updated first. */
  listRooms(userId: string): Promise<Room[]>;
  /** List the six Surfaces of a Room. */
  listSurfaces(roomId: string): Promise<Surface[]>;
  /**
   * Persist the orbit camera pose for a Room (ADR-0009). Called from a
   * debounced save after the user stops rotating / zooming.
   */
  updateRoomCamera(
    id: string,
    pose: { yaw: number; pitch: number; distance: number },
  ): Promise<Room>;

  /** List every Note Pinned to any Surface of the Room, oldest first. */
  listNotes(roomId: string): Promise<Note[]>;
  /** Insert a Note Pinned at `(surface_id, u, v)`. */
  insertNote(note: NewNote): Promise<Note>;
  /** Re-Pin a Note to a (possibly different) Surface at `(u, v)`. */
  updateNotePin(
    id: string,
    pin: { surface_id: string; u: number; v: number },
  ): Promise<Note>;
  /** Replace a Note's body text. Debounced commit from Focus editing. */
  updateNoteBody(id: string, body: string): Promise<Note>;
  /** Permanently remove a Note. Called when the user drops it on the trash. */
  deleteNote(id: string): Promise<void>;
}
