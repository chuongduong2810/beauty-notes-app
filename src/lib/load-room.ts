import type { CanvasRepository } from "./canvas-repository";
import type { Note, Room, Surface } from "./room";
import type { Annotation } from "./stroke";

/**
 * The full payload an App needs to render a Room: its metadata, the
 * six Surfaces, every Note Pinned to those Surfaces, and every
 * Annotation drawn on them.
 */
export type RoomBundle = {
  room: Room;
  surfaces: Surface[];
  notes: Note[];
  annotations: Annotation[];
};

/**
 * Fetch a Room and its contents by id (issue #22). Returns null when
 * the Room doesn't exist (or RLS denies access in the Supabase impl).
 *
 * The `CanvasRepository` interface doesn't (yet) expose a one-shot
 * "get Room by id" — Surfaces always carry the owner_id, so we list
 * Surfaces first (cheap; cascades to empty if the Room doesn't exist),
 * then resolve the parent Room via the user's room list. Notes and
 * Annotations are fetched in parallel because they're independent.
 */
export async function loadRoom(
  repo: CanvasRepository,
  roomId: string,
): Promise<RoomBundle | null> {
  const surfaces = await repo.listSurfaces(roomId);
  if (surfaces.length === 0) return null;
  const ownerId = surfaces[0].owner_id;
  const rooms = await repo.listRooms(ownerId);
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return null;
  const [notes, annotations] = await Promise.all([
    repo.listNotes(roomId),
    repo.listAnnotations(roomId),
  ]);
  return { room, surfaces, notes, annotations };
}
