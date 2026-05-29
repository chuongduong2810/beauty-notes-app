import type { CanvasRepository } from "./canvas-repository";
import type { Room, Surface, Note } from "./room";
import type { Annotation } from "./stroke";

/**
 * Idempotent first-run bootstrap for v2 (ADR-0008). Called after
 * anonymous sign-in.
 *
 * If `preferredRoomId` is supplied and the User owns a Room with
 * that id, return it (issue #22 — supports bookmarkable `/room/:id`).
 * Otherwise return the most-recently-updated Room. If the User owns
 * no Rooms, create an "Untitled" one (which seeds the six default
 * Surfaces server-side).
 *
 * Also returns the full `rooms[]` list so the App can populate the
 * RoomPicker dropdown without a follow-up listRooms call.
 */
export async function ensureInitialRoom(
  repo: CanvasRepository,
  userId: string,
  preferredRoomId?: string,
): Promise<{
  room: Room;
  rooms: Room[];
  surfaces: Surface[];
  notes: Note[];
  annotations: Annotation[];
}> {
  let rooms = await repo.listRooms(userId);

  // Pick: requested id if the user owns it, otherwise most-recent.
  let target: Room | undefined;
  if (preferredRoomId) {
    target = rooms.find((r) => r.id === preferredRoomId);
  }
  if (!target && rooms.length > 0) {
    target = rooms[0];
  }

  if (!target) {
    // First run — seed a default Room.
    target = await repo.insertRoom(userId, "Untitled");
    rooms = await repo.listRooms(userId);
  }

  const [surfaces, notes, annotations] = await Promise.all([
    repo.listSurfaces(target.id),
    repo.listNotes(target.id),
    repo.listAnnotations(target.id),
  ]);
  return { room: target, rooms, surfaces, notes, annotations };
}
