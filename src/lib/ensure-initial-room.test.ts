import { describe, it, expect } from "vitest";
import { InMemoryCanvasRepository } from "./in-memory-canvas-repository";
import { ensureInitialRoom } from "./ensure-initial-room";

describe("ensureInitialRoom — idempotent first-run Room bootstrap (issue #13)", () => {
  it("creates a Room with six seeded Surfaces and no Notes when the user has none", async () => {
    const repo = new InMemoryCanvasRepository();
    const { room, surfaces, notes } = await ensureInitialRoom(repo, "user-1");

    expect(room.owner_id).toBe("user-1");
    expect(room.name).toBe("Untitled");
    expect(surfaces).toHaveLength(6);
    expect(notes).toEqual([]);
    expect(repo.insertRoomCalls).toBe(1);
  });

  it("returns the existing most-recent Room with its Surfaces and Notes — does not create another", async () => {
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
    });

    const result = await ensureInitialRoom(repo, "user-1");

    expect(result.room.id).toBe(first.id);
    expect(result.surfaces).toHaveLength(6);
    expect(result.notes.map((n) => n.id)).toEqual([seeded.id]);
    expect(repo.insertRoomCalls).toBe(1); // not bumped again
  });
});
