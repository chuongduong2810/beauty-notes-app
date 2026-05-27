import { describe, it, expect } from "vitest";
import { InMemoryCanvasRepository } from "./in-memory-canvas-repository";

describe("CanvasRepository.updateRoomCamera — persist orbit camera state (issue #14)", () => {
  it("updates yaw + pitch + distance and bumps updated_at", async () => {
    const repo = new InMemoryCanvasRepository();
    const room = await repo.insertRoom("user-1", "Untitled");
    const before = room.updated_at;

    // Small delay so updated_at can advance.
    await new Promise((r) => setTimeout(r, 5));

    const updated = await repo.updateRoomCamera(room.id, {
      yaw: 1.2,
      pitch: 0.6,
      distance: 2.1,
    });

    expect(updated.camera_yaw).toBeCloseTo(1.2, 5);
    expect(updated.camera_pitch).toBeCloseTo(0.6, 5);
    expect(updated.camera_distance).toBeCloseTo(2.1, 5);
    expect(updated.id).toBe(room.id);
    expect(updated.updated_at > before).toBe(true);
  });
});
