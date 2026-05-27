import { describe, it, expect, beforeEach } from "vitest";
import { ensureInitialCanvas } from "./ensure-initial-canvas";
import { InMemoryCanvasRepository } from "./in-memory-canvas-repository";

const USER_A = "user-a-uuid";
const USER_B = "user-b-uuid";

describe("ensureInitialCanvas", () => {
  let repo: InMemoryCanvasRepository;

  beforeEach(() => {
    repo = new InMemoryCanvasRepository();
  });

  it("creates an Untitled canvas and a seed note for a brand-new user", async () => {
    const { canvas, notes } = await ensureInitialCanvas(repo, USER_A);

    expect(canvas.owner_id).toBe(USER_A);
    expect(canvas.name).toBe("Untitled");
    expect(notes).toHaveLength(1);
    expect(notes[0].canvas_id).toBe(canvas.id);
    expect(notes[0].owner_id).toBe(USER_A);
    expect(notes[0].body).toMatch(/welcome/i);
  });

  it("seeds the note with mid depth and the default palette colour", async () => {
    const { notes } = await ensureInitialCanvas(repo, USER_A);
    expect(notes[0].depth).toBe("mid");
    expect(notes[0].color_id).toBe("warm-white");
  });

  it("is idempotent: a second call does not create a duplicate canvas or note", async () => {
    const first = await ensureInitialCanvas(repo, USER_A);
    const second = await ensureInitialCanvas(repo, USER_A);

    expect(repo.insertCanvasCalls).toBe(1);
    expect(repo.insertNoteCalls).toBe(1);
    expect(second.canvas.id).toBe(first.canvas.id);
    expect(second.notes).toHaveLength(1);
    expect(second.notes[0].id).toBe(first.notes[0].id);
  });

  it("scopes results to the calling user (RLS-like behaviour at the repo layer)", async () => {
    const a = await ensureInitialCanvas(repo, USER_A);
    const b = await ensureInitialCanvas(repo, USER_B);

    expect(b.canvas.id).not.toBe(a.canvas.id);
    expect(b.canvas.owner_id).toBe(USER_B);
    expect(b.notes[0].owner_id).toBe(USER_B);
    expect(repo.insertCanvasCalls).toBe(2);
    expect(repo.insertNoteCalls).toBe(2);
  });
});
