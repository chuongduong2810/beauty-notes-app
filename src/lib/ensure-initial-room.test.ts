import { describe, it, expect } from "vitest";
import { InMemoryCanvasRepository } from "./in-memory-canvas-repository";
import { ensureInitialRoom } from "./ensure-initial-room";

describe("ensureInitialRoom — idempotent first-run Room bootstrap (issue #13)", () => {
  it("creates a Room with six seeded Surfaces, no Notes, and no Annotations when the user has none", async () => {
    const repo = new InMemoryCanvasRepository();
    const { room, rooms, surfaces, notes, annotations } = await ensureInitialRoom(
      repo,
      "user-1",
    );

    expect(room.owner_id).toBe("user-1");
    expect(room.name).toBe("Untitled");
    expect(rooms).toHaveLength(1);
    expect(rooms[0].id).toBe(room.id);
    expect(surfaces).toHaveLength(6);
    expect(notes).toEqual([]);
    expect(annotations).toEqual([]);
    expect(repo.insertRoomCalls).toBe(1);
  });

  it("loads the preferredRoomId when the user owns it (issue #22 — bookmarkable /room/:id)", async () => {
    const repo = new InMemoryCanvasRepository();
    const first = await repo.insertRoom("user-1", "First");
    await new Promise((r) => setTimeout(r, 5));
    const second = await repo.insertRoom("user-1", "Second");

    // Without preferredRoomId, most-recent wins.
    const noPref = await ensureInitialRoom(repo, "user-1");
    expect(noPref.room.id).toBe(second.id);

    // With preferredRoomId, the requested Room wins.
    const withPref = await ensureInitialRoom(repo, "user-1", first.id);
    expect(withPref.room.id).toBe(first.id);
    expect(withPref.rooms.map((r) => r.id)).toContain(first.id);
    expect(withPref.rooms.map((r) => r.id)).toContain(second.id);
  });

  it("falls back to the most-recent Room when preferredRoomId doesn't match anything the user owns", async () => {
    const repo = new InMemoryCanvasRepository();
    const owned = await repo.insertRoom("user-1", "Owned");

    const result = await ensureInitialRoom(repo, "user-1", "no-such-room");
    expect(result.room.id).toBe(owned.id);
    expect(repo.insertRoomCalls).toBe(1); // no new Room created
  });

  it("returns the existing most-recent Room with its Surfaces, Notes, and Annotations — does not create another", async () => {
    const repo = new InMemoryCanvasRepository();
    const first = await repo.insertRoom("user-1", "Existing");
    const surfaces = await repo.listSurfaces(first.id);
    const seeded = await repo.insertNote({
      surface_id: surfaces[0].id,
      owner_id: "user-1",
      u: 0.5,
      v: 0.5,
      width_cm: 12,
      height_cm: 9,
      body: "welcome",
      color_id: "warm-white",
      bookmarked: false,
    });
    const ann = await repo.insertAnnotation({
      surface_id: surfaces[0].id,
      owner_id: "user-1",
    });
    await repo.insertStroke(ann.id, {
      points: [
        { u: 0.1, v: 0.1, p: 0.5, t: 0 },
        { u: 0.2, v: 0.2, p: 0.5, t: 16 },
      ],
      color_id: "blush",
      width_id: "fine",
      index: 0,
    });

    const result = await ensureInitialRoom(repo, "user-1");

    expect(result.room.id).toBe(first.id);
    expect(result.rooms.map((r) => r.id)).toEqual([first.id]);
    expect(result.surfaces).toHaveLength(6);
    expect(result.notes.map((n) => n.id)).toEqual([seeded.id]);
    expect(result.annotations.map((a) => a.id)).toEqual([ann.id]);
    expect(result.annotations[0].strokes).toHaveLength(1);
    expect(repo.insertRoomCalls).toBe(1); // not bumped again
  });
});
