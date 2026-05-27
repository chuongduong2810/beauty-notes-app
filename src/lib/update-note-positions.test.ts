import { describe, it, expect } from "vitest";
import { InMemoryCanvasRepository } from "./in-memory-canvas-repository";

describe("CanvasRepository.updateNotePositions", () => {
  it("commits every position update in a single batched call and returns the updated rows", async () => {
    const repo = new InMemoryCanvasRepository();
    const seed = await Promise.all([
      repo.insertNote({
        canvas_id: "c1", owner_id: "u1", x: 0, y: 0,
        depth: "mid", width: 240, height: 160, body: "a", color_id: "warm-white",
      }),
      repo.insertNote({
        canvas_id: "c1", owner_id: "u1", x: 10, y: 10,
        depth: "mid", width: 240, height: 160, body: "b", color_id: "warm-white",
      }),
      repo.insertNote({
        canvas_id: "c1", owner_id: "u1", x: 20, y: 20,
        depth: "mid", width: 240, height: 160, body: "c", color_id: "warm-white",
      }),
    ]);

    const updated = await repo.updateNotePositions([
      { id: seed[0].id, x: 100, y: 200 },
      { id: seed[2].id, x: -5, y: -5 },
    ]);

    expect(repo.updateNotePositionsCalls).toBe(1);
    const byId = new Map(updated.map((n) => [n.id, n]));
    expect(byId.get(seed[0].id)).toMatchObject({ x: 100, y: 200 });
    expect(byId.get(seed[2].id)).toMatchObject({ x: -5, y: -5 });

    // Untouched row stays untouched.
    const stillThere = await repo.listNotes("c1");
    expect(stillThere.find((n) => n.id === seed[1].id)).toMatchObject({ x: 10, y: 10 });
  });
});
