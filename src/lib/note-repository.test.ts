import { describe, it, expect } from "vitest";
import { InMemoryCanvasRepository } from "./in-memory-canvas-repository";

describe("CanvasRepository — Note CRUD on v2 shape (issue #15)", () => {
  it("insertNote stores a Note at (surface_id, u, v) and listNotes returns it by Room", async () => {
    const repo = new InMemoryCanvasRepository();
    const room = await repo.insertRoom("user-1", "Room");
    const surfaces = await repo.listSurfaces(room.id);
    const wallNorth = surfaces.find((s) => s.kind === "wall_north")!;

    const inserted = await repo.insertNote({
      surface_id: wallNorth.id,
      owner_id: "user-1",
      u: 0.5,
      v: 0.5,
      width_cm: 12,
      height_cm: 9,
      body: "hello",
      color_id: "warm-white",
    });
    expect(inserted.surface_id).toBe(wallNorth.id);
    expect(inserted.body).toBe("hello");

    const fromRoom = await repo.listNotes(room.id);
    expect(fromRoom).toHaveLength(1);
    expect(fromRoom[0].id).toBe(inserted.id);
  });

  it("listNotes(roomId) returns only that Room's Notes, sorted by created_at ascending (oldest first → newest stacks on top)", async () => {
    const repo = new InMemoryCanvasRepository();
    const a = await repo.insertRoom("user-1", "A");
    const b = await repo.insertRoom("user-1", "B");
    const aSurfaces = await repo.listSurfaces(a.id);
    const bSurfaces = await repo.listSurfaces(b.id);

    const n1 = await repo.insertNote({
      surface_id: aSurfaces[0].id,
      owner_id: "user-1",
      u: 0.5,
      v: 0.5,
      width_cm: 12,
      height_cm: 9,
      body: "in A",
      color_id: "warm-white",
    });
    await new Promise((r) => setTimeout(r, 5));
    const n2 = await repo.insertNote({
      surface_id: aSurfaces[0].id,
      owner_id: "user-1",
      u: 0.5,
      v: 0.5,
      width_cm: 12,
      height_cm: 9,
      body: "later in A",
      color_id: "warm-white",
    });
    await repo.insertNote({
      surface_id: bSurfaces[0].id,
      owner_id: "user-1",
      u: 0.5,
      v: 0.5,
      width_cm: 12,
      height_cm: 9,
      body: "in B",
      color_id: "warm-white",
    });

    const inA = await repo.listNotes(a.id);
    expect(inA.map((n) => n.id)).toEqual([n1.id, n2.id]);
  });

  it("updateNotePin moves a Note to a different Surface and (u, v)", async () => {
    const repo = new InMemoryCanvasRepository();
    const room = await repo.insertRoom("user-1", "Room");
    const surfaces = await repo.listSurfaces(room.id);
    const wallNorth = surfaces.find((s) => s.kind === "wall_north")!;
    const wallEast = surfaces.find((s) => s.kind === "wall_east")!;

    const n = await repo.insertNote({
      surface_id: wallNorth.id,
      owner_id: "user-1",
      u: 0.5,
      v: 0.5,
      width_cm: 12,
      height_cm: 9,
      body: "",
      color_id: "warm-white",
    });

    const moved = await repo.updateNotePin(n.id, {
      surface_id: wallEast.id,
      u: 0.2,
      v: 0.8,
    });
    expect(moved.surface_id).toBe(wallEast.id);
    expect(moved.u).toBeCloseTo(0.2, 5);
    expect(moved.v).toBeCloseTo(0.8, 5);
  });

  it("updateNoteBody replaces the body, leaving placement untouched", async () => {
    const repo = new InMemoryCanvasRepository();
    const room = await repo.insertRoom("user-1", "Room");
    const surfaces = await repo.listSurfaces(room.id);
    const n = await repo.insertNote({
      surface_id: surfaces[0].id,
      owner_id: "user-1",
      u: 0.3,
      v: 0.4,
      width_cm: 12,
      height_cm: 9,
      body: "old",
      color_id: "warm-white",
    });
    const updated = await repo.updateNoteBody(n.id, "new");
    expect(updated.body).toBe("new");
    expect(updated.surface_id).toBe(n.surface_id);
    expect(updated.u).toBeCloseTo(0.3, 5);
    expect(updated.v).toBeCloseTo(0.4, 5);
  });
});
