import { describe, it, expect } from "vitest";
import { InMemoryCanvasRepository } from "./in-memory-canvas-repository";

describe("CanvasRepository.deleteNotes", () => {
  it("removes all matching Notes in a single batched call and returns the deleted rows", async () => {
    const repo = new InMemoryCanvasRepository();
    const a = await repo.insertNote({
      canvas_id: "c1", owner_id: "u1", x: 0, y: 0,
      depth: "mid", width: 240, height: 160, body: "a", color_id: "warm-white",
    });
    const b = await repo.insertNote({
      canvas_id: "c1", owner_id: "u1", x: 10, y: 10,
      depth: "mid", width: 240, height: 160, body: "b", color_id: "warm-white",
    });
    const c = await repo.insertNote({
      canvas_id: "c1", owner_id: "u1", x: 20, y: 20,
      depth: "mid", width: 240, height: 160, body: "c", color_id: "warm-white",
    });

    const deleted = await repo.deleteNotes([a.id, c.id]);

    expect(repo.deleteNotesCalls).toBe(1);
    expect(deleted.map((n) => n.id).sort()).toEqual([a.id, c.id].sort());
    const remaining = await repo.listNotes("c1");
    expect(remaining.map((n) => n.id)).toEqual([b.id]);
  });
});
