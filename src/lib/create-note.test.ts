import { describe, it, expect } from "vitest";
import { createNoteAt } from "./create-note";
import { InMemoryCanvasRepository } from "./in-memory-canvas-repository";

const CANVAS = "canvas-1";
const OWNER = "user-1";

describe("createNoteAt", () => {
  it("inserts a Note at the given world coordinates with PRD defaults", async () => {
    const repo = new InMemoryCanvasRepository();
    const note = await createNoteAt(repo, {
      canvasId: CANVAS,
      ownerId: OWNER,
      x: 123,
      y: -45,
    });

    expect(note.canvas_id).toBe(CANVAS);
    expect(note.owner_id).toBe(OWNER);
    expect(note.x).toBe(123);
    expect(note.y).toBe(-45);
    expect(note.depth).toBe("mid");
    expect(note.body).toBe("");
    expect(note.color_id).toBe("warm-white");
    expect(note.width).toBeGreaterThan(0);
    expect(note.height).toBeGreaterThan(0);
  });
});
