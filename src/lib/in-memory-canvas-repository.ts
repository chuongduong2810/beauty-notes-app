import type {
  CanvasRepository,
  CanvasRow,
  NewNote,
  NoteRow,
} from "./canvas-repository";
import {
  defaultSurfaces,
  DEFAULT_ROOM_WIDTH_M,
  DEFAULT_ROOM_DEPTH_M,
  DEFAULT_ROOM_HEIGHT_M,
  DEFAULT_CAMERA_YAW,
  DEFAULT_CAMERA_PITCH,
  DEFAULT_CAMERA_DISTANCE,
  type Room,
  type Surface,
} from "./room";

/**
 * Test double for `CanvasRepository`. Mirrors the surface the Supabase-backed
 * repo exposes so the unit under test never depends on Supabase's query
 * builder. Exposes call counters for tests that need to assert idempotency or
 * batching.
 */
export class InMemoryCanvasRepository implements CanvasRepository {
  canvases: CanvasRow[] = [];
  notes: NoteRow[] = [];
  rooms: Room[] = [];
  surfaces: Surface[] = [];
  insertCanvasCalls = 0;
  insertNoteCalls = 0;
  deleteNotesCalls = 0;
  updateNotePositionsCalls = 0;
  insertRoomCalls = 0;

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

  async insertRoom(owner_id: string, name: string): Promise<Room> {
    this.insertRoomCalls++;
    const now = new Date().toISOString();
    const room: Room = {
      id: `room-${this.rooms.length + 1}`,
      owner_id,
      name,
      width_m: DEFAULT_ROOM_WIDTH_M,
      depth_m: DEFAULT_ROOM_DEPTH_M,
      height_m: DEFAULT_ROOM_HEIGHT_M,
      camera_yaw: DEFAULT_CAMERA_YAW,
      camera_pitch: DEFAULT_CAMERA_PITCH,
      camera_distance: DEFAULT_CAMERA_DISTANCE,
      created_at: now,
      updated_at: now,
    };
    this.rooms.push(room);
    for (const s of defaultSurfaces()) {
      this.surfaces.push({
        id: `surface-${this.surfaces.length + 1}`,
        room_id: room.id,
        owner_id,
        kind: s.kind,
        color_id: s.color_id,
      });
    }
    return room;
  }

  async listRooms(userId: string): Promise<Room[]> {
    return this.rooms
      .filter((r) => r.owner_id === userId)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  async listSurfaces(roomId: string): Promise<Surface[]> {
    return this.surfaces.filter((s) => s.room_id === roomId);
  }

  async updateRoomCamera(
    id: string,
    pose: { yaw: number; pitch: number; distance: number },
  ): Promise<Room> {
    let updated: Room | null = null;
    this.rooms = this.rooms.map((r) => {
      if (r.id !== id) return r;
      updated = {
        ...r,
        camera_yaw: pose.yaw,
        camera_pitch: pose.pitch,
        camera_distance: pose.distance,
        updated_at: new Date().toISOString(),
      };
      return updated;
    });
    if (!updated) throw new Error(`updateRoomCamera: no Room with id ${id}`);
    return updated;
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
