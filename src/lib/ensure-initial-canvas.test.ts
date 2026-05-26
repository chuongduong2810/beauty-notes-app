import { describe, it, expect, beforeEach } from "vitest";
import { ensureInitialCanvas } from "./ensure-initial-canvas";
import type { CanvasRepository, CanvasRow, NoteRow, NewNote } from "./canvas-repository";

/**
 * In-memory CanvasRepository used to test ensureInitialCanvas in isolation
 * from Supabase. Mirrors the surface the real (Supabase-backed) repo will
 * expose so the unit under test stays at the right level of abstraction.
 */
class InMemoryRepo implements CanvasRepository {
  canvases: CanvasRow[] = [];
  notes: NoteRow[] = [];
  insertCanvasCalls = 0;
  insertNoteCalls = 0;

  async listCanvases(userId: string): Promise<CanvasRow[]> {
    return this.canvases
      .filter((c) => c.owner_id === userId)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  async insertCanvas(owner_id: string, name: string): Promise<CanvasRow> {
    this.insertCanvasCalls++;
    const row: CanvasRow = {
      id: `canvas-${this.canvases.length + 1}`,
      owner_id,
      name,
      camera_x: 0,
      camera_y: 0,
      camera_z: 0,
      camera_zoom: 1,
      camera_focused_depth: "mid",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.canvases.push(row);
    return row;
  }

  async listNotes(canvas_id: string): Promise<NoteRow[]> {
    return this.notes.filter((n) => n.canvas_id === canvas_id);
  }

  async insertNote(note: NewNote): Promise<NoteRow> {
    this.insertNoteCalls++;
    const row: NoteRow = {
      id: `note-${this.notes.length + 1}`,
      ...note,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.notes.push(row);
    return row;
  }
}

const USER_A = "user-a-uuid";
const USER_B = "user-b-uuid";

describe("ensureInitialCanvas", () => {
  let repo: InMemoryRepo;

  beforeEach(() => {
    repo = new InMemoryRepo();
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
