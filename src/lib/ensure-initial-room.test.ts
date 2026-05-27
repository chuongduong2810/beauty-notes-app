import { describe, it, expect } from "vitest";
import { InMemoryCanvasRepository } from "./in-memory-canvas-repository";
import { ensureInitialRoom } from "./ensure-initial-room";

describe("ensureInitialRoom — idempotent first-run Room bootstrap (issue #13)", () => {
  it("creates a Room with six seeded Surfaces when the user has none", async () => {
    const repo = new InMemoryCanvasRepository();
    const { room, surfaces } = await ensureInitialRoom(repo, "user-1");

    expect(room.owner_id).toBe("user-1");
    expect(room.name).toBe("Untitled");
    expect(surfaces).toHaveLength(6);
    expect(repo.insertRoomCalls).toBe(1);
  });

  it("returns the existing most-recent Room when the user already has one — does not create another", async () => {
    const repo = new InMemoryCanvasRepository();
    const first = await repo.insertRoom("user-1", "Existing");
    const { room, surfaces } = await ensureInitialRoom(repo, "user-1");

    expect(room.id).toBe(first.id);
    expect(surfaces).toHaveLength(6);
    expect(repo.insertRoomCalls).toBe(1); // not bumped again
  });
});
