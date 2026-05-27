import type { CanvasRepository } from "./canvas-repository";
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
  type Note,
  type NewNote,
} from "./room";

/**
 * Test double for `CanvasRepository`. Mirrors the surface the Supabase
 * repo exposes so units never depend on Supabase's query builder.
 * Exposes call counters for tests that need to assert idempotency.
 */
export class InMemoryCanvasRepository implements CanvasRepository {
  rooms: Room[] = [];
  surfaces: Surface[] = [];
  notes: Note[] = [];
  insertRoomCalls = 0;
  insertNoteCalls = 0;

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

  async listNotes(roomId: string): Promise<Note[]> {
    const surfaceIds = new Set(
      this.surfaces.filter((s) => s.room_id === roomId).map((s) => s.id),
    );
    return this.notes
      .filter((n) => surfaceIds.has(n.surface_id))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async insertNote(note: NewNote): Promise<Note> {
    this.insertNoteCalls++;
    const now = new Date().toISOString();
    const row: Note = {
      id: `note-${this.notes.length + 1}`,
      ...note,
      created_at: now,
      updated_at: now,
    };
    this.notes.push(row);
    return row;
  }

  async updateNotePin(
    id: string,
    pin: { surface_id: string; u: number; v: number },
  ): Promise<Note> {
    let updated: Note | null = null;
    this.notes = this.notes.map((n) => {
      if (n.id !== id) return n;
      updated = { ...n, ...pin, updated_at: new Date().toISOString() };
      return updated;
    });
    if (!updated) throw new Error(`updateNotePin: no Note with id ${id}`);
    return updated;
  }

  async updateNoteBody(id: string, body: string): Promise<Note> {
    let updated: Note | null = null;
    this.notes = this.notes.map((n) => {
      if (n.id !== id) return n;
      updated = { ...n, body, updated_at: new Date().toISOString() };
      return updated;
    });
    if (!updated) throw new Error(`updateNoteBody: no Note with id ${id}`);
    return updated;
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
}
