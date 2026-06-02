import { describe, it, expect } from "vitest";
import { InMemoryCanvasRepository } from "./in-memory-canvas-repository";

describe("CanvasRepository.updateRoomName — persist editable Room name (issue #133)", () => {
  it("updates name and bumps updated_at", async () => {
    const repo = new InMemoryCanvasRepository();
    const room = await repo.insertRoom("user-1", "Untitled");
    const before = room.updated_at;

    // Small delay so updated_at can advance.
    await new Promise((r) => setTimeout(r, 5));

    const updated = await repo.updateRoomName(room.id, "Studio");

    expect(updated.name).toBe("Studio");
    expect(updated.id).toBe(room.id);
    expect(updated.updated_at > before).toBe(true);
  });

  it("throws when the Room id is unknown", async () => {
    const repo = new InMemoryCanvasRepository();
    await expect(repo.updateRoomName("missing", "x")).rejects.toThrow(
      "updateRoomName: no Room with id missing",
    );
  });
});
