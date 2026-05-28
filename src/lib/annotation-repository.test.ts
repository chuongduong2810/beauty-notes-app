import { describe, expect, it } from "vitest";
import { InMemoryCanvasRepository } from "./in-memory-canvas-repository";

describe("CanvasRepository — Annotation + Stroke CRUD (issue #35, ADR-0014)", () => {
  it("insertAnnotation creates an empty Annotation on a Surface, owned by the user", async () => {
    const repo = new InMemoryCanvasRepository();
    const room = await repo.insertRoom("user-1", "Room");
    const surfaces = await repo.listSurfaces(room.id);
    const wallNorth = surfaces.find((s) => s.kind === "wall_north")!;

    const ann = await repo.insertAnnotation({
      surface_id: wallNorth.id,
      owner_id: "user-1",
    });

    expect(ann.id).toBeTruthy();
    expect(ann.surface_id).toBe(wallNorth.id);
    expect(ann.owner_id).toBe("user-1");
    expect(ann.strokes).toEqual([]);
  });

  it("insertStroke appends a Stroke to an Annotation with sequential index", async () => {
    const repo = new InMemoryCanvasRepository();
    const room = await repo.insertRoom("user-1", "Room");
    const surfaces = await repo.listSurfaces(room.id);
    const ann = await repo.insertAnnotation({
      surface_id: surfaces[0].id,
      owner_id: "user-1",
    });

    const s1 = await repo.insertStroke(ann.id, {
      points: [
        { u: 0.1, v: 0.2, p: 0.5, t: 0 },
        { u: 0.2, v: 0.3, p: 0.5, t: 16 },
      ],
      color_id: "paper",
      width_id: "fine",
      index: 0,
    });
    const s2 = await repo.insertStroke(ann.id, {
      points: [
        { u: 0.5, v: 0.5, p: 0.5, t: 0 },
      ],
      color_id: "paper",
      width_id: "fine",
      index: 1,
    });

    expect(s1.id).toBeTruthy();
    expect(s1.annotation_id).toBe(ann.id);
    expect(s1.index).toBe(0);
    expect(s2.index).toBe(1);
  });

  it("listAnnotations(roomId) returns Annotations on the Room's Surfaces with their Strokes ordered by index", async () => {
    const repo = new InMemoryCanvasRepository();
    const a = await repo.insertRoom("user-1", "A");
    const b = await repo.insertRoom("user-1", "B");
    const aSurfaces = await repo.listSurfaces(a.id);
    const bSurfaces = await repo.listSurfaces(b.id);

    const annA = await repo.insertAnnotation({
      surface_id: aSurfaces[0].id,
      owner_id: "user-1",
    });
    await repo.insertStroke(annA.id, {
      points: [{ u: 0.1, v: 0.1, p: 0.5, t: 0 }],
      color_id: "paper",
      width_id: "fine",
      index: 1,
    });
    await repo.insertStroke(annA.id, {
      points: [{ u: 0.2, v: 0.2, p: 0.5, t: 0 }],
      color_id: "paper",
      width_id: "fine",
      index: 0,
    });

    const annB = await repo.insertAnnotation({
      surface_id: bSurfaces[0].id,
      owner_id: "user-1",
    });
    await repo.insertStroke(annB.id, {
      points: [{ u: 0.3, v: 0.3, p: 0.5, t: 0 }],
      color_id: "paper",
      width_id: "fine",
      index: 0,
    });

    const inA = await repo.listAnnotations(a.id);
    expect(inA).toHaveLength(1);
    expect(inA[0].id).toBe(annA.id);
    expect(inA[0].strokes.map((s) => s.index)).toEqual([0, 1]);

    const inB = await repo.listAnnotations(b.id);
    expect(inB).toHaveLength(1);
    expect(inB[0].id).toBe(annB.id);
  });

  it("deleteStroke removes a single Stroke without touching its sibling Strokes", async () => {
    const repo = new InMemoryCanvasRepository();
    const room = await repo.insertRoom("user-1", "Room");
    const surfaces = await repo.listSurfaces(room.id);
    const ann = await repo.insertAnnotation({
      surface_id: surfaces[0].id,
      owner_id: "user-1",
    });
    const s1 = await repo.insertStroke(ann.id, {
      points: [{ u: 0.1, v: 0.1, p: 0.5, t: 0 }],
      color_id: "paper",
      width_id: "fine",
      index: 0,
    });
    const s2 = await repo.insertStroke(ann.id, {
      points: [{ u: 0.2, v: 0.2, p: 0.5, t: 0 }],
      color_id: "paper",
      width_id: "fine",
      index: 1,
    });

    await repo.deleteStroke(s1.id);

    const [annAfter] = await repo.listAnnotations(room.id);
    expect(annAfter.strokes.map((s) => s.id)).toEqual([s2.id]);
  });
});
