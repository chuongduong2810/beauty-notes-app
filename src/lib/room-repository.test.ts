import { describe, it, expect } from "vitest";
import { InMemoryCanvasRepository } from "./in-memory-canvas-repository";
import { SURFACE_KINDS } from "./room";

describe("CanvasRepository — Room + Surface methods (issue #13)", () => {
  it("insertRoom seeds exactly six Surfaces (one per kind), all defaulted to warm-white", async () => {
    const repo = new InMemoryCanvasRepository();
    const room = await repo.insertRoom("user-1", "My Room");

    expect(room.owner_id).toBe("user-1");
    expect(room.name).toBe("My Room");

    const surfaces = await repo.listSurfaces(room.id);
    expect(surfaces).toHaveLength(6);
    expect(surfaces.map((s) => s.kind).sort()).toEqual([...SURFACE_KINDS].sort());
    expect(surfaces.every((s) => s.color_id === "warm-white")).toBe(true);
    expect(surfaces.every((s) => s.room_id === room.id)).toBe(true);
    expect(surfaces.every((s) => s.owner_id === "user-1")).toBe(true);
  });

  it("listRooms returns the user's Rooms most-recently-updated first", async () => {
    const repo = new InMemoryCanvasRepository();
    const a = await repo.insertRoom("user-1", "Room A");
    await new Promise((r) => setTimeout(r, 5));
    const b = await repo.insertRoom("user-1", "Room B");
    await repo.insertRoom("user-2", "Foreign Room");

    const mine = await repo.listRooms("user-1");
    expect(mine.map((r) => r.id)).toEqual([b.id, a.id]);
  });
});
