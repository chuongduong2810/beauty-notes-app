import { describe, expect, it } from "vitest";
import { InMemoryCanvasRepository } from "./in-memory-canvas-repository";
import { loadRoom } from "./load-room";

describe("loadRoom — fetch Room + Surfaces + Notes + Annotations (issue #22)", () => {
  it("returns the full Room bundle for an existing Room", async () => {
    const repo = new InMemoryCanvasRepository();
    const room = await repo.insertRoom("user-1", "Room A");
    const surfaces = await repo.listSurfaces(room.id);
    await repo.insertNote({
      surface_id: surfaces[0].id,
      owner_id: "user-1",
      u: 0.5,
      v: 0.5,
      width_cm: 12,
      height_cm: 9,
      body: "hi",
      color_id: "paper",
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

    const bundle = await loadRoom(repo, room.id);

    expect(bundle).not.toBeNull();
    expect(bundle!.room.id).toBe(room.id);
    expect(bundle!.surfaces).toHaveLength(6);
    expect(bundle!.notes).toHaveLength(1);
    expect(bundle!.annotations).toHaveLength(1);
    expect(bundle!.annotations[0].strokes).toHaveLength(1);
  });

  it("returns null when the Room id does not exist", async () => {
    const repo = new InMemoryCanvasRepository();
    await repo.insertRoom("user-1", "Room A");
    expect(await loadRoom(repo, "no-such-room")).toBeNull();
  });

  it("loads only data for the requested Room, not data from other Rooms", async () => {
    const repo = new InMemoryCanvasRepository();
    const roomA = await repo.insertRoom("user-1", "A");
    const roomB = await repo.insertRoom("user-1", "B");
    const sA = await repo.listSurfaces(roomA.id);
    const sB = await repo.listSurfaces(roomB.id);
    await repo.insertNote({
      surface_id: sA[0].id,
      owner_id: "user-1",
      u: 0.5,
      v: 0.5,
      width_cm: 12,
      height_cm: 9,
      body: "in A",
      color_id: "paper",
    });
    await repo.insertNote({
      surface_id: sB[0].id,
      owner_id: "user-1",
      u: 0.5,
      v: 0.5,
      width_cm: 12,
      height_cm: 9,
      body: "in B",
      color_id: "paper",
    });

    const bundle = await loadRoom(repo, roomB.id);
    expect(bundle!.notes).toHaveLength(1);
    expect(bundle!.notes[0].body).toBe("in B");
  });
});
