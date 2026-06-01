import { describe, it, expect } from "vitest";
import { InMemoryCanvasRepository } from "./in-memory-canvas-repository";

/**
 * Seed a full Room graph (Room → Surfaces → a Note + an Annotation with a
 * Stroke) for `owner` and return the created Room's id. Used to verify the
 * cascade of `deleteRoomsForOwner` (issue #84, ADR-0019).
 */
async function seedRoomGraph(
  repo: InMemoryCanvasRepository,
  owner: string,
): Promise<string> {
  const room = await repo.insertRoom(owner, `${owner}'s Room`);
  const surfaces = await repo.listSurfaces(room.id);
  await repo.insertNote({
    surface_id: surfaces[0].id,
    owner_id: owner,
    u: 0.5,
    v: 0.5,
    width_cm: 12,
    height_cm: 9,
    body: "a note",
    color_id: "warm-white",
    bookmarked: false,
  });
  const ann = await repo.insertAnnotation({
    surface_id: surfaces[0].id,
    owner_id: owner,
  });
  await repo.insertStroke(ann.id, {
    points: [{ u: 0.1, v: 0.2, p: 0.5, t: 0 }],
    color_id: "paper",
    width_id: "fine",
    index: 0,
  });
  return room.id;
}

describe("CanvasRepository — deleteRoomsForOwner (issue #84, ADR-0019)", () => {
  it("removes only the target owner's Rooms and cascades to their Surfaces/Notes/Annotations/Strokes, leaving other owners intact", async () => {
    const repo = new InMemoryCanvasRepository();
    const roomA = await seedRoomGraph(repo, "owner-a");
    const roomB = await seedRoomGraph(repo, "owner-b");

    await repo.deleteRoomsForOwner("owner-a");

    // Owner A's whole graph is gone.
    expect(await repo.listRooms("owner-a")).toEqual([]);
    expect(await repo.listSurfaces(roomA)).toEqual([]);
    expect(await repo.listNotes(roomA)).toEqual([]);
    expect(await repo.listAnnotations(roomA)).toEqual([]);

    // Owner B is untouched: Room, six Surfaces, the Note, and the
    // Annotation with its Stroke all survive.
    const bRooms = await repo.listRooms("owner-b");
    expect(bRooms.map((r) => r.id)).toEqual([roomB]);
    expect(await repo.listSurfaces(roomB)).toHaveLength(6);
    expect(await repo.listNotes(roomB)).toHaveLength(1);
    const bAnnotations = await repo.listAnnotations(roomB);
    expect(bAnnotations).toHaveLength(1);
    expect(bAnnotations[0].strokes).toHaveLength(1);

    // The internal stroke/annotation collections were pruned for A only.
    expect(repo.strokes).toHaveLength(1);
    expect(repo.annotations).toHaveLength(1);
  });
});
