import type {
  CanvasRepository,
  CanvasRow,
  NewNote,
  NoteRow,
} from "./canvas-repository";

/**
 * Test double for `CanvasRepository`. Mirrors the surface the Supabase-backed
 * repo exposes so the unit under test never depends on Supabase's query
 * builder. Exposes call counters for tests that need to assert idempotency or
 * batching.
 */
export class InMemoryCanvasRepository implements CanvasRepository {
  canvases: CanvasRow[] = [];
  notes: NoteRow[] = [];
  insertCanvasCalls = 0;
  insertNoteCalls = 0;
  deleteNotesCalls = 0;
  updateNotePositionsCalls = 0;

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

  async deleteNotes(ids: readonly string[]): Promise<NoteRow[]> {
    this.deleteNotesCalls++;
    const idSet = new Set(ids);
    const deleted = this.notes.filter((n) => idSet.has(n.id));
    this.notes = this.notes.filter((n) => !idSet.has(n.id));
    return deleted;
  }

  async updateNotePositions(
    updates: ReadonlyArray<{ id: string; x: number; y: number }>,
  ): Promise<NoteRow[]> {
    this.updateNotePositionsCalls++;
    const byId = new Map(updates.map((u) => [u.id, u]));
    const now = new Date().toISOString();
    const result: NoteRow[] = [];
    this.notes = this.notes.map((n) => {
      const u = byId.get(n.id);
      if (!u) return n;
      const next = { ...n, x: u.x, y: u.y, updated_at: now };
      result.push(next);
      return next;
    });
    return result;
  }
}
