import type { CanvasRepository } from "./canvas-repository";
import type { Room, Surface, Note } from "./room";

/**
 * Idempotent first-run bootstrap for v2 (ADR-0008). Called after
 * anonymous sign-in.
 *
 * If the user already owns at least one Room, returns the most recently
 * updated one along with its six Surfaces and the Notes currently Pinned
 * to those Surfaces. Otherwise creates an "Untitled" Room (which seeds
 * the six default Surfaces server-side).
 */
export async function ensureInitialRoom(
  repo: CanvasRepository,
  userId: string,
): Promise<{ room: Room; surfaces: Surface[]; notes: Note[] }> {
  const existing = await repo.listRooms(userId);
  if (existing.length > 0) {
    const room = existing[0];
    const [surfaces, notes] = await Promise.all([
      repo.listSurfaces(room.id),
      repo.listNotes(room.id),
    ]);
    return { room, surfaces, notes };
  }

  const room = await repo.insertRoom(userId, "Untitled");
  const surfaces = await repo.listSurfaces(room.id);
  return { room, surfaces, notes: [] };
}
