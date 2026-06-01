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
import type { Annotation, NewStroke, Stroke } from "./stroke";

export interface CanvasRepository {
  /** Insert a Room and seed its six Surfaces. */
  insertRoom(owner_id: string, name: string): Promise<Room>;
  /** List the User's Rooms, most-recently-updated first. */
  listRooms(userId: string): Promise<Room[]>;
  /**
   * Hard-delete every Room owned by `ownerId`, cascading to its Surfaces,
   * Notes, Annotations, and Strokes (ADR-0019). Used by the consented
   * guest-cleanup step of Restore (issue #84): on restore the device leaves
   * its anonymous identity, so the guest's Rooms can no longer follow it and
   * are eagerly removed while still anonymous (RLS permits the anon User to
   * delete only its own rows).
   */
  deleteRoomsForOwner(ownerId: string): Promise<void>;
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
  /** Set a Note's Bookmark ("keep handy") flag (issue #55). */
  setNoteBookmark(id: string, bookmarked: boolean): Promise<Note>;
  /** Permanently remove a Note. Called when the user drops it on the trash. */
  deleteNote(id: string): Promise<void>;

  /**
   * List every Annotation on any Surface of the Room, with its Strokes
   * pre-sorted by `index` ascending so the renderer draws older Strokes
   * first (ADR-0014, issue #35).
   */
  listAnnotations(roomId: string): Promise<Annotation[]>;
  /** Create an empty Annotation owned by `owner_id` on a Surface. */
  insertAnnotation(input: {
    surface_id: string;
    owner_id: string;
  }): Promise<Annotation>;
  /** Append a Stroke to an Annotation. */
  insertStroke(annotationId: string, stroke: NewStroke): Promise<Stroke>;
  /** Remove a single Stroke (used by the Eraser tool). */
  deleteStroke(id: string): Promise<void>;
}
