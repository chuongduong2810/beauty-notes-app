import type { CanvasRepository } from "./canvas-repository";
import type { Room, Surface } from "./room";

/**
 * Idempotent first-run bootstrap for v2 (ADR-0008). Called after
 * anonymous sign-in.
 *
 * If the user already owns at least one Room, returns the most recently
 * updated one along with its six Surfaces. Otherwise creates an
 * "Untitled" Room (which seeds the six default Surfaces server-side).
 */
export async function ensureInitialRoom(
  repo: CanvasRepository,
  userId: string,
): Promise<{ room: Room; surfaces: Surface[] }> {
  const existing = await repo.listRooms(userId);
  if (existing.length > 0) {
    const room = existing[0];
    const surfaces = await repo.listSurfaces(room.id);
    return { room, surfaces };
  }

  const room = await repo.insertRoom(userId, "Untitled");
  const surfaces = await repo.listSurfaces(room.id);
  return { room, surfaces };
}
